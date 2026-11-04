// Fitted clothes shaped from the mannequin's own body mesh.
// Each garment selects a region of the body, pushes it out by a fabric allowance, smooths away anatomy,
// cuts clean hems along planes, and keeps a 1:1 link to body vertices so it follows every pose.
// Extra parts (hood, brim, laces, strings, collars) take their skin from the nearest body vertex.

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const plane = (p0, n) => ({ p0, n: norm(n) });
const sd = (pl, p) => dot(sub(p, pl.p0), pl.n); // > 0 = outside (cut away)

export function buildGarments(ctx) {
  const { THREE, P, N, quads, uvFaces, W, skinFor, makeSkinnedGeometry, jointWorld, nb } = ctx;
  const J = (n) => jointWorld(n);
  const out = [];

  const boneW = (li, test) => { let s = 0, t = 0; W[li].forEach((w, b) => { t += w; if (test(b)) s += w; }); return t ? s / t : 0; };
  const isArm = (b) => /^(upperarm|lowerarm|wrist|finger|metacarpal)/.test(b);
  const isLowerArm = (b) => /^(lowerarm|wrist|finger|metacarpal)/.test(b);
  const isHand = (b) => /^(wrist|finger|metacarpal)/.test(b);
  const isHead = (b) => b === 'head';
  const isFoot = (b) => /^foot/.test(b);
  const isLeg = (b) => /^(upperleg|lowerleg|foot|pelvis)/.test(b);

  /* ---------- spatial lookup for nearest body vertex (skin for extra parts) ---------- */
  const cell = 0.03, grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  P.forEach((p, i) => { const k = key(...p); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const nearest = (p, filter) => {
    let best = -1, bd = Infinity;
    for (let r = 1; r <= 4 && best < 0; r++) {
      const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
      for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) {
        const ids = grid.get(`${x},${y},${z}`); if (!ids) continue;
        for (const i of ids) { if (filter && !filter(i)) continue; const d = len(sub(P[i], p)); if (d < bd) { bd = d; best = i; } }
      }
    }
    return best < 0 ? 0 : best;
  };

  /* ---------- normals ---------- */
  function normalsFor(points, faces) {
    const Nn = new Map();
    for (const q of faces) {
      const tris = q.length === 4 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [q];
      for (const [a, b, c] of tris) {
        const n = cross(sub(points[b], points[a]), sub(points[c], points[a]));
        for (const i of [a, b, c]) { const v = Nn.get(i) || [0, 0, 0]; Nn.set(i, add(v, n)); }
      }
    }
    let res = []; Nn.forEach((v, i) => { res[i] = norm(v); });
    // average with neighbours: collapsed points (tiny faces) otherwise get random normals and show as dots
    const adj = new Map();
    for (const q of faces) q.forEach((a, i) => { const b = q[(i + 1) % q.length]; (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); });
    for (let it = 0; it < 2; it++) {
      const next = [];
      adj.forEach((ns, i) => { let a = [...res[i]]; ns.forEach((j) => { a = add(a, res[j]); }); next[i] = norm(a); });
      res = next;
    }
    return res;
  }

  /* ---------- a smoothed copy of the body: clothes are shaped from this, so anatomy never shows ---------- */
  const PS = P.map((p) => [...p]);
  {
    const tmp = PS.map((p) => [...p]);
    // long volume-keeping smoothing: melts small anatomy (chest, navel, knees) without shrinking the body
    const passes = Array(320).fill([0.5, -0.53]).flat();
    for (const lam of passes) {
      for (let i = 0; i < PS.length; i++) {
        let x = 0, y = 0, z = 0; for (const j of nb[i]) { x += PS[j][0]; y += PS[j][1]; z += PS[j][2]; }
        const k = nb[i].length; tmp[i][0] = PS[i][0] + lam * (x / k - PS[i][0]); tmp[i][1] = PS[i][1] + lam * (y / k - PS[i][1]); tmp[i][2] = PS[i][2] + lam * (z / k - PS[i][2]);
      }
      for (let i = 0; i < PS.length; i++) { PS[i][0] = tmp[i][0]; PS[i][1] = tmp[i][1]; PS[i][2] = tmp[i][2]; }
    }
  }
  // the uniform smoothing bulges at irregular points (3 or 5 neighbours, e.g. the nipple clusters): relax them
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < PS.length; i++) {
      if (nb[i].length === 4) continue;
      let x = 0, y = 0, z = 0; for (const j of nb[i]) { x += PS[j][0]; y += PS[j][1]; z += PS[j][2]; }
      const k = nb[i].length; PS[i] = [x / k, y / k, z / k];
      // and their direct neighbours a little
      for (const j of nb[i]) { if (nb[j].length !== 4) continue; let a = [0, 0, 0]; for (const m of nb[j]) a = add(a, PS[m]); PS[j] = lerp3(PS[j], mul(a, 1 / nb[j].length), 0.5); }
    }
  }
  const NS = (() => {
    const acc = PS.map(() => [0, 0, 0]);
    for (const q of quads) {
      const tris = q.length === 4 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [q];
      for (const [a, b, c] of tris) { const n = cross(sub(PS[b], PS[a]), sub(PS[c], PS[a])); for (const i of [a, b, c]) acc[i] = add(acc[i], n); }
    }
    let n = acc.map(norm);
    for (let it = 0; it < 4; it++) n = n.map((v, i) => { let a = [...v]; for (const j of nb[i]) a = add(a, n[j]); return norm(a); });
    return n;
  })();

  /* ---------- the shell builder ---------- */
  function shell({ inside, offset, cuts, smoothIters = 20, minOffset = 0.003, smoothFactor, drape = 0, tension = 0, post }) {
    // Keep faces that touch the inside; points that poke past a cut get snapped onto it later,
    // which gives hems that follow the cut exactly instead of the mesh's zigzag rows.
    const over = (li) => { let m = 0; for (const c of cuts) if (c.applies(li)) m = Math.max(m, sd(c.pl, P[li])); return m; };
    const insideV = (li) => inside(li) && over(li) <= 0;
    const faces = [], uvF = [];
    quads.forEach((q, fi) => {
      if (!q.some(insideV) || !q.every(inside)) return;
      if (q.some((li) => over(li) > 0.035)) return; // a face reaching far past the cut stays out
      faces.push(q); uvF.push(uvFaces[fi]);
    });
    const verts = new Set(faces.flat());
    // start from the smoothed body, then make sure the fabric clears the real body by the allowance
    const G = [], ease = [];
    for (const li of verts) {
      const o = offset(li); ease[li] = o;
      let g = add(PS[li], mul(NS[li], o));
      const d = dot(sub(g, P[li]), N[li]);
      const clear = Math.min(0.008, o * 0.5);
      if (d < clear) g = add(g, mul(N[li], clear - d));
      G[li] = g;
    }
    const nbr = new Map([...verts].map((li) => [li, new Set()]));
    const edgeCount = new Map();
    faces.forEach((q) => q.forEach((a, i) => {
      const b = q[(i + 1) % q.length];
      nbr.get(a).add(b); nbr.get(b).add(a);
      const k = a < b ? a * 1e6 + b : b * 1e6 + a; edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }));
    const boundary = new Set();
    edgeCount.forEach((c, k) => { if (c === 1) { boundary.add(Math.floor(k / 1e6)); boundary.add(k % 1e6); } });
    const list = [...verts];
    // smooth interior (Taubin), boundary held still
    const tmp = [];
    for (let it = 0; it < smoothIters; it++) {
      for (const lam of [0.5, -0.53]) {
        for (const i of list) {
          if (boundary.has(i)) { tmp[i] = G[i]; continue; }
          const f = smoothFactor ? smoothFactor(i) : 1;
          let s = [0, 0, 0]; const n = nbr.get(i); n.forEach((j) => { s = add(s, G[j]); });
          s = mul(s, 1 / n.size);
          tmp[i] = add(G[i], mul(sub(s, G[i]), lam * f));
        }
        for (const i of list) G[i] = tmp[i];
      }
    }
    // drape: fabric bridges hollows (moves outward freely, inward only a little), like cloth over a body.
    // Open edges smooth along themselves, so a hem bridges a crease instead of dipping into it.
    const edgeNbr = new Map();
    for (const i of boundary) edgeNbr.set(i, new Set([...nbr.get(i)].filter((j) => boundary.has(j))));
    for (let it = 0; it < drape; it++) {
      for (const i of list) {
        let s = [0, 0, 0]; const n = boundary.has(i) ? edgeNbr.get(i) : nbr.get(i);
        if (!n.size) { tmp[i] = G[i]; continue; }
        n.forEach((j) => { s = add(s, G[j]); });
        const Lp = sub(mul(s, 1 / n.size), G[i]);
        const f = smoothFactor ? smoothFactor(i) : 1;
        tmp[i] = add(G[i], mul(Lp, (dot(Lp, N[i]) > 0 ? 0.5 : 0.22) * f));
      }
      for (const i of list) G[i] = tmp[i];
      if (it % 10 === 9) for (const i of list) { const d = dot(sub(G[i], PS[i]), NS[i]); const want = ease[i] * 0.72; if (d < want) G[i] = add(G[i], mul(NS[i], want - d)); }
    }
    // fabric keeps most of its ease over the smoothed body (it can't collapse onto the chest)
    const keepEase = () => { for (const i of list) { const d = dot(sub(G[i], PS[i]), NS[i]); const want = ease[i] * 0.72; if (d < want) G[i] = add(G[i], mul(NS[i], want - d)); } };
    keepEase();
    // settle: volume-keeping smoothing after the drape removes the jitter it leaves behind
    for (let it = 0; it < 45; it++) {
      for (const lam of [0.5, -0.53]) {
        for (const i of list) {
          const n = boundary.has(i) ? edgeNbr.get(i) : nbr.get(i);
          if (!n.size) { tmp[i] = G[i]; continue; }
          let s = [0, 0, 0]; n.forEach((j) => { s = add(s, G[j]); });
          tmp[i] = add(G[i], mul(sub(mul(s, 1 / n.size), G[i]), lam));
        }
        for (const i of list) G[i] = tmp[i];
      }
    }
    keepEase();
    // tension: fabric pulled smooth over small bumps (chest, navel, folds), never sinking into the body
    for (let it = 0; it < tension; it++) {
      for (const i of list) {
        const n = boundary.has(i) ? edgeNbr.get(i) : nbr.get(i);
        if (!n.size) { tmp[i] = G[i]; continue; }
        let s = [0, 0, 0]; n.forEach((j) => { s = add(s, G[j]); });
        tmp[i] = add(G[i], mul(sub(mul(s, 1 / n.size), G[i]), 0.35));
      }
      for (const i of list) {
        const d = dot(sub(tmp[i], P[i]), N[i]);
        G[i] = d < minOffset + 0.004 ? add(tmp[i], mul(N[i], minOffset + 0.004 - d)) : tmp[i];
      }
    }
    // irregular points (3 or 5 neighbours, e.g. the nipple and navel clusters) keep a small pimple: relax them into their ring
    for (let it = 0; it < 6; it++) for (const i of list) {
      const n = nbr.get(i);
      if (boundary.has(i) || n.size === 4) continue;
      let s = [0, 0, 0]; n.forEach((j) => { s = add(s, G[j]); });
      G[i] = lerp3(G[i], mul(s, 1 / n.size), 0.8);
    }
    // never inside the body
    for (const i of list) {
      const d = dot(sub(G[i], P[i]), N[i]);
      if (d < minOffset) G[i] = add(G[i], mul(N[i], minOffset - d));
    }
    if (post) for (const i of list) G[i] = post(i, G[i]);
    // clean hems: anything past a cut is snapped onto it; open edges land exactly on their nearest cut
    for (const i of list) {
      for (const c of cuts) { if (!c.applies(i)) continue; const d = sd(c.pl, G[i]); if (d > 0) G[i] = sub(G[i], mul(c.pl.n, d)); }
    }
    for (const i of boundary) {
      let best = null, bd = Infinity;
      for (const c of cuts) { if (!c.applies(i)) continue; const d = Math.abs(sd(c.pl, G[i])); if (d < bd) { bd = d; best = c; } }
      if (best && bd < 0.05) G[i] = sub(G[i], mul(best.pl.n, sd(best.pl, G[i])));
    }
    // final local clean-up around irregular mesh points (nipple and navel clusters): plain smoothing within ~3 cm
    {
      const irregular = list.filter((i) => !boundary.has(i) && nb[i].length !== 4);
      const zone = new Map();
      for (const c of irregular) for (const i of list) { if (boundary.has(i)) continue; const d = len(sub(P[i], P[c])); if (d < 0.05) zone.set(i, Math.max(zone.get(i) || 0, Math.min(1, 1.4 * (1 - d / 0.05)))); }
      for (let it = 0; it < 30; it++) {
        const next = new Map();
        zone.forEach((w, i) => { let a = [0, 0, 0]; const n = nbr.get(i); n.forEach((j) => { a = add(a, G[j]); }); next.set(i, lerp3(G[i], mul(a, 1 / n.size), 0.6 * w)); });
        next.forEach((g, i) => { G[i] = g; });
      }
    }
    // boundary edges in face order (for hem bands)
    const bEdges = [];
    faces.forEach((q, fi) => q.forEach((a, i) => {
      const b = q[(i + 1) % q.length];
      const k = a < b ? a * 1e6 + b : b * 1e6 + a;
      if (edgeCount.get(k) === 1) bEdges.push({ a, b, ta: uvF[fi][i], tb: uvF[fi][(i + 1) % q.length] });
    }));
    return { faces, uvF, G, verts, boundary, bEdges, nbr };
  }

  /* ---------- turn a shell (or a part of it) into a skinned geometry, with a turned-in hem edge ---------- */
  function emit(name, sh, { faceFilter, hem = 0.004, pull, shade } = {}) {
    // drop only faces the hem snapping squashed flat (tiny compared with the body face they came from)
    const area = (pts, q) => len(cross(sub(pts[q[1]], pts[q[0]]), sub(pts[q[2]], pts[q[0]])));
    const squashed = (q) => area(sh.G, q) < area(P, q) * 0.04;
    const idx = sh.faces.map((q, i) => ((!faceFilter || faceFilter(q)) && !squashed(q) ? i : -1)).filter((i) => i >= 0);
    const faces = idx.map((i) => sh.faces[i]);
    const uvF = idx.map((i) => sh.uvF[i]);
    const points = sh.G.slice();
    if (pull) for (const q of faces) for (const li of q) { const k = pull(li); if (k) points[li] = lerp3(P[li], sh.G[li], 1 - k); }
    let normals = normalsFor(points, faces);
    const extraSrc = [];
    if (hem) {
      // boundary edges of this part
      const ec = new Map();
      faces.forEach((q) => q.forEach((a, i) => { const b = q[(i + 1) % q.length]; const k = a < b ? a * 1e6 + b : b * 1e6 + a; ec.set(k, (ec.get(k) || 0) + 1); }));
      const dup = new Map();
      const dupOf = (li) => {
        if (dup.has(li)) return dup.get(li);
        const n = points.length; points[n] = sub(points[li], mul(normals[li], hem)); extraSrc[n] = li; dup.set(li, n); return n;
      };
      faces.slice().forEach((q, fi) => q.forEach((a, i) => {
        const b = q[(i + 1) % q.length];
        const k = a < b ? a * 1e6 + b : b * 1e6 + a;
        if (ec.get(k) !== 1) return;
        const t = uvF[fi];
        faces.push([b, a, dupOf(a), dupOf(b)]);
        uvF.push([t[(i + 1) % q.length], t[i], t[i], t[(i + 1) % q.length]]);
      }));
      normals = normalsFor(points, faces);
    }
    const skin = (li) => skinFor(extraSrc[li] ?? li);
    const shadeFn = (li) => (extraSrc[li] !== undefined ? (shade ? shade(extraSrc[li], true) : 0.78) : shade ? shade(li) : 1);
    const geometry = makeSkinnedGeometry({ faces, points, normals, uvFaces: uvF, uvs: ctx.uvs, skin, shade: shadeFn });
    out.push({ name, geometry });
    return { faces, points };
  }

  /* ---------- raw parts (tubes, plates) skinned from the nearest body vertex ---------- */
  function emitRaw(name, pts, tris, uv, filter, colors) {
    const pos = [], nor = [], uvs = [], si = [], sw = [], index = [];
    const nrm = new Array(pts.length).fill(0).map(() => [0, 0, 0]);
    for (const [a, b, c] of tris) { const n = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a])); for (const i of [a, b, c]) nrm[i] = add(nrm[i], n); }
    pts.forEach((p, i) => {
      pos.push(...p); nor.push(...norm(nrm[i])); uvs.push(...(uv?.[i] || [0, 0]));
      const s = skinFor(nearest(p, filter));
      si.push(...s.idx); const w = s.wt.map((x) => Math.round(x * 255)); w[0] += 255 - (w[0] + w[1] + w[2] + w[3]); sw.push(...w);
    });
    tris.forEach((t) => index.push(...t));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(si), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(sw), 4, true));
    const col = colors ? new Uint8Array(colors.flat().map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255))) : new Uint8Array(pts.length * 3).fill(255);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setIndex(new THREE.Uint16BufferAttribute(index, 1));
    out.push({ name, geometry: g });
  }

  // tube along a polyline; radius may vary along it
  function tube(path, radius, seg = 10, capEnds = true) {
    const pts = [], tris = [], uv = [];
    let prevN = null;
    path.forEach((p, i) => {
      const t = norm(sub(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)]));
      let n = prevN ? norm(sub(prevN, mul(t, dot(prevN, t)))) : norm(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      prevN = n;
      const b = cross(t, n);
      const r = typeof radius === 'function' ? radius(i / (path.length - 1)) : radius;
      for (let s = 0; s < seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        pts.push(add(p, add(mul(n, Math.cos(a) * r), mul(b, Math.sin(a) * r))));
        uv.push([s / seg, i / path.length]);
      }
    });
    for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < seg; s++) {
      const a = i * seg + s, b = i * seg + ((s + 1) % seg), c = (i + 1) * seg + s, d = (i + 1) * seg + ((s + 1) % seg);
      tris.push([a, c, b], [b, c, d]);
    }
    if (capEnds) {
      for (const [ring, flip] of [[0, true], [path.length - 1, false]]) {
        const ci = pts.length; pts.push(path[ring]); uv.push([0.5, 0.5]);
        for (let s = 0; s < seg; s++) { const a = ring * seg + s, b = ring * seg + ((s + 1) % seg); tris.push(flip ? [ci, b, a] : [ci, a, b]); }
      }
    }
    return { pts, tris, uv };
  }
  const merge = (...parts) => {
    const pts = [], tris = [], uv = [];
    for (const p of parts) { const o = pts.length; pts.push(...p.pts); uv.push(...p.uv); p.tris.forEach((t) => tris.push(t.map((i) => i + o))); }
    return { pts, tris, uv };
  };

  // ordered loop(s) from boundary edges, keeping only edges whose points pass `test`
  function loopsFrom(bEdges, G, test) {
    const next = new Map();
    bEdges.forEach(({ a, b }) => { if (test(G[a]) && test(G[b])) next.set(a, b); });
    const seen = new Set(), loops = [];
    for (const s of next.keys()) {
      if (seen.has(s)) continue;
      const loop = []; let c = s;
      while (c !== undefined && !seen.has(c)) { seen.add(c); loop.push(c); c = next.get(c); }
      if (loop.length > 4) loops.push(loop);
    }
    return loops;
  }

  // A soft rectangular (or trapezoid) patch laid onto a garment: grid on the surface, puffed out, with side walls.
  function patch(sh, { center, u, v, w, h, taper = 0, lift = 0.004, puff = 0.004, wall = 0.005, nu = 14, nv = 10, filter }) {
    const ids = [...sh.verts].filter((i) => !filter || filter(i));
    const near = (p) => { let b = ids[0], bd = Infinity; for (const i of ids) { const d = len(sub(sh.G[i], p)); if (d < bd) { bd = d; b = i; } } return b; };
    const pts = [], tris = [], uv = [];
    const grid = [];
    for (let j = 0; j <= nv; j++) {
      const row = [];
      for (let i = 0; i <= nu; i++) {
        const a = i / nu - 0.5, b = j / nv - 0.5;
        const ww = w * (1 - taper * (b + 0.5));
        const target = add(center, add(mul(u, a * ww), mul(v, b * h)));
        const k = near(target);
        const n = N[k];
        const bump = Math.sin(Math.PI * (a + 0.5)) * Math.sin(Math.PI * (b + 0.5));
        const sp = sub(target, mul(n, dot(sub(target, sh.G[k]), n))); // onto the surface's tangent plane
        row.push(pts.length); pts.push(add(sp, mul(n, lift + puff * bump))); uv.push([i / nu, j / nv]);
      }
      grid.push(row);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i], d = grid[j + 1][i + 1];
      tris.push([a, b, d], [a, d, c]);
    }
    // side walls down to the garment
    const ring = [...grid[0], ...grid.slice(1, -1).map((r) => r[nu]), ...grid[nv].slice().reverse(), ...grid.slice(1, -1).reverse().map((r) => r[0])];
    const base = ring.map((ri) => { const p = pts[ri]; const k = near(p); const n = N[k]; const q = sub(p, mul(n, wall)); const idx = pts.length; pts.push(q); uv.push(uv[ri]); return idx; });
    for (let t = 0; t < ring.length; t++) {
      const a = ring[t], b = ring[(t + 1) % ring.length], c = base[t], d = base[(t + 1) % ring.length];
      tris.push([a, c, b], [b, c, d]);
    }
    return { pts, tris, uv };
  }

  /* ======================= landmarks ======================= */
  const root = J('root'), neck = J('neck01'), headJ = J('head');
  const side = (s) => ({
    ua: J(`upperarm01.${s}`), la: J(`lowerarm01.${s}`), wr: J(`wrist.${s}`),
    ul: J(`upperleg01.${s}`), ll: J(`lowerleg01.${s}`), ft: J(`foot.${s}`),
  });
  const L = side('L'), R = side('R');
  const armOf = (li) => (P[li][0] >= 0 ? L : R);
  const hipY = root[1];

  /* ======================= HOODIE ======================= */
  {
    const neckline = plane([0, neck[1] - 0.018, neck[2]], [0, 1, 0.72]);
    const hem = plane([0, hipY - 0.035, 0], [0, -1, 0]);
    const wristCut = (S) => plane(lerp3(S.la, S.wr, 0.9), sub(S.wr, S.la));
    const cuts = [
      { pl: neckline, applies: (li) => boneW(li, isArm) < 0.5 },
      { pl: hem, applies: () => true },
      { pl: wristCut(L), applies: (li) => P[li][0] > 0.05 && boneW(li, isLowerArm) > 0.3 },
      { pl: wristCut(R), applies: (li) => P[li][0] < -0.05 && boneW(li, isLowerArm) > 0.3 },
    ];
    const offset = (li) => {
      const p = P[li];
      const arm = boneW(li, isArm);
      // roomier sleeves toward the cuff, a relaxed body, slight blouse above the rib
      const S = armOf(li);
      const along = clamp01(dot(sub(p, S.ua), norm(sub(S.wr, S.ua))) / len(sub(S.wr, S.ua)));
      let o = arm > 0.5 ? 0.017 + 0.012 * along : 0.028;
      o += 0.004 * smooth(hipY + 0.1, hipY, p[1]) * (1 - arm);
      // soft horizontal folds on the lower sleeve
      if (arm > 0.5 && along > 0.55) o += 0.004 * Math.max(0, Math.sin(along * 52)) * smooth(0.55, 0.75, along);
      return o;
    };
    // rib zones: the hem band and the cuffs gather in and carry fine vertical ridges
    const cuffFrame = (S) => { const ax = norm(sub(S.wr, S.la)); const r0 = norm(cross(ax, [0, 1, 0])); return { ax, r0, b0: cross(ax, r0) }; };
    const CF = { L: cuffFrame(L), R: cuffFrame(R) };
    const ribInfo = (li, g) => {
      const dh = Math.abs(sd(hem, g)) / 0.05;
      const isL = P[li][0] >= 0; const S = isL ? L : R;
      const wc = wristCut(S);
      const dc = boneW(li, isLowerArm) > 0.3 ? Math.abs(sd(wc, g)) / 0.06 : 9;
      if (dh < 1 && dh <= dc) return { k: 1 - dh, theta: Math.atan2(g[0], g[2] - 0.02), n: 110 };
      if (dc < 1) { const f = CF[isL ? 'L' : 'R']; const v = sub(g, S.wr); return { k: 1 - dc, theta: Math.atan2(dot(v, f.b0), dot(v, f.r0)), n: 34 }; }
      return null;
    };
    const sh = shell({
      inside: (li) => boneW(li, isHead) < 0.3 && boneW(li, isHand) < 0.6 && boneW(li, (b) => /^(upperleg|lowerleg|foot)/.test(b)) < 0.5,
      offset, cuts, smoothIters: 40, drape: 260,
      post: (li, g) => {
        const r = ribInfo(li, g); if (!r) return g;
        const gather = 0.38 * r.k * r.k;
        const base = lerp3(P[li], g, 1 - gather);
        return add(base, mul(N[li], 0.0016 * Math.sin(r.theta * r.n) * Math.min(1, r.k * 4)));
      },
    });
    emit('Hoodie', sh, { hem: 0.004, shade: (li) => (sh.G[li] && ribInfo(li, sh.G[li]) ? 0.86 : 1) });

    // kangaroo pocket: a soft trapezoid patch on the front belly
    {
      const c = [0, hipY + 0.075, 0.3];
      const k = nearest(c, (i) => sh.G[i] && N[i][2] > 0.6 && Math.abs(P[i][0]) < 0.02);
      const center = sh.G[k] || add(P[k], mul(N[k], 0.03));
      const kp = patch(sh, { center, u: [1, 0, 0], v: [0, 1, 0], w: 0.25, h: 0.135, taper: 0.28, lift: 0.003, puff: 0.006, filter: (i) => N[i][2] > 0.2 });
      emitRaw('HoodiePocket', kp.pts, kp.tris, kp.uv, (i) => N[i][2] > 0.2);
    }

    // hood, worn down: a soft roll lying around the back of the neck
    const loops = loopsFrom(sh.bEdges, sh.G, (p) => p[1] > neck[1] - 0.12 && Math.abs(p[0]) < 0.14);
    const ring = loops.sort((a, b) => b.length - a.length)[0] || [];
    if (ring.length > 6) {
      // order the ring from front-left, round the back, to front-right
      const pts = ring.map((i) => sh.G[i]);
      const ang = pts.map((p) => Math.atan2(p[0], -(p[2] - neck[2])));
      const order = pts.map((p, i) => i).sort((a, b) => ang[a] - ang[b]);
      const path = order.map((i) => pts[i]).filter((p, i, a) => i === 0 || len(sub(p, a[i - 1])) > 0.006);
      const hoodPath = path.map((p) => {
        const a = Math.atan2(p[0], -(p[2] - neck[2]));
        const back = Math.cos(a) > 0 ? Math.pow(Math.cos(a), 1.2) : 0;
        const out = norm([p[0], 0, p[2] - neck[2]]);
        return add(p, add(mul(out, 0.006 + 0.016 * back), [0, -0.016 - 0.045 * back, 0]));
      });
      const rad = (t) => { const a = (t - 0.5) * 2; const back = 1 - Math.abs(a); return 0.01 + 0.022 * Math.pow(back, 1.2); };
      const hood = tube(hoodPath, rad, 14);
      emitRaw('HoodieHood', hood.pts, hood.tris, hood.uv, (i) => boneW(i, isArm) < 0.3);

      // drawstrings from the front of the neckline
      const strings = [];
      for (const s of [1, -1]) {
        const start = [0.032 * s, neck[1] - 0.075, 0];
        const pathS = [];
        for (let k = 0; k <= 12; k++) {
          const y = start[1] - k * 0.016;
          const ni = nearest([0.034 * s, y, root[2] + 0.2], (i) => N[i][2] > 0.5 && Math.abs(P[i][0] - 0.034 * s) < 0.03);
          const surf = sh.G[ni] || add(P[ni], mul(N[ni], 0.02));
          pathS.push(add([0.034 * s, y, surf[2]], [0, 0, 0.007]));
        }
        strings.push(tube(pathS, (t) => (t > 0.9 ? 0.0034 : 0.0024), 8));
      }
      const st = merge(...strings);
      emitRaw('HoodieStrings', st.pts, st.tris, st.uv, (i) => N[i][2] > 0.3);
    }
  }

  /* ======================= TEE ======================= */
  {
    const neckline = plane([0, neck[1] - 0.012, neck[2]], [0, 1, 0.62]);
    const hem = plane([0, hipY - 0.07, 0], [0, -1, 0]);
    const sleeve = (S) => plane(lerp3(S.ua, S.la, 0.5), sub(S.la, S.ua));
    const cuts = [
      { pl: neckline, applies: (li) => boneW(li, isArm) < 0.5 },
      { pl: hem, applies: () => true },
      { pl: sleeve(L), applies: (li) => P[li][0] > 0.12 && boneW(li, isArm) > 0.35 },
      { pl: sleeve(R), applies: (li) => P[li][0] < -0.12 && boneW(li, isArm) > 0.35 },
    ];
    const offset = (li) => {
      const arm = boneW(li, isArm) > 0.5;
      let o = arm ? 0.02 : 0.021;
      o += 0.008 * smooth(hipY + 0.08, hipY - 0.02, P[li][1]);
      return o;
    };
    const collarK = (g) => 1 - clamp01(Math.abs(sd(neckline, g)) / 0.022);
    const sh = shell({
      inside: (li) => boneW(li, isHead) < 0.3 && boneW(li, isLowerArm) < 0.4 && boneW(li, (b) => /^(upperleg|lowerleg|foot)/.test(b)) < 0.5, offset, cuts, smoothIters: 35, drape: 260,
      post: (li, g) => { const k = collarK(g); return k > 0 ? add(lerp3(P[li], g, 1 - 0.3 * k), mul(N[li], 0.0012 * Math.sin(Math.atan2(g[0], g[2]) * 90))) : g; },
    });
    emit('Tee', sh, { hem: 0.004, shade: (li) => (sh.G[li] && collarK(sh.G[li]) > 0 ? 0.88 : 1) });
  }

  /* ======================= TROUSERS (cargo) ======================= */
  {
    const waist = plane([0, hipY + 0.025, 0], [0, 1, 0]);
    const ankle = plane([0, L.ft[1] + 0.055, 0], [0, -1, 0]);
    const cuts = [{ pl: waist, applies: () => true }, { pl: ankle, applies: () => true }];
    const legLen = hipY - L.ft[1];
    const offset = (li) => {
      const y = P[li][1];
      const t = clamp01((hipY - y) / legLen); // 0 at the waist, 1 at the ankle
      let o = 0.015 + 0.01 * t + 0.014 * smooth(0.3, 1, t); // straight, relaxed leg
      // stacked folds above the hem, a few creases behind the knee
      o += 0.006 * Math.max(0, Math.sin((y - L.ft[1]) * 110)) * smooth(0.82, 0.97, t);
      return o;
    };
    const sh = shell({
      inside: (li) => boneW(li, isArm) < 0.15 && (boneW(li, isLeg) > 0.25 || P[li][1] < hipY + 0.03),
      offset: (li) => offset(li), cuts, smoothIters: 45, drape: 90,
      smoothFactor: (li) => 0.6 + 0.4 * clamp01((hipY - P[li][1]) / legLen),
    });
    emit('Trousers', sh, { hem: 0.005, shade: (li) => (sh.G[li] && Math.abs(sd(waist, sh.G[li])) < 0.04 ? 0.84 : 1) });
    // cargo pockets on the outer thighs: a puffy patch with a flap over it
    const parts = [];
    for (const S of [L, R]) {
      const sgn = S === L ? 1 : -1;
      const y = S.ll[1] + 0.2, z = (S.ul[2] + S.ll[2]) / 2;
      const k = nearest([S.ul[0] + 0.15 * sgn, y, z], (i) => sh.G[i] && N[i][0] * sgn > 0.7);
      const center = sh.G[k];
      if (!center) continue;
      const n = N[k];
      const u = norm(cross([0, 1, 0], n)); // across the thigh
      const filter = (i) => N[i][0] * sgn > 0.3;
      parts.push(patch(sh, { center, u, v: [0, 1, 0], w: 0.13, h: 0.15, lift: 0.003, puff: 0.009, wall: 0.006, filter }));
      parts.push(patch(sh, { center: add(center, [0, 0.07, 0]), u, v: [0, 1, 0], w: 0.142, h: 0.045, lift: 0.012, puff: 0.003, wall: 0.008, nu: 12, nv: 4, filter }));
    }
    const cp = merge(...parts);
    emitRaw('TrouserPockets', cp.pts, cp.tris, cp.uv, (i) => boneW(i, isLeg) > 0.5);
  }

  /* ======================= CAP ======================= */
  {
    // the head is an egg; find its crown and front
    const headIds = []; for (let i = 0; i < P.length; i++) if (boneW(i, isHead) > 0.9) headIds.push(i);
    const top = Math.max(...headIds.map((i) => P[i][1]));
    const front = Math.max(...headIds.map((i) => P[i][2]));
    const back = Math.min(...headIds.map((i) => P[i][2]));
    const cz = (front + back) / 2;
    const rim = plane([0, top - 0.098, cz], [0, -1, 0.32]); // rim lower at the back
    const sh = shell({
      inside: (li) => boneW(li, isHead) > 0.6, cuts: [{ pl: rim, applies: () => true }],
      offset: (li) => { const p = P[li]; const f = clamp01((p[2] - cz) / (front - cz)); return 0.006 + 0.012 * f * smooth(top - 0.09, top - 0.03, p[1]); },
      smoothIters: 15,
    });
    emit('Cap', sh, { hem: 0.004 });
    // brim: a curved peak off the front of the rim
    const loops = loopsFrom(sh.bEdges, sh.G, () => true);
    const ring = (loops.sort((a, b) => b.length - a.length)[0] || []).map((i) => sh.G[i]);
    const frontArc = ring.filter((p) => p[2] > cz + (front - cz) * 0.15).sort((a, b) => a[0] - b[0]);
    if (frontArc.length > 4) {
      const pts = [], tris = [], uv = [];
      const half = (frontArc[frontArc.length - 1][0] - frontArc[0][0]) / 2 || 0.08;
      frontArc.forEach((p, i) => {
        const u = p[0] / half; // -1..1 across
        const reach = 0.085 * Math.sqrt(Math.max(0, 1 - u * u * 0.92));
        const outDir = norm([p[0] * 0.35, 0, p[2] - cz]);
        const base = add(p, [0, -0.001, 0]);
        const tip = add(base, add(mul(outDir, reach), [0, -0.012 - 0.004 * (1 - Math.abs(u)), 0]));
        const mid = add(lerp3(base, tip, 0.5), [0, 0.004 * (1 - u * u), 0]);
        pts.push(base, mid, tip); uv.push([i / frontArc.length, 0], [i / frontArc.length, 0.5], [i / frontArc.length, 1]);
        // underside, 4 mm lower
        pts.push(add(base, [0, -0.004, 0]), add(mid, [0, -0.004, 0]), add(tip, [0, -0.003, 0])); uv.push([0, 0], [0, 0.5], [0, 1]);
      });
      for (let i = 0; i < frontArc.length - 1; i++) {
        const a = i * 6, b = (i + 1) * 6;
        for (const k of [0, 1]) { tris.push([a + k, b + k, a + k + 1], [a + k + 1, b + k, b + k + 1]); }
        for (const k of [3, 4]) { tris.push([a + k, a + k + 1, b + k], [a + k + 1, b + k + 1, b + k]); }
        tris.push([a + 2, b + 2, a + 5], [a + 5, b + 2, b + 5]); // front edge
      }
      emitRaw('CapBrim', pts, tris, uv, (i) => boneW(i, isHead) > 0.6);
    }
    const btn = tube([[0, top + 0.004, cz - 0.004], [0, top + 0.011, cz - 0.004]], (t) => 0.007 * (1 - t * 0.4), 10);
    emitRaw('CapButton', btn.pts, btn.tris, btn.uv, (i) => boneW(i, isHead) > 0.6);
  }

  /* ======================= SNEAKERS ======================= */
  // Built like a real shoe on a last: the foot's outline is measured along its length, and a smooth
  // shoe is lofted round it (rounded toe box, heel counter, ankle opening), with a separate sole.
  {
    const SOLE = 0.026;
    const uppers = [], uCols = [], soles = [], sCols = [], collars = [], laces = [];
    for (const S of [L, R]) {
      const sgn = S === L ? 1 : -1;
      const ids = []; for (let i = 0; i < P.length; i++) if (boneW(i, isFoot) > 0.45 && P[i][0] * sgn > 0.02) ids.push(i);
      const heelZ = Math.min(...ids.map((i) => P[i][2])), toeZ = Math.max(...ids.map((i) => P[i][2]));
      const Lf = toeZ - heelZ;
      const NB = 36, halfW = new Array(NB).fill(0.03), topY = new Array(NB).fill(0.03), cxs = new Array(NB).fill(S.ft[0]);
      const mins = new Array(NB).fill(Infinity), maxs = new Array(NB).fill(-Infinity);
      for (const i of ids) {
        const t = clamp01((P[i][2] - heelZ) / Lf); const b = Math.min(NB - 1, Math.floor(t * NB));
        mins[b] = Math.min(mins[b], P[i][0]); maxs[b] = Math.max(maxs[b], P[i][0]);
        if (P[i][1] < 0.13) topY[b] = Math.max(topY[b], P[i][1]);
      }
      for (let b = 0; b < NB; b++) if (isFinite(mins[b])) { cxs[b] = (mins[b] + maxs[b]) / 2; halfW[b] = (maxs[b] - mins[b]) / 2; }
      const sm = (a) => { for (let k = 0; k < 4; k++) a = a.map((v, i) => (a[Math.max(0, i - 1)] + v * 2 + a[Math.min(a.length - 1, i + 1)]) / 4); return a; };
      // envelope never narrower than the foot itself, then lightly smoothed
      const env = (raw) => { const sm1 = sm(raw); const mx = sm1.map((v, i) => Math.max(v, raw[i], raw[Math.max(0, i - 1)], raw[Math.min(raw.length - 1, i + 1)])); return sm(mx).map((v, i) => Math.max(v, mx[i] * 0.985)); };
      const HW = env(halfW), TY = env(topY), CX = sm(cxs);
      const at = (arr, t) => { const x = clamp01(t) * (NB - 1); const i = Math.floor(x), f = x - i; return arr[i] + (arr[Math.min(NB - 1, i + 1)] - arr[i]) * f; };
      // shoe length runs a little past the heel and toes; ends are rounded
      const T0 = -0.05, T1 = 1.07;
      const endRound = (t) => (t > 0.86 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.86) / (T1 - 0.86), 2))) : t < 0.06 ? Math.sqrt(Math.max(0, 1 - Math.pow((0.06 - t) / (0.06 - T0), 2))) : 1);
      const width = (t) => (Math.max(at(HW, t), 0.034) + 0.014) * endRound(t);
      const height = (t) => {
        const toeBox = 0.052 + 0.012 * (1 - smooth(0.7, 1, t));
        const h = t > 0.55 ? Math.min(at(TY, t) + 0.012, toeBox + 0.01) : at(TY, t) + 0.012;
        return Math.max(0.035, h) * (0.35 + 0.65 * endRound(t));
      };
      const zOf = (t) => heelZ + t * Lf;
      const collarY = (t) => 0.074 + 0.016 * smooth(0.22, 0, t) + 0.04 * smooth(0.17, 0.3, t); // higher at the heel, closing over the instep
      const opening = (t) => t < 0.31;
      const NT = 90, NA = 60, E = 0.78; // superellipse exponent → boxy-rounded cross-sections
      const grid = [], cut = [];
      for (let i = 0; i <= NT; i++) {
        const t = T0 + (T1 - T0) * (i / NT);
        const row = [], crow = [];
        for (let j = 0; j <= NA; j++) {
          const a = Math.PI * (j / NA); // 0 = outer ground edge, π = inner ground edge
          const c = Math.cos(a), sn = Math.sin(a);
          const x = at(CX, t) + sgn * Math.sign(c) * Math.pow(Math.abs(c), E) * width(t);
          let y = 0.002 + Math.pow(sn, E) * height(t);
          let isCut = opening(t) && y > collarY(t);
          if (isCut) y = collarY(t);
          row.push([x, y, zOf(t)]); crow.push(isCut);
        }
        grid.push(row); cut.push(crow);
      }
      // upper surface (faces inside the ankle opening are left out)
      const base = uppers.length ? uppers.reduce((n, u) => n + u.pts.length, 0) : 0;
      const pts = [], tris = [], cols = [];
      grid.forEach((row, i) => row.forEach((p, j) => {
        const t = T0 + (T1 - T0) * (i / NT);
        const yc = 0.016 + 0.046 * Math.pow(clamp01(1 - t), 1.2); // the stripe rises toward the heel
        const w = 0.008 + 0.003 * (1 - t);
        const side = Math.abs(Math.cos(Math.PI * (j / NA)));
        const stripe = (1 - smooth(w * 0.35, w * 1.15, Math.abs(p[1] - yc))) * smooth(0.45, 0.7, side) * smooth(0.12, 0.2, t) * (1 - smooth(0.78, 0.86, t));
        pts.push(p); cols.push([0, stripe, 0]);
      }));
      const id = (i, j) => i * (NA + 1) + j;
      for (let i = 0; i < NT; i++) for (let j = 0; j < NA; j++) {
        if (cut[i][j] && cut[i + 1][j] && cut[i][j + 1] && cut[i + 1][j + 1]) continue;
        if ((cut[i][j] + cut[i + 1][j] + cut[i][j + 1] + cut[i + 1][j + 1]) >= 3) continue;
        const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
        if (sgn > 0) tris.push([a, b, d], [a, d, c]); else tris.push([a, d, b], [a, c, d]);
      }
      uppers.push({ pts, tris, uv: pts.map(() => [0, 0]) }); uCols.push(...cols);
      void base;
      // padded collar: along the opening's edge (cut boundary)
      const ring = [];
      for (let i = 0; i <= NT; i++) {
        const t = T0 + (T1 - T0) * (i / NT); if (!opening(t)) continue;
        let jj = -1; for (let j = 0; j <= NA; j++) if (cut[i][j]) { jj = j; break; }
        if (jj > 0) ring.push(grid[i][jj]);
      }
      const ring2 = [];
      for (let i = NT; i >= 0; i--) {
        const t = T0 + (T1 - T0) * (i / NT); if (!opening(t)) continue;
        let jj = -1; for (let j = NA; j >= 0; j--) if (cut[i][j]) { jj = j; break; }
        if (jj > 0 && jj < NA) ring2.push(grid[i][jj]);
      }
      const loop = [...ring, ...ring2]; if (loop.length > 4) { loop.push(loop[0]); collars.push(tube(loop, 0.0068, 10, false)); }
      // sole: outline of the upper's ground edges, lofted down with a toe spring
      const outline = [];
      for (let i = 0; i <= NT; i++) outline.push({ p: grid[i][0], t: T0 + (T1 - T0) * (i / NT) });
      for (let i = NT; i >= 0; i--) outline.push({ p: grid[i][NA], t: T0 + (T1 - T0) * (i / NT) });
      const ctr = [at(CX, 0.5), 0, zOf(0.5)];
      const spts = [], stris = [], scols = [];
      const ringAt = (y, grow, spring) => outline.map(({ p, t }) => {
        const dir = norm([p[0] - at(CX, t), 0, (t < 0.05 ? -1 : t > 0.95 ? 1 : 0) * 0.6]);
        return [p[0] + dir[0] * grow, y + spring * 0.014 * smooth(0.86, T1, t), p[2] + dir[2] * grow];
      });
      const rings = [ringAt(0.012, 0.004, 0.4), ringAt(0.002, 0.007, 0.7), ringAt(-SOLE + 0.008, 0.007, 1), ringAt(-SOLE, 0.003, 1)];
      rings.forEach((r) => r.forEach((p) => { spts.push(p); scols.push([1, 0, 0]); }));
      const n = outline.length;
      for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < n; k++) {
        const a = r * n + k, b = r * n + ((k + 1) % n), c = (r + 1) * n + k, d = (r + 1) * n + ((k + 1) % n);
        if (sgn > 0) stris.push([a, c, b], [b, c, d]); else stris.push([a, b, c], [b, d, c]);
      }
      // flat bottom: strip between the two sides
      const half = NT + 1, bottom = (rings.length - 1) * n;
      for (let i = 0; i < NT; i++) {
        const a = bottom + i, b = bottom + i + 1, c = bottom + (n - 1 - i), d = bottom + (n - 2 - i);
        if (sgn > 0) stris.push([a, b, c], [b, d, c]); else stris.push([a, c, b], [b, c, d]);
      }
      void half; void ctr;
      soles.push({ pts: spts, tris: stris, uv: spts.map(() => [0, 0]) }); sCols.push(...scols);
      // laces across the tongue
      for (let k = 0; k < 6; k++) {
        const t = 0.33 + k * 0.047;
        const y = 0.002 + height(t) + 0.004;
        const w = width(t) * 0.42;
        const cx = at(CX, t), z = zOf(t);
        laces.push(tube([[cx - w, y - 0.006, z], [cx - w * 0.45, y, z + 0.002], [cx + w * 0.45, y, z - 0.002], [cx + w, y - 0.006, z]], 0.0026, 6));
      }
    }
    const footSide = (i) => boneW(i, isFoot) > 0.5;
    const up = merge(...uppers, ...soles);
    emitRaw('Shoe', up.pts, up.tris, up.uv, footSide, [...uCols, ...sCols]);
    const c = merge(...collars);
    emitRaw('ShoeCollar', c.pts, c.tris, c.uv, footSide);
    const l = merge(...laces);
    emitRaw('ShoeLaces', l.pts, l.tris, l.uv, footSide);
  }

  return out;
}

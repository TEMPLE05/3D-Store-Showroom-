// Builds the showroom mannequin (and its fitted clothes) from MakeHuman's CC0 base mesh.
//
//   node tools/mannequin/build-mannequin.mjs <makehuman/data dir> <out.glb>
//
// Source assets: https://github.com/makehumancommunity/makehuman (makehuman/data/...), released as CC0.
// Needed files: 3dobjs/base.obj, rigs/default.mhskel, rigs/default_weights.mhw and the
// macrodetails targets listed in TARGETS below.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readObj, readTarget, applyTarget } from './mh.mjs';
import { buildGarments } from './garments.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const THREE = await import(path.join(here, '../../my-ecommerce-store/node_modules/three/build/three.module.js'));
const { GLTFExporter } = await import(path.join(here, '../../my-ecommerce-store/node_modules/three/examples/jsm/exporters/GLTFExporter.js'));

// Node has Blob but no FileReader; GLTFExporter only needs readAsArrayBuffer.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = `data:application/octet-stream;base64,${Buffer.from(b).toString('base64')}`; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
};

const SRC = process.argv[2];
const OUT = process.argv[3];
const HEIGHT = 1.86; // metres, a typical male display mannequin

/* ---------- 1. Body shape ---------- */
const obj = readObj(`${SRC}/3dobjs/base.obj`);
const T = `${SRC}/targets/macrodetails`;
const TARGETS = [
  ...['african', 'asian', 'caucasian'].map((e) => [`${e}-male-young.target`, 1 / 3]),
  ['universal-male-young-averagemuscle-minweight.target', 0.35], // a little slimmer, like a display figure
  ['height/male-young-averagemuscle-averageweight-maxheight.target', 0.2],
  ['proportions/male-young-averagemuscle-averageweight-idealproportions.target', 1],
];
for (const [file, w] of TARGETS) applyTarget(obj.v, readTarget(`${T}/${file}`), w);

const V = obj.v.map(([x, y, z]) => [x * 0.1, y * 0.1, z * 0.1]); // decimetres → metres
const bodyFaces = obj.faces.filter((f) => f.group === 'body');

/* ---------- 2. Skeleton ---------- */
const skel = JSON.parse(fs.readFileSync(`${SRC}/rigs/default.mhskel`, 'utf8'));
const weightsFile = JSON.parse(fs.readFileSync(`${SRC}/rigs/default_weights.mhw`, 'utf8'));
const jointPos = (name) => {
  const ids = skel.joints[name];
  const p = [0, 0, 0];
  ids.forEach((i) => { p[0] += V[i][0]; p[1] += V[i][1]; p[2] += V[i][2]; });
  return p.map((c) => c / ids.length);
};
const allBones = skel.bones;
const isUnder = (name, anc) => { let b = allBones[name]?.parent; while (b) { if (b === anc) return true; b = allBones[b]?.parent; } return false; };
// Face bones fold into the head, toes into the foot, breasts into the chest.
const keep = (n) => !isUnder(n, 'head') && !isUnder(n, 'foot.L') && !isUnder(n, 'foot.R') && !n.startsWith('breast');
const keptOf = (n) => { let b = n; while (b && !keep(b)) b = allBones[b].parent; return b; };
const boneNames = Object.keys(allBones).filter(keep);

/* ---------- 3. Mesh topology (welded, original vertex ids) ---------- */
const usedIds = [...new Set(bodyFaces.flatMap((f) => f.v))].sort((a, b) => a - b);
const local = new Map(usedIds.map((id, i) => [id, i]));
const P = usedIds.map((id) => [...V[id]]);
const quads = bodyFaces.map((f) => f.v.map((id) => local.get(id)));
const neighbors = P.map(() => new Set());
quads.forEach((q) => q.forEach((a, i) => { const b = q[(i + 1) % q.length]; neighbors[a].add(b); neighbors[b].add(a); }));
const nb = neighbors.map((s) => [...s]);

/* ---------- 4. Skin weights per vertex ---------- */
const W = P.map(() => new Map());
for (const [bone, list] of Object.entries(weightsFile.weights)) {
  const k = keptOf(bone);
  if (!k) continue;
  for (const [id, w] of list) {
    const li = local.get(id);
    if (li === undefined) continue;
    W[li].set(k, (W[li].get(k) || 0) + w);
  }
}
const weightOf = (li, pred) => { let s = 0, t = 0; W[li].forEach((w, b) => { t += w; if (pred(b)) s += w; }); return t ? s / t : 0; };

/* ---------- 5. Mannequin finish: faceless head, smooth feet and chest ---------- */
function taubin(points, factor, iterations, lambda = 0.5, mu = -0.53) {
  const tmp = points.map((p) => [...p]);
  for (let it = 0; it < iterations; it++) {
    for (const k of [lambda, mu]) {
      for (let i = 0; i < points.length; i++) {
        const f = factor[i];
        if (!f) { tmp[i][0] = points[i][0]; tmp[i][1] = points[i][1]; tmp[i][2] = points[i][2]; continue; }
        const n = nb[i]; let x = 0, y = 0, z = 0;
        for (const j of n) { x += points[j][0]; y += points[j][1]; z += points[j][2]; }
        x /= n.length; y /= n.length; z /= n.length;
        const s = k * f;
        tmp[i][0] = points[i][0] + s * (x - points[i][0]);
        tmp[i][1] = points[i][1] + s * (y - points[i][1]);
        tmp[i][2] = points[i][2] + s * (z - points[i][2]);
      }
      for (let i = 0; i < points.length; i++) { points[i][0] = tmp[i][0]; points[i][1] = tmp[i][1]; points[i][2] = tmp[i][2]; }
    }
  }
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// raw (pre-merge) weights for toes and face so the masks follow the anatomy closely
const rawMask = (pred) => {
  const m = new Float32Array(P.length);
  for (const [bone, list] of Object.entries(weightsFile.weights)) {
    if (!pred(bone)) continue;
    for (const [id, w] of list) { const li = local.get(id); if (li !== undefined) m[li] += w; }
  }
  return m;
};
const headMask = rawMask((b) => b === 'head' || isUnder(b, 'head'));
const toeMask = rawMask((b) => isUnder(b, 'foot.L') || isUnder(b, 'foot.R'));
const chestMask = rawMask((b) => b.startsWith('breast'));
const face = new Float32Array(P.length);
// Abstract display head: everything above the top of the neck is projected onto a smooth egg
// (melting eyes, nose, mouth and ears), with a short blend band into the neck.
{
  const H = jointPos(allBones.head.head);          // top of the neck, where the head pivots
  const N3 = jointPos(allBones.neck03.head);
  const sideOk = (i) => headMask[i] > 0.02 || P[i][1] > H[1] + 0.02; // ignore shoulders/back
  const region = []; for (let i = 0; i < P.length; i++) if (P[i][1] > H[1] - 0.12 && sideOk(i)) region.push(i);
  const skull = region.filter((i) => P[i][1] > H[1] + 0.04);
  const pct = (ids, axis, q) => { const a = ids.map((i) => P[i][axis]).sort((x, y) => x - y); return a[Math.floor(q * (a.length - 1))]; };
  const top = pct(skull, 1, 1);
  const bottom = H[1] - 0.085;                      // just under the chin
  const rx = (pct(skull, 0, 0.93) - pct(skull, 0, 0.07)) / 2 * 0.98;
  const zf = pct(skull, 2, 0.985), zb = pct(skull, 2, 0.02);
  const rz = (zf - zb) / 2 * 0.95;
  const c = [0, (top + bottom) / 2, (zf + zb) / 2 - rz * 0.04];
  const ry = (top - bottom) / 2;
  const tilt = 0.12; // the egg leans forward slightly, like a lowered gaze
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (const i of region) {
    const y = P[i][1];
    // head/neck join: a plane under the chin, rising toward the nape
    const h = (y - (H[1] - 0.085)) * 0.958 + (P[i][2] - (zf - 0.02)) * 0.287;
    const m = smoothstep(-0.012, 0.03, h);
    if (!m) continue;
    // into the egg's tilted frame
    let px = P[i][0] - c[0], py = y - c[1], pz = P[i][2] - c[2];
    const ty = py * ct - pz * st, tz = py * st + pz * ct; py = ty; pz = tz;
    const q = [px / rx, py / ry, pz / rz];
    const l = Math.hypot(...q) || 1; const d = q.map((v) => v / l);
    const taper = d[1] < 0 ? 1 - 0.22 * Math.pow(-d[1], 1.4) : 1 - 0.04 * d[1];
    let ex = d[0] * rx * taper, ey = d[1] * ry, ez = d[2] * rz * taper;
    // back out of the tilted frame
    const by = ey * ct + ez * st, bz = -ey * st + ez * ct;
    const t = [c[0] + ex, c[1] + by, c[2] + bz];
    for (let k = 0; k < 3; k++) P[i][k] += (t[k] - P[i][k]) * m;
  }
  // relax the skull's vertex spacing (collapsed eyelids and lips otherwise catch the light as specks)
  const relax = new Float32Array(P.length);
  for (const i of region) {
    const h = (P[i][1] - (H[1] - 0.085)) * 0.958 + (P[i][2] - (zf - 0.02)) * 0.287;
    relax[i] = smoothstep(0.02, 0.06, h);
  }
  taubin(P, relax, 40, 0.6, -0.62);
  // blend the egg into the neck
  const blend = new Float32Array(P.length);
  for (const i of region) {
    const h = (P[i][1] - (H[1] - 0.085)) * 0.958 + (P[i][2] - (zf - 0.02)) * 0.287;
    blend[i] = (1 - Math.abs(smoothstep(-0.06, 0.06, h) - 0.5) * 2) * 0.9;
  }
  taubin(P, blend, 80, 0.5, -0.52);
  void N3;
}
const toes = new Float32Array(P.length);
for (let i = 0; i < P.length; i++) toes[i] = smoothstep(0.2, 0.7, toeMask[i]) * 0.9;
taubin(P, toes, 45);
const chest = new Float32Array(P.length);
// display mannequins have a smooth chest: flatten the nipples and soften the pecs
for (let i = 0; i < P.length; i++) chest[i] = smoothstep(0.03, 0.35, chestMask[i]);
taubin(P, chest, 30);
{
  const tmp = P.map((p) => [...p]);
  for (let it = 0; it < 90; it++) {
    for (let i = 0; i < P.length; i++) {
      const f = chest[i] * 0.5; if (!f) { tmp[i] = P[i]; continue; }
      let x = 0, y = 0, z = 0; for (const j of nb[i]) { x += P[j][0]; y += P[j][1]; z += P[j][2]; }
      const k = nb[i].length; tmp[i] = [P[i][0] + f * (x / k - P[i][0]), P[i][1] + f * (y / k - P[i][1]), P[i][2] + f * (z / k - P[i][2])];
    }
    for (let i = 0; i < P.length; i++) P[i] = tmp[i];
  }
}

/* ---------- 6. Units: feet on the floor, centred, exact height ---------- */
let minY = Infinity, maxY = -Infinity;
P.forEach((p) => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
const scale = HEIGHT / (maxY - minY);
const root0 = jointPos(allBones.root.head);
const toWorld = (p) => [(p[0] - root0[0]) * scale, (p[1] - minY) * scale, (p[2] - root0[2]) * scale];
const PW = P.map(toWorld);

/* ---------- 7. Normals on the welded mesh ---------- */
function vertexNormals(points, faces) {
  const N = points.map(() => [0, 0, 0]);
  for (const q of faces) {
    const tris = q.length === 4 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [q];
    for (const [a, b, c] of tris) {
      const A = points[a], B = points[b], C = points[c];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      for (const i of [a, b, c]) { N[i][0] += n[0]; N[i][1] += n[1]; N[i][2] += n[2]; }
    }
  }
  return N.map((n) => { const l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; });
}
// average each normal with its neighbours so collapsed spots (the flattened nipples) can't flip them
const NW = (() => {
  let n = vertexNormals(PW, quads);
  for (let it = 0; it < 3; it++) {
    n = n.map((v, i) => { let x = v[0], y = v[1], z = v[2]; for (const j of nb[i]) { x += n[j][0]; y += n[j][1]; z += n[j][2]; } const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; });
  }
  return n;
})();

/* ---------- 8. Bones ---------- */
const bones = {};
for (const name of boneNames) {
  const b = new THREE.Bone();
  b.name = name.replace(/\./g, '_'); // loaders strip dots from node names
  bones[name] = b;
}
for (const name of boneNames) {
  const h = toWorld(jointPos(allBones[name].head));
  const parent = allBones[name].parent && keptOf(allBones[name].parent);
  if (parent) {
    const ph = toWorld(jointPos(allBones[parent].head));
    bones[name].position.set(h[0] - ph[0], h[1] - ph[1], h[2] - ph[2]);
    bones[parent].add(bones[name]);
  } else bones[name].position.set(...h);
}
const boneList = boneNames.map((n) => bones[n]);
const boneIndex = new Map(boneNames.map((n, i) => [n, i]));
const skinFor = (li) => {
  const top = [...W[li]].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
  const idx = [0, 0, 0, 0], wt = [0, 0, 0, 0];
  top.forEach(([b, w], i) => { idx[i] = boneIndex.get(b); wt[i] = w / sum; });
  if (!top.length) { idx[0] = boneIndex.get('root'); wt[0] = 1; }
  return { idx, wt };
};

/* ---------- 9. Mesh with UV seams split (normals stay welded, so no shading seams) ---------- */
export function makeSkinnedGeometry({ faces, points, normals, uvFaces, uvs, skin, shade }) {
  const key = new Map(); const pos = [], nor = [], uv = [], si = [], sw = [], index = [], col = [];
  const vert = (li, ti) => {
    const k = li * 100000 + ti;
    if (key.has(k)) return key.get(k);
    const n = pos.length / 3;
    pos.push(...points[li]); nor.push(...normals[li]); uv.push(...(uvs[ti] || [0, 0]));
    if (shade) { const c = shade(li); if (Array.isArray(c)) col.push(c[0], c[1], c[2]); else col.push(c, c, c); }
    const s = skin(li); si.push(...s.idx); sw.push(...s.wt.map((w) => Math.round(w * 255)));
    // fix rounding so each vertex's weights sum to exactly 255
    const last = sw.length - 4; const tot = sw[last] + sw[last + 1] + sw[last + 2] + sw[last + 3]; sw[last] += 255 - tot;
    key.set(k, n); return n;
  };
  faces.forEach((q, fi) => {
    const t = uvFaces[fi];
    const ids = q.map((li, c) => vert(li, t[c]));
    index.push(ids[0], ids[1], ids[2]);
    if (ids.length === 4) index.push(ids[0], ids[2], ids[3]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(sw), 4, true));
  if (shade) g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(col.map((c) => Math.round(c * 255))), 3, true));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  return g;
}

const uvFaces = bodyFaces.map((f) => f.t);
const bodyGeo = makeSkinnedGeometry({ faces: quads, points: PW, normals: NW, uvFaces, uvs: obj.vt, skin: skinFor });

const scene = new THREE.Scene();
const group = new THREE.Group(); group.name = 'Mannequin';
scene.add(group);
group.add(bones.root);
const skeleton = new THREE.Skeleton(boneList);
const mat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.3, metalness: 0.05, name: 'Mannequin' });
const body = new THREE.SkinnedMesh(bodyGeo, mat); body.name = 'Body';
group.add(body);
scene.updateMatrixWorld(true);
body.bind(skeleton);

/* ---------- 10. Clothes shaped from the body ---------- */
const garments = buildGarments({
  THREE, P: PW, N: NW, quads, nb, uvFaces, uvs: obj.vt, W, weightOf, skinFor, makeSkinnedGeometry, bones, jointWorld: (n) => toWorld(jointPos(allBones[n].head)),
  jointTail: (n) => toWorld(jointPos(allBones[n].tail)),
});
for (const g of garments) {
  const m = new THREE.SkinnedMesh(g.geometry, new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, name: g.name }));
  m.name = g.name;
  group.add(m);
  m.bind(skeleton);
}

/* ---------- 11. Export ---------- */
const exporter = new GLTFExporter();
exporter.parse(scene, (glb) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(glb));
  console.log(`wrote ${OUT} ${(glb.byteLength / 1024).toFixed(0)} KB · ${boneNames.length} bones · body ${bodyGeo.attributes.position.count} verts · garments: ${garments.map((g) => `${g.name}(${g.geometry.attributes.position.count})`).join(', ')}`);
}, (e) => { console.error(e); process.exit(1); }, { binary: true });

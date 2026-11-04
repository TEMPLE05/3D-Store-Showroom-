import * as THREE from 'three';

/*
 * Pose solver for the mannequin rig (MakeHuman skeleton, rest pose = A-pose, bone axes aligned with the model).
 * A pose says where the hands and ankles go (two-bone IK with an elbow/knee hint), plus small joint
 * rotations for hips, spine, neck, head and fingers. The solver returns a local quaternion per bone and a
 * root offset that keeps the feet on the floor.
 *
 * Model space: metres, +y up, +z = the mannequin's front, +x = the mannequin's left.
 */

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export function buildRig(root) {
  const bones = [];
  root.traverse((o) => { if (o.isBone) bones.push(o); });
  const byName = new Map(bones.map((b) => [b.name, b]));
  const rest = new Map();
  // rest world positions from rest local offsets (rest rotations are identity)
  const walk = (b, parentPos) => {
    const p = parentPos.clone().add(b.position);
    rest.set(b.name, { offset: b.position.clone(), world: p, parent: b.parent?.isBone ? b.parent.name : null });
    b.children.forEach((c) => c.isBone && walk(c, p));
  };
  const top = bones.find((b) => !b.parent?.isBone);
  walk(top, top.parent ? new THREE.Vector3() : new THREE.Vector3());
  // walk() added top.position once; keep top world as its own position
  const order = []; const visit = (b) => { order.push(b.name); b.children.forEach((c) => c.isBone && visit(c)); };
  visit(top);
  const len = (a, b) => rest.get(a).world.distanceTo(rest.get(b).world);
  return {
    byName, rest, order, rootName: top.name,
    arm: { L: { upper: len('upperarm01_L', 'lowerarm01_L'), fore: len('lowerarm01_L', 'wrist_L') }, R: { upper: len('upperarm01_R', 'lowerarm01_R'), fore: len('lowerarm01_R', 'wrist_R') } },
    leg: { L: { thigh: len('upperleg01_L', 'lowerleg01_L'), shin: len('lowerleg01_L', 'foot_L') }, R: { thigh: len('upperleg01_R', 'lowerleg01_R'), shin: len('lowerleg01_R', 'foot_R') } },
    ankleHeight: rest.get('foot_L').world.y,
  };
}

// Two-bone IK: from joint A to target T with segment lengths a, b; pole hints where the middle joint points.
function twoBone(A, T, a, b, pole) {
  const AT = T.clone().sub(A);
  let d = AT.length();
  d = Math.min(d, (a + b) * 0.999);
  const dir = AT.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const angA = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const M = A.clone().add(dir.clone().multiplyScalar(Math.cos(angA) * a)).add(p.multiplyScalar(Math.sin(angA) * a));
  const end = A.clone().add(dir.multiplyScalar(d));
  return { mid: M, end };
}

/**
 * def = {
 *   root: { pos: [x,y,z] (offset), rot: [x,y,z] },
 *   rot: { boneName: [x,y,z] },              // local euler offsets (radians)
 *   hands: { L: { at: [x,y,z], pole: [x,y,z], twist }, R: {...} },   // wrist target in model space
 *   feet: { L: { at: [x,y,z], pole: [x,y,z], pitch }, R: {...} },   // ankle target in model space
 *   fingers: curl (0..1), thumbs: curl
 * }
 */
export function solvePose(rig, def) {
  const { rest, order } = rig;
  const local = new Map();   // bone → local quaternion
  const worldQ = new Map();  // bone → world quaternion
  const worldP = new Map();  // bone → world position
  const restDir = (from, to) => rest.get(to).world.clone().sub(rest.get(from).world).normalize();

  const setLocal = (name, q) => local.set(name, q);
  for (const name of order) local.set(name, new THREE.Quaternion());
  const rootOffset = new THREE.Vector3(...(def.root?.pos || [0, 0, 0]));
  if (def.root?.rot) local.set(rig.rootName, new THREE.Quaternion().setFromEuler(_e.set(...def.root.rot)));
  for (const [name, r] of Object.entries(def.rot || {})) {
    if (local.has(name)) local.set(name, new THREE.Quaternion().setFromEuler(_e.set(...r)));
  }

  // forward kinematics for one bone, assuming its parent is already resolved
  const fk = (name) => {
    const r = rest.get(name);
    const pq = r.parent ? worldQ.get(r.parent) : new THREE.Quaternion();
    const pp = r.parent ? worldP.get(r.parent) : rootOffset;
    const pos = r.parent ? pp.clone().add(r.offset.clone().applyQuaternion(pq)) : r.offset.clone().add(rootOffset);
    worldP.set(name, pos);
    worldQ.set(name, pq.clone().multiply(local.get(name)));
  };
  const fkFrom = (start) => {
    let on = false;
    for (const n of order) {
      if (n === start) on = true;
      if (on) fk(n);
    }
  };
  // Aim a bone so the direction from it to `child` points along `dir` (model space), then twist around it.
  const aim = (name, child, dir, twist = 0) => {
    const r = rest.get(name);
    const pq = r.parent ? worldQ.get(r.parent) : new THREE.Quaternion();
    const inv = pq.clone().invert();
    const d = dir.clone().normalize().applyQuaternion(inv);
    const q = new THREE.Quaternion().setFromUnitVectors(restDir(name, child), d);
    if (twist) q.premultiply(_q.setFromAxisAngle(d, twist));
    setLocal(name, q);
  };

  order.forEach(fk);

  for (const side of ['L', 'R']) {
    const h = def.hands?.[side];
    if (!h) continue;
    fkFrom(`upperarm01_${side}`);
    const S = worldP.get(`upperarm01_${side}`);
    const { mid, end } = twoBone(S, new THREE.Vector3(...h.at), rig.arm[side].upper, rig.arm[side].fore, new THREE.Vector3(...(h.pole || [0, 0, -1])));
    aim(`upperarm01_${side}`, `lowerarm01_${side}`, mid.clone().sub(S), h.upperTwist || 0);
    fkFrom(`upperarm01_${side}`);
    aim(`lowerarm01_${side}`, `wrist_${side}`, end.clone().sub(mid), h.twist || 0);
    if (h.wrist) local.get(`wrist_${side}`).multiply(new THREE.Quaternion().setFromEuler(_e.set(...h.wrist)));
  }

  for (const side of ['L', 'R']) {
    const f = def.feet?.[side];
    if (!f) continue;
    fkFrom(`upperleg01_${side}`);
    const H = worldP.get(`upperleg01_${side}`);
    const { mid, end } = twoBone(H, new THREE.Vector3(...f.at), rig.leg[side].thigh, rig.leg[side].shin, new THREE.Vector3(...(f.pole || [0, 0, 1])));
    aim(`upperleg01_${side}`, `lowerleg01_${side}`, mid.clone().sub(H), f.twist || 0);
    fkFrom(`upperleg01_${side}`);
    aim(`lowerleg01_${side}`, `foot_${side}`, end.clone().sub(mid));
    fkFrom(`upperleg01_${side}`);
    // keep the foot level with the floor (plus optional heel lift / turn-out)
    const pq = worldQ.get(`lowerleg02_${side}`) || worldQ.get(`lowerleg01_${side}`);
    const want = new THREE.Quaternion().setFromEuler(_e.set(f.pitch || 0, f.turn || 0, 0));
    setLocal(`foot_${side}`, pq.clone().invert().multiply(want));
  }

  // relaxed hands: fingers together and curled toward the palm, like a display mannequin
  const curl = def.fingers ?? 0.35;
  for (const side of ['L', 'R']) {
    const { knuckles, palm } = handAxes(rig, side);
    for (let f = 2; f <= 5; f++) {
      for (let s = 1; s <= 3; s++) {
        const n = `finger${f}-${s}_${side}`;
        if (!local.has(n)) continue;
        const amt = curl * (s === 1 ? 0.7 : s === 2 ? 1.0 : 0.75) * (1 + (f - 2) * 0.15);
        local.get(n).premultiply(new THREE.Quaternion().setFromAxisAngle(knuckles, amt));
        // close the gaps: index leans toward the middle finger, ring and little toward it from the other side
        if (s === 1) {
          const close = { 2: -0.1, 3: 0, 4: 0.1, 5: 0.22 }[f];
          local.get(n).premultiply(new THREE.Quaternion().setFromAxisAngle(palm, close));
        }
      }
    }
    for (let s = 1; s <= 3; s++) {
      const n = `finger1-${s}_${side}`;
      if (local.has(n)) local.get(n).premultiply(new THREE.Quaternion().setFromAxisAngle(knuckles, (def.thumbs ?? 0.25) * (s === 1 ? 0.3 : 0.6)));
    }
  }

  // feet on the floor: lift or lower the whole figure so the lower ankle sits at its rest height
  order.forEach(fk);
  const ay = Math.min(worldP.get('foot_L').y, worldP.get('foot_R').y);
  rootOffset.y += rig.ankleHeight - ay;

  return { local, rootOffset };
}

// Hand axes in the rest frame: `knuckles` runs along the knuckle line (rotating about it curls the fingers),
// `palm` is the palm's normal (rotating about it moves fingers sideways).
const handCache = new Map();
function handAxes(rig, side) {
  if (handCache.has(side)) return handCache.get(side);
  const w = (n) => rig.rest.get(n).world;
  const wrist = w(`wrist_${side}`);
  const along = w(`finger3-1_${side}`).clone().sub(wrist).normalize();      // wrist → middle knuckle
  const spread = w(`finger2-1_${side}`).clone().sub(w(`finger5-1_${side}`)).normalize(); // little → index
  const palmN = new THREE.Vector3().crossVectors(along, spread).normalize();
  // the palm faces away from the back-of-hand; the thumb sits on the palm side of the knuckle line
  const thumb = w(`finger1-2_${side}`).clone().sub(wrist);
  if (palmN.dot(thumb) < 0) palmN.negate();
  // curl = rotate the finger tip toward the palm normal
  const knuckles = new THREE.Vector3().crossVectors(along, palmN).normalize().negate();
  const out = { knuckles, palm: palmN.clone().multiplyScalar(side === 'L' ? 1 : -1) };
  handCache.set(side, out);
  return out;
}

/* ---------- The pose library ---------- */
// Hand/ankle targets are in model space for a 1.86 m figure (shoulders ≈ ±0.23 at y 1.49, hips ≈ ±0.11 at y 1.01).
export const POSES = {
  standing: {
    label: 'Standing',
    def: {
      rot: { spine03: [0.02, 0, 0], neck01: [-0.04, 0, 0], head: [0.06, 0, 0] },
      hands: {
        L: { at: [0.35, 0.88, 0.1], pole: [0.25, 0, -1], twist: 0.9 },
        R: { at: [-0.35, 0.88, 0.1], pole: [-0.25, 0, -1], twist: -0.9 },
      },
      feet: { L: { at: [0.12, 0.077, 0.08], turn: 0.12 }, R: { at: [-0.12, 0.077, 0.08], turn: -0.12 } },
      fingers: 0.18,
    },
  },
  hip: {
    label: 'Hand on hip',
    def: {
      root: { pos: [0.025, 0, 0], rot: [0, 0.08, -0.04] },
      rot: { spine04: [0, 0, 0.03], spine02: [0, -0.05, 0.03], neck01: [0, 0, -0.02], head: [0.07, -0.18, 0.04] },
      hands: {
        L: { at: [0.235, 1.0, -0.035], pole: [1, 0.3, -0.45], twist: 1.6, wrist: [0, 0, 0.35] },
        R: { at: [-0.34, 0.88, 0.11], pole: [-0.3, 0, -1], twist: -0.9 },
      },
      feet: { L: { at: [0.13, 0.077, 0.07], turn: 0.2 }, R: { at: [-0.09, 0.077, 0.13], turn: -0.25 } },
      fingers: 0.2,
    },
  },
  step: {
    label: 'Mid-step',
    def: {
      root: { rot: [0, -0.06, 0] },
      rot: { spine03: [0.03, 0.05, 0], spine01: [0, 0.04, 0], head: [0.04, 0.02, 0] },
      hands: {
        L: { at: [0.3, 0.89, -0.13], pole: [0.2, 0, -1], twist: 0.9 },
        R: { at: [-0.29, 0.9, 0.21], pole: [-0.2, 0, -1], twist: -0.9 },
      },
      feet: { L: { at: [0.11, 0.077, 0.32], pole: [0, 0, 1] }, R: { at: [-0.11, 0.1, -0.2], pole: [0, 0, 1], pitch: 0.5 } },
      fingers: 0.35,
    },
  },
  relaxed: {
    label: 'Relaxed',
    def: {
      root: { pos: [-0.03, 0, 0], rot: [0, -0.12, 0.045] },
      rot: { spine04: [0, 0, -0.04], spine02: [0.02, 0.08, -0.02], neck01: [0.03, 0, 0.03], head: [0.09, 0.28, -0.05] },
      hands: {
        L: { at: [0.33, 0.86, 0.03], pole: [0.25, 0, -1], twist: 0.95 },
        R: { at: [-0.17, 0.98, 0.11], pole: [-0.6, -0.1, -1], twist: -1.5, wrist: [0, 0, -0.2] },
      },
      feet: { L: { at: [0.16, 0.077, 0.11], pole: [0.15, 0, 1], turn: 0.3 }, R: { at: [-0.1, 0.077, 0.04], turn: -0.12 } },
      fingers: 0.45,
    },
  },
};

export const POSE_KEYS = Object.keys(POSES);

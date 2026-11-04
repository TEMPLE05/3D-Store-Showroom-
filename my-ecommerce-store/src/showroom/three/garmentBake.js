import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { buildRig, solvePose } from './posing';
import { MANNEQUIN_URL } from './MannequinModel';

/*
 * Turns the mannequin's clothes into still 3D products: each garment is posed the way it would hang
 * (sleeves down, legs straight), baked out of the skeleton, and centred on its hanging point.
 * The result is cached, so every rail item, shelf item and preview shares the same shapes.
 */

export const GARMENT_PARTS = {
  hoodies: ['Hoodie', 'HoodieHood', 'HoodiePocket', 'HoodieStrings'],
  jackets: ['Hoodie', 'HoodieHood', 'HoodiePocket', 'HoodieStrings'],
  tees: ['Tee'],
  trousers: ['Trousers', 'TrouserPockets'],
  caps: ['Cap', 'CapBrim', 'CapButton'],
  shoes: ['Shoe', 'ShoeCollar', 'ShoeLaces'],
};

// How the clothes hang: arms down a little away from the body, legs straight and close.
const HANG = {
  hands: {
    L: { at: [0.3, 0.9, 0.04], pole: [0.2, 0, -1], twist: 0.9 },
    R: { at: [-0.3, 0.9, 0.04], pole: [-0.2, 0, -1], twist: -0.9 },
  },
  feet: { L: { at: [0.105, 0.077, 0.07] }, R: { at: [-0.105, 0.077, 0.07] } },
  fingers: 0,
};

// Bake a posed skinned mesh into a still geometry. three's applyBoneTransform handles the compressed
// (quantized) attributes; normals follow by transforming a point a hair along each normal.
function bake(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position, nor = g.attributes.normal;
  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  const out = new Float32Array(pos.count * 3), outN = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
  const toWorld = mesh.matrixWorld;
  // measure how many stored units make 1 m (compressed files store positions as scaled integers)
  const a = new THREE.Vector3().fromBufferAttribute(pos, 0), b = a.clone().add(new THREE.Vector3(1, 0, 0));
  const a2 = a.clone(), b2 = b.clone();
  mesh.applyBoneTransform(0, a2); mesh.applyBoneTransform(0, b2);
  const metresPerUnit = a2.applyMatrix4(toWorld).distanceTo(b2.applyMatrix4(toWorld)) || 1;
  const eps = 0.002 / metresPerUnit;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i).normalize();
    q.copy(v).addScaledVector(n, eps);
    mesh.applyBoneTransform(i, v); mesh.applyBoneTransform(i, q);
    v.applyMatrix4(toWorld); q.applyMatrix4(toWorld);
    q.sub(v).normalize();
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    outN[i * 3] = q.x; outN[i * 3 + 1] = q.y; outN[i * 3 + 2] = q.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(outN, 3));
  if (g.attributes.uv) geo.setAttribute('uv', g.attributes.uv);
  if (g.attributes.color) geo.setAttribute('color', g.attributes.color);
  geo.setIndex(g.index);
  return geo;
}

// keep only triangles on one side of x = 0 (to split the pair of shoes)
function half(geo, sign) {
  const idx = geo.index.array, pos = geo.attributes.position;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    const cx = (pos.getX(idx[t]) + pos.getX(idx[t + 1]) + pos.getX(idx[t + 2])) / 3;
    if (cx * sign > 0) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const g = geo.clone();
  g.setIndex(keep);
  return g;
}

function centre(parts, anchor) {
  const box = new THREE.Box3();
  parts.forEach((p) => { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); });
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  // anchor: 'top' hangs from the top centre (tops, trousers); 'bottom' stands on its base (caps, shoes)
  const shift = new THREE.Vector3(-c.x, anchor === 'top' ? -box.max.y : -box.min.y, -c.z);
  parts.forEach((p) => p.geometry.translate(shift.x, shift.y, shift.z));
  return { parts, size };
}

/** Types that exist as real 3D garments (the rest show as photo cards). */
export const MODEL_TYPES = new Set(['hoodies', 'jackets', 'tees', 'trousers', 'caps', 'shoes']);

export function useProductSize(type) {
  const baked = useBakedGarments();
  return baked[type]?.size || new THREE.Vector3(0.5, 0.6, 0.2);
}

let cache = null;
export function useBakedGarments() {
  const gltf = useGLTF(MANNEQUIN_URL);
  return useMemo(() => {
    if (cache) return cache;
    const scene = cloneSkinned(gltf.scene);
    const meshes = {};
    scene.traverse((o) => { if (o.isSkinnedMesh) meshes[o.material?.name || o.name] = o; });
    const rig = buildRig(scene.getObjectByName('root'));
    const pose = solvePose(rig, HANG);
    for (const [name, q] of pose.local) rig.byName.get(name).quaternion.copy(q);
    rig.byName.get(rig.rootName).position.add(pose.rootOffset);
    scene.updateMatrixWorld(true);
    const get = (names) => names.filter((n) => meshes[n]).map((n) => ({ name: n, geometry: bake(meshes[n]) }));

    const tops = get(GARMENT_PARTS.hoodies);
    const tee = get(GARMENT_PARTS.tees);
    const trousers = get(GARMENT_PARTS.trousers);
    const cap = get(GARMENT_PARTS.caps);
    const shoes = get(GARMENT_PARTS.shoes);
    const shoeL = shoes.map((p) => ({ name: p.name, geometry: half(p.geometry, 1) }));
    // the shoes are baked standing; a hoodie's hood sits over where the neck was, so hang tops from the collar
    cache = {
      hoodies: centre(tops, 'top'),
      tees: centre(tee, 'top'),
      trousers: centre(trousers, 'top'),
      caps: centre(cap, 'bottom'),
      shoes: centre(shoeL, 'bottom'),
    };
    cache.jackets = cache.hoodies;
    return cache;
  }, [gltf]);
}

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { buildRig, solvePose, POSES } from './posing';
import { partMaterial, mannequinMaterial } from './materials';

export const MANNEQUIN_URL = '/models/mannequin.glb';
// Sneaker soles sit this far below the bare foot, so the figure stands taller in shoes.
const SHOE_LIFT = 0.025;

// Which garment meshes belong to each product type (same list the baked products use).
const PARTS = {
  hoodies: ['Hoodie', 'HoodieHood', 'HoodiePocket', 'HoodieStrings'],
  jackets: ['Hoodie', 'HoodieHood', 'HoodiePocket', 'HoodieStrings'],
  tees: ['Tee'],
  trousers: ['Trousers', 'TrouserPockets'],
  caps: ['Cap', 'CapBrim', 'CapButton'],
  shoes: ['Shoe', 'ShoeCollar', 'ShoeLaces'],
};
const SLOT_TYPES = { torso: ['hoodies', 'jackets', 'tees'], legs: ['trousers'], head: ['caps'], feet: ['shoes'] };


/**
 * The glossy black display mannequin wearing the featured outfit.
 * outfit: { torso, legs, head, feet } → { id, type, hex, accent, sole, name }
 */
export default function MannequinModel({ pose = 'standing', outfit = {}, onSelect, still = false }) {
  const gltf = useGLTF(MANNEQUIN_URL);
  const { scene, rig, meshes } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    const m = {};
    s.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      // pieces are identified by their material name (mesh names don't survive compression)
      const key = o.material?.name === 'Mannequin' ? 'Body' : o.material?.name || o.name;
      o.name = key; m[key] = o;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    });
    const root = s.getObjectByName('root');
    return { scene: s, rig: buildRig(root), meshes: m };
  }, [gltf]);

  // materials: glossy black body, fabric for clothes in the product's colors
  useEffect(() => {
    if (meshes.Body) meshes.Body.material = mannequinMaterial();
    Object.entries(SLOT_TYPES).forEach(([slot, types]) => {
      const item = outfit[slot];
      const parts = item ? PARTS[item.type] || [] : [];
      types.forEach((t) => (PARTS[t] || []).forEach((n) => { if (meshes[n]) meshes[n].visible = false; }));
      parts.forEach((n) => {
        const mesh = meshes[n];
        if (!mesh) return;
        mesh.visible = true;
        mesh.userData.slot = slot;
        mesh.material = partMaterial(n, item, Boolean(mesh.geometry.attributes.color));
      });
    });
  }, [meshes, outfit]);

  // pose targets
  const target = useMemo(() => solvePose(rig, POSES[pose]?.def || POSES.standing.def), [rig, pose]);
  const current = useRef(null);
  useEffect(() => {
    if (!current.current) {
      // start already in the pose (no flailing on first load)
      current.current = { q: new Map([...target.local].map(([k, v]) => [k, v.clone()])), p: target.rootOffset.clone() };
    }
  }, [target]);

  const idle = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  useFrame((state, dt) => {
    const cur = current.current;
    if (!cur) return;
    const k = 1 - Math.exp(-3.2 * Math.min(dt, 0.05));
    const t = state.clock.elapsedTime;
    const rootRest = rig.rest.get(rig.rootName).offset;
    for (const [name, q] of target.local) {
      const c = cur.q.get(name);
      c.slerp(q, k);
      const bone = rig.byName.get(name);
      bone.quaternion.copy(c);
      if (!still) {
        // breathing and a slow weight shift, layered on top of the pose
        if (name === 'spine02') bone.quaternion.multiply(idle.setFromEuler(euler.set(Math.sin(t * 1.4) * 0.012, 0, 0)));
        if (name === 'root') bone.quaternion.multiply(idle.setFromEuler(euler.set(0, 0, Math.sin(t * 0.7) * 0.008)));
        if (name === 'head') bone.quaternion.multiply(idle.setFromEuler(euler.set(Math.sin(t * 0.6) * 0.012, Math.sin(t * 0.4) * 0.04, 0)));
      }
    }
    cur.p.lerp(target.rootOffset, k);
    rig.byName.get(rig.rootName).position.copy(rootRest).add(cur.p);
    if (outfit.feet) rig.byName.get(rig.rootName).position.y += SHOE_LIFT;
  });

  const handle = (e) => {
    const slot = e.object.userData.slot;
    if (!slot || !outfit[slot] || !onSelect) return;
    e.stopPropagation();
    onSelect(outfit[slot].id);
  };

  return (
    <primitive object={scene} onClick={handle}
      onPointerOver={(e) => { if (e.object.userData.slot) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }} />
  );
}

useGLTF.preload(MANNEQUIN_URL);

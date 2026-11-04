import { useMemo } from 'react';
import * as THREE from 'three';
import { useBakedGarments } from './garmentBake';
import { partMaterial } from './materials';
import { woodMaterial } from './wood';

/**
 * One product as a 3D object in its chosen color.
 * Tops and trousers hang from y = 0 (their hanging point); caps and shoes stand on y = 0.
 */
export default function Product3D({ type, color, scale = 1, onClick, shadows = false }) {
  const baked = useBakedGarments();
  const set = baked[type];
  const item = useMemo(() => ({ hex: color?.hex || '#888', accent: color?.accent, sole: color?.sole }), [color]);
  if (!set) return null;
  const pointer = onClick ? {
    onClick: (e) => { e.stopPropagation(); onClick(); },
    onPointerOver: () => { document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = ''; },
  } : {};
  return (
    <group scale={scale} {...pointer}>
      {set.parts.map((p) => (
        <mesh key={p.name} geometry={p.geometry} material={partMaterial(p.name, item, Boolean(p.geometry.attributes.color))}
          castShadow={shadows} receiveShadow={shadows} />
      ))}
    </group>
  );
}

/* ---------- Hangers ---------- */

const hookGeo = new THREE.TorusGeometry(0.028, 0.0035, 8, 24, Math.PI * 1.35);
const stemGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.03, 8);
const metal = new THREE.MeshStandardMaterial({ color: '#c8c2b6', metalness: 0.9, roughness: 0.28 });

// A wooden hanger whose arms follow the shoulder width; for trousers a straight bar with two clips.
export function Hanger({ width = 0.46, kind = 'top' }) {
  const wood = woodMaterial('hanger');
  const arm = useMemo(() => {
    const shape = new THREE.Shape();
    const w = width / 2;
    shape.moveTo(-w, -0.06); shape.quadraticCurveTo(-w * 0.55, -0.02, 0, 0.0); shape.quadraticCurveTo(w * 0.55, -0.02, w, -0.06);
    shape.lineTo(w, -0.075); shape.quadraticCurveTo(w * 0.55, -0.038, 0, -0.018); shape.quadraticCurveTo(-w * 0.55, -0.038, -w, -0.075);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
    g.translate(0, 0, -0.006);
    return g;
  }, [width]);
  const bar = useMemo(() => new THREE.BoxGeometry(width * 0.9, 0.016, 0.014), [width]);
  return (
    <group>
      <mesh geometry={hookGeo} material={metal} position={[0.004, 0.05, 0]} rotation-z={-0.35} />
      <mesh geometry={stemGeo} material={metal} position={[0, 0.012, 0]} />
      {kind === 'top' ? <mesh geometry={arm} material={wood} castShadow /> : <>
        <mesh geometry={bar} material={wood} position={[0, -0.01, 0]} castShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * width * 0.36, -0.03, 0]} material={metal}>
            <boxGeometry args={[0.02, 0.03, 0.018]} />
          </mesh>
        ))}
      </>}
    </group>
  );
}

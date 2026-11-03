import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POSES } from './poses';

/* ---------- Geometry helpers ---------- */

// A smooth tapered limb hanging down from y=0 to y=-len, with rounded ends.
function limbGeometry(len, r1, r2, seg = 20) {
  const pts = [];
  const capTop = r1 * 0.75, capBot = r2 * 0.75;
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const y = capTop - (i / steps) * (len + capTop + capBot);
    let r;
    if (y > 0) r = r1 * Math.sqrt(Math.max(0, 1 - (y / capTop) ** 2));
    else if (y < -len) r = r2 * Math.sqrt(Math.max(0, 1 - ((y + len) / capBot) ** 2));
    else {
      const t = -y / len;
      // slight muscle bulge in the upper third
      r = THREE.MathUtils.lerp(r1, r2, t) * (1 + 0.08 * Math.sin(Math.PI * Math.min(1, t * 1.4)));
    }
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  // Lathe faces point outward only when the profile runs bottom → top.
  return new THREE.LatheGeometry(pts.reverse(), seg);
}

const sphere = new THREE.SphereGeometry(1, 32, 24);

// Smooth body section from a (radius, height) profile, revolved and later flattened front-to-back.
function profileGeometry(profile, grow = 0, seg = 40) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r > 0 ? r + grow : 0.0001, y));
  return new THREE.LatheGeometry(pts, seg);
}

// Upper torso: from the waist (y=0 at the chest joint) to the base of the neck.
const TORSO = [[0, -0.09], [0.118, -0.085], [0.124, -0.02], [0.138, 0.06], [0.158, 0.13], [0.168, 0.19], [0.162, 0.235], [0.135, 0.27], [0.085, 0.292], [0.045, 0.3], [0, 0.302]];
// Pelvis: around the hip joint, a little below and above it.
const PELVIS = [[0, -0.115], [0.07, -0.108], [0.128, -0.08], [0.152, -0.03], [0.15, 0.03], [0.132, 0.08], [0.12, 0.11], [0, 0.112]];

function useGeometries() {
  return useMemo(() => ({
    torso: profileGeometry(TORSO),
    pelvis: profileGeometry(PELVIS),
    abdomen: limbGeometry(0.2, 0.118, 0.12, 32),
    upperArm: limbGeometry(0.27, 0.054, 0.041),
    forearm: limbGeometry(0.24, 0.041, 0.03),
    thigh: limbGeometry(0.41, 0.088, 0.056),
    shin: limbGeometry(0.4, 0.056, 0.036),
    neck: limbGeometry(0.07, 0.046, 0.054),
    // clothing shells follow the same shapes, just a little larger
    torsoShell: profileGeometry(TORSO.map(([r, y]) => [r, y === 0.302 ? 0.29 : y]), 0.018),
    pelvisTopShell: profileGeometry([[0, 0.02], [0.17, 0.02], [0.165, 0.07], [0.148, 0.1], [0.138, 0.125], [0, 0.126]], 0),
    pelvisShell: profileGeometry(PELVIS.slice(0, 7), 0.014),
    abdomenShell: limbGeometry(0.2, 0.136, 0.15, 32),
    upperArmSleeve: limbGeometry(0.27, 0.07, 0.056),
    forearmSleeve: limbGeometry(0.2, 0.054, 0.046),
    cuff: limbGeometry(0.035, 0.044, 0.044),
    thighLeg: limbGeometry(0.41, 0.104, 0.074),
    shinLeg: limbGeometry(0.38, 0.072, 0.066),
    hood: profileGeometry([[0, -0.02], [0.12, 0.0], [0.15, 0.06], [0.14, 0.12], [0.1, 0.16], [0, 0.17]], 0, 32),
  }), []);
}

/* ---------- Materials ---------- */

function useMannequinMaterial() {
  return useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0c0c0e', roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.2, sheenColor: '#3a3a44',
  }), []);
}

const fabricCache = new Map();
function fabric(hex, rough = 0.92) {
  const key = hex + rough;
  if (!fabricCache.has(key)) fabricCache.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 }));
  return fabricCache.get(key);
}

/* ---------- Joint ---------- */

// order 'XZY' on shoulders: twist along the arm first, then raise, then swing — so an elbow can bend toward the body.
const J = ({ name, joints, position, order, children }) => (
  <group ref={(g) => { if (g) { joints.current[name] = g; if (order) g.rotation.order = order; } }} position={position}>{children}</group>
);

const Part = ({ geometry, material, position, scale, rotation, onClick, cast = true }) => (
  <mesh geometry={geometry} material={material} position={position} scale={scale} rotation={rotation}
    castShadow={cast} receiveShadow onClick={onClick}
    onPointerOver={onClick ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
    onPointerOut={onClick ? () => { document.body.style.cursor = ''; } : undefined} />
);

/* ---------- Mannequin ---------- */

/**
 * outfit: { torso, legs, head, feet } each { id, hex, accent, sole, type } or undefined
 * onSelect(id): called when a worn item is tapped
 */
export default function Mannequin({ pose = 'standing', outfit = {}, onSelect, still = false, hotspots }) {
  const g = useGeometries();
  const skin = useMannequinMaterial();
  const joints = useRef({});
  const root = useRef();

  const tap = (slot) => (outfit[slot] && onSelect ? (e) => { e.stopPropagation(); onSelect(outfit[slot].id); } : undefined);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const target = POSES[pose]?.joints || {};
    const d = Math.min(dt, 0.05);
    for (const [name, obj] of Object.entries(joints.current)) {
      const [tx, ty, tz] = target[name] || [0, 0, 0];
      let ix = 0, iy = 0, iz = 0;
      if (!still) {
        if (name === 'hips') iz = Math.sin(t * 0.8) * 0.012;
        if (name === 'chest') ix = Math.sin(t * 1.5) * 0.012;
        if (name === 'head') { iy = Math.sin(t * 0.45) * 0.05; ix = Math.sin(t * 0.7) * 0.015; }
        if (name === 'lShoulder' || name === 'rShoulder') ix = Math.sin(t * 1.5 + 0.6) * 0.012;
      }
      obj.rotation.x = THREE.MathUtils.damp(obj.rotation.x, tx + ix, 3.5, d);
      obj.rotation.y = THREE.MathUtils.damp(obj.rotation.y, ty + iy, 3.5, d);
      obj.rotation.z = THREE.MathUtils.damp(obj.rotation.z, tz + iz, 3.5, d);
    }
  });

  const top = outfit.torso, legs = outfit.legs, cap = outfit.head, shoes = outfit.feet;
  const topMat = top && fabric(top.hex);
  const legMat = legs && fabric(legs.hex);
  const capMat = cap && fabric(cap.hex, 0.85);
  const shoeMat = shoes && fabric(shoes.hex, 0.6);
  const soleMat = shoes && fabric(shoes.sole || '#f2f0ea', 0.55);
  const accentMat = shoes && fabric(shoes.accent || '#ffffff', 0.6);
  const hood = top?.type === 'hoodies';

  const arm = (side) => {
    const s = side === 'l' ? 1 : -1;
    return (
      <J name={`${side}Shoulder`} joints={joints} position={[0.19 * s, 0.225, -0.005]} order="XZY">
        <Part geometry={sphere} material={top ? topMat : skin} onClick={top ? tap('torso') : undefined}
          position={[0.006 * s, 0.004, 0]} scale={top ? [0.08, 0.078, 0.078] : [0.066, 0.064, 0.064]} />
        <Part geometry={g.upperArm} material={skin} />
        {top && <Part geometry={g.upperArmSleeve} material={topMat} onClick={tap('torso')} position={[0, 0.012, 0]} />}
        <J name={`${side}Elbow`} joints={joints} position={[0, -0.285, 0]}>
          <Part geometry={sphere} material={skin} scale={[0.042, 0.042, 0.042]} />
          <Part geometry={g.forearm} material={skin} />
          {hood && <>
            <Part geometry={g.forearmSleeve} material={topMat} onClick={tap('torso')} position={[0, 0.02, 0]} />
            <Part geometry={g.cuff} material={topMat} onClick={tap('torso')} position={[0, -0.19, 0]} />
          </>}
          <J name={`${side}Wrist`} joints={joints} position={[0, -0.255, 0]}>
            <Part geometry={sphere} material={skin} position={[0, -0.075, 0.004]} scale={[0.024, 0.085, 0.042]} />
            <Part geometry={sphere} material={skin} position={[0.0, -0.045, 0.034]} rotation={[0.5, 0, 0]} scale={[0.014, 0.04, 0.014]} />
          </J>
        </J>
      </J>
    );
  };

  const leg = (side) => {
    const s = side === 'l' ? 1 : -1;
    return (
      <J name={`${side}Hip`} joints={joints} position={[0.092 * s, -0.055, 0]}>
        <Part geometry={g.thigh} material={skin} />
        {legs && <Part geometry={g.thighLeg} material={legMat} onClick={tap('legs')} position={[0, 0.01, 0]} />}
        <J name={`${side}Knee`} joints={joints} position={[0, -0.425, 0]}>
          <Part geometry={sphere} material={skin} scale={[0.05, 0.05, 0.05]} />
          <Part geometry={g.shin} material={skin} />
          {legs && <Part geometry={g.shinLeg} material={legMat} onClick={tap('legs')} />}
          <J name={`${side}Ankle`} joints={joints} position={[0, -0.415, 0]}>
            {shoes ? (
              <group onClick={tap('feet')}>
                <Part geometry={sphere} material={shoeMat} position={[0, -0.03, 0.055]} scale={[0.058, 0.05, 0.135]} onClick={tap('feet')} />
                <Part geometry={sphere} material={accentMat} position={[0.045 * s, -0.035, 0.05]} scale={[0.02, 0.028, 0.09]} onClick={tap('feet')} />
                <Part geometry={sphere} material={soleMat} position={[0, -0.062, 0.058]} scale={[0.064, 0.022, 0.145]} onClick={tap('feet')} />
              </group>
            ) : (
              <Part geometry={sphere} material={skin} position={[0, -0.035, 0.06]} scale={[0.045, 0.036, 0.12]} />
            )}
          </J>
        </J>
      </J>
    );
  };

  return (
    <group ref={root}>
      <J name="hips" joints={joints} position={[0, 0.985, 0]}>
        <Part geometry={g.pelvis} material={skin} scale={[1.02, 1, 0.7]} />
        {legs && <Part geometry={g.pelvisShell} material={legMat} onClick={tap('legs')} scale={[1.02, 1, 0.72]} />}
        {top && <Part geometry={g.pelvisTopShell} material={topMat} onClick={tap('torso')} scale={[1.02, 1, 0.74]} />}
        <J name="spine" joints={joints} position={[0, 0.055, 0]}>
          <Part geometry={g.abdomen} material={skin} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.66]} />
          {top && <Part geometry={g.abdomenShell} material={topMat} onClick={tap('torso')} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.72]} />}
          <J name="chest" joints={joints} position={[0, 0.2, 0]}>
            <Part geometry={g.torso} material={skin} scale={[1.08, 1, 0.62]} />
            {top && <Part geometry={g.torsoShell} material={topMat} onClick={tap('torso')} scale={[1.08, 1, 0.66]} />}
            {hood && <Part geometry={g.hood} material={topMat} onClick={tap('torso')} position={[0, 0.25, -0.085]} rotation={[-0.35, 0, 0]} scale={[0.95, 0.75, 0.55]} />}
            {hotspots?.torso}
            <J name="neck" joints={joints} position={[0, 0.285, 0]}>
              <Part geometry={g.neck} material={skin} rotation={[Math.PI, 0, 0]} />
              <J name="head" joints={joints} position={[0, 0.085, 0]}>
                <Part geometry={sphere} material={skin} position={[0, 0.1, 0.008]} rotation={[0.12, 0, 0]} scale={[0.086, 0.114, 0.1]} />
                {cap && <group onClick={tap('head')}>
                  <Part geometry={sphere} material={capMat} position={[0, 0.142, 0.002]} scale={[0.094, 0.082, 0.106]} onClick={tap('head')} />
                  <Part geometry={sphere} material={capMat} position={[0, 0.118, 0.12]} rotation={[-0.12, 0, 0]} scale={[0.085, 0.012, 0.075]} onClick={tap('head')} />
                </group>}
                {hotspots?.head}
              </J>
            </J>
            {arm('l')}
            {arm('r')}
          </J>
        </J>
        {leg('l')}
        {leg('r')}
        {hotspots?.legs}
      </J>
      {hotspots?.feet}
    </group>
  );
}

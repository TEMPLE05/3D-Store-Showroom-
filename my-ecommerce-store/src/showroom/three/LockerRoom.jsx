import { useMemo } from 'react';
import * as THREE from 'three';
import { woodMaterial } from './wood';

/* The shop floor from the reference video: dark wood lockers, warm light inside each bay, oak floor. */

const brass = new THREE.MeshStandardMaterial({ color: '#b48a4a', metalness: 0.85, roughness: 0.32 });
const shadowWood = new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 0.9 });
const led = new THREE.MeshBasicMaterial({ color: '#ffd9a3', toneMapped: false });

let glowTex;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 0, 4, 64, 40, 190);
  g.addColorStop(0, 'rgba(255,214,160,0.85)'); g.addColorStop(0.35, 'rgba(255,200,140,0.28)'); g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 256);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

const plateCache = new Map();
function plateTexture(text) {
  if (plateCache.has(text)) return plateCache.get(text);
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, '#d8b06a'); g.addColorStop(0.5, '#b28546'); g.addColorStop(1, '#8c6533');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = 'rgba(40,24,8,.5)'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = '#2a1a0a';
  ctx.font = '800 50px "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 256, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  plateCache.set(text, t);
  return t;
}

/** One open locker bay. Its inside is lit from a warm strip at the top. */
export function LockerBay({ width = 0.9, height = 2.3, depth = 0.6, label, glowOpacity = 0.85, children }) {
  const side = woodMaterial('locker', [1, 1]);
  const back = woodMaterial('locker', [3, 1]);
  const t = 0.04;
  return (
    <group>
      {/* back panel with slats */}
      <mesh position={[0, height / 2, -depth / 2]} material={back} receiveShadow>
        <boxGeometry args={[width, height, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (width - t)) / 2, height / 2, 0]} material={side} castShadow receiveShadow>
          <boxGeometry args={[t, height, depth]} />
        </mesh>
      ))}
      {/* top shelf and the cubby above it */}
      <mesh position={[0, height - 0.32, 0]} material={side} receiveShadow castShadow>
        <boxGeometry args={[width - t, 0.035, depth]} />
      </mesh>
      <mesh position={[0, height, 0]} material={side}>
        <boxGeometry args={[width, 0.05, depth + 0.02]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={shadowWood}>
        <boxGeometry args={[width, 0.12, depth]} />
      </mesh>
      {/* warm LED strip under the shelf + its light on the back panel */}
      <mesh position={[0, height - 0.345, depth / 2 - 0.08]} material={led}>
        <boxGeometry args={[width - 0.12, 0.008, 0.012]} />
      </mesh>
      <mesh position={[0, height - 0.36 - 0.9, -depth / 2 + 0.012]}>
        <planeGeometry args={[width * 0.98, 1.8]} />
        <meshBasicMaterial map={glow()} transparent opacity={glowOpacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* brass name plate */}
      {label && (
        <mesh position={[0, height - 0.17, depth / 2 + 0.012]}>
          <planeGeometry args={[Math.min(width * 0.62, 0.5), 0.09]} />
          <meshStandardMaterial map={plateTexture(label)} metalness={0.6} roughness={0.35} />
        </mesh>
      )}
      {/* clothes rail */}
      <mesh position={[0, height - 0.5, 0]} rotation-z={Math.PI / 2} material={brass}>
        <cylinderGeometry args={[0.012, 0.012, width - t * 2, 12]} />
      </mesh>
      {children}
    </group>
  );
}

/** A straight wall of locker bays centred on x = 0. */
export function LockerWall({ count = 7, width = 0.9, height = 2.3, depth = 0.6, labels = [], z = -1.6, renderBay }) {
  const xs = useMemo(() => Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * width), [count, width]);
  return (
    <group position={[0, 0, z]}>
      {xs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <LockerBay width={width} height={height} depth={depth} label={labels[i]}>{renderBay?.(i)}</LockerBay>
        </group>
      ))}
      {/* crown moulding across the top */}
      <mesh position={[0, height + 0.08, 0.02]} material={woodMaterial('locker', [8, 1])}>
        <boxGeometry args={[count * width + 0.1, 0.12, depth + 0.08]} />
      </mesh>
    </group>
  );
}

export function WoodFloor({ size = 14 }) {
  const mat = woodMaterial('floor', [size / 2.4, size / 2.4]);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={mat}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}

export function Bench({ length = 1.8, position = [0, 0, 0], rotation = 0 }) {
  const top = woodMaterial('shelf', [2, 1]);
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0.44, 0]} material={top} castShadow receiveShadow>
        <boxGeometry args={[length, 0.05, 0.36]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (length / 2 - 0.12), 0.21, 0]} material={shadowWood} castShadow>
          <boxGeometry args={[0.06, 0.42, 0.3]} />
        </mesh>
      ))}
    </group>
  );
}

/** Warm room lighting: soft fill, a few ceiling downlights, cool rim from behind. */
export function RoomLights({ downlights = [[0, 3.6, 0.6]], target = [0, 1, 0] }) {
  const aim = useMemo(() => { const o = new THREE.Object3D(); o.position.set(...target); return o; }, [target]);
  return (
    <>
      <primitive object={aim} />
      <hemisphereLight args={['#5a4634', '#120c08', 0.55]} />
      <ambientLight intensity={0.12} color="#ffe2c2" />
      {downlights.map((p, i) => (
        <spotLight key={i} position={p} target={aim} angle={0.42} penumbra={0.85} intensity={60} decay={2} distance={9}
          color="#ffd8a8" castShadow={i === 0} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      ))}
      <spotLight position={[-2.2, 2.6, -1.2]} target={aim} angle={0.6} penumbra={1} intensity={28} decay={2} color="#a9c4ff" />
      <spotLight position={[2.4, 2.8, -1.0]} target={aim} angle={0.6} penumbra={1} intensity={22} decay={2} color="#ffcf96" />
    </>
  );
}

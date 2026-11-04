import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ProductPiece } from './pieces';
import { cardSize } from './pieceUtils';
import { MODEL_TYPES } from './garmentBake';
import { woodMaterial } from './wood';
import { useInView, useReducedMotion } from './hooks';

const SLOT_W = 1.08;

function useColumns(ref) {
  const [w, setW] = useState(360);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  const cols = w >= 1100 ? 5 : w >= 820 ? 4 : w >= 560 ? 3 : 2;
  return { width: w, cols };
}

const is3D = (p) => p.demo && MODEL_TYPES.has(p.productType);

/* One product in its cubby: eases to its slot, or slides off the shelf when filtered out. */
function ShelfItem({ product, color, slot, visible, phase, rowH, onSelect, still }) {
  const ref = useRef();
  const target = useRef(new THREE.Vector3());
  const entered = useRef(false);
  const standing = is3D(product);
  const lift = standing ? 0.0 : cardSize(product.productType)[1] / 2 + 0.035;
  // shoes face sideways so the profile and stripe show; caps face out at three-quarters
  const baseTurn = product.productType === 'shoes' ? -1.25 : product.productType === 'caps' ? 0.5 : 0;

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    if (visible && slot) target.current.set(slot[0], slot[1] + lift, 0);
    else target.current.set(g.position.x >= 0 ? 6 : -6, g.position.y, 0);
    if (!entered.current && visible && slot) { g.position.set(slot[0], slot[1] - rowH * 0.5, 0); entered.current = true; }
    g.position.x = THREE.MathUtils.damp(g.position.x, target.current.x, visible ? 5 : 2.6, d);
    g.position.y = THREE.MathUtils.damp(g.position.y, target.current.y, 5, d);
    const s = THREE.MathUtils.damp(g.scale.x, visible ? 1 : 0.001, visible ? 6 : 3, d);
    g.scale.setScalar(s);
    g.visible = s > 0.01;
    g.rotation.y = baseTurn + (still ? 0 : Math.sin(t * 0.5 + phase) * 0.35);
  });

  return (
    <group ref={ref} position={[0, -50, 0]}>
      <ProductPiece product={product} color={color} context="shelf" onClick={visible ? () => onSelect(product._id) : undefined} />
    </group>
  );
}

let poolTex;
function pool() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 10, 2, 64, 60, 170);
  g.addColorStop(0, 'rgba(255,214,160,0.9)'); g.addColorStop(0.4, 'rgba(255,200,140,0.25)'); g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 256);
  poolTex = new THREE.CanvasTexture(c); poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}
const led = new THREE.MeshBasicMaterial({ color: '#ffd9a3', toneMapped: false });

function Shelving({ cols, rows, rowH }) {
  const width = cols * SLOT_W + 0.12;
  const total = rows * rowH;
  const back = woodMaterial('locker', [cols * 1.2, rows]);
  const shelf = woodMaterial('shelf', [cols * 0.8, 1]);
  const side = woodMaterial('locker', [1, rows * 0.6]);
  return (
    <group>
      <mesh position={[0, -total / 2 + rowH / 2, -0.42]} material={back}>
        <planeGeometry args={[width + 0.4, total + 0.4]} />
      </mesh>
      {Array.from({ length: rows }).map((_, r) => {
        const y = -r * rowH - rowH / 2 + 0.02; // shelf top
        return (
          <group key={r}>
            <mesh position={[0, y - 0.022, -0.1]} material={shelf} receiveShadow>
              <boxGeometry args={[width, 0.044, 0.66]} />
            </mesh>
            <mesh position={[0, y + rowH - 0.07, 0.16]} material={led}>
              <boxGeometry args={[width - 0.1, 0.01, 0.012]} />
            </mesh>
            {Array.from({ length: cols }).map((__, c) => (
              <mesh key={c} position={[(c - (cols - 1) / 2) * SLOT_W, y + rowH * 0.47, -0.41]}>
                <planeGeometry args={[SLOT_W * 0.96, rowH * 1.02]} />
                <meshBasicMaterial map={pool()} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} toneMapped={false} />
              </mesh>
            ))}
            {Array.from({ length: cols + 1 }).map((__, c) => (
              <mesh key={`d${c}`} position={[(c - cols / 2) * SLOT_W, y + rowH / 2 - 0.02, -0.1]} material={side} castShadow>
                <boxGeometry args={[0.03, rowH - 0.04, 0.66]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Rig({ height }) {
  useFrame(({ camera }) => {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const d = height / 2 / Math.tan(fov / 2);
    camera.position.set(0, -height / 2 + 0.08, d + 0.4);
    camera.lookAt(0, -height / 2 + 0.03, 0);
  });
  return null;
}

/**
 * items: [{ product, color }] all products in this view; visibleIds: ids that pass the filters.
 * Shoes and caps sit in a wall of lit wooden cubbies, 2 per shelf on phones.
 */
export default function ShelfScene({ items, visibleIds, onSelect, kind = 'shoes' }) {
  const wrap = useRef(null);
  const { width, cols } = useColumns(wrap);
  const [viewRef, inView] = useInView('200px');
  const reduced = useReducedMotion();
  const rowH = kind === 'caps' ? 0.82 : 0.78;

  const layout = useMemo(() => {
    const vis = items.filter((it) => visibleIds.has(it.product._id));
    const rows = Math.max(1, Math.ceil(vis.length / cols));
    const slots = new Map();
    vis.forEach((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, vis.length - r * cols);
      slots.set(it.product._id, [(c - (inRow - 1) / 2) * SLOT_W, -r * rowH - rowH / 2 + 0.02]);
    });
    return { rows, slots };
  }, [items, visibleIds, cols, rowH]);

  const worldW = cols * SLOT_W + 0.3;
  const worldH = layout.rows * rowH + 0.12;
  const cssH = Math.round((worldH / worldW) * width);

  return (
    <div ref={(el) => { wrap.current = el; viewRef.current = el; }} style={{ height: cssH, touchAction: 'pan-y' }}
      className="relative w-full transition-[height] duration-500">
      <Canvas shadows dpr={[1, 1.75]} frameloop={inView ? 'always' : 'never'} camera={{ fov: 18, near: 0.1, far: 60 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        <color attach="background" args={['#120c08']} />
        <hemisphereLight args={['#7a6248', '#1a120c', 0.9]} />
        <directionalLight position={[0.6, 3, 4]} intensity={1.6} color="#ffe2c0" castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={2} shadow-camera-bottom={-6} />
        <directionalLight position={[-2, 1, -1]} intensity={0.5} color="#a9c4ff" />
        <Rig height={worldH} />
        <Shelving cols={cols} rows={layout.rows} rowH={rowH} />
        <Suspense fallback={null}>
          {items.map((it, i) => (
            <ShelfItem key={it.product._id} product={it.product} color={it.color}
              slot={layout.slots.get(it.product._id)} visible={visibleIds.has(it.product._id)}
              phase={i * 1.7} rowH={rowH} onSelect={onSelect} still={reduced} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

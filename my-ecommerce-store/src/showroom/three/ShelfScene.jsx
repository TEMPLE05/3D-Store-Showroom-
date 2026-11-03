import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ProductPiece } from './pieces';
import { poolTexture, cardSize } from './pieceUtils';
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

/* One product sitting in its cubby. It eases to its slot, or slides off the shelf when filtered out. */
function ShelfItem({ product, color, slot, visible, phase, rowH, onSelect, still }) {
  const ref = useRef();
  const target = useRef(new THREE.Vector3());
  const entered = useRef(false);
  const [, h] = cardSize(product.productType);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    if (visible && slot) target.current.set(slot[0], slot[1] + h / 2 + 0.035, 0);
    else target.current.set(g.position.x >= 0 ? 6 : -6, g.position.y, 0);
    if (!entered.current && visible && slot) { g.position.set(slot[0], slot[1] - rowH * 0.5, 0); entered.current = true; }
    g.position.x = THREE.MathUtils.damp(g.position.x, target.current.x, visible ? 5 : 2.6, d);
    g.position.y = THREE.MathUtils.damp(g.position.y, target.current.y, 5, d);
    const s = THREE.MathUtils.damp(g.scale.x, visible ? 1 : 0.001, visible ? 6 : 3, d);
    g.scale.setScalar(s);
    g.visible = s > 0.01;
    g.rotation.y = still ? 0.12 : Math.sin(t * 0.55 + phase) * 0.42;
  });

  return (
    <group ref={ref} position={[0, -50, 0]}>
      <ProductPiece product={product} color={color} onClick={visible ? () => onSelect(product._id) : undefined} />
    </group>
  );
}

function Shelving({ cols, rows, rowH }) {
  const pool = poolTexture();
  const width = cols * SLOT_W + 0.24;
  const total = rows * rowH;
  return (
    <group>
      {/* back wall */}
      <mesh position={[0, -total / 2 + rowH / 2, -0.42]}>
        <planeGeometry args={[width + 2, total + 2]} />
        <meshStandardMaterial color="#17130f" roughness={0.95} />
      </mesh>
      {Array.from({ length: rows }).map((_, r) => {
        const y = -r * rowH - rowH / 2 + 0.02; // shelf top surface
        return (
          <group key={r}>
            <mesh position={[0, y - 0.025, -0.08]} receiveShadow>
              <boxGeometry args={[width, 0.05, 0.62]} />
              <meshStandardMaterial color="#2a2119" roughness={0.6} metalness={0.05} />
            </mesh>
            {/* warm LED strip under the shelf above, lighting this row */}
            <mesh position={[0, y + rowH - 0.06, 0.2]}>
              <boxGeometry args={[width - 0.1, 0.012, 0.012]} />
              <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
            </mesh>
            {Array.from({ length: cols }).map((__, c) => (
              <mesh key={c} position={[(c - (cols - 1) / 2) * SLOT_W, y + rowH * 0.48, -0.41]}>
                <planeGeometry args={[SLOT_W * 0.95, rowH * 1.05]} />
                <meshBasicMaterial map={pool} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.75} />
              </mesh>
            ))}
            {/* dividers between cubbies */}
            {Array.from({ length: cols + 1 }).map((__, c) => (
              <mesh key={`d${c}`} position={[(c - cols / 2) * SLOT_W, y + rowH / 2 - 0.02, -0.12]}>
                <boxGeometry args={[0.02, rowH - 0.05, 0.56]} />
                <meshStandardMaterial color="#1f1913" roughness={0.8} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Rig({ height }) {
  // Fit the shelf height exactly: camera distance from fov.
  useFrame(({ camera }) => {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const d = height / 2 / Math.tan(fov / 2);
    camera.position.set(0, -height / 2 + 0.06, d + 0.3);
    camera.lookAt(0, -height / 2 + 0.06, 0);
  });
  return null;
}

/**
 * items: [{ product, color }] all products in this view; visibleIds: Set of ids that pass the filters.
 * Shoes and caps sit in a wall of lit cubbies, 2 per shelf on phones.
 */
export default function ShelfScene({ items, visibleIds, onSelect, kind = 'shoes' }) {
  const wrap = useRef(null);
  const { width, cols } = useColumns(wrap);
  const [viewRef, inView] = useInView('200px');
  const reduced = useReducedMotion();
  const rowH = kind === 'caps' ? 0.86 : 0.8;

  const layout = useMemo(() => {
    const vis = items.filter((it) => visibleIds.has(it.product._id));
    const rows = Math.max(1, Math.ceil(vis.length / cols));
    const slots = new Map();
    vis.forEach((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, vis.length - r * cols);
      const x = (c - (inRow - 1) / 2) * SLOT_W;
      slots.set(it.product._id, [x, -r * rowH - rowH / 2 + 0.02]);
    });
    return { rows, slots };
  }, [items, visibleIds, cols, rowH]);

  const worldW = cols * SLOT_W + 0.3;
  const worldH = layout.rows * rowH + 0.1;
  const cssH = Math.round((worldH / worldW) * width);

  return (
    <div ref={(el) => { wrap.current = el; viewRef.current = el; }} style={{ height: cssH, touchAction: 'pan-y' }}
      className="relative w-full transition-[height] duration-500">
      <Canvas dpr={[1, 1.75]} frameloop={inView ? 'always' : 'never'} camera={{ fov: 18, near: 0.1, far: 60 }}
        gl={{ antialias: true }} flat={false}>
        <color attach="background" args={['#0f0c0a']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[0, 3, 4]} intensity={1.4} color="#ffe6c4" />
        <Rig height={worldH} />
        <group position={[0, -0.05 + 0.0, 0]}>
          <Shelving cols={cols} rows={layout.rows} rowH={rowH} />
          <Suspense fallback={null}>
            {items.map((it, i) => (
              <ShelfItem key={it.product._id} product={it.product} color={it.color}
                slot={layout.slots.get(it.product._id)} visible={visibleIds.has(it.product._id)}
                phase={i * 1.7} rowH={rowH} onSelect={onSelect} still={reduced} />
            ))}
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}

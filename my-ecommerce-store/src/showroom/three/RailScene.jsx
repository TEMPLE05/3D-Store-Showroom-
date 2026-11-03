import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ProductPiece } from './pieces';
import ShopLights from './ShopLights';
import { useInView, useReducedMotion } from './hooks';

const SPACING = 0.5;

/* Horizontal swipe along the rail with inertia; vertical swipes still scroll the page. */
function useRailDrag(count) {
  const s = useRef({ x: 0, target: 0, vel: 0, dragging: false, lastX: 0, lastT: 0, moved: 0 });
  const max = Math.max(0, (count - 1) * SPACING);
  const bind = {
    onPointerDown: (e) => { const r = s.current; r.dragging = true; r.lastX = e.clientX; r.lastT = performance.now(); r.vel = 0; r.moved = 0; },
    onPointerMove: (e) => {
      const r = s.current; if (!r.dragging) return;
      const now = performance.now(); const dx = (e.clientX - r.lastX) / 180;
      r.target = Math.min(max + 0.3, Math.max(-0.3, r.target - dx));
      r.vel = -dx / Math.max(0.008, (now - r.lastT) / 1000);
      r.moved += Math.abs(e.clientX - r.lastX);
      r.lastX = e.clientX; r.lastT = now;
    },
    onPointerUp: () => {
      const r = s.current; r.dragging = false;
      // snap to the nearest garment after a fling
      const flung = r.target + r.vel * 0.18;
      r.target = Math.min(max, Math.max(0, Math.round(flung / SPACING) * SPACING));
    },
    onPointerCancel: () => { s.current.dragging = false; },
  };
  const goTo = (i) => { s.current.target = Math.min(max, Math.max(0, i * SPACING)); };
  return { s, bind, goTo, max };
}

function Hung({ product, color, index, visibleIndex, rail, onSelect, still }) {
  const ref = useRef();
  useFrame((state, dt) => {
    const g = ref.current; if (!g) return;
    const d = Math.min(dt, 0.05);
    const shown = visibleIndex >= 0;
    const x = shown ? visibleIndex * SPACING - rail.s.current.x : g.position.x;
    g.position.x = shown ? x : g.position.x;
    g.position.y = THREE.MathUtils.damp(g.position.y, shown ? 0 : -1.6, 5, d);
    const sc = THREE.MathUtils.damp(g.scale.x, shown ? 1 : 0.001, 5, d);
    g.scale.setScalar(sc); g.visible = sc > 0.01;
    // garments away from the centre turn edge-on, like clothes on a real rail
    const turn = THREE.MathUtils.clamp(x * 1.9, -1.4, 1.4);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, turn, 8, d);
    const sway = still ? 0 : Math.sin(state.clock.elapsedTime * 1.1 + index) * 0.015;
    g.rotation.z = sway;
    const focus = 1 - Math.min(1, Math.abs(x) / SPACING);
    g.position.z = THREE.MathUtils.damp(g.position.z, focus * 0.22, 6, d);
  });
  const isClothing = ['tees', 'hoodies', 'jackets', 'trousers'].includes(product.productType);
  return (
    <group ref={ref} position={[0, -1.6, 0]}>
      {/* hanger */}
      <mesh position={[0, 0.02, 0]}>
        <torusGeometry args={[0.035, 0.006, 8, 20, Math.PI * 1.4]} />
        <meshStandardMaterial color="#c9c3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.075, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.006, 0.006, 0.42, 8]} />
        <meshStandardMaterial color="#3a2c20" roughness={0.6} />
      </mesh>
      <group position={[0, isClothing ? -0.43 : -0.32, 0]}>
        <ProductPiece product={product} color={color} width={0.58}
          onClick={() => {
            if (Math.abs(visibleIndex * SPACING - rail.s.current.x) < SPACING * 0.5) onSelect(product._id);
            else rail.goTo(visibleIndex);
          }} />
      </group>
    </group>
  );
}

function RailRig({ rail }) {
  useFrame((_, dt) => {
    const r = rail.s.current;
    r.x = THREE.MathUtils.damp(r.x, r.target, r.dragging ? 14 : 6, Math.min(dt, 0.05));
  });
  return null;
}

/** A clothing rail: swipe left/right; the centred piece faces you and opens on tap. */
export default function RailScene({ items, visibleIds, onSelect }) {
  const [viewRef, inView] = useInView('200px');
  const reduced = useReducedMotion();
  const order = useMemo(() => {
    const m = new Map(); let i = 0;
    items.forEach((it) => { if (visibleIds.has(it.product._id)) m.set(it.product._id, i++); });
    return m;
  }, [items, visibleIds]);
  const rail = useRailDrag(order.size);

  return (
    <div ref={viewRef} className="relative w-full" style={{ height: 'clamp(420px, 62svh, 620px)', touchAction: 'pan-y' }} {...rail.bind}>
      <Canvas dpr={[1, 1.75]} frameloop={inView ? 'always' : 'never'}
        camera={{ position: [0, 1.42, 2.75], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, 1.4, 0)}>
        <color attach="background" args={['#0b0a09']} />
        <fog attach="fog" args={['#0b0a09', 3.5, 8]} />
        <ShopLights target={[0, 1.4, 0]} floor={false} />
        <RailRig rail={rail} />
        <group position={[0, 1.78, 0]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.014, 0.014, 12, 12]} />
            <meshStandardMaterial color="#bdb6aa" metalness={0.9} roughness={0.25} />
          </mesh>
          <Suspense fallback={null}>
            {items.map((it, i) => (
              <Hung key={it.product._id} product={it.product} color={it.color} index={i}
                visibleIndex={order.has(it.product._id) ? order.get(it.product._id) : -1}
                rail={rail} onSelect={onSelect} still={reduced} />
            ))}
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}

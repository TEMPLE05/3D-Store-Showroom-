import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ProductPiece } from './pieces';
import { Hanger } from './Product3D';
import { LockerBay, WoodFloor, RoomLights } from './LockerRoom';
import { useInView, useReducedMotion } from './hooks';

const BAY = 0.76;

/* Horizontal swipe along the lockers with inertia; vertical swipes still scroll the page. */
function useRailDrag(count) {
  const s = useRef({ x: 0, target: 0, vel: 0, dragging: false, lastX: 0, lastT: 0 });
  const max = Math.max(0, (count - 1) * BAY);
  const bind = {
    onPointerDown: (e) => { const r = s.current; r.dragging = true; r.lastX = e.clientX; r.lastT = performance.now(); r.vel = 0; },
    onPointerMove: (e) => {
      const r = s.current; if (!r.dragging) return;
      const now = performance.now(); const dx = (e.clientX - r.lastX) / 260;
      r.target = Math.min(max + 0.35, Math.max(-0.35, r.target - dx));
      r.vel = -dx / Math.max(0.008, (now - r.lastT) / 1000);
      r.lastX = e.clientX; r.lastT = now;
    },
    onPointerUp: () => {
      const r = s.current; r.dragging = false;
      r.target = Math.min(max, Math.max(0, Math.round((r.target + r.vel * 0.15) / BAY) * BAY));
    },
    onPointerCancel: () => { s.current.dragging = false; },
  };
  const goTo = (i) => { s.current.target = Math.min(max, Math.max(0, i * BAY)); };
  return { s, bind, goTo };
}

const isHanging = (t) => ['tees', 'hoodies', 'jackets', 'trousers'].includes(t);

/* One locker with its garment. Away from the centre the garment hangs side-on, like on a real rail;
   the centred one slides out of the locker and turns to face you. */
function Locker({ product, color, visibleIndex, rail, onSelect, still, label }) {
  const ref = useRef(), item = useRef();
  useFrame((state, dt) => {
    const g = ref.current, it = item.current; if (!g || !it) return;
    const d = Math.min(dt, 0.05);
    const shown = visibleIndex >= 0;
    const x = shown ? visibleIndex * BAY - rail.s.current.x : g.position.x;
    g.position.x = x;
    const sc = THREE.MathUtils.damp(g.scale.y, shown ? 1 : 0.001, 6, d);
    g.scale.set(1, sc, 1); g.visible = sc > 0.02;
    const focus = 1 - Math.min(1, Math.abs(x) / (BAY * 0.75));
    it.rotation.y = THREE.MathUtils.damp(it.rotation.y, (1 - focus) * (x > 0 ? -1.35 : 1.35) + (still ? 0 : Math.sin(state.clock.elapsedTime * 0.8) * 0.06 * focus), 7, d);
    it.position.z = THREE.MathUtils.damp(it.position.z, focus * 0.42, 6, d);
    it.rotation.z = still ? 0 : Math.sin(state.clock.elapsedTime * 1.1 + visibleIndex) * 0.012;
  });
  const hanging = isHanging(product.productType);
  const open = () => {
    if (Math.abs(visibleIndex * BAY - rail.s.current.x) < BAY * 0.5) onSelect(product._id);
    else rail.goTo(visibleIndex);
  };
  return (
    <group ref={ref}>
      <LockerBay width={BAY} height={2.3} depth={0.62} label={label} glowOpacity={0.65} />
      <group ref={item} position={[0, hanging ? 1.8 : 1.15, 0]}>
        {hanging && <Hanger width={product.productType === 'trousers' ? 0.38 : 0.44} kind={product.productType === 'trousers' ? 'bar' : 'top'} />}
        <group position={[0, hanging ? -0.03 : 0, 0]}>
          <ProductPiece product={product} color={color} onClick={open} context="rail" />
        </group>
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

/** A row of wooden lockers, one garment in each: swipe along it; the front one comes out to meet you. */
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
    <div ref={viewRef} className="relative w-full" style={{ height: 'clamp(440px, 64svh, 640px)', touchAction: 'pan-y' }} {...rail.bind}>
      <Canvas dpr={[1, 1.75]} frameloop={inView ? 'always' : 'never'}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        camera={{ position: [0, 1.42, 3.15], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0, 1.36, 0)}>
        <color attach="background" args={['#0b0806']} />
        <fog attach="fog" args={['#0b0806', 3.2, 7]} />
        <RoomLights downlights={[[0.3, 2.9, 2.8]]} target={[0, 1.35, 0.2]} />
        <WoodFloor size={12} />
        <RailRig rail={rail} />
        <group position={[0, 0, -0.35]}>
          <Suspense fallback={null}>
            {items.map((it) => (
              <Locker key={it.product._id} product={it.product} color={it.color}
                visibleIndex={order.has(it.product._id) ? order.get(it.product._id) : -1}
                rail={rail} onSelect={onSelect} still={reduced} label={it.product.name} />
            ))}
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}

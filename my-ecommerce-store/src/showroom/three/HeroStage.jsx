import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Mannequin from './Mannequin';
import ShopLights from './ShopLights';
import { useDragSpin, useInView, useReducedMotion } from './hooks';

function Spinner({ spin, children }) {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y = spin.tick(Math.min(dt, 0.05)); });
  return <group ref={ref}>{children}</group>;
}

const Hotspot = ({ label, onClick, position }) => (
  <Html position={position} center zIndexRange={[20, 0]} className="pointer-events-none">
    <button type="button" onClick={onClick} className="sr-hotspot pointer-events-auto" aria-label={`Open ${label}`}>
      <span className="sr-hotspot-dot" />
    </button>
  </Html>
);

/**
 * The home-page mannequin under a spotlight.
 * outfit: { torso, legs, head, feet } → worn items; onSelect(id) opens a product.
 */
export default function HeroStage({ pose, outfit, onSelect, showHotspots = true }) {
  const reduced = useReducedMotion();
  const [wrapRef, inView] = useInView();
  const spin = useDragSpin({ auto: reduced ? 0 : 0.28 });

  const hs = (slot, position) =>
    showHotspots && outfit[slot] ? <Hotspot position={position} label={outfit[slot].name} onClick={() => onSelect(outfit[slot].id)} /> : null;

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ touchAction: 'pan-y' }} {...spin.bind}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={inView ? 'always' : 'never'}
        camera={{ position: [0, 1.12, 4.3], fov: 33, near: 0.1, far: 40 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ camera, scene }) => { camera.lookAt(0, 0.98, 0); scene.fog = null; }}
      >
        <color attach="background" args={['#0b0a09']} />
        <fog attach="fog" args={['#0b0a09', 5.5, 11]} />
        <ShopLights target={[0, 1.0, 0]} />
        <Spinner spin={spin}>
          <Mannequin
            pose={pose}
            outfit={outfit}
            onSelect={onSelect}
            still={reduced}
            hotspots={{
              torso: hs('torso', [0.0, 0.1, 0.16]),
              head: hs('head', [0, 0.2, 0.1]),
              legs: hs('legs', [0.1, -0.33, 0.12]),
              feet: hs('feet', [0.12, 0.05, 0.2]),
            }}
          />
        </Spinner>
      </Canvas>
    </div>
  );
}

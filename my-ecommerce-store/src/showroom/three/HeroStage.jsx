import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import MannequinModel from './MannequinModel';
import ShopLights from './ShopLights';
import Product3D, { Hanger } from './Product3D';
import { LockerWall, WoodFloor, Bench } from './LockerRoom';
import { useDragSpin, useInView, useReducedMotion } from './hooks';

// On narrow screens the figure stands a little right of centre, clear of the headline.
function Spinner({ spin, children }) {
  const ref = useRef();
  const { size } = useThree();
  const x = size.width < 640 ? 0.3 : 0.55;
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y = spin.tick(Math.min(dt, 0.05)); });
  return <group position={[x, 0, 0]}><group ref={ref}>{children}</group></group>;
}

const Hotspot = ({ label, onClick, position }) => (
  <Html position={position} center zIndexRange={[20, 0]} className="pointer-events-none">
    <button type="button" onClick={onClick} className="sr-hotspot pointer-events-auto" aria-label={`Open ${label}`}>
      <span className="sr-hotspot-dot" />
    </button>
  </Html>
);

const plinthMat = new THREE.MeshPhysicalMaterial({ color: '#0d0b0a', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2 });

/* Clothes hanging in the lockers behind the mannequin */
function BayContents({ item }) {
  if (!item) return null;
  const top = ['hoodies', 'tees', 'jackets', 'trousers'].includes(item.type);
  if (top) {
    return (
      <group position={[0, 1.78, 0]}>
        <Hanger width={item.type === 'trousers' ? 0.38 : 0.44} kind={item.type === 'trousers' ? 'bar' : 'top'} />
        <group position={[0, item.type === 'trousers' ? -0.04 : -0.02, 0]}><Product3D type={item.type} color={item.color} scale={0.92} /></group>
      </group>
    );
  }
  return <group position={[0, 1.99, -0.02]}><Product3D type={item.type} color={item.color} scale={1.1} /></group>;
}

/**
 * The home-page scene: a black display mannequin on a plinth under a spotlight, in a wooden locker room.
 * outfit: { torso, legs, head, feet }; bays: items hanging in the lockers behind.
 */
export default function HeroStage({ pose, outfit, onSelect, bays = [], showHotspots = true }) {
  const reduced = useReducedMotion();
  const [wrapRef, inView] = useInView();
  const spin = useDragSpin({ auto: reduced ? 0 : 0.26 });

  const hs = (slot, position) =>
    showHotspots && outfit[slot] ? <Hotspot position={position} label={outfit[slot].name} onClick={() => onSelect(outfit[slot].id)} /> : null;

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ touchAction: 'pan-y' }} {...spin.bind}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={inView ? 'always' : 'never'}
        camera={{ position: [0, 1.25, 7.2], fov: 29, near: 0.1, far: 40 }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}
      >
        <color attach="background" args={['#0b0806']} />
        <fog attach="fog" args={['#0b0806', 7.5, 15]} />
        <ShopLights target={[0.3, 1.1, 0]} floor={false} />
        <hemisphereLight args={['#6b5540', '#140d08', 0.5]} />
        <WoodFloor size={16} />
        <LockerWall count={9} width={0.92} z={-1.75} labels={['Shoes', 'Trousers', 'Tees', 'Hoodies', 'The look', 'New in', 'Caps', 'Trousers', 'Tees']}
          renderBay={(i) => <Suspense fallback={null}><BayContents item={bays[i]} /></Suspense>} />
        <Bench length={1.7} position={[-1.55, 0, -0.85]} rotation={0.12} />
        <mesh position={[0.3, 0.025, 0]} material={plinthMat} receiveShadow castShadow>
          <cylinderGeometry args={[0.52, 0.55, 0.05, 48]} />
        </mesh>
        <ContactShadows position={[0.3, 0.052, 0]} scale={1.6} blur={2.2} far={1.2} opacity={0.75} resolution={512} />
        <Spinner spin={spin}>
          <group position={[0, 0.05, 0]}>
            <Suspense fallback={null}>
              <MannequinModel pose={pose} outfit={outfit} onSelect={onSelect} still={reduced} />
            </Suspense>
            {hs('head', [0, 1.95, 0.12])}
            {hs('torso', [0.02, 1.32, 0.2])}
            {hs('legs', [0.14, 0.62, 0.16])}
            {hs('feet', [0.17, 0.09, 0.24])}
          </group>
        </Spinner>
      </Canvas>
    </div>
  );
}

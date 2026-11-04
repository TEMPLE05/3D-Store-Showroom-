import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { ProductPiece } from './pieces';
import { garmentKind } from './pieceUtils';
import { MODEL_TYPES, useProductSize } from './garmentBake';
import { useDragSpin, useReducedMotion } from './hooks';
import { woodMaterial } from './wood';

// Flat cards rock gently instead of spinning (a card seen edge-on is a thin line); dragging still turns them fully.
function Spin({ spin, rock, children }) {
  const ref = useRef();
  useFrame((state, dt) => {
    if (!ref.current) return;
    const a = spin.tick(Math.min(dt, 0.05));
    ref.current.rotation.y = a + (rock ? Math.sin(state.clock.elapsedTime * 0.7) * 0.55 : 0);
  });
  return <group ref={ref}>{children}</group>;
}

// A 3D product framed to fill the view: hanging pieces are centred on their middle, standing ones on their base.
function Framed({ product, color }) {
  const t = product.productType;
  const size = useProductSize(t);
  const hanging = ['tees', 'hoodies', 'jackets', 'trousers'].includes(t);
  const fit = 1.05 / Math.max(size.x, size.y, size.z * 0.8);
  const y = hanging ? (size.y * fit) / 2 : -(size.y * fit) / 2;
  return (
    <group position={[0, y, 0]} scale={fit}>
      <ProductPiece product={product} color={color} context="viewer" />
    </group>
  );
}

/** Big spinnable view of one product in the chosen color (drag to turn it all the way round). */
export default function ItemViewer({ product, color }) {
  const reduced = useReducedMotion();
  const model = product.demo && MODEL_TYPES.has(product.productType);
  const garment = model || (!product.photoOnly && garmentKind(product.productType));
  const spin = useDragSpin({ auto: reduced || !garment ? 0 : 0.5, damping: 2.5 });
  const width = garment ? 0.95 : product.productType === 'shoes' ? 1.25 : 1.0;
  return (
    <div className="absolute inset-0" style={{ touchAction: 'pan-y' }} {...spin.bind}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.05, 2.5], fov: 32 }} gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}>
        <hemisphereLight args={['#8a7056', '#20160e', 1.1]} />
        <spotLight position={[0.5, 3, 2.2]} angle={0.5} penumbra={0.9} intensity={45} color="#ffe2bd" />
        <directionalLight position={[-2, 1, -2]} intensity={1.4} color="#a9c8ff" />
        <Suspense fallback={null}>
          <Spin spin={spin} rock={!garment && !reduced}>
            {model
              ? <Framed key={`${product._id}-${color?.name}`} product={product} color={color} />
              : <ProductPiece key={`${product._id}-${color?.name}`} product={product} color={color} width={width} />}
          </Spin>
        </Suspense>
        <mesh position={[0, -0.69, 0]} rotation-x={-Math.PI / 2} material={woodMaterial('floor', [1.5, 1.5])}>
          <circleGeometry args={[0.9, 48]} />
        </mesh>
        <ContactShadows position={[0, -0.685, 0]} scale={2.2} blur={2.6} opacity={0.55} far={1.2} />
      </Canvas>
    </div>
  );
}

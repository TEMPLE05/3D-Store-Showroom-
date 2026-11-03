import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { ProductPiece } from './pieces';
import { garmentKind } from './pieceUtils';
import { useDragSpin, useReducedMotion } from './hooks';

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

/** Big spinnable view of one product in the chosen color (drag to turn it all the way round). */
export default function ItemViewer({ product, color }) {
  const reduced = useReducedMotion();
  const garment = !product.photoOnly && garmentKind(product.productType);
  const spin = useDragSpin({ auto: reduced || !garment ? 0 : 0.5, damping: 2.5 });
  const width = garment ? 0.95 : product.productType === 'shoes' ? 1.25 : 1.0;
  return (
    <div className="absolute inset-0" style={{ touchAction: 'pan-y' }} {...spin.bind}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.05, 2.4], fov: 32 }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[0.4, 3, 2]} angle={0.5} penumbra={0.9} intensity={40} color="#ffe2bd" />
        <directionalLight position={[-2, 1, -2]} intensity={1.2} color="#a9c8ff" />
        <Suspense fallback={null}>
          <Spin spin={spin} rock={!garment && !reduced}>
            <ProductPiece key={`${product._id}-${color?.name}`} product={product} color={color} width={width} />
          </Spin>
        </Suspense>
        <ContactShadows position={[0, garment ? -0.62 : -0.42, 0]} scale={2.4} blur={2.6} opacity={0.6} far={1} />
      </Canvas>
    </div>
  );
}

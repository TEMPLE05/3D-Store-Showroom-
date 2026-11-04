/* eslint-disable react-refresh/only-export-components -- standalone dev entry, not part of the app */
// Dev tool: renders one demo product at a time on a transparent background, for product images.
// Open /render.html; tools/render-thumbnails.cjs drives it through every product and color.
import ReactDOM from 'react-dom/client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Product3D from '../three/Product3D';
import { useProductSize } from '../three/garmentBake';
import { DEMO_PRODUCTS } from '../catalog';

window.__catalog = DEMO_PRODUCTS.map((p) => ({ id: p._id, type: p.productType, colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, accent: c.accent, sole: c.sole })) }));

function Framed({ type, color }) {
  const size = useProductSize(type);
  const hanging = ['tees', 'hoodies', 'jackets', 'trousers'].includes(type);
  const fit = (type === 'shoes' ? 1.12 : type === 'caps' ? 1.05 : 1.45) / Math.max(size.x, size.y, type === 'shoes' || type === 'caps' ? size.z : 0);
  const y = hanging ? (size.y * fit) / 2 : -(size.y * fit) / 2;
  const turn = type === 'shoes' ? -1.05 : type === 'caps' ? 0.55 : -0.32;
  return <group rotation-y={turn}><group position={[0, y, 0]} scale={fit}><Product3D type={type} color={color} /></group></group>;
}

function Ready({ onReady }) {
  const { gl } = useThree();
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => onReady(gl))); return () => cancelAnimationFrame(id); });
  return null;
}

function Studio() {
  const [job, setJob] = useState(null);
  useEffect(() => { window.__show = (type, color) => new Promise((res) => setJob({ type, color, res })); window.__studioUp = true; }, []);
  return (
    <Canvas gl={{ preserveDrawingBuffer: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      camera={{ position: [0, 0.12, 3.1], fov: 30 }} style={{ width: 640, height: 800 }}>
      <hemisphereLight args={['#fff4e6', '#3a2c20', 1.2]} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={2.4} color="#fff1df" />
      <directionalLight position={[-2.5, 1, -1.5]} intensity={1.1} color="#b9d0ff" />
      <directionalLight position={[0, -1.5, 2]} intensity={0.35} />
      <Suspense fallback={null}>
        {job && <Framed key={`${job.type}-${job.color.hex}-${job.color.accent}`} type={job.type} color={job.color} />}
        {job && <Ready onReady={() => job.res(true)} />}
      </Suspense>
    </Canvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Studio />);

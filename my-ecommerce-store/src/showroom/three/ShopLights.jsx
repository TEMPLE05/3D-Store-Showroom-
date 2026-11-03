import { useMemo, useRef, useEffect } from 'react';
import { Environment, Lightformer, ContactShadows, SpotLight } from '@react-three/drei';
import * as THREE from 'three';

// Radial "pool of light" texture painted on the floor under the spotlight.
function usePoolTexture(warm = '255,214,160') {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, `rgba(${warm},0.55)`);
    grd.addColorStop(0.35, `rgba(${warm},0.22)`);
    grd.addColorStop(0.7, `rgba(${warm},0.05)`);
    grd.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [warm]);
}

/** Spotlit display: warm key from above, cool + warm rim lights from behind, floor pool, soft contact shadow. */
export default function ShopLights({ target = [0, 1, 0], cone = true, floor = true, shadowScale = 2.4 }) {
  const pool = usePoolTexture();
  const key = useRef();
  const rimL = useRef();
  const rimR = useRef();
  const aim = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    aim.position.set(...target);
    aim.updateMatrixWorld();
    [key, rimL, rimR].forEach((r) => { if (r.current) r.current.target = aim; });
  }, [aim, target]);

  return (
    <>
      <primitive object={aim} />
      <hemisphereLight args={['#3a3430', '#050505', 0.35]} />
      {cone ? (
        <SpotLight ref={key} position={[0.25, 4.4, 0.9]} angle={0.36} penumbra={0.85} intensity={95} distance={9} decay={2}
          color="#ffdcb0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
          attenuation={4.6} anglePower={4.5} radiusTop={0.06} radiusBottom={1.25} opacity={0.32} volumetric />
      ) : (
        <spotLight ref={key} position={[0.25, 4.4, 0.9]} angle={0.4} penumbra={0.85} intensity={95} distance={9} decay={2} color="#ffdcb0" castShadow />
      )}
      <spotLight ref={rimL} position={[-2.4, 2.4, -2.2]} angle={0.5} penumbra={1} intensity={55} decay={2} color="#a9c8ff" />
      <spotLight ref={rimR} position={[2.3, 2.8, -2]} angle={0.5} penumbra={1} intensity={45} decay={2} color="#ffd39a" />
      <pointLight position={[0, 0.9, 2.6]} intensity={1.6} decay={2} color="#ffe9cc" />

      {/* Reflections for the glossy finish, built from light panels (no image download). */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffe2c0" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[3, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#b8d0ff" position={[-4, 1.5, -2]} rotation-y={Math.PI / 3} scale={[1, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffd6a0" position={[4, 1.5, -2]} rotation-y={-Math.PI / 3} scale={[1, 4, 1]} />
        <Lightformer form="ring" intensity={0.6} position={[0, 1, 5]} scale={2} />
      </Environment>

      {floor && <>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[9, 64]} />
          <meshStandardMaterial color="#121010" roughness={0.85} metalness={0.05} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0.15]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial map={pool} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <ContactShadows position={[0, 0.003, 0]} scale={shadowScale} blur={2.4} far={1.2} opacity={0.85} resolution={512} color="#000" />
      </>}
    </>
  );
}

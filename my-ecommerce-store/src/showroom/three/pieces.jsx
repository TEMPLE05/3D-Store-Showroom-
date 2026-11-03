import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { OUTLINES, OUTLINE_VIEW } from '../art';
import { cardSize, garmentKind } from './pieceUtils';

/* ---------- Textures ---------- */

function useImageTextures(urls) {
  const list = useLoader(THREE.TextureLoader, urls);
  return useMemo(() => {
    list.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; });
    return list;
  }, [list]);
}

/* ---------- Turning card: a cut-out photo with a front and a back ---------- */

export function TurningCard({ images, type, width, onClick }) {
  const urls = images.length > 1 ? [images[0], images[1]] : [images[0], images[0]];
  const [front, back] = useImageTextures(urls);
  const [w0, h0] = cardSize(type);
  const k = width ? width / w0 : 1;
  const w = w0 * k, h = h0 * k;
  const pointer = onClick ? {
    onClick: (e) => { e.stopPropagation(); onClick(); },
    onPointerOver: () => { document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = ''; },
  } : {};
  return (
    <group {...pointer}>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={front} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
      <mesh rotation-y={Math.PI} position={[0, 0, -0.002]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={back} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- Garment: the product outline extruded a little, front and back art on each face ---------- */

const garmentCache = new Map();
function garmentGeometry(kind) {
  if (garmentCache.has(kind)) return garmentCache.get(kind);
  const [vx, vy, vw, vh] = OUTLINE_VIEW[kind];
  const S = 1 / 400; // 400 art px = 1 m
  const shape = new THREE.Shape(OUTLINES[kind].map(([x, y]) => new THREE.Vector2((x - 200) * S, -(y - 220) * S)));
  const depth = 0.035;
  const sides = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 4 });
  sides.translate(0, 0, -depth / 2);
  const face = new THREE.ShapeGeometry(shape);
  // map art pixels → uv using the art's viewBox
  const pos = face.attributes.position, uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / S + 200, py = -pos.getY(i) / S + 220;
    uv.setXY(i, (px - vx) / vw, 1 - (py - vy) / vh);
  }
  uv.needsUpdate = true;
  const out = { sides, face, z: depth / 2 + 0.0135 };
  garmentCache.set(kind, out);
  return out;
}


export function Garment({ images, type, hex = '#777', onClick, scale = 1 }) {
  const kind = garmentKind(type) || 'tee';
  const g = garmentGeometry(kind);
  const urls = images.length > 1 ? [images[0], images[1]] : [images[0], images[0]];
  const [front, back] = useImageTextures(urls);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.7), roughness: 0.95 }), [hex]);
  const pointer = onClick ? {
    onClick: (e) => { e.stopPropagation(); onClick(); },
    onPointerOver: () => { document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = ''; },
  } : {};
  return (
    <group scale={scale} {...pointer}>
      <mesh geometry={g.sides} material={edge} castShadow />
      <mesh geometry={g.face} position={[0, 0, g.z]}>
        <meshStandardMaterial map={front} roughness={0.9} transparent alphaTest={0.05} />
      </mesh>
      <mesh geometry={g.face} position={[0, 0, -g.z]} rotation-y={Math.PI}>
        <meshStandardMaterial map={back} roughness={0.9} transparent alphaTest={0.05} />
      </mesh>
    </group>
  );
}

/** Shows either a 3D garment (clothing with a known outline) or a turning card (shoes, caps, photos). */
export function ProductPiece({ product, color, onClick, width }) {
  const c = color || product.colors[0];
  const images = c.images?.length ? c.images : product.image;
  if (!product.photoOnly && garmentKind(product.productType)) {
    return <Garment images={images} type={product.productType} hex={c.hex} onClick={onClick} scale={width ? width / 0.9 : 1} />;
  }
  return <TurningCard images={images} type={product.photoOnly ? 'photo' : product.productType} onClick={onClick} width={width} />;
}


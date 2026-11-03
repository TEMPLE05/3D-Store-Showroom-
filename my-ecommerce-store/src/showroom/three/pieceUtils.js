import * as THREE from 'three';

export function cardSize(type) {
  if (type === 'shoes') return [0.9, 0.9 * (240 / 420)];
  if (type === 'caps') return [0.78, 0.78 * (280 / 400)];
  return [0.78, 0.78 * (450 / 390)]; // portrait product photo
}

const KIND = { tees: 'tee', hoodies: 'hoodie', jackets: 'hoodie', trousers: 'trousers' };
export const garmentKind = (type) => KIND[type];

/* Soft light pool (for walls and shelves) */
let poolTex;
export function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(64, 20, 2, 64, 60, 150);
  grd.addColorStop(0, 'rgba(255,220,170,0.75)');
  grd.addColorStop(0.4, 'rgba(255,214,160,0.22)');
  grd.addColorStop(1, 'rgba(255,214,160,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 256);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

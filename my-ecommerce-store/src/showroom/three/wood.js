import * as THREE from 'three';

/* Procedural wood: dark walnut lockers, oak floorboards, a light hanger wood. Drawn once on a canvas. */

const PRESETS = {
  locker: { base: [62, 38, 24], dark: [34, 20, 12], light: [92, 60, 38], planks: 1, rings: 0.9, size: [256, 512] },
  floor: { base: [70, 46, 30], dark: [40, 26, 16], light: [104, 72, 46], planks: 6, rings: 0.7, size: [512, 512] },
  shelf: { base: [84, 54, 34], dark: [48, 30, 18], light: [120, 82, 52], planks: 1, rings: 0.8, size: [512, 128], horizontal: true },
  hanger: { base: [168, 126, 84], dark: [128, 90, 56], light: [200, 160, 112], planks: 1, rings: 0.6, size: [256, 64], horizontal: true },
};

// small deterministic noise
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

const textures = {};
function woodTexture(kind) {
  if (textures[kind]) return textures[kind];
  const p = PRESETS[kind];
  const [W, H] = p.size;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // grain runs along v (vertical) unless horizontal
      const u = p.horizontal ? y / H : x / W, v = p.horizontal ? x / W : y / H;
      const plank = Math.floor(u * p.planks);
      const pu = u * p.planks - plank;
      const warp = fbm(pu * 3 + plank * 7.3, v * 2.5) * 2.2;
      const grain = Math.sin((pu * 38 + warp * 6 + plank * 13) * p.rings) * 0.5 + 0.5;
      const fine = fbm(pu * 90 + plank * 3, v * 9) ;
      let t = grain * 0.55 + fine * 0.45;
      t += (hash(plank, 3) - 0.5) * 0.25; // plank-to-plank colour variation
      const seam = p.planks > 1 && (pu < 0.012 || pu > 0.988) ? 0.45 : 1;
      const col = p.base.map((b, k) => {
        const lo = p.dark[k], hi = p.light[k];
        const m = t < 0.5 ? lo + (b - lo) * (t * 2) : b + (hi - b) * ((t - 0.5) * 2);
        return Math.max(0, Math.min(255, m * seam));
      });
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  textures[kind] = t;
  return t;
}

const mats = {};
export function woodMaterial(kind = 'locker', repeat = [1, 1]) {
  const key = `${kind}:${repeat.join('x')}`;
  if (mats[key]) return mats[key];
  const map = woodTexture(kind).clone();
  map.repeat.set(...repeat);
  map.needsUpdate = true;
  mats[key] = new THREE.MeshStandardMaterial({
    map, roughness: kind === 'floor' ? 0.55 : kind === 'hanger' ? 0.45 : 0.62, metalness: 0,
    color: kind === 'floor' ? '#d9cbbd' : '#ffffff',
  });
  return mats[key];
}

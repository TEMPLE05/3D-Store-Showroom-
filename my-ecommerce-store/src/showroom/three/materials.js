import * as THREE from 'three';

/* Shared materials: the glossy black mannequin finish and fabric with a procedural weave. */

let mannequin;
export function mannequinMaterial() {
  if (!mannequin) {
    mannequin = new THREE.MeshPhysicalMaterial({
      color: '#0b0b0d', roughness: 0.26, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.12,
      sheen: 0.15, sheenColor: new THREE.Color('#2a2a33'),
    });
  }
  return mannequin;
}

// Tileable normal maps drawn on a canvas: knit (cotton jersey), rib (cuffs), twill (caps), grain (leather).
const maps = {};
function normalMap(kind) {
  if (maps[kind]) return maps[kind];
  const S = 256;
  const h = new Float32Array(S * S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      if (kind === 'cotton') {
        // interlocking knit loops: rows of small v-shapes
        const cx = (x % 8) - 4, cy = (y % 10);
        v = Math.sin((Math.abs(cx) * 0.9 + cy * 0.6) * 0.9) * 0.5 + Math.sin(y * 0.63) * 0.25;
      } else if (kind === 'rib') {
        v = Math.sin(x * (Math.PI * 2 / 10)) * 0.9 + Math.sin(y * 0.8) * 0.1;
      } else if (kind === 'twill') {
        v = Math.sin((x + y) * (Math.PI * 2 / 9)) * 0.8;
      } else if (kind === 'leather' || kind === 'rubber') {
        v = (Math.sin(x * 0.37 + Math.sin(y * 0.21) * 3) + Math.sin(y * 0.41 + Math.sin(x * 0.17) * 3)) * 0.25;
      } else if (kind === 'cord') {
        v = Math.sin((x * 0.5 + y) * (Math.PI * 2 / 12)) * 0.8;
      }
      // fine noise so it never looks perfectly regular
      v += (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.12;
      h[y * S + x] = v;
    }
  }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
      const n = new THREE.Vector3(-dx, -dy, 2.2).normalize();
      const i = (y * S + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  maps[kind] = t;
  return t;
}

const SETTINGS = {
  cotton: { roughness: 0.92, sheen: 0.6, repeat: 110, normal: 0.35 },
  rib: { roughness: 0.9, sheen: 0.5, repeat: 60, normal: 0.9 },
  twill: { roughness: 0.85, sheen: 0.35, repeat: 90, normal: 0.4 },
  leather: { roughness: 0.5, sheen: 0, repeat: 30, normal: 0.25, clearcoat: 0.25 },
  rubber: { roughness: 0.75, sheen: 0, repeat: 30, normal: 0.15 },
  cord: { roughness: 0.8, sheen: 0.3, repeat: 30, normal: 0.6 },
};

const cache = new Map();
export function fabricMaterial(color, kind = 'cotton', vertexColors = false) {
  const c = new THREE.Color(color);
  const key = `${kind}:${c.getHexString()}:${vertexColors ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  const s = SETTINGS[kind] || SETTINGS.cotton;
  const map = normalMap(kind === 'rubber' ? 'leather' : kind).clone();
  map.repeat.set(s.repeat, s.repeat);
  map.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({
    color: c, roughness: s.roughness, metalness: 0,
    sheen: s.sheen, sheenRoughness: 0.8, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.35),
    normalMap: map, normalScale: new THREE.Vector2(s.normal, s.normal),
    clearcoat: s.clearcoat || 0, clearcoatRoughness: 0.5,
    vertexColors, // ribs and stitched pocket edges are a shade darker
    side: THREE.DoubleSide,
  });
  cache.set(key, m);
  return m;
}

const shadeHex = (hex, k) => { const c = new THREE.Color(hex); return k >= 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.multiplyScalar(1 + k); };

/** Fabric for one garment part in a product color. item = { hex, accent, sole } */
export function partMaterial(part, item, hasVertexColors = false) {
  if (part === 'Shoe') return shoeMaterial(item);
  let color = item.hex, kind = 'cotton';
  if (part === 'HoodieStrings') { color = shadeHex(item.hex, 0.55); kind = 'cord'; }
  else if (part === 'HoodiePocket' || part === 'TrouserPockets') color = shadeHex(item.hex, -0.04);
  else if (part === 'ShoeSole') { color = item.sole || '#f2f0ea'; kind = 'rubber'; }
  else if (part === 'ShoeAccent') { color = item.accent || '#ffffff'; kind = 'leather'; }
  else if (part === 'ShoeUpper') kind = 'leather';
  else if (part === 'ShoeLaces') { color = shadeHex(item.sole || '#f2f0ea', 0.1); kind = 'cord'; }
  else if (part === 'ShoeCollar') color = shadeHex(item.hex, -0.25);
  else if (part.startsWith('Cap')) kind = 'twill';
  return fabricMaterial(color, kind, hasVertexColors);
}

// Sneaker shell: vertex colour red = sole mask, green = stripe mask, blue = darker inner lip.
const shoeCache = new Map();
export function shoeMaterial(item) {
  const key = `${item.hex}|${item.accent}|${item.sole}`;
  if (shoeCache.has(key)) return shoeCache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.5, vertexColors: true, side: THREE.DoubleSide,
    normalMap: (() => { const t = normalMap('leather').clone(); t.repeat.set(30, 30); t.needsUpdate = true; return t; })(),
    normalScale: new THREE.Vector2(0.2, 0.2),
  });
  const uUpper = { value: new THREE.Color(item.hex || '#f2f0ea') };
  const uAccent = { value: new THREE.Color(item.accent || '#d33b2c') };
  const uSole = { value: new THREE.Color(item.sole || '#f2f0ea') };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uUpper = uUpper; shader.uniforms.uAccent = uAccent; shader.uniforms.uSole = uSole;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uUpper; uniform vec3 uAccent; uniform vec3 uSole;')
      .replace('#include <color_fragment>', `
        vec3 shoeCol = mix(mix(uUpper, uAccent, vColor.g), uSole, vColor.r);
        diffuseColor.rgb = shoeCol * (1.0 - 0.45 * vColor.b);
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.82, vColor.r);');
  };
  m.customProgramCacheKey = () => 'shoe-mask';
  shoeCache.set(key, m);
  return m;
}

// Demo catalog for "ASO Studio", an invented boutique.
// Used whenever the backend is unreachable or has no products, so the showroom always has stock to show.
// All brands here are invented. Replace with a boutique's real stock through the admin panel.

import { toDataUrl, sneakerSvg, teeSvg, hoodieSvg, capSvg, trousersSvg, brandMarkSvg } from './art';

export const STORE = {
  name: import.meta.env.VITE_STORE_NAME || 'ASO Studio',
  tagline: import.meta.env.VITE_STORE_TAGLINE || 'Streetwear · Abuja',
  whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || '2348000000000',
  // The owner's pose for this week's featured look: standing | hip | step | relaxed
  featuredPose: import.meta.env.VITE_FEATURED_POSE || 'hip',
};

export const CATEGORIES = [
  { slug: 'shoes', label: 'Shoes', note: 'Shop by brand', display: 'shelf' },
  { slug: 'hoodies', label: 'Hoodies', note: 'On the rail', display: 'rail' },
  { slug: 'tees', label: 'Tees', note: 'On the rail', display: 'rail' },
  { slug: 'trousers', label: 'Trousers', note: 'On the rail', display: 'rail' },
  { slug: 'caps', label: 'Caps', note: 'On the wall', display: 'wall' },
  { slug: 'jackets', label: 'Jackets', note: 'On the rail', display: 'rail' },
];

export const SHOE_BRANDS = [
  { slug: 'volta', name: 'VOLTA', style: 'slant' },
  { slug: 'kairo', name: 'KAIRO', style: 'ring' },
  { slug: 'zuri', name: 'ZURI', style: 'stack' },
  { slug: 'northline', name: 'NORTHLINE', style: 'word' },
].map((b) => ({ ...b, logo: toDataUrl(brandMarkSvg({ name: b.name, style: b.style })) }));

const SHOE_SIZES = ['39', '40', '41', '42', '43', '44', '45', '46'];
const WEAR_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// Deterministic "random" stock so sold-out sizes stay the same between reloads.
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const stockFor = (sizes, seed) => {
  const r = seeded(seed);
  return sizes.map((size) => ({ size, stock: r() < 0.22 ? 0 : 1 + Math.floor(r() * 6) }));
};

let n = 0;
const id = (p) => `demo-${p}-${(++n).toString().padStart(3, '0')}`;

const COLOR = {
  white: ['White', '#f2f0ea'], black: ['Black', '#151515'], red: ['Red', '#8e2420'], navy: ['Navy', '#2f3d5c'],
  sand: ['Sand', '#c9b79c'], olive: ['Olive', '#4a5236'], grey: ['Grey', '#7b7d80'], cream: ['Cream', '#e9e2d2'],
  green: ['Green', '#2f5d46'], blue: ['Blue', '#3d63a8'], brown: ['Brown', '#6b4a33'],
};

function product({ type, name, brand, price, description, colors, bestseller = false, featured, display }) {
  const _id = id(type);
  const sizeList = type === 'shoes' ? SHOE_SIZES : WEAR_SIZES;
  const builtColors = colors.map((c, i) => ({
    ...c,
    sizes: stockFor(sizeList, _id.length * 97 + i * 31 + n * 13),
  }));
  return {
    _id,
    name,
    brand,
    description,
    price,
    productType: type,
    displayType: display || CATEGORIES.find((c) => c.slug === type)?.display || 'rail',
    image: builtColors[0].images,
    colors: builtColors,
    sizes: sizeList,
    bestseller,
    featured,
    category: 'Unisex',
    subCategory: type,
    date: Date.now() - n * 3600_000,
    demo: true,
  };
}

/* ---------- Shoes ---------- */
const shoe = (brand, name, shape, price, variants, extra = {}) =>
  product({
    type: 'shoes', brand, name, price, ...extra,
    description: `${name} by ${brand}. Cushioned midsole, breathable upper and a grippy rubber outsole for all-day wear around town.`,
    colors: variants.map(([colorKey, accent, sole]) => {
      const [cname, hex] = COLOR[colorKey];
      return {
        name: cname, hex, accent, sole,
        images: [
          toDataUrl(sneakerSvg({ upper: hex, accent, sole, shape, brand })),
          toDataUrl(sneakerSvg({ upper: hex, accent, sole, shape, brand, mirror: true })),
        ],
      };
    }),
  });

const shoes = [
  shoe('VOLTA', 'Volta Sprint 2', 'runner', 64000, [['white', '#d33b2c', '#f7f5ef'], ['black', '#d33b2c', '#1c1c1c'], ['navy', '#f0b43c', '#efe9dc']], { bestseller: true, featured: 'feet' }),
  shoe('VOLTA', 'Volta Court Low', 'court', 52000, [['white', '#2f3d5c', '#f7f5ef'], ['cream', '#2f5d46', '#e3d9c4']]),
  shoe('VOLTA', 'Volta Rise Hi', 'high', 71000, [['red', '#f4efe6', '#f4efe6'], ['black', '#f4efe6', '#f4efe6']]),
  shoe('VOLTA', 'Volta Daily', 'runner', 45000, [['grey', '#151515', '#f2f0ea'], ['green', '#e9e2d2', '#e9e2d2']]),
  shoe('KAIRO', 'Kairo Loop', 'court', 58000, [['black', '#e8e2d4', '#e8e2d4'], ['white', '#151515', '#f2f0ea']], { bestseller: true }),
  shoe('KAIRO', 'Kairo Terrain', 'runner', 68000, [['olive', '#d98a2b', '#2a2a2a'], ['brown', '#e9e2d2', '#3a2a1e']]),
  shoe('KAIRO', 'Kairo Arc Hi', 'high', 76000, [['navy', '#f2f0ea', '#f2f0ea'], ['white', '#8e2420', '#f2f0ea']]),
  shoe('ZURI', 'Zuri Pace', 'runner', 49000, [['blue', '#f2f0ea', '#f2f0ea'], ['black', '#3d63a8', '#151515'], ['white', '#3d63a8', '#f2f0ea']], { bestseller: true }),
  shoe('ZURI', 'Zuri Classic', 'court', 39000, [['cream', '#8e2420', '#e3d9c4'], ['white', '#2f5d46', '#f2f0ea']]),
  shoe('ZURI', 'Zuri Street Hi', 'high', 55000, [['black', '#e9e2d2', '#e9e2d2'], ['sand', '#6b4a33', '#f2f0ea']]),
  shoe('NORTHLINE', 'Northline Trail', 'runner', 82000, [['grey', '#f0b43c', '#222'], ['olive', '#f2f0ea', '#2a2a2a']]),
  shoe('NORTHLINE', 'Northline Base', 'court', 47000, [['white', '#7b7d80', '#f2f0ea'], ['black', '#7b7d80', '#151515']]),
  shoe('NORTHLINE', 'Northline Summit', 'high', 85000, [['brown', '#e9e2d2', '#e9e2d2'], ['navy', '#c9b79c', '#e9e2d2']]),
];

/* ---------- Clothing ---------- */
const wear = (type, name, price, keys, art, extra = {}) =>
  product({
    type, brand: 'ASO', name, price, ...extra,
    description: extra.description || `${name}. Heavyweight cotton, relaxed fit, made for Abuja heat and cool harmattan evenings.`,
    colors: keys.map((k) => {
      const [cname, hex] = COLOR[k];
      return { name: cname, hex, images: [toDataUrl(art(hex, false)), toDataUrl(art(hex, true))] };
    }),
  });

const hoodies = [
  wear('hoodies', 'Core Hoodie', 38000, ['black', 'sand', 'grey', 'olive'], (c, back) => hoodieSvg({ color: c, brand: 'ASO', back }), { bestseller: true, featured: 'torso' }),
  wear('hoodies', 'Harmattan Heavy Hoodie', 45000, ['cream', 'brown', 'black'], (c, back) => hoodieSvg({ color: c, brand: 'ASO', back })),
  wear('hoodies', 'Studio Zip Hoodie', 42000, ['navy', 'green', 'grey'], (c, back) => hoodieSvg({ color: c, brand: '', back })),
  wear('hoodies', 'Logo Hoodie', 36000, ['red', 'black', 'white'], (c, back) => hoodieSvg({ color: c, brand: 'ASO', back })),
];

const tees = [
  wear('tees', 'Everyday Tee', 12000, ['white', 'black', 'grey', 'sand'], (c, back) => teeSvg({ color: c, brand: 'ASO', back }), { bestseller: true }),
  wear('tees', 'Big Logo Tee', 15000, ['black', 'cream', 'red'], (c, back) => teeSvg({ color: c, brand: 'ASO', back, print: 'big' }), { bestseller: true }),
  wear('tees', 'Stripe Tee', 14000, ['navy', 'white', 'olive'], (c, back) => teeSvg({ color: c, brand: 'ASO', back, print: 'stripe' })),
  wear('tees', 'Heavy Box Tee', 18000, ['brown', 'black', 'cream'], (c, back) => teeSvg({ color: c, brand: 'ASO', back })),
];

const trousers = [
  wear('trousers', 'Cargo Trousers', 28000, ['olive', 'black', 'sand'], (c, back) => trousersSvg({ color: c, back }), { featured: 'legs', bestseller: true }),
  wear('trousers', 'Wide Leg Chinos', 24000, ['cream', 'brown', 'navy'], (c, back) => trousersSvg({ color: c, back })),
  wear('trousers', 'Utility Joggers', 21000, ['grey', 'black', 'green'], (c, back) => trousersSvg({ color: c, back })),
];

const caps = [
  wear('caps', 'Logo Cap', 9000, ['black', 'cream', 'navy'], (c, back) => capSvg({ color: c, brand: 'ASO', back }), { featured: 'head' }),
  wear('caps', 'Washed Dad Cap', 8000, ['sand', 'olive', 'brown'], (c, back) => capSvg({ color: c, brand: '', back })),
  wear('caps', 'Team Cap', 11000, ['red', 'green', 'blue'], (c, back) => capSvg({ color: c, brand: 'ASO', back })),
  wear('caps', 'Studio Cap', 10000, ['white', 'black'], (c, back) => capSvg({ color: c, brand: 'ASO', back })),
];

export const DEMO_PRODUCTS = [...shoes, ...hoodies, ...tees, ...trousers, ...caps];

import { CATEGORIES, STORE } from './catalog';

// Older products (from the original store) have no productType/colors.
// Map them into the showroom shape so they still appear.
const LEGACY_TYPE = { Topwear: 'tees', Bottomwear: 'trousers', Winterwear: 'jackets' };

export function normalizeProduct(p) {
  const productType = (p.productType || LEGACY_TYPE[p.subCategory] || 'tees').toLowerCase();
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  let colors = Array.isArray(p.colors) && p.colors.length ? p.colors : null;
  if (!colors) {
    colors = [{ name: 'Default', hex: '#888888', images: p.image || [], sizes: sizes.map((size) => ({ size, stock: 1 })) }];
  }
  colors = colors.map((c) => ({
    ...c,
    images: c.images?.length ? c.images : p.image || [],
    sizes: (c.sizes || []).map((s) => (typeof s === 'string' ? { size: s, stock: 1 } : s)),
  }));
  const category = CATEGORIES.find((c) => c.slug === productType);
  return {
    ...p,
    productType,
    brand: p.brand || '',
    colors,
    displayType: p.displayType && p.displayType !== 'auto' ? p.displayType : category?.display || 'rail',
    // Legacy photos show people wearing the item; they can't be painted onto a garment shape.
    photoOnly: !p.colors?.length && !p.demo,
  };
}

export const slugify = (s = '') => s.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const formatPrice = (currency, value) => `${currency}${Number(value || 0).toLocaleString('en-NG')}`;

export function allSizes(items) {
  const set = new Set();
  items.forEach((p) => p.colors.forEach((c) => c.sizes.forEach((s) => set.add(s.size))));
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  return [...set].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return order.indexOf(a) - order.indexOf(b);
  });
}

export function allColors(items) {
  const map = new Map();
  items.forEach((p) => p.colors.forEach((c) => { if (c.name !== 'Default' && !map.has(c.name)) map.set(c.name, c.hex); }));
  return [...map].map(([name, hex]) => ({ name, hex }));
}

// Does this product have the chosen color (and, if chosen, that size in stock in that color)?
export function matchVariant(p, color, size) {
  const colors = color ? p.colors.filter((c) => c.name === color) : p.colors;
  if (!colors.length) return null;
  if (!size) return colors[0];
  return colors.find((c) => c.sizes.some((s) => s.size === size && s.stock > 0)) || null;
}

export function whatsappLink({ product, color, size, currency }) {
  const lines = [
    `Hello ${STORE.name}, I'd like to order:`,
    `${product.name}${product.brand ? ` (${product.brand})` : ''}`,
    color && color !== 'Default' ? `Color: ${color}` : null,
    size ? `Size: ${size}` : null,
    `Price: ${formatPrice(currency, product.price)}`,
  ].filter(Boolean);
  return `https://wa.me/${STORE.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`;
}

import { createContext, useContext, useMemo } from 'react';
import { ShopContext } from '../context/ShopContext';
import { normalizeProduct, slugify } from './catalogUtils';
import { CATEGORIES, SHOE_BRANDS } from './catalog';
import { toDataUrl, brandMarkSvg } from './art';

export const ShowroomUI = createContext({ openProduct: () => {}, openMenu: () => {} });
export const useShowroomUI = () => useContext(ShowroomUI);

export function useShowroom() {
  const shop = useContext(ShopContext);
  const products = useMemo(() => (shop.products || []).map(normalizeProduct), [shop.products]);

  const byType = useMemo(() => {
    const m = {};
    products.forEach((p) => { (m[p.productType] ||= []).push(p); });
    return m;
  }, [products]);

  const categories = useMemo(() => CATEGORIES.filter((c) => byType[c.slug]?.length).map((c) => ({ ...c, count: byType[c.slug].length })), [byType]);

  // Shoe brands from the stock itself; known brands get their logo, others a plain wordmark.
  const brands = useMemo(() => {
    const m = new Map();
    (byType.shoes || []).forEach((p) => {
      const name = p.brand || 'Other';
      const slug = slugify(name);
      if (!m.has(slug)) {
        const known = SHOE_BRANDS.find((b) => b.slug === slug);
        m.set(slug, { slug, name, logo: known?.logo || toDataUrl(brandMarkSvg({ name: name.toUpperCase(), style: 'word' })), items: [] });
      }
      m.get(slug).items.push(p);
    });
    return [...m.values()];
  }, [byType]);

  // This week's look on the mannequin: owner-flagged items first, then best sellers.
  const outfit = useMemo(() => {
    const pick = (slot, types) => {
      const flagged = products.find((p) => p.featured === slot);
      const p = flagged || types.map((t) => (byType[t] || []).find((x) => x.bestseller) || (byType[t] || [])[0]).find(Boolean);
      if (!p) return undefined;
      const c = p.colors[0];
      return { id: p._id, name: p.name, price: p.price, hex: c.hex, accent: c.accent, sole: c.sole, type: p.productType, image: c.images?.[0] };
    };
    return {
      torso: pick('torso', ['hoodies', 'jackets', 'tees']),
      legs: pick('legs', ['trousers']),
      head: pick('head', ['caps']),
      feet: pick('feet', ['shoes']),
    };
  }, [products, byType]);

  return { ...shop, products, byType, categories, brands, outfit };
}

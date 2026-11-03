import { useMemo, useState } from 'react';
import { allColors, allSizes, matchVariant } from '../catalogUtils';

/** Color + size filter state for a set of products. Returns the visible ids and the variant to show for each. */
export default function useFilters(products) {
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const colors = useMemo(() => allColors(products), [products]);
  const sizes = useMemo(() => allSizes(products), [products]);
  const result = useMemo(() => {
    const visible = new Set();
    const items = products.map((p) => {
      const v = matchVariant(p, color, size);
      if (v) visible.add(p._id);
      return { product: p, color: v || (color && p.colors.find((c) => c.name === color)) || p.colors[0] };
    });
    return { items, visible };
  }, [products, color, size]);
  return { color, setColor, size, setSize, colors, sizes, ...result, clear: () => { setColor(''); setSize(''); } };
}


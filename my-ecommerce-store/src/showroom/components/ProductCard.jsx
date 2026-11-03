import { useContext } from 'react';
import { ShopContext } from '../../context/ShopContext';
import { formatPrice } from '../catalogUtils';
import { useShowroomUI } from '../useShowroom';

export default function ProductCard({ product, color, className = '' }) {
  const { currency } = useContext(ShopContext);
  const { openProduct } = useShowroomUI();
  const c = color || product.colors[0];
  const img = c.images?.[0] || product.image?.[0];
  const swatches = product.colors.filter((x) => x.name !== 'Default');
  return (
    <button type="button" onClick={() => openProduct(product._id)} className={`group text-left min-w-0 ${className}`}>
      <div className="sr-card-stage aspect-[4/5] rounded-2xl overflow-hidden grid place-items-center border border-[var(--sr-line)]">
        <img src={img} alt={product.name} loading="lazy"
          className={`${product.photoOnly ? 'w-full h-full object-cover' : 'w-[78%] max-h-[78%] object-contain'} transition-transform duration-500 group-hover:scale-105`} />
      </div>
      <div className="pt-2.5 px-0.5">
        {product.brand && <p className="sr-eyebrow !text-[0.6rem]">{product.brand}</p>}
        <p className="text-sm leading-snug truncate">{product.name}</p>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm font-semibold sr-num">{formatPrice(currency, product.price)}</p>
          {swatches.length > 1 && (
            <span className="flex -space-x-1" aria-label={`${swatches.length} colors`}>
              {swatches.slice(0, 4).map((s) => <span key={s.name} className="sr-swatch !w-3 !h-3 ring-1 ring-[var(--sr-bg)]" style={{ background: s.hex }} />)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

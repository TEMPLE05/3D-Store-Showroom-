import { lazy, Suspense, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, MessageCircle, Rotate3d } from 'lucide-react';
import { toast } from 'react-toastify';
import { ShopContext } from '../../context/ShopContext';
import { formatPrice, whatsappLink } from '../catalogUtils';

const ItemViewer = lazy(() => import('../three/ItemViewer'));

/** Bottom sheet (side panel on laptops): spin the item, pick color + size, add to cart or order on WhatsApp. */
export default function ProductSheet({ product, onClose }) {
  const { currency, addToCart } = useContext(ShopContext);
  const [colorName, setColorName] = useState('');
  const [size, setSize] = useState('');
  const [shown, setShown] = useState(product);

  // keep the last product rendered while the sheet slides away
  useEffect(() => { if (product) setShown(product); }, [product]);
  useEffect(() => {
    if (!product) return;
    setColorName(product.colors[0]?.name || '');
    setSize('');
    const fn = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [product, onClose]);

  const p = product || shown;
  const open = Boolean(product);
  const color = p?.colors.find((c) => c.name === colorName) || p?.colors[0];
  const sizeInfo = color?.sizes.find((s) => s.size === size);
  const hasColors = p && !(p.colors.length === 1 && p.colors[0].name === 'Default');

  const sizeKey = hasColors ? `${size} / ${color?.name}` : size;
  const add = () => {
    if (!size) { toast.info('Pick a size first'); return; }
    addToCart(p._id, sizeKey);
    toast.success(`Added ${p.name} (${sizeKey}) to your cart`);
  };

  return (
    <>
      <div className={`sr-overlay ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ zIndex: 69 }} onClick={onClose} aria-hidden="true" />
      <section className={`sr-sheet flex flex-col ${open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
        role="dialog" aria-modal="true" aria-label={p?.name || 'Product'} inert={!open}>
        {p && <>
          <div className="relative shrink-0 h-[38dvh] md:h-[46vh] sr-card-stage rounded-t-[1.4rem] md:rounded-none overflow-hidden">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20 md:hidden" />
            {open && (
              <Suspense fallback={<img src={color?.images?.[0] || p.image?.[0]} alt="" className="absolute inset-0 m-auto max-h-[70%] max-w-[75%] object-contain" />}>
                <ItemViewer product={p} color={color} />
              </Suspense>
            )}
            <button type="button" onClick={onClose} className="absolute top-3 right-3 z-10 h-10 w-10 grid place-items-center rounded-full bg-black/40 backdrop-blur" aria-label="Close"><X size={18} /></button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] text-[var(--sr-muted)] pointer-events-none">
              <Rotate3d size={14} /> Drag to turn
            </p>
          </div>

          <div className="sr-gutter flex-1 overflow-y-auto pt-5 pb-6 grid gap-5 content-start">
            <div>
              {p.brand && <p className="sr-eyebrow mb-1.5">{p.brand}</p>}
              <h2 className="sr-display text-[2.1rem]">{p.name}</h2>
              <p className="mt-2 text-xl font-semibold sr-num">{formatPrice(currency, p.price)}</p>
            </div>

            {hasColors && (
              <div>
                <p className="text-sm mb-2.5">Color: <span className="text-[var(--sr-muted)]">{color?.name}</span></p>
                <div className="flex flex-wrap gap-2.5">
                  {p.colors.map((c) => (
                    <button key={c.name} type="button" onClick={() => { setColorName(c.name); setSize(''); }}
                      aria-pressed={c.name === color?.name} aria-label={c.name}
                      className={`h-10 w-10 rounded-full grid place-items-center border transition ${c.name === color?.name ? 'border-[var(--sr-text)]' : 'border-transparent'}`}>
                      <span className="sr-swatch !w-7 !h-7" style={{ background: c.hex }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between mb-2.5">
                <p className="text-sm">Size{p.productType === 'shoes' ? ' (EU)' : ''}</p>
                {sizeInfo && sizeInfo.stock > 0 && sizeInfo.stock <= 2 && <p className="text-xs text-[var(--sr-light)]">Only {sizeInfo.stock} left</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {color?.sizes.map((s) => (
                  <button key={s.size} type="button" disabled={s.stock <= 0} onClick={() => setSize(s.size)}
                    aria-pressed={size === s.size} className="sr-chip sr-num min-w-12 justify-center"
                    title={s.stock <= 0 ? 'Sold out in this color' : undefined}>{s.size}</button>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5">
              <button type="button" onClick={add} className="sr-btn sr-btn-primary">Add to cart</button>
              <a href={whatsappLink({ product: p, color: color?.name, size, currency })} target="_blank" rel="noreferrer" className="sr-btn sr-btn-wa">
                <MessageCircle size={18} /> Order on WhatsApp
              </a>
            </div>

            <p className="text-sm leading-relaxed text-[var(--sr-muted)] max-w-[60ch]">{p.description}</p>
            <Link to={`/product/${p._id}`} onClick={onClose} className="text-sm underline underline-offset-4 text-[var(--sr-muted)]">Full product page</Link>
          </div>
        </>}
      </section>
    </>
  );
}

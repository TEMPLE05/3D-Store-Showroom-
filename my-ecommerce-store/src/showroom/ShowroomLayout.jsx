import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Menu, ShoppingBag, X, ChevronRight, MessageCircle } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './showroom.css';
import { STORE } from './catalog';
import { ShowroomUI, useShowroom } from './useShowroom';
import ProductSheet from './components/ProductSheet';

function TopBar({ onMenu, cartCount, solid }) {
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${solid ? 'bg-[var(--sr-bg)]/92 backdrop-blur border-b border-[var(--sr-line)]' : 'bg-gradient-to-b from-black/60 to-transparent'}`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="sr-gutter h-14 flex items-center justify-between gap-3">
        <button type="button" onClick={onMenu} className="h-11 w-11 -ml-2 grid place-items-center rounded-full hover:bg-white/5" aria-label="Open categories">
          <Menu size={22} />
        </button>
        <Link to="/" className="sr-display text-[1.35rem] tracking-wide">{STORE.name}</Link>
        <Link to="/cart" className="relative h-11 w-11 -mr-2 grid place-items-center rounded-full hover:bg-white/5" aria-label={`Cart, ${cartCount} items`}>
          <ShoppingBag size={21} />
          {cartCount > 0 && <span className="absolute top-1.5 right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--sr-light)] text-[10px] font-bold text-black grid place-items-center sr-num">{cartCount}</span>}
        </Link>
      </div>
    </header>
  );
}

function Drawer({ open, onClose, categories, brands, token }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
  return (
    <>
      <div className={`sr-overlay ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} aria-hidden="true" />
      <nav className={`sr-drawer flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Categories" aria-hidden={!open} inert={!open}>
        <div className="sr-gutter h-14 flex items-center justify-between border-b border-[var(--sr-line)]">
          <p className="sr-eyebrow">Shop by category</p>
          <button type="button" onClick={onClose} className="h-11 w-11 -mr-2 grid place-items-center rounded-full hover:bg-white/5" aria-label="Close"><X size={20} /></button>
        </div>
        <ul className="flex-1 overflow-y-auto py-2">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link to={`/shop/${c.slug}`} onClick={onClose} className="sr-gutter flex items-center gap-3 py-4 hover:bg-white/[.03] active:bg-white/5">
                <span className="flex-1 min-w-0">
                  <span className="sr-display block text-[2rem]">{c.label}</span>
                  <span className="text-xs text-[var(--sr-muted)]">{c.slug === 'shoes' ? `${brands.length} brands` : c.note} · <span className="sr-num">{c.count}</span> items</span>
                </span>
                <ChevronRight size={18} className="text-[var(--sr-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="sr-gutter py-4 border-t border-[var(--sr-line)] grid gap-1 text-sm">
          <Link to="/cart" onClick={onClose} className="py-2 text-[var(--sr-text)]">Cart</Link>
          <Link to={token ? '/orders' : '/login'} onClick={onClose} className="py-2 text-[var(--sr-text)]">{token ? 'My orders' : 'Sign in'}</Link>
          <Link to="/collection" onClick={onClose} className="py-2 text-[var(--sr-muted)]">Classic store view</Link>
          <p className="pt-2 flex items-center gap-2 text-[var(--sr-muted)] select-all"><MessageCircle size={15} /> +{STORE.whatsapp}</p>
        </div>
      </nav>
    </>
  );
}

export default function ShowroomLayout() {
  const shop = useShowroom();
  const [menuOpen, setMenuOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const [solid, setSolid] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 40);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [pathname]);

  const itemId = params.get('item');
  const product = itemId ? shop.products.find((p) => p._id === itemId) : null;

  const openProduct = useCallback((id) => {
    setParams((prev) => { const p = new URLSearchParams(prev); p.set('item', id); return p; });
  }, [setParams]);
  const closeProduct = useCallback(() => {
    setParams((prev) => { const p = new URLSearchParams(prev); p.delete('item'); return p; }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || product ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, product]);

  return (
    <ShowroomUI.Provider value={{ openProduct, openMenu: () => setMenuOpen(true) }}>
      <div className="sr">
        <ToastContainer theme="dark" position="top-center" autoClose={2200} />
        <TopBar onMenu={() => setMenuOpen(true)} cartCount={shop.getCartCount()} solid={solid || pathname !== '/'} />
        <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} categories={shop.categories} brands={shop.brands} token={shop.token} />
        <main>
          <Outlet />
        </main>
        <ProductSheet product={product} onClose={closeProduct} />
      </div>
    </ShowroomUI.Provider>
  );
}

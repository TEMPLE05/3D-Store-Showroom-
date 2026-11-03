import { lazy, Suspense, useContext } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, Hand } from 'lucide-react';
import { useShowroom, useShowroomUI } from '../useShowroom';
import { CATEGORIES } from '../catalog';
import { formatPrice } from '../catalogUtils';
import FilterBar from '../components/Filters';
import useFilters from '../components/useFilters';
import ProductCard from '../components/ProductCard';
import { ShopContext } from '../../context/ShopContext';

const ShelfScene = lazy(() => import('../three/ShelfScene'));
const RailScene = lazy(() => import('../three/RailScene'));

const SceneFallback = ({ h = 420 }) => <div style={{ height: h }} className="grid place-items-center text-xs text-[var(--sr-muted)]">Setting up the display…</div>;

export function PageHead({ back, eyebrow, title, note }) {
  return (
    <div className="sr-gutter pb-4" style={{ paddingTop: 'calc(4.5rem + env(safe-area-inset-top, 0px))' }}>
      {back && <Link to={back.to} className="inline-flex items-center gap-1 text-xs text-[var(--sr-muted)] -ml-1 mb-2 py-1"><ChevronLeft size={15} />{back.label}</Link>}
      {eyebrow && <p className="sr-eyebrow">{eyebrow}</p>}
      <h1 className="sr-display text-[clamp(2.6rem,12vw,4.8rem)] mt-1">{title}</h1>
      {note && <p className="text-sm text-[var(--sr-muted)] mt-1.5">{note}</p>}
    </div>
  );
}

/* Shoes → brand tiles first. */
function BrandGrid() {
  const { brands, byType } = useShowroom();
  const { currency } = useContext(ShopContext);
  const shoes = byType.shoes || [];
  const from = (list) => Math.min(...list.map((p) => p.price));
  return (
    <>
      <PageHead back={{ to: '/', label: 'Home' }} eyebrow="Shoes" title="Pick a brand" note={`${shoes.length} pairs from ${brands.length} brands`} />
      <div className="sr-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-10">
        <Link to="/shop/shoes/all" className="col-span-2 sm:col-span-3 lg:col-span-4 rounded-2xl border border-[var(--sr-line)] bg-[var(--sr-panel)] p-4 flex items-center justify-between">
          <span>
            <span className="sr-display block text-[1.6rem]">All brands</span>
            <span className="text-xs text-[var(--sr-muted)] sr-num">{shoes.length} pairs · from {formatPrice(currency, from(shoes))}</span>
          </span>
          <span className="text-sm">View wall →</span>
        </Link>
        {brands.map((b) => (
          <Link key={b.slug} to={`/shop/shoes/${b.slug}`} className="sr-card-stage rounded-2xl border border-[var(--sr-line)] aspect-square p-4 flex flex-col justify-between">
            <img src={b.logo} alt={b.name} className="w-full h-auto mt-[18%] opacity-95" />
            <span className="text-[11px] text-[var(--sr-muted)] sr-num">{b.items.length} pairs · from {formatPrice(currency, from(b.items))}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

/* Shelf wall for a brand's shoes (or all shoes). */
export function ShoeShelf() {
  const { brand } = useParams();
  const { brands, byType } = useShowroom();
  const { openProduct } = useShowroomUI();
  const b = brands.find((x) => x.slug === brand);
  const list = brand === 'all' ? byType.shoes || [] : b?.items || [];
  const f = useFilters(list);
  if (!list.length && brands.length) return <Navigate to="/shop/shoes" replace />;
  return (
    <>
      <PageHead back={{ to: '/shop/shoes', label: 'All brands' }} eyebrow="Shoes" title={brand === 'all' ? 'The shoe wall' : b?.name || ''} />
      <FilterBar f={f} unit="pairs" />
      <p className="sr-gutter pt-3 pb-2 flex items-center gap-1.5 text-[11px] text-[var(--sr-muted)]"><Hand size={13} /> Tap a shoe to spin it and pick your size</p>
      <Suspense fallback={<SceneFallback />}>
        <ShelfScene items={f.items} visibleIds={f.visible} onSelect={openProduct} kind="shoes" />
      </Suspense>
      {f.visible.size === 0 && <p className="sr-gutter py-8 text-center text-sm text-[var(--sr-muted)]">No pairs in that color and size right now. <button type="button" className="underline" onClick={f.clear}>Clear filters</button></p>}
      <div className="h-12" />
    </>
  );
}

/* Clothing rail or cap wall, plus a plain grid of everything below for quick scanning. */
function DisplayPage({ category }) {
  const { byType } = useShowroom();
  const { openProduct } = useShowroomUI();
  const list = byType[category.slug] || [];
  const f = useFilters(list);
  const wall = category.display === 'wall';
  return (
    <>
      <PageHead back={{ to: '/', label: 'Home' }} eyebrow={category.note} title={category.label} />
      <FilterBar f={f} />
      <p className="sr-gutter pt-3 pb-1 flex items-center gap-1.5 text-[11px] text-[var(--sr-muted)]">
        <Hand size={13} /> {wall ? 'Tap a piece to spin it' : 'Swipe along the rail · tap the front piece to open it'}
      </p>
      <Suspense fallback={<SceneFallback />}>
        {wall
          ? <ShelfScene items={f.items} visibleIds={f.visible} onSelect={openProduct} kind="caps" />
          : <RailScene items={f.items} visibleIds={f.visible} onSelect={openProduct} />}
      </Suspense>
      <section className="pt-8 pb-12">
        <h2 className="sr-gutter sr-eyebrow mb-3">Everything in {category.label.toLowerCase()}</h2>
        <div className="sr-gutter grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6">
          {f.items.filter((it) => f.visible.has(it.product._id)).map((it) => <ProductCard key={it.product._id} product={it.product} color={it.color} />)}
        </div>
      </section>
    </>
  );
}

export default function CategoryPage() {
  const { category } = useParams();
  const { byType } = useShowroom();
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat || !byType[category]?.length) return <Navigate to="/" replace />;
  if (cat.slug === 'shoes') return <BrandGrid />;
  return <DisplayPage category={cat} />;
}

import { lazy, Suspense, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Hand } from 'lucide-react';
import { ShopContext } from '../../context/ShopContext';
import { useShowroom, useShowroomUI } from '../useShowroom';
import { STORE } from '../catalog';
import { POSES, POSE_KEYS } from '../three/posing';
import { formatPrice } from '../catalogUtils';
import ProductCard from '../components/ProductCard';

const HeroStage = lazy(() => import('../three/HeroStage'));

const weekNo = () => {
  const d = new Date(); const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
};

export default function ShowroomHome() {
  const { products, outfit, categories, byType } = useShowroom();
  const { openProduct, openMenu } = useShowroomUI();
  const { currency } = useContext(ShopContext);
  const [pose, setPose] = useState(POSES[STORE.featuredPose] ? STORE.featuredPose : 'standing');

  const look = ['head', 'torso', 'legs', 'feet'].map((k) => outfit[k]).filter(Boolean);
  // what hangs in the lockers behind the mannequin; bay 4 (centre) stays empty behind the figure
  const pick = (type, n = 0, c = 0) => { const p = (byType[type] || [])[n]; if (!p) return null; const color = p.colors[c] || p.colors[0]; return { type, color }; };
  const bays = [pick('shoes', 4), pick('trousers', 1), pick('tees', 0), pick('hoodies', 1), null, pick('hoodies', 3), pick('caps', 0, 1), pick('trousers', 2), pick('tees', 1, 1)];
  const lookTotal = look.reduce((s, i) => s + i.price, 0);
  const best = products.filter((p) => p.bestseller).slice(0, 10);

  return (
    <>
      {/* Hero: the mannequin under its spotlight */}
      <section className="relative w-full overflow-hidden" style={{ height: 'clamp(540px, 84svh, 820px)' }}>
        <Suspense fallback={<div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(242,201,131,.12),transparent)]" />}>
          <HeroStage pose={pose} outfit={outfit} onSelect={openProduct} bays={bays} />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-0 top-0 sr-gutter" style={{ paddingTop: 'calc(4.5rem + env(safe-area-inset-top, 0px))' }}>
          <p className="sr-eyebrow">Week {weekNo()} · The look</p>
          <h1 className="sr-display text-[clamp(2.6rem,11vw,5.5rem)] mt-1.5 max-w-[9ch]">Harmattan layers</h1>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--sr-bg)] via-[var(--sr-bg)]/70 to-transparent pt-16 pb-4">
          <p className="sr-gutter mb-2.5 flex items-center gap-1.5 text-[11px] text-[var(--sr-muted)]"><Hand size={13} /> Drag to turn · Tap a glowing dot to shop it</p>
          <div className="sr-scroll-x">
            <div className="sr-gutter flex gap-2 w-max" role="group" aria-label="Pose">
              {POSE_KEYS.map((k) => (
                <button key={k} type="button" className="sr-chip" aria-pressed={pose === k} onClick={() => setPose(k)}>{POSES[k].label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Shop the look */}
      {look.length > 0 && (
        <section className="pt-6 pb-2">
          <div className="sr-gutter flex items-baseline justify-between mb-3">
            <h2 className="sr-display text-[1.7rem]">Shop the look</h2>
            <p className="text-xs text-[var(--sr-muted)] sr-num">{look.length} pieces · {formatPrice(currency, lookTotal)}</p>
          </div>
          <ul className="sr-gutter grid gap-2">
            {look.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => openProduct(i.id)}
                  className="w-full flex items-center gap-3 p-2 pr-3 rounded-2xl bg-[var(--sr-panel)] border border-[var(--sr-line)] text-left active:bg-[var(--sr-panel-2)]">
                  <span className="sr-card-stage h-14 w-14 shrink-0 rounded-xl grid place-items-center overflow-hidden">
                    {i.image && <img src={i.image} alt="" className="max-h-[80%] max-w-[80%] object-contain" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{i.name}</span>
                    <span className="block text-xs text-[var(--sr-muted)] sr-num">{formatPrice(currency, i.price)}</span>
                  </span>
                  <ArrowRight size={16} className="text-[var(--sr-muted)]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Best sellers */}
      {best.length > 0 && (
        <section className="pt-8">
          <div className="sr-gutter flex items-baseline justify-between mb-3">
            <h2 className="sr-display text-[1.7rem]">Best sellers</h2>
            <span className="text-xs text-[var(--sr-muted)]">Swipe</span>
          </div>
          <div className="sr-scroll-x">
            <div className="sr-gutter flex gap-3 w-max pb-1">
              {best.map((p) => <ProductCard key={p._id} product={p} className="w-[42vw] max-w-[220px] shrink-0" />)}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="pt-10 pb-6">
        <div className="sr-gutter flex items-baseline justify-between mb-3">
          <h2 className="sr-display text-[1.7rem]">Browse the shop</h2>
          <button type="button" onClick={openMenu} className="text-xs text-[var(--sr-muted)] underline underline-offset-4">All categories</button>
        </div>
        <div className="sr-gutter grid grid-cols-2 sm:grid-cols-3 gap-3">
          {categories.map((c) => {
            const sample = byType[c.slug]?.[0];
            return (
              <Link key={c.slug} to={`/shop/${c.slug}`} className="relative sr-card-stage rounded-2xl border border-[var(--sr-line)] overflow-hidden aspect-[5/4] p-3 flex flex-col justify-between">
                <span className="relative z-10">
                  <span className="sr-display block text-[1.6rem]">{c.label}</span>
                  <span className="text-[11px] text-[var(--sr-muted)] sr-num">{c.count} items</span>
                </span>
                {sample && <img src={sample.colors[0].images?.[0] || sample.image?.[0]} alt="" aria-hidden="true"
                  className={`absolute right-[-6%] bottom-[-4%] w-[70%] object-contain opacity-90 ${sample.photoOnly ? 'h-[70%] object-cover rounded-xl' : ''}`} />}
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="sr-gutter py-10 mt-4 border-t border-[var(--sr-line)] text-sm text-[var(--sr-muted)] grid gap-1.5">
        <p className="sr-display text-[1.4rem] text-[var(--sr-text)]">{STORE.name}</p>
        <p>{STORE.tagline}</p>
        <p>Orders on WhatsApp: <span className="select-all text-[var(--sr-text)]">+{STORE.whatsapp}</span></p>
        <Link to="/collection" className="underline underline-offset-4 w-max mt-2">Classic store view</Link>
      </footer>
    </>
  );
}

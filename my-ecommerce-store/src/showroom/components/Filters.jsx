/** Sticky chip bar under the top bar. */
export default function FilterBar({ f, unit = 'items' }) {
  const active = f.color || f.size;
  return (
    <div className="sticky z-40 bg-[var(--sr-bg)]/94 backdrop-blur border-b border-[var(--sr-line)]" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
      {f.colors.length > 1 && (
        <div className="sr-scroll-x">
          <div className="sr-gutter flex gap-2 pt-3 w-max">
            {f.colors.map((c) => (
              <button key={c.name} type="button" className="sr-chip" aria-pressed={f.color === c.name}
                onClick={() => f.setColor(f.color === c.name ? '' : c.name)}>
                <span className="sr-swatch" style={{ background: c.hex }} /> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="sr-scroll-x">
        <div className="sr-gutter flex gap-2 py-3 w-max">
          {f.sizes.map((s) => (
            <button key={s} type="button" className="sr-chip sr-num min-w-11 justify-center" aria-pressed={f.size === s}
              onClick={() => f.setSize(f.size === s ? '' : s)}>{s}</button>
          ))}
        </div>
      </div>
      <div className="sr-gutter flex items-center justify-between pb-2.5 -mt-0.5 text-xs text-[var(--sr-muted)]">
        <span className="sr-num" aria-live="polite">{f.visible.size} {unit}{active ? ' match' : ''}</span>
        {active && <button type="button" onClick={f.clear} className="underline underline-offset-4 py-1">Clear filters</button>}
      </div>
    </div>
  );
}

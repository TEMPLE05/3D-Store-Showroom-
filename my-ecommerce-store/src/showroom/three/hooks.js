import { useEffect, useRef, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

// Stop rendering a canvas while it is scrolled off screen (saves battery on phones).
export function useInView(margin = '120px') {
  const ref = useRef(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView];
}

/**
 * Horizontal drag to turn a model, with inertia. Vertical swipes are left to the page,
 * so the visitor can still scroll past a 3D section on a phone.
 */
export function useDragSpin({ auto = 0, damping = 3 } = {}) {
  const state = useRef({ angle: 0, vel: 0, dragging: false, lastX: 0, lastT: 0, idleFor: 10 });
  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const s = state.current;
      s.dragging = true; s.lastX = e.clientX; s.lastT = performance.now(); s.vel = 0; s.idleFor = 0;
    },
    onPointerMove: (e) => {
      const s = state.current;
      if (!s.dragging) return;
      const now = performance.now();
      const dx = e.clientX - s.lastX;
      const step = dx * 0.011;
      s.angle += step;
      s.vel = step / Math.max(0.008, (now - s.lastT) / 1000);
      s.lastX = e.clientX; s.lastT = now;
    },
    onPointerUp: () => { state.current.dragging = false; },
    onPointerCancel: () => { state.current.dragging = false; },
    onPointerLeave: () => { state.current.dragging = false; },
  };
  const tick = (dt) => {
    const s = state.current;
    if (!s.dragging) {
      s.angle += s.vel * dt;
      s.vel *= Math.exp(-damping * dt);
      s.idleFor += dt;
      // ease back into the slow turntable after the visitor lets go
      const blend = Math.min(1, Math.max(0, (s.idleFor - 1.2) / 2));
      s.angle += auto * dt * blend;
    }
    return s.angle;
  };
  return { bind, tick, state };
}

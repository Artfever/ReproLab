'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Draws the comparison chart's lines in once, when it scrolls into view (GSAP). The chart is fully
// rendered on the server; this only animates it. Nothing happens under prefers-reduced-motion.
export function DrawIn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    let cancelled = false;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const { gsap } = await import('gsap');
      if (cancelled) return;
      const lines = root.querySelectorAll('[data-draw]');
      const dots = root.querySelectorAll('circle');
      gsap.from(lines, { attr: { x2: (_i: number, el: Element) => Number(el.getAttribute('x1') ?? 0) }, duration: 0.6, ease: 'power3.out', stagger: 0.06 });
      gsap.from(dots, { scale: 0.4, transformOrigin: '50% 50%', duration: 0.32, ease: 'power3.out', stagger: 0.06, delay: 0.3, clearProps: 'transform' });
    }, { threshold: 0.35 });
    io.observe(root);
    return () => { cancelled = true; io.disconnect(); };
  }, []);
  return <div ref={ref}>{children}</div>;
}

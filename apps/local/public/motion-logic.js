// motion-logic.js: DOM-free motion rules (spec 05-ui-redesign, Requirement 5). Runs under node:test.
// One easing curve and three durations for the whole interface. GSAP and anime.js both receive
// the same `ease` function from here, so every movement shares one curve.

export const CURVE = Object.freeze([0.2, 0, 0, 1]);
export const DURATION_MS = Object.freeze({ feedback: 120, change: 200, enter: 320 });
export const STAGGER_MS = 40;
export const STAGGER_MAX_ITEMS = 6;
export const RISE_PX = 8;
export const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Cubic Bézier easing with control points (x1, y1) and (x2, y2), endpoints (0,0) and (1,1).
 * Returns t => y. Solves x(s) = t with Newton steps and bisection as a fallback.
 */
export function cubicBezier(x1, y1, x2, y2) {
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError('cubicBezier needs finite control points with x in [0, 1]');
  }
  const cx = 3 * x1; const bx = 3 * (x2 - x1) - cx; const ax = 1 - cx - bx;
  const cy = 3 * y1; const by = 3 * (y2 - y1) - cy; const ay = 1 - cy - by;
  const sx = (s) => ((ax * s + bx) * s + cx) * s;
  const sy = (s) => ((ay * s + by) * s + cy) * s;
  const dx = (s) => (3 * ax * s + 2 * bx) * s + cx;
  const solve = (t) => {
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const e = sx(s) - t;
      if (Math.abs(e) < 1e-7) return s;
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0; let hi = 1; s = t;
    for (let i = 0; i < 40; i += 1) {
      const v = sx(s);
      if (Math.abs(v - t) < 1e-7) return s;
      if (v < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };
  return (t) => {
    if (!(t > 0)) return 0;
    if (t >= 1) return 1;
    return sy(solve(t));
  };
}

export const ease = cubicBezier(...CURVE);

/** Delay in ms for item i of a staggered group. Items after the sixth share the last delay. */
export function staggerDelay(i, step = STAGGER_MS, max = STAGGER_MAX_ITEMS) {
  const n = Math.max(0, Math.min(Math.floor(Number(i) || 0), max - 1));
  return n * step;
}

/** True when motion is allowed. `matches` is the result of matchMedia(REDUCED_QUERY).matches. */
export function motionAllowed(reducedMatches) {
  return reducedMatches !== true;
}

/** Linear interpolation, clamped to [0, 1] progress. */
export function lerp(from, to, p) {
  const q = Math.min(1, Math.max(0, Number(p) || 0));
  return from + (to - from) * q;
}

/**
 * Text for a number tween frame. Keeps the target's own decimals so the last frame equals the
 * final text exactly. `target` is the final string, for example "10000" or "0.6686".
 */
export function tweenText(target, p) {
  const s = String(target);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s;
  const decimals = (s.split('.')[1] ?? '').length;
  if (p >= 1) return s;
  const v = lerp(0, Number(s), ease(p));
  return v.toFixed(decimals);
}

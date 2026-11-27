// motion.js: the one place that decides whether anything moves (spec 05-ui-redesign, Requirement 5).
// GSAP is loaded before this module as a same-origin classic script and read from window.gsap.
// anime.js is imported from the vendored ES module. Under prefers-reduced-motion: reduce every
// export returns without creating a tween, so the page is shown in its final state at once.
import { animate, stagger } from '/vendor/animejs-4.5.0/anime.esm.min.js';
import { ease, DURATION_MS, STAGGER_MS, STAGGER_MAX_ITEMS, RISE_PX, REDUCED_QUERY, motionAllowed, tweenText } from '/motion-logic.js';

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_QUERY) : null;

export function allowed() {
  return motionAllowed(query ? query.matches : true);
}

export function gsapOrNull() {
  return allowed() && typeof window !== 'undefined' && window.gsap ? window.gsap : null;
}

export { ease, DURATION_MS };

/** One short fade and rise for the direct children of `root`, at most six staggered. GSAP. */
export function entrance(root) {
  const gsap = gsapOrNull();
  if (!gsap || !root) return;
  const items = [...root.children].filter((el) => !el.hidden && el.getBoundingClientRect().top < window.innerHeight);
  if (items.length === 0) return;
  gsap.from(items.slice(0, STAGGER_MAX_ITEMS + 2), {
    opacity: 0, y: RISE_PX, duration: DURATION_MS.enter / 1000, ease,
    stagger: STAGGER_MS / 1000, clearProps: 'opacity,transform',
  });
}

/** A small settle when something new appears (hash tag, result box). anime.js. */
export function settle(targets, { delayStep = STAGGER_MS } = {}) {
  if (!allowed() || !targets || (targets.length !== undefined && targets.length === 0)) return;
  animate(targets, {
    opacity: [0, 1], translateY: [4, 0], duration: DURATION_MS.change, ease,
    delay: stagger(delayStep, { start: 0 }),
    onComplete: (a) => { for (const t of a.targets ?? []) { if (t.style) { t.style.removeProperty('opacity'); t.style.removeProperty('transform'); } } },
  });
}

/** Light one timeline step: the marker scales from 0.6 to 1. anime.js. */
export function lightStep(el) {
  if (!allowed() || !el) return;
  animate(el, { scale: [0.96, 1], duration: DURATION_MS.change, ease, onComplete: () => el.style.removeProperty('transform') });
}

/** Tween the text of `el` from 0 to `finalText`, keeping its decimals. anime.js drives the frames. */
export function countTo(el, finalText) {
  if (!el) return;
  if (!allowed() || !/^-?\d+(\.\d+)?$/.test(String(finalText))) { el.textContent = String(finalText); return; }
  const state = { p: 0 };
  animate(state, {
    p: 1, duration: DURATION_MS.enter, ease: 'linear',
    onUpdate: () => { el.textContent = tweenText(finalText, state.p); },
    onComplete: () => { el.textContent = String(finalText); },
  });
}

/** Brief confirmation on a control, such as "Copied". Colour only, no movement. */
export function flash(el) {
  if (!allowed() || !el) return;
  animate(el, { opacity: [0.55, 1], duration: DURATION_MS.change, ease, onComplete: () => el.style.removeProperty('opacity') });
}

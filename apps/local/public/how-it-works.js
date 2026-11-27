// how-it-works.js: scroll-driven pipeline (spec 05-ui-redesign, task 10).
// GSAP ScrollTrigger marks the pipeline node of the step being read. It changes emphasis only:
// every step and every node stays fully visible at all times, so nothing waits on a scroll to be
// readable. Under reduced motion, without ScrollTrigger, or below 64rem the figure stays static.
import { gsapOrNull } from '/motion.js';

const steps = [...document.querySelectorAll('#steps > li')];
const nodes = [...document.querySelectorAll('#pipeline .node')];

function mark(i) {
  steps.forEach((s, k) => s.setAttribute('data-active', String(k === i)));
  nodes.forEach((n) => n.setAttribute('data-active', String(Number(n.getAttribute('data-node')) === i)));
}

const gsap = gsapOrNull();
const ST = window.ScrollTrigger;
const wide = window.matchMedia('(min-width: 64rem)');
if (gsap && ST && wide.matches && steps.length === nodes.length) {
  gsap.registerPlugin(ST);
  steps.forEach((step, i) => {
    ST.create({
      trigger: step,
      start: 'top 55%',
      end: 'bottom 55%',
      onEnter: () => mark(i),
      onEnterBack: () => mark(i),
    });
  });
  mark(0);
}

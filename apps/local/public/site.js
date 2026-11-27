// site.js: shared shell behaviour for every page (spec 05-ui-redesign, Requirement 4.2 and 5).
// The navigation menu is a native <details> that is open in the HTML, so it works without
// JavaScript. Here it is closed on narrow screens and kept open on wide ones.
import { entrance } from '/motion.js';

const menu = document.querySelector('.nav-menu');
const wide = window.matchMedia('(min-width: 48rem)');

function syncMenu() {
  if (!menu) return;
  if (wide.matches) menu.open = true;
  else menu.open = false;
}

syncMenu();
wide.addEventListener('change', syncMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu && menu.open && !wide.matches) {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }
});

const main = document.getElementById('main');
if (main && !main.hasAttribute('data-no-entrance')) entrance(main);

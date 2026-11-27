// docs.js: copy buttons for the command blocks on Documentation (spec 05-ui-redesign, task 10).
import { flash } from '/motion.js';

const status = document.getElementById('copy-status');
for (const button of document.querySelectorAll('button[data-copy]')) {
  button.addEventListener('click', () => {
    const source = document.getElementById(button.getAttribute('data-copy'));
    if (!source) return;
    const text = source.textContent;
    const done = (ok) => {
      status.textContent = ok ? 'Copied the commands.' : 'Copy is not available here. Select the commands and copy them by hand.';
      if (ok) flash(button);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    else done(false);
  });
}

# UI keyboard check (task 5.2 and 5.3)

## Summary

- The automated Tab-order check passed on the Run page and on the Results page.
- The human keyboard-only pass was **NOT done**. No person operated either page with a keyboard alone.
- No screen-reader check and no 200% zoom check by a person was done.

## What the automated check did

`apps/local/scripts/ui-browser-check.mjs` (Run page) and `apps/local/scripts/results-browser-check.mjs`
(Results page) drive headless Chrome through the DevTools protocol. They send real `Tab` key events
and read `document.activeElement` after each one. Output: `test-ui-run.txt`, `test-ui-results.txt`
in this directory.

### Run page (`run.html`), from `test-ui-run.txt`

Focus order observed:
skip link, brand link, 8 navigation links, `demo`, `model`, `data`, `chains`, `inits-1`, `inits-2`,
`monitors`, `burnIn`, `samples`, `thin`, `seed`, `timeoutS`, `submit`.
(The script lists one extra "Documentation" link entry before `demo`: a link in the page's intro text.)

The check proved: every control is reachable by Tab, in the same order as the page, ending at the
submit button. It also proved that after a failed submit the focus moves to the first problem field,
that each problem has a link that moves focus to its field, and that the status region is
`aria-live="polite"`.

### Results page (`results.html`), from `test-ui-results.txt`

Focus order observed for a succeeded run:
skip link, brand link, 8 navigation links, engine log (`log`, a focusable scroll region),
output-files table region (`files-wrap`), one `Download <name>` link per file (10 files),
`manifest-link`, summary table region.

The check proved: these stops exist and occur in that order. It did not press Enter or Space on any of them.

## What the automated check did not prove

- Whether focus is clearly visible. The stylesheet sets a 3 px outline on `:focus-visible` (asserted by
  `tests/pages.test.mjs`), but no one looked at focus rings on screen.
- Whether keys other than Tab work (arrow keys inside the scroll regions, Enter on links and buttons,
  Space on the file inputs). Native HTML elements are used, so they are expected to work, but this was not tested.
- Whether Shift+Tab reverses the order.
- The native file chooser, which headless Chrome cannot show. The script sets files with
  `DOM.setFileInputFiles`, so opening the chooser by keyboard is untested.
- Reading order or announcements in a screen reader. The live-region text was read back from the DOM only
  (for example "Run state changed from Running to Succeeded."). No assistive technology heard it.
- Whether the live region announces anything at a sensible moment for a real user.
- Behaviour in Firefox, Safari or Edge. Only Chrome was used.

## Still to do by a person (MANUAL)

1. Use Run and Results with the keyboard only (no mouse): choose a demonstration, run it, reach the
   results, scroll the log and file table, download a file and the manifest.
2. Check focus is always visible and never trapped.
3. Check with a screen reader and at 200% zoom.

Record the outcome here as done or not done, with the date and the person.

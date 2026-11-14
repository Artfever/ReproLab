# Local interface: responsive and accessibility review (task 5.4)

Scope: every page in `apps/local/public`. Requirements 15.5 and 15.6.
Method: `apps/local/scripts/ui-a11y-review.mjs` starts the real local server and drives headless Chrome (DevTools protocol). The Results page was checked against one real coin run (state `succeeded`, executed in the Docker image). Output is redacted (`<repo>`).

Evidence files in `docs/evidence/local-product/`:

- `ui-a11y-review-run1.txt`: first run, before the fix. 4 failures (listed below). The file is a partly interleaved log because an earlier run was killed and restarted; the failing lines are genuine.
- `ui-a11y-review-run2.txt`: run after the fix. `SUMMARY 162 passed, 0 failed`, `exit=0`.
- `shots/local-<page>-<1280|390|320>.png` for `home`, `run`, `run-problems` (Run with the error summary open), `how-it-works`, `docs`, `limitations`, `privacy`, `terms`, `results-empty`, `results` (real run). 30 PNGs.

## Defects found and fixed

| # | Where | Finding | Fix |
|---|-------|---------|-----|
| 1 | Run page at 320 px (also with problems shown) | Page scrolled sideways: document width 344 px in a 320 px viewport. The first fieldset and the file inputs could not shrink below their content width. | `apps/local/public/styles.css`: `fieldset { min-width: 0 }` and `input[type="file"] { width: 100% }`. Run 2 shows `scrollWidth=320` at 320 px. |
| 2 | Script check, Home | Reported "Tab order not in reading order". Cause: two cards side by side, so the second card's links are higher on the page than the first card's button. Not a page defect. | Check changed to accept a move to the right on the same row. No page change. |
| 3 | Script check, Run | `aria-labelledby="error-summary-title"` on the hidden error summary points at an element that exists only after the summary is shown. | Not changed. The reference resolves once the summary is visible (the `run-problems` state passes). Check now ignores hidden elements. |

## Automated results (run 2, all PASS)

Per page: `lang`, title, viewport meta; one `h1` and no skipped heading levels; landmarks (banner, one labelled `nav`, `main`, footer); skip link first in tab order with a valid target; every form control, link, button and scroll region has an accessible name; no duplicate ids and all `aria-*` references resolve; tables have captions; computed text contrast at WCAG AA (lowest ratio on any page 5.03, normal text 4.5 needed); Tab order follows DOM and reading order; every focused element shows an outline of at least 2 px; with `prefers-reduced-motion: reduce` no element has a transition, animation or smooth scroll (the stylesheet has none to begin with); no horizontal page scroll at 1280, 390 and 320 px; no control smaller than 24x24 CSS px at 390 and 320 px; no uncaught script error on any page.

The contrast check uses computed colours and ReproLab's own WCAG formula, not a third-party tool such as axe. Disabled controls (the assistant textarea and Ask button while the assistant is off) are exempt from WCAG contrast and were not judged.

## Screenshots read, per page

I opened these PNGs: `local-home-1280`, `local-run-320`, `local-results-320`, `local-run-problems-390`. The other PNGs were produced and are measured by the checks above but I did not look at each one; the table says which.

| Page | Widths | Looked at | Notes |
|------|--------|-----------|-------|
| Home | 1280, 390, 320 | 1280 | Header, nav, warning notice, two cards and footer are laid out cleanly. Nav wraps onto rows on narrow screens. No overflow measured. |
| Run | 1280, 390, 320 | 320 | After fix no sideways scroll. Fields stack in one column and labels, hints and file info are readable. Two cosmetic points, not fixed: the first legend ("Start from a demonstration (optional)") wraps to two lines and sits on the border at 320 px; the demonstration `select` clips its text ("None. I will choose my own fil") at 320 px. Full text is still available when the list is opened. |
| Run with problems | 1280, 390, 320 | 390 | Red summary lists each problem as a link; each field shows "Problem: ..." text in red plus the red border. Colour is not the only signal. |
| How it works, Documentation, Limitations, Privacy, Terms | 1280, 390, 320 | not viewed individually | Same shell as Home; checks pass; no overflow measured. |
| Results (no run) | 1280, 390, 320 | not viewed individually | Shows "No run selected" with a link to Run. |
| Results (real run) | 1280, 390, 320 | 320 | Log, file table and summary table scroll inside their own focusable regions (so the table is clipped at 320 px and the user must scroll that region). The page itself does not scroll sideways. Badge shows the word "Succeeded", so state is not conveyed by colour alone. |

## NOT DONE (needs a person)

- **Screen reader pass (NVDA, JAWS, VoiceOver, TalkBack): NOT DONE.** The checks confirm names, landmarks and live regions exist. They do not show how a screen reader reads or announces them.
- **Real keyboard pass by a person: NOT DONE.** The script sent Tab key events and measured focus order and focus rings. Enter/Space activation, the arrow keys on selects, and the feel of the order were not judged by a person. (`ui-keyboard.md` from task 5.2 is a separate record.)
- **200% browser zoom: NOT DONE.** 320 CSS px wide emulates a 400% zoom of a 1280 px window for layout, and that passes with no page scroll, but no one zoomed a real browser to 200% and checked it. Text-only zoom was not tested either.
- Also not done: Firefox, Safari and Edge; high-contrast or forced-colours mode; touch use on a real phone; automated tool such as axe.

The task checkbox stays unticked.

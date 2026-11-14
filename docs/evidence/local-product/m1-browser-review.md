# M1 browser review of apps/web

Task 1.4, requirement 2.6. Reviewer: Kiro executor. Browser: Google Chrome 157 headless (`--headless=new`). Server: `apps/web/scripts/serve-static.mjs` on `http://127.0.0.1:4173`, serving the `out/` folder. `out/` existed already and was rebuilt by `npm run check` after the CSS fix below. Screenshots are in `shots/`. Capture scripts: `.scratch/m1-shots2.ps1` and `.scratch/m1-frame.html` (not committed).

## Files

| PNG | Size | What it is |
|---|---|---|
| `shots/m1-home-1280x800.png` | 1280x800 | `/` at desktop, first viewport |
| `shots/m1-home-1280-full.png` | 1280x5000 | `/` full page |
| `shots/m1-home-390x844.png` | 500x844 | `/` at 390 CSS px (see method note) |
| `shots/m1-home-390-full.png` | 500x5000 | `/` full page at 390 CSS px |
| `shots/m1-sample-run-1280x800.png` | 1280x800 | `/sample-run` first viewport |
| `shots/m1-sample-run-1280-full.png` | 1280x5000 | `/sample-run` full page (cut at 5000 px, the page is longer) |
| `shots/m1-sample-run-390x844.png` | 500x844 | `/sample-run` at 390 CSS px |
| `shots/m1-sample-run-390-full.png` | 500x5000 | `/sample-run` full page at 390 CSS px (cut at 5000 px) |

Method note: headless Chrome would not render a window narrower than about 500 px (a first attempt at `--window-size=390,844` showed text clipped on the right, which was a window artefact, not a page defect). The 390 shots therefore load the page in a 390 px wide iframe inside a 500 px window. The page content is 390 CSS px wide; the grey strip on the right is the harness, not the site. The 390x844 files are 500 px wide PNGs for that reason.

## Defects found and fixed

1. **`serve-static.mjs` answered 404 for `/sample-run`.** The Next export has `out/sample-run.html` and an `out/sample-run/` folder that holds only data `.txt` files. The script treated the folder as the page and found no `index.html`. The first screenshots of `/sample-run` showed the "Page not found" page. Fix: when a folder has no `index.html`, serve `<folder>.html`. Only the local review script changed; the exported site is unchanged.
2. **Tables were crushed at 390 px.** `th, td { overflow-wrap: anywhere }` let every column shrink to one letter, so the table never overflowed its scroll region. Headings broke mid-word ("Pu / blis / he / d"), numbers broke across lines, and the Result column read "fai / l". The pre-declared comparison was unreadable. Fix in `globals.css`: `table { min-width: 36rem }` and `overflow-wrap: break-word` on cells. Hash cells keep their own `.hash` break rule.

After fix 2 the tables at 390 px sit inside their labelled scroll regions and are legible. `npm.cmd run check` was re-run: 78 tests pass (`m1-check-after-fix.txt`).

## Observations (from reading the PNGs)

- **Layout, 1280:** one centred column about 600 px of text on the left half of a wide window. Large empty area on the right. Readable, no overflow. Not a defect, a design choice.
- **Banner ("Limits of this site"):** six bullets in a grey band under the nav, about 230 px tall at 1280 and about 150 px at 390. It sits above the h1 on both pages and takes about one third of the first mobile viewport and about 30 percent of the first desktop viewport. The h1 and call to action are still visible without scrolling at 1280x800; at 390x844 the h1 and "View the recorded sample run" button are visible too.
- **Home order:** h1, one-line purpose, who it is for, one button, "What the tested prototype did" (includes the sentence that the pre-declared comparison failed on all five nodes), "did not do", Status list. Nothing implies a run can be started here.
- **Home, Status block:** shows "Repository licence: not chosen". This is correct today. It becomes stale after task 10.1 adds `LICENSE`; the web data would need updating then (not changed here).
- **Sample run, order:** What this page is, then "The pre-declared comparison failed" callout, then the two failed tables (pre-declared first), then post hoc tables labelled "(not an independent confirmation)", then inputs, settings, output summary, runs. The failure comes before any pass. "fail" is red and "pass (post hoc)" is green, and both carry text, so colour is not the only signal.
- **Sample run, desktop:** all tables fit. In the "All seven recorded runs" table the Status column is narrow and wraps words: "succeede / d" and "timed_ou / t". Cosmetic, not fixed (the column width comes from auto layout and a fix needs a design choice).
- **Sample run, 390 after fix:** Result column and the later columns are off-screen to the right until the region is scrolled. So on a phone the "fail" word of the pre-declared table is not visible without horizontal scrolling. The caption is inside the table, so it scrolls with it and is clipped at the right edge ("Pre-declared comparison: seeds-a, 2 chains pool..."). Not fixed. Possible later fix: move captions outside the scroll region or add a visible "scroll sideways" hint.
- **Overflow:** home has no horizontal overflow at 390. On `/sample-run` the page itself does not scroll sideways; the tables scroll inside their own regions.
- **Contrast:** judged by eye only as good (dark text on pale backgrounds, dark teal button with white text). The contrast tests in the check (25 pairs) pass. I did not measure pixels.
- **Focus order:** not shown in a screenshot. Static evidence only: the page tests assert that the skip link is first, that nav has exactly Home and Sample run, and that each table region has `tabindex="0"`. No keyboard run, zoom or screen-reader check was done. MANUAL.

## Not seen

- Pages below the 5000 px cut on `/sample-run` (the per-run generated-file tables and the Reproducibility, Errors and Limitations sections) were not viewed.
- No Edge run (Edge is not installed on this machine). No real phone. No 200 percent zoom. No keyboard or screen-reader pass. No dark mode or forced-colors view.
- Headless screenshots hid scrollbars (`--hide-scrollbars`), so scroll regions have no visible cue in the PNGs.

## Unchanged

The recorded Seeds comparison text and the post hoc labels were not touched (`apps/web/content` and `src/components/sample-run` are unmodified by this task).

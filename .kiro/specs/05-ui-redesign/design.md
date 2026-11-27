# Design Document: 05-ui-redesign

## Overview

Two front ends get one visual language. Function, copy and claims do not change. The richness goes into two moments of real content, the Run_Timeline and the Sample_Plot, plus one rendered object, the Specimen_Case. The chrome around them stays quiet.

Audit of the previous Local_UI (unslop, light slop): a stacked text-only hero with two equal cards; eight equal-weight navigation links; a 2,800px single-column Results page where wrapping hashes dominate; weights 650 to 750 with negative tracking on small text; `Inter` named but never loaded; off-grid spacing (0.62rem, 1.05rem, 12.8px radius); pill badges; a hover lift with a brightness filter; smooth scrolling. No gradients, glows or emoji.

## Direction

| Line | Value |
|---|---|
| Product | Runs an old Bayesian analysis with its original engine in a sealed container on your machine, and keeps a record you can verify |
| Character | Exact, candid, archival |
| World | An archive room where an old machine has been switched back on: warm paper, graphite ink, typed engine logs, chain-of-custody tags |
| Moments | The Run_Timeline lighting the seven engine markers; the Sample_Plot of real CODA samples (with the exact Beta(8, 4) density for the Coin toy model) |
| Signature | The Hash_Tag `sha256 61cf5083…`, wherever a file is recorded |

## Tokens (`apps/local/public/styles.css`, single `:root`)

| Token | Value | Use |
|---|---|---|
| `--color-paper` | `#f6f5f1` | page |
| `--color-surface` | `#ffffff` | cards, inputs |
| `--color-band` | `#eceae3` | raised rows, table heads |
| `--color-ink` | `#1c211e` | primary text |
| `--color-muted` | `#545b55` | secondary text |
| `--color-border` | `#b9bbb2` | hairlines |
| `--color-border-strong` | `#7a7f77` | control borders |
| `--color-primary` | `#245c43` | the one accent |
| `--color-error` / `--color-warning` | `#a43e3e` / `#875b19` | semantic only |
| `--color-log-bg` / `-log-text` / `-log-muted` | `#161a17` / `#e4e2d9` / `#a9ada4` | the engine log panel |
| `--color-log-accent` / `-log-error` | `#8fcfa9` / `#f2a7a0` | marker and error lines inside the log panel |

Spacing is a 4px scale (`--space-1` 4px to `--space-12` 96px). Radii: 6 for tags and keycaps, 8 for controls, 12 for cards, 16 for panels. Motion: one curve `cubic-bezier(0.2, 0, 0, 1)` implemented once in `motion-logic.js` and passed to both GSAP and anime.js; durations 120, 200 and 320 ms; stagger 40 ms, at most six items. Type: system UI stack for the interface; IBM Plex Mono (self-hosted, 400 and 500) for logs, hashes and figures, with `tabular-nums`.

## Library roles

| Library | File | Job | Loaded on |
|---|---|---|---|
| GSAP 3.15.1 | `vendor/gsap-3.15.1/gsap.min.js` (classic script) | page entrance, chart drawing, log replay | every page |
| ScrollTrigger | `vendor/gsap-3.15.1/ScrollTrigger.min.js` | the pinned pipeline on How it works | How it works |
| anime.js 4.5.0 | `vendor/animejs-4.5.0/anime.esm.min.js` (ES module) | timeline steps, number changes, state changes, hash tag settle, copy feedback | through `motion.js` |
| three.js 0.187.0 | `vendor/three-0.187.0/three.module.js` + `three.core.js` | Specimen_Case on Home; NiftyNet volume viewer on Results | Home, Results (NiftyNet only, dynamic import) |

Rules: no loop, no hover lift, no parallax. Text is never left at opacity 0 waiting for a scroll (the accessibility review computes contrast with the element's own opacity), so scroll-driven motion changes emphasis, not visibility. Under Reduced_Motion `motion.js` returns before creating any tween, the CSS override removes every transition, and three.js renders one frame.

## Page structure (Local_UI)

- **Shell.** `header.site-header` holds the wordmark, the header line "Runs on your machine only. Not a hosted service." and one `nav.site-nav`. Inside the nav, a `<details class="nav-menu" open>` wraps two lists: primary (Home, Run, Results, How it works, Documentation) and secondary (Limitations, Privacy, Terms). Without JavaScript the menu is open. `site.js` closes it below 48rem and keeps it open above. `footer.site-footer` keeps each page's sentences.
- **Home.** Asymmetric hero: text (h1, both required sentences, "Go to Run", "How it works") and the Specimen_Case canvas with a DOM hash caption. Below: the machine strip (Docker, image, nine engines, from `/api/health` and `/api/engines`), the recorded replay of the Coin log from `public/data/recorded-coin-run.json`, and "What this is not".
- **Run.** Two columns. Left: the existing form, unchanged IDs and attribute order, restyled. Right (sticky from 64rem): the engine card from `/api/engines` and the run sheet preview of the chosen files and settings.
- **Results.** Run sheet (state badge, engine, runtime, comparison, created), Run_Timeline, reason box, details, dark log, files with Hash_Tags, manifest and bundles, summary with the Sample_Plot, fixture comparison and NiftyNet viewer, assistant.
- **How it works.** The five numbered steps stay as text. A pinned SVG pipeline beside them highlights the step in view (ScrollTrigger). Under Reduced_Motion or below 64rem, the figure is static and every step is drawn in its resting style.
- **Documentation, Limitations, Privacy, Terms.** Copy unchanged; command blocks and keycaps on Documentation; the Seeds comparison as a table on Limitations.

## Data flow for the moments

- `timelineFromLog(lines, state, engine)` (results-logic.js) walks `SUCCESS_MARKERS` in order with the same "find from the last position" rule as `classify()` in `adapter.py`. A test reads the tuple from `adapter.py` and asserts equality.
- `parseCoda(indexText, chainTexts)` parses `coda_CODAindex.txt` (`name first last`) and chain files (`iteration value`), rejects anything else, and caps the work at 200,000 values. `histogram()` bins the first node per chain. `betaPdf()` draws the exact curve only when `run.comparison.expected` exists for the OpenBUGS Coin demo (Beta(8, 4)).
- `parseNpy(buffer)` reads NumPy v1/v2 headers for little-endian `<f4`, `<f8`, `<i4`, `<u1` C-order arrays up to 8 MiB and returns `{shape, data}`.

## Public_Site

`apps/web` keeps its server-rendered pages. New: `src/components/motion/*` client components (Specimen_Case, chart draw-in) that render their full static fallback on the server, an SVG comparison chart rendered on the server, Hash_Tags as plain text, Plex Mono through `next/font/local`. The guard test allows `gsap`, `three` and `animejs` and client components only in `src/components/motion/`.

## Test amendments (recorded)

| File | Change | Why |
|---|---|---|
| `apps/local/tests/pages.test.mjs` | Allow `@font-face` and `url("/fonts/…woff2")` only; `@import` and remote URLs stay banned. Add the five log tokens to the contrast table | Self-hosted mono face; dark log panel |
| `apps/local/tests/server.test.mjs` | Assert `.woff2` and `.webp` content types | Requirement 2.4 |
| `apps/local/tests/vendor-integrity.test.mjs` | New | Requirement 2.3 |
| `apps/web/tests/disabled-features.test.mjs` | Allow `gsap`, `three`, `animejs` (exact pins) and client components under `src/components/motion/` | Requirement 7.1, 7.3 |
| `apps/local/scripts/results-browser-check.mjs` | None needed; copy buttons sit after each download link, so the required tab subsequence holds | Requirement 6.6 |

Amended earlier requirements, dated 2026-11-27:

- 01-web-mvp Requirement 7.12 (system fonts only): IBM Plex Mono may be self-hosted for mono text; body text stays on system fonts.
- 01-web-mvp Requirements 12.1 and 12.3 (dependency allowlist, no UI or font package): `gsap`, `three` and `animejs` are allowed at exact pins.
- 03-local-product Requirement 16.1 ("no new runtime dependency" for the Public_Site): superseded for the three libraries above only.
- 03-local-product "Local UI visual language": superseded by this document; a dated pointer is in that section.

Spec 01-web-mvp itself is left unedited, as spec 03 requires ("Specs 00, 01-web-mvp … stay unedited"). This table is the amendment record.

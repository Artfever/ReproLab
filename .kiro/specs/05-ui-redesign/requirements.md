# Requirements Document

## Introduction

This spec (`05-ui-redesign`) redesigns the two front ends of ReproLab, the Local_UI in `apps/local/public` and the Public_Site in `apps/web`, without changing what the product does or what it claims. The local product (spec 03) and the multi-engine selector (spec 04) stay the functional baseline. Every honesty rule from `.kiro/steering/scientific-integrity.md`, every required statement and every forbidden claim from specs 01-web-mvp and 03 stays in force.

The design direction was set with the unslop skill (unslop by Damir Sokolovsky, @heydamir, CC BY 4.0) and confirmed by the project owner on 2026-11-27:

- **Product:** runs an old Bayesian analysis with its original engine in a sealed container on your machine, and keeps a record you can verify.
- **Character:** exact, candid, archival.
- **World:** an archive room where an old machine has been switched back on. Graphite-ink and warm paper neutrals, the existing green `#245c43` as the one accent, the engine log as a dark panel in a typewriter-like mono face.
- **Moments:** (1) a run timeline that lights each required engine success marker as it appears in the real log and stops at the failed step; (2) a plot of the real exported samples, labelled as a plot and not a diagnostic.
- **Signature:** a short hash tag `sha256 61cf5083…`, used everywhere a file is recorded.

The owner chose: both front ends (decision Q1 = B); GSAP with ScrollTrigger, anime.js and three.js, each with a stated job (Q2 = all); small, recorded test and spec amendments (Q3 = B).

## Glossary

- **Local_UI**, **Public_Site**, **Run**, **Run_State**, **Run_Manifest**, **Judge**: as in spec 03.
- **Vendor_Dir**: `apps/local/public/vendor/`, holding self-hosted third-party browser files with their licence texts.
- **Vendor_Manifest**: `apps/local/public/vendor/manifest.json`, listing each vendored file with version, licence and SHA-256.
- **Motion_Module**: `apps/local/public/motion.js` with its DOM-free helpers in `motion-logic.js`.
- **Hash_Tag**: the shortened hash element `sha256 xxxxxxxx…` with the full hash available as text.
- **Run_Timeline**: the ordered list of engine success markers on the Results page.
- **Sample_Plot**: the SVG histogram of exported CODA samples on the Results page.
- **Specimen_Case**: the three.js rendered sealed case on the two Home pages, tagged with a real recorded hash.
- **Reduced_Motion**: the user setting `prefers-reduced-motion: reduce`.

## Requirements

### Requirement 1: Honesty and copy are unchanged

**User Story:** As a judge, I want the redesigned screens to say exactly what the product did, so that a better look does not mean a stronger claim.

#### Acceptance Criteria

1. THE Local_UI SHALL keep every sentence asserted by `apps/local/tests/pages.test.mjs`, `ui-logic.test.mjs` and `assistant-status.test.mjs`, word for word.
2. THE Public_Site SHALL keep every statement asserted by `apps/web/tests/smoke.test.mjs`, the limits banner above the h1, and the section order of the Sample run page.
3. THE Local_UI and THE Public_Site SHALL NOT contain the forbidden claims of spec 01 Requirement 4.4 or spec 03 (validated, converged, AI assistant, cloud service, sign up, log in, guarantee), and SHALL NOT suggest that a hosted service exists.
4. WHEN a visual shows recorded data, THE page SHALL label it as recorded and name where it comes from.
5. THE Sample_Plot SHALL carry the caption "Plot of exported samples. Not a convergence diagnostic." and SHALL be drawn only from the files of that Run.
6. THE Run_Timeline SHALL mark a step complete only when its marker line is present in the Run log, and SHALL show the state word next to it in text.

### Requirement 2: Self-hosted assets only

1. THE Local_UI SHALL load every script, style, font and image from its own origin, under the existing `Content-Security-Policy: default-src 'self'`.
2. THE Vendor_Dir SHALL contain only built browser files of GSAP, ScrollTrigger, anime.js and three.js, each with its licence text, at exact versions.
3. THE Vendor_Manifest SHALL record the SHA-256 of every vendored file and font, and a test SHALL fail when a file does not match.
4. THE Local_Server SHALL serve `.woff2` as `font/woff2` and `.webp` as `image/webp`.
5. `docs/third-party-notices.md` SHALL list each vendored library and font with its licence. GSAP SHALL be described as distributed under its own no-charge licence, not as open source.

### Requirement 3: Tokens and type

1. THE Local_UI SHALL define colours only in the single `:root` block of `styles.css`, and every colour token SHALL be covered by the contrast table in `pages.test.mjs`.
2. Text colours SHALL meet 4.5:1 on the surfaces they are used on, including the dark log panel.
3. Spacing SHALL use a 4px scale. Radii SHALL be 8 for controls, 12 for cards and 16 for panels.
4. Interface text SHALL use the system UI stack. Logs, hashes and figures SHALL use IBM Plex Mono, self-hosted. Weights SHALL stay between 400 and 600 and small text SHALL have no negative letter spacing.

### Requirement 4: Navigation and shell

1. Every Local_UI page SHALL keep one `<nav>` that links all eight pages, one h1, the skip link as the first link, `header.site-header` and `footer.site-footer`.
2. Below 48rem the navigation SHALL collapse into a native disclosure (`<details>`) that works without JavaScript.
3. No page SHALL scroll sideways at 320, 390 or 1280 CSS pixels, except inside labelled scroll regions.

### Requirement 5: Motion

1. THE Motion_Module SHALL decide whether anything moves. WHILE Reduced_Motion is active, no element SHALL have a transition, an animation or smooth scrolling, and every three.js scene SHALL draw one still frame.
2. THE Local_UI SHALL NOT use looping motion, hover lift or parallax. One easing curve and three durations SHALL be used.
3. Motion SHALL explain a change: a page entrance, a timeline step lighting, a number changing, a chart drawing in, a scroll-driven pipeline.

### Requirement 6: Results moments

1. THE Results page SHALL show the Run_Timeline for OpenBUGS runs, built from the seven `REQUIRED_SUCCESS_MARKERS` of `services/runner/reprolab_runner/adapter.py`, and a coarse timeline for fixture engines.
2. WHEN a Run ends in `engine_error`, THE Run_Timeline SHALL stop at the first missing marker and show the words "Stopped here" with the engine error line.
3. THE Results page SHALL show every file hash as a Hash_Tag with a copy button, and the full hash SHALL remain in the page text.
4. WHEN an OpenBUGS Run succeeded, THE Results page SHALL draw the Sample_Plot from its CODA files; WHEN the comparison holds an exact expected value for the Coin demo, THE plot SHALL add the exact Beta(8, 4) density labelled "Exact posterior for this toy model".
5. WHEN a NiftyNet Run succeeded, THE Results page SHALL show its `volume.npy` in a three.js slice viewer with a labelled range control, captioned as a synthetic fixture volume.
6. THE Results tab order SHALL stay: skip link, log, files table, the first download link, manifest link, summary region.

### Requirement 7: Public_Site

1. THE Public_Site MAY depend on `gsap`, `three` and `animejs` at exact versions, in addition to the spec 01 allowlist (amends spec 01 Requirement 12.1 and 12.3).
2. THE Public_Site MAY load IBM Plex Mono through `next/font/local` from files in the repository (amends spec 01 Requirement 7.12 for mono text only; body text stays on system fonts).
3. Client components SHALL be limited to `src/components/motion/*` and `src/app/error.tsx`, and SHALL render a complete static fallback in the exported HTML.
4. THE built HTML SHALL still contain no form, button, input, inline style attribute, `fetch` or external resource.
5. THE Sample run page SHALL draw the pre-declared comparison as a server-rendered SVG with each failing node labelled "fail" in text.

### Requirement 8: Evidence

1. Before and after the redesign, every existing suite SHALL be run and its output saved under `docs/evidence/ui-redesign/`.
2. Screenshots at 1280, 390 and 320 CSS pixels SHALL be saved for every Local_UI page.
3. A check that could not run (for example because Docker is not available) SHALL be recorded as SKIPPED with the reason, never as passed.

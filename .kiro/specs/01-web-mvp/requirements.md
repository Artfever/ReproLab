# Requirements Document

## Introduction

The Web_Site is a Next.js (App Router, TypeScript strict) website that Vercel can host. Vercel hosts the web app only, in `apps/web`. The audience is researchers who must re-run an old analysis with its original engine and want to see genuine logs and outputs. In this milestone the Web_Site shows one recorded, read-only sample: the OpenBUGS 3.2.3 Seeds example that ran in a pinned local Docker image on a developer machine (Docker Desktop). The Web_Site does not run the engine.

This spec (`01-web-mvp`) narrows and replaces the web part of the older placeholder spec `01-end-to-end-web-run` for the first release. The older placeholder described a public run button, a queue and a worker; none of these belong to the first release. The older placeholders `01-end-to-end-web-run` and `02-grounded-assistant` and the spec `00-engine-feasibility` are not edited by this spec.

Facts that bind this spec (all taken from `docs/engine-feasibility.md`, `docs/release-decision.md`, `docs/release-inventory.md`, `docs/licensing-review.md`, `docs/third-party-notices.md` and `docs/evidence/`):

- Engine feasibility is GO for local runs. OpenBUGS 3.2.3 (engine banner "rev 1012") ran Seeds with genuine logs and outputs. Image ID `sha256:f65e2244463b5899308e9fd51361589de518f9a534fbc62d758e17277e76b88f` is a local ID, never pushed.
- The pre-declared comparison (pooled 2 chains, 1,000 burn-in; mean within 4 x published Monte Carlo error and sd within 10%) FAILED on all five nodes. Chain 1 alone passes only post hoc. The pooled pass at 20,000 burn-in uses a setting chosen after the failure and is not an independent confirmation. No convergence claim and no scientific-validity claim is made. The published baseline was transcribed by eye from an image, and the source page does not state the number of chains.
- Publishing or distributing the engine image is NO-GO, and a public web runner is NO-GO. The licence review is INCOMPLETE: GPL v3 text versus GPL v2 text conflict, the tarball predates upstream r1018, the build revision of `libOpenBUGS.so` is unknown, CpcBeautifier and TAUCS terms are unknown, and Examples data rights are unknown. The tarball checksum is not cross-checked with SourceForge. Isolation was tested only on Docker Desktop, not on a production worker host. No root `LICENSE` is chosen yet (task 6.4, next milestone).
- All four gates G1 to G4 in `docs/release-decision.md` are UNMET. `scripts/release-guard.ps1` and `scripts/check-publish-paths.ps1` exist.
- The upstream Seeds model, data and initial-value files, upstream documentation text and upstream binaries are not publishable here because their rights are unknown. The Web_Site shows file names, sizes and SHA-256 hashes for them and describes the model in original words.

Where `ReproLab_Harnessed_Build_Plan.md` conflicts with these facts, the facts win.

First slice: Home and Sample_Run_Page are live. How_It_Works_Page and Documentation_Pages are specified (Requirements 5 and 6) but not built in the first slice.

## Glossary

- **Web_Site**: The Next.js application in `apps/web` specified by this document.
- **Site_Shell**: The shared header, navigation, skip link, main landmark and footer of the Web_Site.
- **Home_Page**: The page at `/`.
- **Sample_Run_Page**: The page at `/sample-run`, which presents the recorded Seeds sample.
- **How_It_Works_Page**: The page at `/how-it-works` (later slice).
- **Documentation_Pages**: The pages under `/docs` (later slice).
- **Sample_Content**: The committed content file in `apps/web` (JSON or TypeScript data) from which the Sample_Run_Page is rendered. Derived from `docs/evidence/` and `services/runner/reference/seeds_published.json`.
- **Evidence_Files**: The files under `docs/evidence/` and `services/runner/reference/` from which Sample_Content is derived.
- **Drift_Test**: A unit test that recomputes every value in Sample_Content from the Evidence_Files and fails when any value differs.
- **Recorded_Run**: One of the seven runs listed in Sample_Content: seeds-a, seeds-b, seeds-c, seeds-longburn, bad-syntax, bad-undefined, timeout-live.
- **Pre_Declared_Comparison**: The comparison of pooled seeds-a samples (2 chains, 1,000 burn-in) with the published baseline, using the tolerance fixed before results were seen.
- **Post_Hoc_Result**: Any comparison result whose setting was chosen after the Pre_Declared_Comparison failed (chain 1 only, and the seeds-longburn pooled result at 20,000 burn-in).
- **Published_Baseline**: The 15 numbers (mean, sd, MC error for alpha0, alpha1, alpha12, alpha2, sigma) in `services/runner/reference/seeds_published.json`, with attribution.
- **Upstream_Material**: Any file, documentation text, or binary from the OpenBUGS distribution or its Examples.
- **Program_Output**: A short factual line printed by the engine, shown only inside an element labelled "Program output".
- **Limits_Banner**: The status banner on every page stating what the Web_Site does not do.
- **Empty_State**: The component shown when sample data is missing or invalid.
- **Disabled_Features_Guard**: The automated test that fails when code for a disabled feature appears in `apps/web`.
- **Required_Statements**: The list of statements in Requirement 4 that must appear on named pages.
- **Forbidden_Claims**: The list of phrases and claims in Requirement 4 that must not appear on any page.
- **Release_Guard_Scripts**: `scripts/release-guard.ps1` and `scripts/check-publish-paths.ps1`.
- **Assistant**: The future grounded AI assistant specified in Requirement 13. Not built in this milestone.
- **Check**: A named automated or manual verification. The names are defined in the Acceptance checks table at the end of this document.

## Requirements

### Requirement 1: Homepage

**User Story:** As a researcher, I want the homepage to say who ReproLab helps and what the tested prototype did and did not do, so that I can judge quickly whether the site is relevant and trustworthy.

#### Acceptance Criteria

1. THE Home_Page SHALL state in the first viewport text (before any scrolling at 1280 x 800) that ReproLab helps researchers re-run a supported old analysis with its original engine and view genuine logs and outputs. Check: SMOKE, MANUAL-CONTENT.
2. THE Home_Page SHALL present exactly one primary call-to-action link labelled "View the recorded sample run" that targets `/sample-run`. Check: SMOKE.
3. THE Home_Page SHALL contain no button, link, or form control whose accessible name contains the word "Run" as an imperative action (for example "Run", "Run analysis", "Start run"). Check: SMOKE.
4. THE Home_Page SHALL contain a section "What the tested prototype did" stating that OpenBUGS 3.2.3 ran the Seeds example in a pinned local Docker image on a developer machine, produced genuine logs and sample files, failed visibly on two invalid models, and was stopped by a timeout. Check: SMOKE, DRIFT.
5. THE Home_Page SHALL contain a section "What the tested prototype did not do" listing: no public engine execution, no uploads, no engine image distribution, no convergence or scientific-validity claim, and no test on a production worker host. Check: SMOKE.
6. THE Home_Page SHALL render the Limits_Banner above the main heading region, stating that the site shows a recorded sample, that nothing runs on the site, and that the licence review is incomplete. Check: SMOKE.
7. THE Home_Page SHALL contain exactly one `h1` element. Check: SMOKE.
8. WHEN the Home_Page is rendered, THE Web_Site SHALL produce the page without any client-side request to a host other than the Web_Site origin. Check: GUARD, SMOKE.

### Requirement 2: Navigation and site shell

**User Story:** As a visitor, I want consistent navigation and a footer that states the limits, so that I can move around the site and always see what it does not claim.

#### Acceptance Criteria

1. THE Site_Shell SHALL render, on every page, a skip link as the first focusable element whose target is the `main` landmark. Check: SMOKE, MANUAL-KEYBOARD.
2. THE Site_Shell SHALL render a `header` landmark containing a `nav` landmark with an accessible label, whose links in the first slice are exactly "Home" (`/`) and "Sample run" (`/sample-run`). Check: SMOKE.
3. THE Site_Shell SHALL mark the link of the current page with `aria-current="page"`. Check: SMOKE.
4. THE Site_Shell SHALL render a `footer` landmark containing a one-sentence statement of the limits (recorded sample only, no public execution, licence review incomplete) and links to the Home_Page and the Sample_Run_Page. Check: SMOKE.
5. THE Site_Shell SHALL include no link to `/how-it-works` or `/docs` until the corresponding page exists in the build output. Check: SMOKE.
6. WHEN the smoke test crawls the built output, THE Web_Site SHALL resolve every internal `href` and every in-page fragment (`#id`) to an existing page or element. Check: SMOKE.
7. WHEN the Documentation_Pages and the How_It_Works_Page are built in a later slice, THE Site_Shell SHALL add their links to the header nav and footer in the same change that adds the pages. Check: SMOKE, MANUAL-REVIEW.

### Requirement 3: Sample-run page

**User Story:** As a researcher, I want to see exactly what was run, with what settings, and what came out, including the failed comparison, so that I can judge the evidence without trusting a summary.

#### Acceptance Criteria

1. THE Sample_Run_Page SHALL be rendered entirely from Sample_Content with no network request at build time or run time. Check: BUILD, GUARD.
2. THE Drift_Test SHALL fail WHEN any numeric value, hash, byte size, status, runtime or setting in Sample_Content differs from the value recomputed from the Evidence_Files. Check: DRIFT.
3. THE Sample_Run_Page SHALL contain an "Available inputs" table listing, for the Seeds model, data, chain-1 initial values and chain-2 initial values: the file name used in the manifests, the size in bytes, the SHA-256, and a rights status of "Not published here: rights unknown". Check: SMOKE, DRIFT.
4. THE Sample_Run_Page SHALL show none of the contents of the inputs listed in criterion 3 and SHALL describe the model in original ReproLab wording (random-effects logistic regression over 21 plates, five monitored nodes). Check: SMOKE, MANUAL-CONTENT.
5. THE Sample_Run_Page SHALL contain a "Settings used" table with, for each of seeds-a, seeds-b, seeds-c and seeds-longburn: number of chains, burn-in, number of samples, thinning, seed, and timeout. Check: SMOKE, DRIFT.
6. THE Sample_Run_Page SHALL contain an "Output summary" table for seeds-longburn with mean, sd, median, 2.5% and 97.5% quantiles and n for alpha0, alpha1, alpha12, alpha2 and sigma, labelled "Computed by ReproLab from the exported samples, not copied from the engine's printed table". Check: SMOKE, DRIFT.
7. THE Sample_Run_Page SHALL show the engine runtime of each successful Recorded_Run in seconds with three decimals, as recorded in its manifest (1.921, 1.921, 1.920 and 5.132 for seeds-a, seeds-b, seeds-c and seeds-longburn). Check: SMOKE, DRIFT.
8. THE Sample_Run_Page SHALL show for each Recorded_Run that has them the output file names with byte size and SHA-256 for `coda_CODAchain1.txt`, `coda_CODAchain2.txt`, `coda_CODAindex.txt`, `log.txt`, `script.txt` and `stderr.txt`. Check: SMOKE, DRIFT.
9. THE Sample_Run_Page SHALL list all seven Recorded_Runs (seeds-a, seeds-b, seeds-c, seeds-longburn, bad-syntax, bad-undefined, timeout-live) with status (succeeded, failed, timed_out), engine version "3.2.3 rev 1012", and the reason recorded in the manifest. Check: SMOKE, DRIFT.
10. THE Sample_Run_Page SHALL state, for bad-syntax and bad-undefined, that the engine exit code was 0 although the model was invalid, and that ReproLab decided the failure from the log. Check: SMOKE, DRIFT.
11. THE Sample_Run_Page SHALL show timeout-live as timed_out after 3.001 s against a 3 s limit, with the statement that the log stopped after the model was initialised. Check: SMOKE, DRIFT.
12. THE Sample_Run_Page SHALL state the reproducibility facts: seeds-a and seeds-b produced byte-identical `coda_CODAchain1.txt`, `coda_CODAchain2.txt`, `coda_CODAindex.txt` and `log.txt`; seeds-c with seed 2 produced different sample files; and this shows determinism for one image on one machine, not identity across machines. Check: SMOKE, DRIFT.
13. THE Sample_Run_Page SHALL render the comparison section before the Output summary table in document order, and its first sentence SHALL state that the pre-declared comparison FAILED on all five nodes. Check: SMOKE.
14. THE Sample_Run_Page SHALL show, for the Pre_Declared_Comparison, a table of the five nodes with published mean, ReproLab mean, mean tolerance, published sd, ReproLab sd, sd tolerance, and a text result "fail" or "pass" for each. Check: SMOKE, DRIFT.
15. THE Sample_Run_Page SHALL label each Post_Hoc_Result with the words "post hoc" in the same table row or heading and SHALL state that the 20,000 burn-in was chosen after the 1,000 burn-in failed. Check: SMOKE.
16. THE Sample_Run_Page SHALL state that the Published_Baseline was transcribed by eye from an image, that the source page does not state the number of chains, and that no convergence or scientific-validity claim is made. Check: SMOKE.
17. THE Sample_Run_Page SHALL contain a "Limitations" list with at least: licence review incomplete, engine image not distributed, public execution disabled, isolation tested only on Docker Desktop, one example on one machine and one image, tarball checksum not cross-checked with SourceForge. Check: SMOKE, MANUAL-CONTENT.
18. THE Sample_Run_Page SHALL show engine log lines only inside an element labelled "Program output" and only lines that appear verbatim in `docs/evidence/<run>/log.txt`. Check: DRIFT, SMOKE.
19. THE Sample_Run_Page SHALL contain exactly one `h1` element and SHALL present each data set in a `table` with a `caption`. Check: SMOKE.

### Requirement 4: Content provenance and honesty rules

**User Story:** As a maintainer, I want the honesty rules to be machine-checked, so that no later edit can overstate what the evidence shows.

#### Acceptance Criteria

1. THE Web_Site SHALL include, in a single file `apps/web/content/claims.json` (or equivalent named in the design), one entry per factual claim shown on the Home_Page and the Sample_Run_Page, each entry naming at least one Evidence_Files path. Check: UNIT.
2. WHEN the content test runs, THE content test SHALL fail IF any claim entry names an Evidence_Files path that does not exist or is empty. Check: UNIT.
3. THE Web_Site SHALL display the Required_Statements: (a) on the Home_Page and the Sample_Run_Page, "No convergence or scientific-validity claim is made"; (b) on the Sample_Run_Page, "The pre-declared comparison failed on all five nodes"; (c) on the Sample_Run_Page, "post hoc" adjacent to every pass result; (d) on the Home_Page and the Sample_Run_Page, "The licence review is incomplete"; (e) on the Home_Page and the Sample_Run_Page, "The engine image is not distributed". Check: SMOKE.
4. THE Web_Site SHALL contain none of the Forbidden_Claims on any page: the word "validated" or "validates"; the phrase "reproduces the published results" without the words "post hoc" in the same sentence; the phrases "run it yourself online", "try it online", "run your own model", "upload your"; the phrase "AI-powered", "AI assistant" or "ask the AI" presented as an available feature; and the words "converged" or "convergence achieved". Check: SMOKE.
5. THE Web_Site SHALL contain no Upstream_Material: no file named like an upstream example, no copy of OpenBUGS documentation sentences, and no OpenBUGS binary. Check: UNIT, MANUAL-REVIEW.
6. WHEN the content test runs, THE content test SHALL fail IF any contiguous run of 12 or more words in the built HTML text also appears in the upstream excerpts kept in `docs/evidence/licensing/`, other than text inside an element labelled "Program output". Any later-obtained copy of upstream documentation SHALL be added to the comparison corpus outside the repository by the maintainer. Check: UNIT.
7. THE Web_Site SHALL attribute the Published_Baseline on the Sample_Run_Page by naming the OpenBUGS Seeds example page and the results image as its source, without reproducing the image. Check: SMOKE.
8. THE Web_Site SHALL describe the Seeds data only as taken from Crowder (1978) and Breslow and Clayton (1993) as credited by the example, with the words "bibliographic details not verified". Check: SMOKE.
9. IF a page text contains a number formatted as a result (mean, sd, runtime or hash) that is not present in Sample_Content, THEN THE smoke test SHALL fail. Check: SMOKE.

### Requirement 5: How-it-works page (specified, later slice)

**User Story:** As a researcher, I want a plain description of the workflow from model and data to a reproduction bundle, so that I understand what a recorded run contains and what it does not prove.

#### Acceptance Criteria

1. WHERE the How_It_Works_Page is built, THE How_It_Works_Page SHALL describe the workflow in this order: model, data, initial values and script; engine run; log; sample outputs; manifest; hashes. Check: SMOKE, MANUAL-CONTENT.
2. WHERE the How_It_Works_Page is built, THE How_It_Works_Page SHALL define "reproduction bundle" as the set of inputs, generated script, log, sample files and manifest with hashes, and SHALL state that in the first release no bundle is offered for download. Check: SMOKE.
3. WHERE the How_It_Works_Page is built, THE How_It_Works_Page SHALL state that a finished run is not evidence that a model or its result is scientifically valid. Check: SMOKE.
4. WHERE the How_It_Works_Page is built, THE How_It_Works_Page SHALL state that the engine returned exit code 0 on invalid models and that success is decided from the log. Check: SMOKE, DRIFT.
5. WHILE the How_It_Works_Page is not built, THE Site_Shell SHALL contain no link to it. Check: SMOKE.
6. WHERE the How_It_Works_Page is built, THE How_It_Works_Page SHALL satisfy Requirements 4, 7 and 11. Check: SMOKE, LINT, MANUAL-KEYBOARD.

### Requirement 6: Documentation (specified, later slice)

**User Story:** As a researcher, I want documentation on what is supported and under what licence terms, so that I can decide whether and how to rely on the recorded sample.

#### Acceptance Criteria

1. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL include a "What is supported" page stating OpenBUGS 3.2.3, the Seeds example, one recorded sample, and that nothing else is supported. Check: SMOKE.
2. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL include a "File formats" page describing the model, data, initial-value, script, log, CODA and manifest files in original ReproLab wording, without reproducing upstream documentation. Check: SMOKE, MANUAL-REVIEW.
3. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL include a glossary and a limitations FAQ whose entries are each traceable to an Evidence_Files path. Check: UNIT, SMOKE.
4. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL include a licence and attribution page that restates `docs/third-party-notices.md` in original wording, names OpenBUGS, BlackBox Component Builder, CpcBeautifier and TAUCS, states that the licence review is incomplete, and states that ReproLab does not own those components. Check: SMOKE, MANUAL-REVIEW.
5. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL include an accessibility statement naming the WCAG 2.2 AA target, the automated and manual checks of Requirement 7, and a contact route for reporting barriers. Check: SMOKE, MANUAL-REVIEW.
6. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL include a status page whose text lists the NO-GO items of Requirement 14 and states that the status is written by hand, not read live from any service. Check: SMOKE.
7. WHERE the Documentation_Pages are built, THE Documentation_Pages SHALL contain only original ReproLab text or text the Web_Site is permitted to publish, subject to the Requirement 4 checks. Check: UNIT, MANUAL-REVIEW.
8. WHILE the Documentation_Pages are not built, THE Site_Shell SHALL contain no link to `/docs`. Check: SMOKE.

### Requirement 7: Responsive layout and accessibility

**User Story:** As a visitor using a keyboard, a screen reader, a small screen or magnification, I want every page to be usable, so that I can read the evidence without barriers.

#### Acceptance Criteria

1. THE Web_Site SHALL target WCAG 2.2 level AA. Check: MANUAL-A11Y.
2. THE Web_Site SHALL use semantic landmarks (`header`, `nav`, `main`, `footer`) exactly once each per page, exactly one `h1` per page, and heading levels that never skip a level. Check: SMOKE, LINT.
3. THE Web_Site SHALL set the `lang` attribute on the `html` element, a unique non-empty `title` per page, and a viewport meta tag that does not disable zoom. Check: SMOKE.
4. WHEN a user moves focus with the keyboard, THE Web_Site SHALL show a visible focus indicator with at least 3:1 contrast against adjacent colours on every interactive element. Check: UNIT (contrast), MANUAL-KEYBOARD.
5. THE Web_Site SHALL make every interactive element operable by keyboard alone, in a logical focus order matching visual order. Check: MANUAL-KEYBOARD.
6. THE Web_Site SHALL render every data table with a `caption`, `th` header cells with `scope`, and no layout tables. Check: SMOKE, LINT.
7. THE Web_Site SHALL provide a text alternative for every informative image and SHALL use no image of text for results. Check: SMOKE, LINT.
8. THE Web_Site SHALL convey pass, fail, post hoc and timed_out status with visible text in addition to any colour or icon. Check: SMOKE, MANUAL-A11Y.
9. WHILE the user's setting `prefers-reduced-motion: reduce` is active, THE Web_Site SHALL show no animation or transition longer than 0 ms. Check: UNIT (CSS check), MANUAL-A11Y.
10. THE Web_Site SHALL define a colour palette in a single tokens file and THE contrast test SHALL compute the contrast ratio of every foreground and background pair used for text and fail IF body text is below 4.5:1, large text below 3:1, or UI component boundaries and focus rings below 3:1. Check: UNIT (contrast).
11. WHEN the viewport is 320 CSS px wide, or the page is zoomed to 200% at 1280 px width, THE Web_Site SHALL display all content without horizontal scrolling of the page, except inside a table wrapper that is itself keyboard-focusable and labelled. Check: MANUAL-REFLOW.
12. THE Web_Site SHALL use system fonts only and set body text to at least 16 px. Check: UNIT (CSS check), GUARD.
13. THE Web_Site SHALL pass `eslint` with `eslint-plugin-jsx-a11y` rules (via `eslint-config-next`) with zero errors. Check: LINT.
14. THE repository SHALL contain a manual checklist file `apps/web/ACCESSIBILITY_CHECKLIST.md` covering keyboard-only navigation, screen-reader read-through of the Sample_Run_Page with one named reader, 320 px reflow, 200% zoom, reduced motion, and forced-colours mode, each with a date, tester and result field. Check: MANUAL-REVIEW.

### Requirement 8: Error, empty and loading states

**User Story:** As a visitor, I want clear plain-English messages when something is missing or broken, so that I am never shown technical output or left with a blank page.

#### Acceptance Criteria

1. WHEN a visitor requests a path that does not exist, THE Web_Site SHALL render a custom 404 page inside the Site_Shell with one `h1`, a sentence explaining that the page was not found, and links to the Home_Page and the Sample_Run_Page. Check: SMOKE.
2. IF a render error occurs in a page, THEN THE Web_Site SHALL show an error-boundary page inside the Site_Shell with one `h1`, a plain-English sentence, and a link to the Home_Page. Check: UNIT (render test), SMOKE.
3. THE Web_Site SHALL display no stack trace, file path, exception message, error digest or raw JSON in any error, empty or 404 view. Check: UNIT, MANUAL-REVIEW.
4. IF Sample_Content is missing, fails schema validation, or fails an internal consistency check, THEN THE Sample_Run_Page SHALL render the Empty_State stating in plain English that the recorded sample could not be loaded, what the Web_Site does show instead, and a link to the Home_Page. Check: UNIT.
5. WHEN the Empty_State is shown, THE Web_Site SHALL render no partial numeric result from Sample_Content. Check: UNIT.
6. IF Sample_Content fails validation at build time, THEN THE build SHALL fail with a message naming the failing field. Check: BUILD, UNIT.
7. THE Web_Site SHALL render all sample data statically so that no loading spinner or skeleton state is shown. Check: BUILD, SMOKE.
8. THE Empty_State and the error pages SHALL satisfy the Requirement 7 checks. Check: SMOKE, LINT.

### Requirement 9: Disabled-features guard

**User Story:** As a maintainer, I want an automated check that fails when forbidden capabilities appear, so that the first release cannot quietly gain upload, execution or tracking code.

#### Acceptance Criteria

1. THE Disabled_Features_Guard SHALL fail IF any file under `apps/web` (excluding `node_modules` and build output) contains an `<input type="file">`, a `FormData` construction, a `multipart/form-data` string, a `<form>` element, or a `<textarea>` element. Check: GUARD.
2. THE Disabled_Features_Guard SHALL fail IF `apps/web` contains a Route Handler (`route.ts` or `route.js`), a `pages/api` directory, a Server Action (`"use server"`), or middleware. Check: GUARD.
3. THE Disabled_Features_Guard SHALL fail IF any file under `apps/web` imports or requires `child_process`, `node:child_process`, `worker_threads`, `cluster`, or a Docker client package, or contains the strings `docker run`, `docker exec` or `/var/run/docker.sock`. Check: GUARD.
4. THE Disabled_Features_Guard SHALL fail IF any file under `apps/web` contains an image reference to a container registry (for example `ghcr.io/`, `docker.io/`, `registry-1.docker.io`, `.azurecr.io`, `.dkr.ecr.`) or a `sha256:` digest that begins `f65e2244` in a link target. Check: GUARD.
5. THE Disabled_Features_Guard SHALL fail IF any file under `apps/web` sets a cookie (`document.cookie`, `cookies()`, `Set-Cookie`), uses `localStorage` or `sessionStorage`, or includes an analytics or tracking package or script (for example `gtag`, `googletagmanager`, `plausible`, `posthog`, `@vercel/analytics`, `@vercel/speed-insights`). Check: GUARD.
6. THE Disabled_Features_Guard SHALL fail IF any file under `apps/web` contains an `http://` or `https://` URL that is loaded as a resource (`src`, `link rel=stylesheet|preload|preconnect`, `@import`, `url(...)`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`). Hyperlinks (`<a href>`) to external sites are exempt and are covered by Requirement 11. Check: GUARD.
7. THE Disabled_Features_Guard SHALL fail IF `next/font/google`, `next/font/local` with a remote source, or `next/image` with a remote loader is used. Check: GUARD.
8. WHEN `npm run build` runs, THE build SHALL perform no network request other than the package installation step that precedes it. Check: BUILD, MANUAL-REVIEW.
9. THE Disabled_Features_Guard SHALL include one negative test for each of criteria 1 to 7 that feeds a fixture file containing the forbidden pattern and asserts that the guard reports it. Check: UNIT.
10. THE `npm test` command SHALL run the Disabled_Features_Guard so that a violation fails the command with a non-zero exit code. Check: UNIT.

### Requirement 10: Hosting and deployment constraints

**User Story:** As a maintainer, I want the hosting constraints written down, so that a later preview deployment cannot add secrets, servers or a premature launch.

#### Acceptance Criteria

1. THE Web_Site SHALL be buildable as a fully static site (`output: 'export'` or an equivalent that produces only static files) with the Vercel project Root Directory set to `apps/web`. Check: BUILD.
2. THE Web_Site SHALL need no environment variable at build time or run time. Check: BUILD (build with an empty environment), GUARD (no `process.env` reads except `NODE_ENV`).
3. THE Web_Site SHALL need no serverless function, edge function, cron job, database, object storage, or queue. Check: BUILD, GUARD.
4. THE repository SHALL contain no committed Vercel project link (`.vercel/`) and no secret value in `apps/web`. Check: GUARD, MANUAL-REVIEW.
5. THE milestone for this spec SHALL perform no deployment, no `vercel` CLI invocation and no linking of a Vercel project. Check: MANUAL-REVIEW.
6. WHEN a deployment is later requested, THE deployment task SHALL require explicit user confirmation before it runs, and the first deployment SHALL be a preview deployment only. Check: MANUAL-REVIEW.
7. THE `apps/web` README SHALL document the build command, the Root Directory setting, and the statement that no environment variable is needed. Check: MANUAL-REVIEW.

### Requirement 11: Security and privacy of the site

**User Story:** As a visitor, I want the site to track nothing and send safe headers, so that reading it carries no privacy cost.

#### Acceptance Criteria

1. THE Web_Site SHALL send, through `apps/web/vercel.json` (static hosting does not apply `next.config` headers), the headers `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` (or `strict-origin-when-cross-origin`), and `X-Frame-Options: DENY`. Check: UNIT (parse vercel.json), MANUAL-REVIEW.
2. THE `Content-Security-Policy` header SHALL contain `default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'none'` and `object-src 'none'`. Check: UNIT.
3. THE `script-src` directive of the `Content-Security-Policy` header SHALL contain neither `'unsafe-inline'` nor `'unsafe-eval'`. Check: UNIT.
4. THE `style-src` directive SHALL contain no `'unsafe-inline'` value, unless the design records the specific Next.js limitation that forces it and a MANUAL-REVIEW item approves the exception. Check: UNIT, MANUAL-REVIEW.
5. THE Web_Site SHALL set no cookie and SHALL include no tracking script, beacon, or fingerprinting code. Check: GUARD, SMOKE.
6. THE Web_Site SHALL give every link to a different origin `rel="noopener noreferrer"` and SHALL show the link text as the destination domain or a descriptive name. Check: SMOKE.
7. THE Web_Site SHALL link only to external hosts listed in an allowlist file in `apps/web` (initially `sourceforge.net` and `chjackson.github.io`), and the smoke test SHALL fail on any other external host. Check: SMOKE.
8. THE Web_Site SHALL state on the Limits_Banner or footer that the Terms of Service and the Privacy Policy are drafts that are needed before any public launch and are not built in this milestone. Check: SMOKE.
9. THE Web_Site SHALL show no personal data, patient data, token, key, or personal log in any page or in Sample_Content. Check: UNIT (secret and email pattern scan), MANUAL-REVIEW.
10. THE `apps/web/vercel.json` file SHALL set `Cache-Control` for HTML pages to a value that does not mark them `immutable`. Check: UNIT.

### Requirement 12: Dependencies and cost

**User Story:** As a maintainer, I want a small, recorded dependency set, so that supply-chain risk and hosting cost stay low and reviewable.

#### Acceptance Criteria

1. THE `apps/web/package.json` file SHALL list as dependencies only `next`, `react` and `react-dom`, and as devDependencies only `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint` and `eslint-config-next`. Check: UNIT (package.json allowlist test).
2. THE test suite SHALL use Node's built-in test runner (`node --test`) and SHALL use no test framework package. Check: UNIT.
3. THE `apps/web` application SHALL use no UI kit, no CSS framework, no state-management library, no icon package and no font package. Check: UNIT (allowlist test).
4. THE `apps/web/package.json` file SHALL pin each dependency to an exact version (no `^`, `~`, `*` or `latest`), and `package-lock.json` SHALL be committed. Check: UNIT.
5. THE repository SHALL contain `apps/web/DEPENDENCIES.md` recording the exact installed version of each direct dependency, the Node.js version used, and the date of the record. Check: MANUAL-REVIEW, UNIT (versions match lockfile).
6. WHEN dependencies are installed or changed, THE maintainer SHALL run `npm audit` and record the date, the command, and the full summary line (including zero results) in `apps/web/DEPENDENCIES.md`. Check: MANUAL-REVIEW.
7. THE Web_Site SHALL need no paid service for the first slice. Check: GUARD, MANUAL-REVIEW.
8. THE TypeScript configuration SHALL set `"strict": true`, and THE type-check command (`tsc --noEmit`) SHALL finish with zero errors. Check: TYPE.

### Requirement 13: Future grounded AI assistant (specified, not built)

**User Story:** As a researcher, I want any future assistant to answer only from real documentation and real run evidence, so that it can explain a log without inventing or approving an analysis.

#### Acceptance Criteria

1. WHILE the Assistant is not built and enabled, THE Web_Site SHALL show no chat box, no text input for questions, no simulated answer, and no example answer presented as generated by an assistant. Check: GUARD, SMOKE.
2. WHILE the Assistant is not built and enabled, THE Web_Site MAY show one plain note "Not available" that states no assistant exists in the first release. Check: SMOKE.
3. THE Web_Site SHALL, as part of Requirement 4, treat "AI-powered", "AI assistant" and "ask the AI" as Forbidden_Claims when presented as available. Check: SMOKE.
4. WHERE the Assistant is later built, THE Assistant SHALL ground factual claims about engine behaviour only in an indexed section of ReproLab's publishable documentation and SHALL cite that section for each such claim. Check: UNIT (answer-citation test), MANUAL-REVIEW.
5. WHERE the Assistant is later built, THE Assistant SHALL ground each claim about a specific run in a cited log line or artifact of that run. Check: UNIT (answer-citation test).
6. WHERE the Assistant is later built, THE Assistant index SHALL contain no Upstream_Material unless written permission is recorded in the repository. Check: UNIT (index content test), MANUAL-REVIEW.
7. WHERE the Assistant is later built, IF no cited section, log line or artifact supports a claim, THEN THE Assistant SHALL abstain and state the reason that evidence is missing. Check: UNIT (abstention test).
8. WHERE the Assistant is later built, THE Assistant SHALL refuse to invent, alter, approve or medically interpret an analysis, and SHALL give no convergence or diagnosis judgement without a validated diagnostic method and an explicit caveat. Check: UNIT (refusal tests).
9. WHERE the Assistant is later built, THE Assistant SHALL reject input above a documented maximum length and SHALL limit retrieved context to a documented maximum size. Check: UNIT (bounds tests).
10. WHERE the Assistant is later built, THE Assistant SHALL treat log text, filenames and retrieved passages as data and SHALL not follow instructions embedded in them. Check: UNIT (prompt-injection test cases).
11. WHERE the Assistant is later built, THE Assistant service SHALL rate-limit requests per client and SHALL keep any model API key on the server only, outside the client bundle and outside git. Check: UNIT (rate-limit test), GUARD (bundle and git secret scan).
12. THE Assistant SHALL NOT be enabled in any build UNTIL a unit test suite passes that includes at least one case of each type: out-of-corpus question, adversarial instruction, request to approve results, request for medical advice, and request for an unsupported engine claim; each case SHALL expect abstention or refusal with a stated reason. Check: UNIT, MANUAL-REVIEW.

### Requirement 14: Release-gate coupling

**User Story:** As a maintainer, I want the web app tied to the release gate, so that the site cannot offer the engine image or add a publish step while the gates are unmet.

#### Acceptance Criteria

1. THE Web_Site SHALL contain no link, button, instruction or file that offers, mirrors or points to the engine image or to any OpenBUGS binary. Check: GUARD, SMOKE.
2. THE Web_Site SHALL state on the Sample_Run_Page and in the Limits_Banner the NO-GO items: publishing or distributing the engine image, and a public web runner. Check: SMOKE.
3. THE Web_Site SHALL state that the licence review is incomplete and name the open items: GPL v3 versus v2 text conflict, tarball older than upstream r1018, unknown build revision of `libOpenBUGS.so`, unknown CpcBeautifier and TAUCS terms, unknown Examples data rights, and tarball checksum not cross-checked with SourceForge. Check: SMOKE, DRIFT.
4. THE Web_Site SHALL state that all four release gates (provenance, licence obligations, matching source, recorded decision) are unmet, and that isolation was tested only on Docker Desktop. Check: SMOKE.
5. THE Web_Site SHALL state that no repository licence has been chosen yet and that this is a pending task, without claiming any licence. Check: SMOKE, MANUAL-REVIEW.
6. THE change set for this spec SHALL add no script, workflow, hook or `package.json` script containing a publish-style command (for example `docker push`, `docker save`, `docker tag`, `skopeo copy`, `gh release`, `buildx --push`). Check: PUB.
7. WHEN `scripts/check-publish-paths.ps1` runs on the repository after the Web_Site is added, THE script SHALL exit with code 0. Check: PUB.
8. WHEN `scripts/release-guard.ps1` runs for the local image ID, THE script SHALL still exit non-zero, and no change in this spec SHALL edit the gate statuses in `docs/release-decision.md`. Check: PUB, MANUAL-REVIEW.

## Acceptance checks

Every acceptance criterion names at least one Check from this table.

| Check | Kind | What it runs or reviews | Command or item |
|---|---|---|---|
| LINT | Automated | ESLint with `eslint-config-next` (includes `eslint-plugin-jsx-a11y` rules), zero errors | `npm run lint` in `apps/web` |
| TYPE | Automated | TypeScript strict type-check | `npx tsc --noEmit` in `apps/web` |
| BUILD | Automated | Static production build with an empty environment, Sample_Content schema validation at build time | `npm run build` in `apps/web` |
| UNIT | Automated | Node built-in test runner: schema, claims, allowlists, CSP and headers parsing, contrast computation, CSS checks, error and Empty_State render tests | `npm test` in `apps/web` |
| DRIFT | Automated | Drift_Test: recompute every Sample_Content value from Evidence_Files | part of `npm test` |
| GUARD | Automated | Disabled_Features_Guard with negative fixtures | part of `npm test` |
| SMOKE | Automated | Static HTML checks over the build output: landmarks, one `h1`, heading order, captions, scoped headers, links resolve, external link `rel`, Required_Statements, Forbidden_Claims, number cross-check against Sample_Content | `npm run smoke` after `npm run build` |
| PUB | Automated | Publish-path checks | `powershell -File scripts/check-publish-paths.ps1` and `scripts/release-guard.ps1` (expected to block) |
| MANUAL-KEYBOARD | Manual | Keyboard-only walkthrough of every page: skip link, focus order, visible focus, no trap | `apps/web/ACCESSIBILITY_CHECKLIST.md` |
| MANUAL-REFLOW | Manual | 320 px width and 200% zoom walkthrough | `apps/web/ACCESSIBILITY_CHECKLIST.md` |
| MANUAL-A11Y | Manual | Screen-reader read-through, reduced motion, forced colours, status not by colour alone | `apps/web/ACCESSIBILITY_CHECKLIST.md` |
| MANUAL-CONTENT | Manual | A person reads each page against the honesty rules and the Evidence_Files | review item recorded in the task |
| MANUAL-REVIEW | Manual | A person checks the item named in the criterion (licence wording, no upstream text, no deployment, dependency record) | review item recorded in the task |

Requirement-to-check summary:

| Requirement | Checks |
|---|---|
| 1 Homepage | SMOKE, DRIFT, GUARD, MANUAL-CONTENT |
| 2 Navigation and shell | SMOKE, MANUAL-KEYBOARD, MANUAL-REVIEW |
| 3 Sample-run page | SMOKE, DRIFT, BUILD, GUARD, MANUAL-CONTENT |
| 4 Provenance and honesty | UNIT, SMOKE, MANUAL-REVIEW |
| 5 How it works (later) | SMOKE, DRIFT, LINT, MANUAL-CONTENT |
| 6 Documentation (later) | SMOKE, UNIT, MANUAL-REVIEW |
| 7 Accessibility and layout | LINT, SMOKE, UNIT, MANUAL-KEYBOARD, MANUAL-REFLOW, MANUAL-A11Y, MANUAL-REVIEW |
| 8 Error, empty, loading | SMOKE, UNIT, BUILD, LINT, MANUAL-REVIEW |
| 9 Disabled-features guard | GUARD, UNIT, BUILD, MANUAL-REVIEW |
| 10 Hosting | BUILD, GUARD, MANUAL-REVIEW |
| 11 Security and privacy | UNIT, SMOKE, GUARD, MANUAL-REVIEW |
| 12 Dependencies and cost | UNIT, TYPE, GUARD, MANUAL-REVIEW |
| 13 Future assistant | GUARD, SMOKE, UNIT (future), MANUAL-REVIEW |
| 14 Release-gate coupling | GUARD, SMOKE, DRIFT, PUB, MANUAL-REVIEW |

## Out of scope for this spec

- File upload, model text entry, and any route that accepts a request body.
- Engine execution of any kind, queue, worker, leased job table, Docker or container calls.
- User accounts, sign-in, private runs, signed downloads, and reproduction-bundle download.
- Billing, quotas, organisations.
- Expo / React Native mobile client.
- Deployment to Vercel or any host (a later task that needs user confirmation).
- Implementation of the Assistant (Requirement 13 specifies it only).
- Building the How_It_Works_Page and Documentation_Pages (specified in Requirements 5 and 6 for a later slice).
- Terms of Service and Privacy Policy pages (needed before any public launch; drafts are a later task).
- Choosing or adding the root `LICENSE` (task 6.4, next milestone), and resolving the licensing, numerical-validation and production-isolation blockers.

# Implementation Plan: 01-web-mvp

## Overview

This plan builds the static Next.js site in `apps/web` specified by `requirements.md` and `design.md` in this folder. Work is split into a first vertical slice and later open tasks.

- **Slice 1** (tasks marked `(slice 1)`): scaffold, content pipeline, design tokens and CSS, shell, Home, Sample run, 404/error/empty states, automated tests, basic security headers, and a review task. It produces a site that shows the one recorded OpenBUGS 3.2.3 Seeds sample.
- **Later open tasks**: CSP script hashes, `/how-it-works`, `/docs`, manual accessibility checks (person tasks), Terms and Privacy drafts, CI, a Vercel preview deployment, and the assistant work. Each states why it is open.

All tasks are unticked. The implementer ticks a task only after its acceptance check has run and its evidence file exists. Paths such as `scripts/...` inside `apps/web` are `apps/web/scripts/...`. The two PowerShell checks live at the repository root: `scripts/check-publish-paths.ps1` and `scripts/release-guard.ps1`.

No task here publishes an image, enables uploads, or enables public engine execution. No task deploys anything except task 18.1, which is blocked and needs explicit user confirmation.

## Slice 1 implementation notes (2026-11-13)

Task checkboxes stay open until each task's own acceptance evidence exists or the task text is amended to match what was built.

**Implemented in `apps/web`** and passing `npm run check` (lint, typecheck, build, 78 `node:test` tests; output in `apps/web/evidence/check.txt`):

- Config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `eslint.config.mjs`, `vercel.json` (basic headers only, no CSP).
- Scripts: `scripts/{authored,build-sample-data,validate-sample-data,serve-static}.mjs`.
- Library and data: `src/lib/{sample-run-schema.mjs(+.d.mts),format.mjs(+.d.mts),sample-run.ts,copy.ts}`, `content/sample-run.json`, `external-hosts.json`.
- UI: `src/components/{shell.tsx,data.tsx,sample-run/Sections.tsx}`, `src/app/{layout,page,not-found,error}.tsx`, `src/app/sample-run/page.tsx`, `src/app/globals.css`.
- Tests: `tests/{sample-data,contrast,disabled-features,smoke}.test.mjs`, `tests/helpers/{html,guard}.mjs`.

**Deviations from the written tasks and design.** Each needs either a task edit or a follow-up task.

1. Components are grouped in three files (`shell.tsx`, `data.tsx`, `sample-run/Sections.tsx`). Tasks 4.1, 6.1 to 6.12 and 7.1 name separate files.
2. `SiteHeader`, `LimitsBanner` and `SiteFooter` are rendered by a `PageShell` component that each page uses, not by `RootLayout`. A server layout cannot set `aria-current` without a client component. `RootLayout` renders only `SkipLink` and children.
3. Internal links to `/` use `next/link`, because `eslint-config-next` errors on plain anchors to `/`. `Link` ships a small client runtime. In our own source only `error.tsx` is a client component.
4. Page titles are set per page ("Home | ReproLab", "Sample run | ReproLab"). The design's title template does not apply to pages in the same segment as the root layout.
5. The static export puts a `<div hidden>` before the skip link in `body`. The structure test allows exactly that element.
6. Tests were consolidated into four files instead of the 15 in tasks 8.x. Not written: `tests/helpers/{static-server,required-text,tsx-loader}.mjs`, `helpers.test.mjs`, `content-rules.*.test.mjs`, `disabled-features.negative.test.mjs` with `tests/fixtures/guard/*`, and `render.test.mjs` with `tests/fixtures/invalid-sample-run.json`. The guard has in-file negative samples. The invalid-data `EmptyState` branch is not render-tested.
7. Per-task evidence files named in acceptance checks (for example `evidence/test-drift.txt`, `scaffold-config.txt`, `sample-data-generate.txt`) were not produced. Only `evidence/check.txt`, `dependencies.txt` and `audit.txt` exist.
8. `npm ci` from a clean checkout has not been run (task 1.2).
9. `typescript` is pinned to 5.9.3 (not 7.x) and `eslint` to 9.39.x. `npm audit` reports 7 moderate findings, all in the dev-only lint chain (see `evidence/audit.txt`). Not fixed.
10. The generator checks claims with `contains`, `line_equals` and `json_eq` assertions against evidence files. `claims.json` is the `claims` array inside `content/sample-run.json`, as the design allowed.
11. Manual checks (MANUAL-CONTENT, MANUAL-REVIEW, keyboard, zoom, screen reader, contrast spot checks) have not been done by a person.
12. The sample-run sections for post hoc results, inputs, settings, output summary, runs, reproducibility, errors and limitations are all implemented in `sample-run/Sections.tsx`. Per-section acceptance evidence is not recorded, so tasks 6.x stay open.

## Tasks

- [ ] 1. Scaffold `apps/web`
  - [ ] 1.1 Create the configuration files (slice 1)
    - `apps/web/package.json`: dependencies `next`, `react`, `react-dom`; devDependencies `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`; nothing else. Exact versions only (no `^`, `~`, `*`, `latest`), chosen after checking the peer-dependency range of `eslint-config-next`. Do not invent versions; read them from the registry at install time. `engines.node` is `24.x`.
    - Scripts: `dev` (`next dev`), `build` (`node scripts/validate-sample-data.mjs && next build`), `start-static` (`node scripts/serve-static.mjs`), `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`node --test "tests/**/*.test.mjs"`), `check` (`npm run lint && npm run typecheck && npm run build && npm run test`). Use `&&` chains only, never a Node script that spawns processes (the guard forbids `child_process` in `apps/web`). No script may contain a publish-style command.
    - `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"resolveJsonModule": true`, `"allowJs": false`.
    - `eslint.config.mjs`: flat config using `next/core-web-vitals`, in the form the pinned `eslint-config-next` documents natively. Do not add `@eslint/eslintrc` or any other package.
    - `next.config.mjs`: `output: 'export'`, `images: { unoptimized: true }`, `reactStrictMode: true`, `generateBuildId: async () => 'static'`.
    - `apps/web/.gitignore`: `node_modules`, `.next`, `out`, `*.tsbuildinfo`, `next-env.d.ts`, `.test-tmp`. Do not ignore `evidence/`.
    - _Requirements: 10.1, 10.2, 12.1, 12.4, 12.8, 14.6_
    - Acceptance check: from `apps/web`, run `node -p "const p=require('./package.json');JSON.stringify({dependencies:p.dependencies,devDependencies:p.devDependencies,scripts:Object.keys(p.scripts)},null,2)"` and save the output to `apps/web/evidence/scaffold-config.txt`; MANUAL-REVIEW that the dependency lists match Requirement 12.1 and no version contains `^`, `~`, `*` or `latest`.

  - [ ] 1.2 Install, commit the lockfile, record versions and audit (slice 1)
    - Run `npm.cmd install` in `apps/web` (generates `package-lock.json`, which is committed). Then confirm `npm.cmd ci` works from a clean `node_modules`.
    - Write `apps/web/evidence/dependencies.txt`: Node and npm versions, each direct dependency with its exact installed version (from `npm.cmd ls --depth=0`), the date, the `npm.cmd audit` command and its full summary line (including "found 0 vulnerabilities" if that is the result). Record the real output; do not edit it.
    - _Requirements: 12.4, 12.5, 12.6_
    - Acceptance check: `npm.cmd ci` then `npm.cmd ls --depth=0` and `npm.cmd audit` in `apps/web`; evidence file `apps/web/evidence/dependencies.txt` contains those outputs verbatim.

- [ ] 2. Content pipeline
  - [ ] 2.1 Write the validator and the formatting helpers (slice 1)
    - `src/lib/sample-run-schema.mjs` plus hand-written `sample-run-schema.d.mts`: validate the `SampleRun` shape in `design.md` (Data Models) and the arithmetic invariants (`d_mean`, `mean_ok`, `sd_ok`, `ok`, `mean_tol = 4 x mc_error`, `sd_tol = 0.1 x ref_sd`, `overall`). Errors name the path of the failing field.
    - `src/lib/format.mjs` plus `format.d.mts`: the only place that turns numbers into display text (runtime with three decimals, bytes, hex, quantiles).
    - `scripts/validate-sample-data.mjs`: loads `content/sample-run.json`, runs the validator, exits 1 with the field path on failure.
    - _Requirements: 3.14, 8.6_
    - Acceptance check: `node scripts/validate-sample-data.mjs` in `apps/web` exits 0 once task 2.2 has written the JSON, and exits 1 with a field path on a deliberately broken copy; save both outputs to `apps/web/evidence/validate-sample-data.txt`.

  - [ ] 2.2 Write the generator and generate `content/sample-run.json` (slice 1)
    - `scripts/authored.mjs`: hand-written claims, limitations, comparison classification (the five rows in `design.md`), status facts, assertions. Original wording only; copy no upstream text.
    - `scripts/build-sample-data.mjs`: dependency-free (`node:fs`, `node:path`, `node:crypto`, `node:url` only); reads the evidence files listed in `design.md`; exports `generate()`; supports `--write` and `--check`; deterministic output (sorted keys, LF, trailing newline, no timestamp); fails with file and field on every condition listed under "Generator rules".
    - Run `node scripts/build-sample-data.mjs --write` once and commit `content/sample-run.json`.
    - Numbers come only from the evidence files. Do not type any result by hand.
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 14.3_
    - Acceptance check: `node scripts/build-sample-data.mjs --check` in `apps/web` exits 0; evidence file `apps/web/evidence/sample-data-generate.txt` holds the `--write` and `--check` outputs and `Get-FileHash` SHA-256 of `content/sample-run.json`.

  - [ ] 2.3 Write the drift test (slice 1)
    - **Property 3: Generated data equals committed data**
    - **Validates: Requirements 3.2**
    - `tests/sample-data.drift.test.mjs`: run `generate()` in memory and deep-compare to `content/sample-run.json`; run it twice and compare; check each `generated_from` entry's hash and byte size against the file on disk.
    - _Requirements: 3.2_
    - Acceptance check: `node --test tests/sample-data.drift.test.mjs` in `apps/web`; evidence file `apps/web/evidence/test-drift.txt`.

  - [ ] 2.4 Write the schema mutation test (slice 1)
    - **Property 6: Comparison rows are internally consistent, and any single-field corruption is rejected by name**
    - **Validates: Requirements 3.14, 8.6**
    - `tests/sample-data.schema.test.mjs`: validator accepts the committed file; a fixed table of single-field mutations (each breaking one invariant or schema rule) is rejected and the message contains the mutated field path.
    - _Requirements: 3.14, 8.6_
    - Acceptance check: `node --test tests/sample-data.schema.test.mjs` in `apps/web`; evidence file `apps/web/evidence/test-schema.txt`.

- [ ] 3. Design tokens and global CSS
  - [ ] 3.1 Write `src/app/globals.css` (slice 1)
    - First `:root` block holds the tokens from the design's colour table, including `--color-accent: #AE5636` (not #B65C3A).
    - Mobile-first base for 320 px, steps at `min-width: 48rem` and `64rem`; system fonts only; body at least `1rem`; prose capped at `70ch`.
    - `:focus-visible` outline 3 px in `--color-primary`; `.skip-link` visible on focus; `.table-scroll` with `overflow-x: auto`; hashes use `overflow-wrap: anywhere`.
    - `@media (prefers-reduced-motion: reduce)` sets `animation: none; transition: none; scroll-behavior: auto`. No `transition` or `animation` elsewhere.
    - `@media (forced-colors: active)` keeps borders. `@media print`: tables do not split across pages mid-row, link URLs are not required, backgrounds removed, text black on white.
    - No external `url()` and no `@import`.
    - _Requirements: 7.4, 7.9, 7.10, 7.11, 7.12, 9.6_
    - Acceptance check: covered by task 3.2; evidence file `apps/web/evidence/css-tokens.txt` listing the `:root` token block copied from the file.

  - [ ] 3.2 Write the contrast and CSS test (slice 1)
    - **Property 12: Every declared colour pair meets its contrast threshold**
    - **Validates: Requirements 7.4, 7.10**
    - `tests/helpers/contrast.mjs` (WCAG 2.x relative luminance) and `tests/contrast.test.mjs`: parse the `:root` tokens, compute every declared pair in the design's contrast table (text 4.5, large text 3, non-text 3), fail naming pair and ratio. Also assert body font at least 1rem, no `transition` or `animation` outside the reduced-motion block, no external `url()` or `@import`, system fonts only. Print the computed ratios.
    - _Requirements: 7.4, 7.9, 7.10, 7.12_
    - Acceptance check: `node --test tests/contrast.test.mjs` in `apps/web`; evidence file `apps/web/evidence/test-contrast.txt` including the computed ratios.

- [ ] 4. Site shell
  - [ ] 4.1 Write `src/lib/copy.ts` and the shell components (slice 1)
    - `src/lib/copy.ts`: the fixed copy from the design. Banner sentences, Home first-viewport sentence, call-to-action text, comparison first sentence.
    - Components: `SkipLink`, `SiteHeader` (`NAV` constant lists only Home `/` and Sample run `/sample-run`; `aria-current="page"` on the current link; `nav aria-label="Main"`), `SiteFooter` (one limits sentence, links to Home and Sample run, Terms/Privacy-are-drafts sentence), `LimitsBanner` (a `section aria-labelledby`, not `role="alert"`). Relative imports only. No client component.
    - _Requirements: 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 11.8, 14.2, 14.4_
    - Acceptance check: `npm.cmd run lint` and `npm.cmd run typecheck` in `apps/web` exit 0; shell markup checked by task 8.8; evidence file `apps/web/evidence/shell-components.txt` with lint and typecheck output.

  - [ ] 4.2 Write `src/app/layout.tsx` and metadata (slice 1)
    - `<html lang="en">`; viewport meta without `maximum-scale` or `user-scalable`; title template `"<page> | ReproLab"`; order: `SkipLink` first, `LimitsBanner`, `SiteHeader`, `<main id="main" tabIndex={-1}>`, `SiteFooter`; imports `globals.css`. The `SiteHeader` current page is set per page.
    - _Requirements: 2.1, 2.2, 7.2, 7.3_
    - Acceptance check: `npm.cmd run build` in `apps/web` succeeds; evidence file `apps/web/evidence/build-shell.txt` with the build output.

- [ ] 5. Homepage
  - [ ] 5.1 Write `src/app/page.tsx` (slice 1)
    - Sections in design order: one `h1`; first-viewport sentence; exactly one call-to-action link "View the recorded sample run" to `/sample-run`; "What the tested prototype did"; "What the tested prototype did not do"; short Status list from `status_facts`. Facts carry `data-claim` ids. No form control; no accessible name with an imperative "Run".
    - The Required_Statements (a), (d), (e) of Requirement 4.3 appear on this page.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 4.3, 14.2, 14.3, 14.4, 14.5_
    - Acceptance check: `node --test tests/smoke.structure.test.mjs` (task 8.8) after `npm.cmd run build`; manual item MANUAL-CONTENT: a person reads `/` against the honesty rules and records the result in `apps/web/evidence/manual-content-home.txt`.

- [ ] 6. Sample-run page
  - [ ] 6.1 Write the loader and data components (slice 1)
    - `src/lib/sample-run.ts`: `loadSampleRun()` returns `{ok:true,data}` or `{ok:false,field}` using the validator. Typed with the `.d.mts`.
    - `DataTable` (caption, `th scope`, focusable labelled scroll region, `data-comparison-kind`), `Hash` (full 64 hex), `StatusText` (visible words), `ProgramOutput` (`figure` labelled "Program output").
    - _Requirements: 3.1, 3.18, 3.19, 7.6, 7.8_
    - Acceptance check: `npm.cmd run typecheck` and `npm.cmd run lint` in `apps/web` exit 0; evidence file `apps/web/evidence/sample-run-components.txt`.

  - [ ] 6.2 Write the "What this page is" section, `#about` (slice 1)
    - New file `src/components/sample-run/AboutSection.tsx`. Recorded, read-only status; what was run, where and with which image; model in original words (random-effects logistic regression over 21 plates, five monitored nodes); data credit to Crowder (1978) and Breslow and Clayton (1993) with "bibliographic details not verified"; baseline attribution to the OpenBUGS Seeds example page and results image (named, not reproduced; only `sourceforge.net` and `chjackson.github.io` links, each with `rel="noopener noreferrer"`); baseline transcribed by eye; source page does not state the number of chains.
    - _Requirements: 3.4, 3.16, 4.7, 4.8, 11.6_
    - Acceptance check: `node --test tests/smoke.structure.test.mjs` after build; evidence in `apps/web/evidence/test-smoke-structure.txt`.

  - [ ] 6.3 Write the pre-declared comparison section, `#comparison` (slice 1)
    - New file `src/components/sample-run/ComparisonSection.tsx`. First sentence "The pre-declared comparison failed on all five nodes." Tolerance rule. A table with `data-comparison-kind="pre_declared"` (seeds-a pooled, 1,000 burn-in) and a second pre-declared table for seeds-c (seed 2). Result cells say "fail". All values read from `sample-run.json`.
    - _Requirements: 3.13, 3.14, 4.3_
    - Acceptance check: `node --test tests/smoke.comparison-order.test.mjs` (task 8.9) after build; evidence in `apps/web/evidence/test-smoke-comparison-order.txt`.

  - [ ] 6.4 Write the post hoc section, `#post-hoc` (slice 1)
    - New file `src/components/sample-run/PostHocSection.tsx`. States the 20,000 burn-in was chosen after the 1,000 burn-in failed, and "No convergence or scientific-validity claim is made." Three tables (`seeds-a` chain 1, `seeds-a` chain 2, `seeds-longburn` pooled 20,000) with `data-comparison-kind="post_hoc"`, captions beginning "post hoc:", result cells "pass (post hoc)" or "fail (post hoc)".
    - _Requirements: 3.15, 3.16, 4.3_
    - Acceptance check: `node --test tests/smoke.post-hoc.test.mjs` (task 8.10) after build; evidence in `apps/web/evidence/test-smoke-post-hoc.txt`.

  - [ ] 6.5 Write the inputs section, `#inputs` (slice 1)
    - New file `src/components/sample-run/InputsSection.tsx`. Table "Available inputs": name in manifest, upstream file name matched by hash, size in bytes, SHA-256, rights status "Not published here: rights unknown". Shows no file contents.
    - _Requirements: 3.3, 3.4_
    - Acceptance check: `node --test tests/smoke.structure.test.mjs` after build; evidence in `apps/web/evidence/test-smoke-structure.txt`.

  - [ ] 6.6 Write the settings section, `#settings` (slice 1)
    - New file `src/components/sample-run/SettingsSection.tsx`. One row each for seeds-a, seeds-b, seeds-c, seeds-longburn: chains, burn-in, samples, thinning, seed, timeout (s).
    - _Requirements: 3.5_
    - Acceptance check: `node --test tests/smoke.numbers.test.mjs` (task 8.11) after build; evidence in `apps/web/evidence/test-smoke-numbers.txt`.

  - [ ] 6.7 Write the output summary section, `#output-summary` (slice 1)
    - New file `src/components/sample-run/OutputSummarySection.tsx`. Caption "seeds-longburn, 2 chains pooled. Computed by ReproLab from the exported samples, not copied from the engine's printed table". Columns Node, Mean, SD, Median, 2.5%, 97.5%, n.
    - _Requirements: 3.6, 3.13_
    - Acceptance check: `node --test tests/smoke.numbers.test.mjs` after build; evidence in `apps/web/evidence/test-smoke-numbers.txt`.

  - [ ] 6.8 Write the recorded runs section, `#runs` (slice 1)
    - New file `src/components/sample-run/RunsSection.tsx`. Table of all seven runs (status, engine version "3.2.3 rev 1012", exit code, runtime in seconds with three decimals, reason). Per-run file table (name, bytes, SHA-256). bad-syntax and bad-undefined: exit code 0 although the model was invalid and ReproLab decided failure from the log. timeout-live: timed_out after 3.001 s against a 3 s limit, log stopped after the model was initialised.
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.11, 14.1_
    - Acceptance check: `node --test tests/smoke.numbers.test.mjs` after build; evidence in `apps/web/evidence/test-smoke-numbers.txt`.

  - [ ] 6.9 Write the reproducibility section, `#reproducibility` (slice 1)
    - New file `src/components/sample-run/ReproducibilitySection.tsx`. seeds-a and seeds-b byte-identical for the three CODA files and `log.txt`; seeds-c (seed 2) differs; determinism for one image on one machine only.
    - _Requirements: 3.12_
    - Acceptance check: `node --test tests/sample-data.drift.test.mjs` and `tests/smoke.structure.test.mjs`; evidence in `apps/web/evidence/test-drift.txt`.

  - [ ] 6.10 Write the error-capture section, `#errors` (slice 1)
    - New file `src/components/sample-run/ErrorsSection.tsx`. The two invalid models are not shown. First engine error line of each is shown inside `ProgramOutput` (`expected right parenthesis error pos 58 (error on line 4)`, `variable gamma_missing is not defined`), plus the note that later lines are follow-on messages.
    - _Requirements: 3.10, 3.18_
    - Acceptance check: `node --test tests/content-rules.program-output.test.mjs` (task 8.4); evidence in `apps/web/evidence/test-content-program-output.txt`.

  - [ ] 6.11 Write the limitations section, `#limitations` (slice 1)
    - New file `src/components/sample-run/LimitationsSection.tsx`. List from `limitations[]`: licence review incomplete with the six open items; engine image not distributed; public execution disabled; isolation tested only on Docker Desktop; one example on one machine and one image; tarball checksum not cross-checked with SourceForge; no repository licence chosen yet; baseline transcribed by eye. Also states all four release gates unmet and the NO-GO items.
    - _Requirements: 3.17, 14.2, 14.3, 14.4, 14.5_
    - Acceptance check: `node --test tests/content-rules.phrases.test.mjs` (task 8.5); MANUAL-CONTENT record in `apps/web/evidence/manual-content-sample-run.txt`.

  - [ ] 6.12 Assemble `src/app/sample-run/page.tsx` (slice 1)
    - Sections in design order: about, comparison, post hoc, inputs, settings, output summary, runs, reproducibility, errors, limitations. One `h1` "Recorded sample: OpenBUGS Seeds". When `loadSampleRun()` is not ok, render only the banner and `EmptyState` and no numbers. Facts carry `data-claim`.
    - _Requirements: 3.1, 3.13, 3.19, 8.4, 8.5_
    - Acceptance check: `npm.cmd run build` in `apps/web` exits 0 and `out/sample-run.html` exists; evidence file `apps/web/evidence/build-sample-run.txt` with the build output and `Get-ChildItem out` listing.

- [ ] 7. Not-found, error and empty states
  - [ ] 7.1 Write `EmptyState` (slice 1)
    - `src/components/EmptyState.tsx`: `h2`, plain-English text, link to `/`. Never receives sample data.
    - _Requirements: 8.4, 8.5, 8.8_
    - Acceptance check: `node --test tests/render.test.mjs` (task 8.14); evidence in `apps/web/evidence/test-render.txt`.

  - [ ] 7.2 Write `src/app/not-found.tsx` (slice 1)
    - One `h1` "Page not found", one sentence, links to `/` and `/sample-run`, inside the shell.
    - _Requirements: 8.1, 8.8_
    - Acceptance check: `node --test tests/smoke.structure.test.mjs` fetches `/does-not-exist` and expects status 404 with the page; evidence in `apps/web/evidence/test-smoke-structure.txt`.

  - [ ] 7.3 Write `src/app/error.tsx` (slice 1)
    - The only client component (`"use client"`). One `h1`, one plain sentence, link to `/`. No `error.message`, no digest, no stack, no `console.error`, no reporting service.
    - _Requirements: 8.2, 8.3, 8.8_
    - Acceptance check: `node --test tests/render.test.mjs` (task 8.14); evidence in `apps/web/evidence/test-render.txt`.

- [ ] 8. Automated tests
  - [ ] 8.1 Write the test helpers and the static server (slice 1)
    - `tests/helpers/html.mjs` (tolerant tag scanner with its own fixture tests), `tests/helpers/static-server.mjs` (`node:http`, port 0, maps `/x` to `x.html`, unknown paths to `404.html` with status 404, fails with "Run npm run build first" when `out/` is missing), `tests/helpers/required-text.mjs` (required and forbidden phrases per page, must equal `src/lib/copy.ts`), `scripts/serve-static.mjs` (calls the server on a fixed local port for `npm run start-static`), `tests/helpers/tsx-loader.mjs` (transpiles `src/**/*.ts(x)` with the installed `typescript` into `.test-tmp/`).
    - Server binds `127.0.0.1` only.
    - _Requirements: 2.6, 9.8, 12.2_
    - Acceptance check: `node --test tests/helpers.test.mjs` in `apps/web`; evidence file `apps/web/evidence/test-helpers.txt`.

  - [ ] 8.2 Write the claims-evidence test (slice 1)
    - **Property 1: Every claim maps to a real evidence file**
    - **Validates: Requirements 4.1, 4.2**
    - `tests/content-rules.claims.test.mjs`: each claim has non-empty `evidence`; each path exists, is non-empty, is in `generated_from` with matching hash and size; each `asserted` entry re-evaluates true.
    - _Requirements: 4.1, 4.2_
    - Acceptance check: `node --test tests/content-rules.claims.test.mjs`; evidence in `apps/web/evidence/test-content-claims.txt`.

  - [ ] 8.3 Write the displayed-claims test (slice 1)
    - **Property 2: Every displayed claim is declared, and every declared claim is displayed on its page**
    - **Validates: Requirements 4.1**
    - `tests/content-rules.displayed.test.mjs`: over built `out/index.html` and `out/sample-run.html`, compare `data-claim` ids with `claims[]` both ways.
    - _Requirements: 4.1_
    - Acceptance check: `npm.cmd run build` then `node --test tests/content-rules.displayed.test.mjs`; evidence in `apps/web/evidence/test-content-displayed.txt`.

  - [ ] 8.4 Write the program-output and upstream-text test (slice 1)
    - **Property 8: Program output is verbatim engine text**
    - **Validates: Requirements 3.18, 4.5, 4.6**
    - `tests/content-rules.program-output.test.mjs`: each `program_output` entry equals a line of `docs/evidence/<run>/log.txt`; each "Program output" element line in built pages likewise; no 12-word window of other page text appears in `docs/evidence/licensing/*.txt`; no upstream-named example file or binary exists under `apps/web`.
    - _Requirements: 3.18, 4.5, 4.6_
    - Acceptance check: `node --test tests/content-rules.program-output.test.mjs`; evidence in `apps/web/evidence/test-content-program-output.txt`.

  - [ ] 8.5 Write the phrases test (slice 1)
    - **Property 9: No page contains a forbidden claim, and every page has its required statements**
    - **Validates: Requirements 4.3, 4.4, 13.3**
    - `tests/content-rules.phrases.test.mjs`: every `out/*.html` including `404.html` has none of the forbidden phrases (with the "post hoc" exception for "reproduces the published results"); Home and Sample run contain their Required_Statements; secret and e-mail pattern scan of `sample-run.json` and built text.
    - _Requirements: 4.3, 4.4, 11.9, 13.1, 13.3_
    - Acceptance check: `node --test tests/content-rules.phrases.test.mjs`; evidence in `apps/web/evidence/test-content-phrases.txt`.

  - [ ] 8.6 Write the disabled-features scanner and negative fixtures (slice 1)
    - `tests/helpers/guard.mjs`: scanner for every pattern in Requirements 9.1 to 9.7, plus `"use client"` allowed only in `src/app/error.tsx`, `process.env` allowed only for `NODE_ENV`, and no `.vercel/`. Excludes `node_modules`, `.next`, `out`, `.test-tmp`, `tests/fixtures`.
    - `tests/fixtures/guard/*`: one fixture file per rule that contains the forbidden pattern. Fixtures are text only and never executed or imported.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_
    - Acceptance check: `node --test tests/disabled-features.negative.test.mjs` asserts the scanner reports each fixture; evidence in `apps/web/evidence/test-guard-negative.txt`.

  - [ ] 8.7 Write the real-tree guard test (slice 1)
    - **Property 13: The disabled-features guard reports every forbidden pattern and finds none in the tree**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9, 9.10**
    - `tests/disabled-features.test.mjs`: scan the real `apps/web` tree and expect zero findings; confirm `npm test` fails when a finding exists (via the negative test).
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.10, 13.1_
    - Acceptance check: `node --test tests/disabled-features.test.mjs`; evidence in `apps/web/evidence/test-guard.txt`.

  - [ ] 8.8 Write the structural smoke test (slice 1)
    - `tests/smoke.structure.test.mjs`: serve `out/`; fetch `/`, `/sample-run`, `/does-not-exist` (status 404). Per page: `html[lang]`, unique non-empty `<title>`, viewport meta, one each of `header`, `nav[aria-label]`, `main`, `footer`, exactly one `h1`, no skipped heading level, skip link first and targeting `#main`, `aria-current` on the current link, nav links exactly Home and Sample run, tables with `caption` and `th[scope]`, no `style` attribute or `<style>` element, no `<img>` without `alt`, no `button`/`input`/`form`/`textarea`, no accessible name with an imperative "Run", no link to `/how-it-works` or `/docs`, no request to another origin in the HTML.
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.19, 7.2, 7.3, 7.6, 7.7, 8.1, 8.7, 10.2_
    - Acceptance check: `npm.cmd run build` then `node --test tests/smoke.structure.test.mjs`; evidence in `apps/web/evidence/test-smoke-structure.txt`.

  - [ ] 8.9 Write the comparison-order test (slice 1)
    - **Property 4: The pre-declared failed comparison comes first**
    - **Validates: Requirements 3.13, 4.3**
    - `tests/smoke.comparison-order.test.mjs`: first `data-comparison-kind="pre_declared"` table has overall fail, precedes every `post_hoc` table and the Output summary, and the section starts with "The pre-declared comparison failed on all five nodes."
    - _Requirements: 3.13, 4.3_
    - Acceptance check: `node --test tests/smoke.comparison-order.test.mjs`; evidence in `apps/web/evidence/test-smoke-comparison-order.txt`.

  - [ ] 8.10 Write the post-hoc label test (slice 1)
    - **Property 5: Every pass is labelled post hoc**
    - **Validates: Requirements 3.15, 4.3**
    - `tests/smoke.post-hoc.test.mjs`: every cell starting "pass" is in a `post_hoc` table whose caption contains "post hoc" and whose text ends "(post hoc)"; each `post_hoc` comparison in the data has "post hoc" in its heading or caption.
    - _Requirements: 3.15, 4.3_
    - Acceptance check: `node --test tests/smoke.post-hoc.test.mjs`; evidence in `apps/web/evidence/test-smoke-post-hoc.txt`.

  - [ ] 8.11 Write the displayed-numbers test (slice 1)
    - **Property 7: Page numbers come from the sample data**
    - **Validates: Requirements 3.6, 3.7, 3.8, 4.9**
    - `tests/smoke.numbers.test.mjs`: every numeric table cell and every 64-hex string on `/` and `/sample-run` is in the set produced by `format.mjs` over `sample-run.json`; every `d+.ddd s` runtime equals a formatted `runtime_s`.
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 4.9_
    - Acceptance check: `node --test tests/smoke.numbers.test.mjs`; evidence in `apps/web/evidence/test-smoke-numbers.txt`.

  - [ ] 8.12 Write the internal-links test (slice 1)
    - **Property 10: Every internal link resolves**
    - **Validates: Requirements 2.5, 2.6, 5.5, 6.8**
    - `tests/smoke.links.test.mjs`: crawl every internal `href` and `#fragment` in `out/`; targets exist; no link to `/how-it-works` or `/docs` while those pages are absent from `out/`.
    - _Requirements: 2.5, 2.6, 5.5, 6.8_
    - Acceptance check: `node --test tests/smoke.links.test.mjs`; evidence in `apps/web/evidence/test-smoke-links.txt`.

  - [ ] 8.13 Write the external-links test and allowlist (slice 1)
    - **Property 11: Every external link is allowed and safe**
    - **Validates: Requirements 11.6, 11.7**
    - Create `external-hosts.json` with `sourceforge.net` and `chjackson.github.io`. `tests/smoke.external.test.mjs`: every external `<a>` host is listed and `rel` contains `noopener` and `noreferrer`.
    - _Requirements: 11.6, 11.7_
    - Acceptance check: `node --test tests/smoke.external.test.mjs`; evidence in `apps/web/evidence/test-smoke-external.txt`.

  - [ ] 8.14 Write the render test for error, empty and 404 views (slice 1)
    - `tests/render.test.mjs`: with the tsx loader and `react-dom/server`, render `EmptyState`, `error.tsx`, `not-found.tsx`, and `/sample-run` with an invalid sample fixture (`tests/fixtures/invalid-sample-run.json`). Assert one `h1`, expected links, no numbers from sample data, and no `message`, `digest`, stack or path text.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8_
    - Acceptance check: `node --test tests/render.test.mjs`; evidence in `apps/web/evidence/test-render.txt`.

  - [x] 8.15 Run `npm run check` and record it (slice 1)
    - Run from `apps/web`: `npm.cmd run check` (lint, typecheck, build with no environment variable set for the build, then all tests). Also run `npm.cmd run start-static` briefly to confirm `out/` is served, then stop it. Fix failures before ticking; do not skip or loosen a test.
    - _Requirements: 8.6, 8.7, 9.8, 9.10, 10.1, 10.2, 12.2, 12.8_
    - Acceptance check: `npm.cmd run check` exits 0; evidence file `apps/web/evidence/check.txt` with the complete output and the exit code.

- [ ] 9. Basic security headers
  - [ ] 9.1 Write `apps/web/vercel.json` with the four basic headers (slice 1)
    - Headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera, microphone, geolocation, payment and usb disabled). HTML `Cache-Control: public, max-age=0, must-revalidate`; never `immutable` for HTML.
    - No `Content-Security-Policy` yet: it is added by task 11.1. Until then Requirement 11.1 and 11.2 are only partly met; the plan does not claim otherwise.
    - _Requirements: 11.1, 11.10_
    - Acceptance check: `node --test tests/headers.test.mjs` (task 9.2); evidence in `apps/web/evidence/test-headers.txt`.

  - [ ] 9.2 Write the basic headers test (slice 1)
    - `tests/headers.test.mjs`: parse `vercel.json`; assert the four headers and their values and that the HTML cache rule is not `immutable`. CSP assertions are added by task 11.2.
    - _Requirements: 11.1, 11.10_
    - Acceptance check: `node --test tests/headers.test.mjs`; evidence in `apps/web/evidence/test-headers.txt`.

- [ ] 10. Slice-1 review
  - [ ] 10.1 Review and commit slice 1 (slice 1)
    - From the repository root run `powershell -File scripts/check-publish-paths.ps1` (expect exit 0). Run `powershell -File scripts/release-guard.ps1 -ImageDigest sha256:f65e2244463b5899308e9fd51361589de518f9a534fbc62d758e17277e76b88f` (expect non-zero; this proves the gate still blocks). Run `npm.cmd run check` in `apps/web`.
    - Confirm there is no upload, engine, publish, deployment or Vercel link code: the guard test passes, `git status` shows no `.vercel/`, and `docs/release-decision.md` is unchanged.
    - Review the staged diff for secrets, upstream text, and any edit outside `apps/web` and this spec. Commit only specific named files, never `git add .`.
    - Leave this task open until the implementer ticks it after the evidence exists.
    - _Requirements: 10.4, 10.5, 14.1, 14.6, 14.7, 14.8_
    - Acceptance check: the three commands above; evidence file `docs/evidence/web-slice1-review.txt` with each command's output and exit code, the `git diff --cached --stat` output, and the commit hash.

- [ ] 11. Content Security Policy (later, open)
  - [ ] 11.1 Write `scripts/update-csp.mjs` and add the CSP header
    - Open because the approach depends on the first real build: inline-script bodies must be byte-stable, and Vercel behaviour on the 404 response is unverified. The script computes the SHA-256 of every inline script in `out/**/*.html` and writes the union into `vercel.json`. No `'unsafe-inline'` fallback without a requirements change. The script uses only `node:fs`, `node:path`, `node:crypto`. Add `csp` to `package.json` scripts.
    - If the real build writes inline `style` attributes, record the exception in `design.md` through a separate approved edit; do not add `'unsafe-inline'` here.
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
    - Acceptance check: `npm.cmd run build` then `npm.cmd run csp` in `apps/web`, then twice more to prove byte-stable output; evidence file `apps/web/evidence/csp-update.txt`.

  - [ ] 11.2 Extend the headers test with CSP and stale-hash checks
    - Open until 11.1 exists. Add to `tests/headers.test.mjs`: required directives (`default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'none'`, `object-src 'none'`), no `'unsafe-inline'` or `'unsafe-eval'` in `script-src` or `style-src`, and every inline-script hash in `out/` present and no extra hash.
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
    - Acceptance check: `npm.cmd run build` then `node --test tests/headers.test.mjs`; evidence in `apps/web/evidence/test-headers-csp.txt`.

- [ ] 12. How-it-works page (later, open)
  - [ ] 12.1 Build `/how-it-works` and add it to nav and footer
    - Open because the first slice is limited to Home and Sample run. Page content per Requirement 5: order model, data, inits and script; engine run; log; sample outputs; manifest; hashes; "reproduction bundle" defined with no download offered; a finished run is not evidence of scientific validity; exit code 0 on invalid models. Add the nav and footer links in the same change. Original wording only.
    - _Requirements: 2.7, 5.1, 5.2, 5.3, 5.4, 5.6_
    - Acceptance check: `npm.cmd run check` in `apps/web`; evidence in `apps/web/evidence/how-it-works-check.txt`; MANUAL-CONTENT record in `apps/web/evidence/manual-content-how-it-works.txt`.

- [ ] 13. Documentation pages (later, open)
  - [ ] 13.1 Build the `/docs` index, `/docs/[slug]` mechanism and "What is supported"
    - Open because documentation is outside slice 1. Use `generateStaticParams` over the files in `content/docs/*.json`, read at build time with `node:fs`, and `dynamicParams = false`. Add nav and footer links in the same change. "What is supported": OpenBUGS 3.2.3, Seeds, one recorded sample, nothing else.
    - _Requirements: 2.7, 6.1, 6.8_
    - Acceptance check: `npm.cmd run check` in `apps/web`; evidence in `apps/web/evidence/docs-index-check.txt`.

  - [ ] 13.2 Write the "File formats" page
    - Open: depends on 13.1. Describe model, data, initial-value, script, log, CODA and manifest files in original wording, with no upstream sentences.
    - _Requirements: 6.2, 6.7_
    - Acceptance check: `npm.cmd run check` (includes the 12-word test); MANUAL-REVIEW record in `apps/web/evidence/docs-file-formats-review.txt`.

  - [ ] 13.3 Write the glossary and limitations FAQ
    - Open: depends on 13.1. Each entry names an Evidence_Files path and a unit test checks that the path exists.
    - _Requirements: 6.3, 6.7_
    - Acceptance check: `npm.cmd run check`; evidence in `apps/web/evidence/docs-glossary-check.txt`.

  - [ ] 13.4 Write the licence and attribution page in original words
    - Open: depends on 13.1 and on the licence review wording in `docs/third-party-notices.md`. Names OpenBUGS, BlackBox Component Builder, CpcBeautifier and TAUCS; states the licence review is incomplete and that ReproLab does not own those components. It makes no licence claim for the repository.
    - _Requirements: 6.4, 6.7, 14.3, 14.5_
    - Acceptance check: `npm.cmd run check`; MANUAL-REVIEW record in `apps/web/evidence/docs-licence-review.txt`.

  - [ ] 13.5 Write the accessibility statement page
    - Open: depends on 13.1 and on the results of the manual checks in task 14. States the WCAG 2.2 AA target, the automated and manual checks, and a contact route for reporting barriers. States only what the recorded checks show.
    - _Requirements: 6.5, 6.7, 7.1_
    - Acceptance check: `npm.cmd run check`; MANUAL-REVIEW record in `apps/web/evidence/docs-accessibility-review.txt`.

  - [ ] 13.6 Write the status page
    - Open: depends on 13.1. Hand-written list of the NO-GO items and gate statuses, stating it is written by hand and not read from any live service.
    - _Requirements: 6.6, 14.2, 14.4_
    - Acceptance check: `npm.cmd run check`; evidence in `apps/web/evidence/docs-status-check.txt`.

- [ ] 14. Manual accessibility checks (later, open; person tasks)
  - [ ] 14.1 Create `apps/web/ACCESSIBILITY_CHECKLIST.md`
    - Open because it belongs with the manual checks. Items from the design: keyboard (scripts on and off), 320 px reflow, 200% zoom, reduced motion, forced colours, screen-reader read-through with one named reader and tool, status without colour. Each item has date, tester and result fields. Leave all results blank.
    - _Requirements: 7.14_
    - Acceptance check: MANUAL-REVIEW that the file lists every item and every item has the three fields; evidence file `apps/web/evidence/checklist-created.txt`.

  - [ ] 14.2 Keyboard walk-through (person task)
    - Open: a person must do it on the built site (`npm.cmd run start-static`), with scripts on and off, on `/`, `/sample-run`, and the 404 page. Result is recorded in the checklist. The implementer does not fill it in for the person.
    - _Requirements: 2.1, 7.4, 7.5_
    - Acceptance check: MANUAL-KEYBOARD items completed in `apps/web/ACCESSIBILITY_CHECKLIST.md`; evidence copy `apps/web/evidence/manual-keyboard.txt`.

  - [ ] 14.3 Reflow at 320 px (person task)
    - Open: a person task on the real rendering.
    - _Requirements: 7.11_
    - Acceptance check: MANUAL-REFLOW 320 px items in the checklist; evidence `apps/web/evidence/manual-reflow-320.txt`.

  - [ ] 14.4 Zoom at 200% (person task)
    - Open: a person task on the real rendering.
    - _Requirements: 7.11_
    - Acceptance check: MANUAL-REFLOW 200% items in the checklist; evidence `apps/web/evidence/manual-zoom-200.txt`.

  - [ ] 14.5 Screen-reader spot check (person task)
    - Open: a person task. One named reader and tool read the Sample run page, the comparison and the post hoc tables.
    - _Requirements: 7.1, 7.8_
    - Acceptance check: MANUAL-A11Y items in the checklist, with reader and tool named; evidence `apps/web/evidence/manual-screen-reader.txt`.

  - [ ] 14.6 Contrast on the real rendering (person task)
    - Open: the automated test checks declared token pairs only; a person must check the rendered pages, forced-colours mode and reduced motion.
    - _Requirements: 7.9, 7.10_
    - Acceptance check: MANUAL-A11Y items in the checklist; evidence `apps/web/evidence/manual-contrast.txt`.

- [ ] 15. Terms and Privacy drafts (later, open)
  - [ ] 15.1 Draft the Terms of Service and Privacy Policy pages
    - Open: both are needed before any public launch and are not in slice 1. Drafts labelled as drafts, in original wording, no legal claims invented; the person responsible reviews them. The footer link and any nav change are made in the same change. The Privacy page states the site sets no cookie and runs no analytics, which the guard test enforces.
    - _Requirements: 11.5, 11.8_
    - Acceptance check: `npm.cmd run check`; MANUAL-REVIEW by a person recorded in `apps/web/evidence/terms-privacy-review.txt`.

- [ ] 16. Continuous integration (later, open)
  - [ ] 16.1 Add a CI workflow that runs the checks
    - Open: no CI exists yet. The workflow runs `npm ci` and `npm run check` in `apps/web`, then `scripts/check-publish-paths.ps1`, then `scripts/release-guard.ps1` with the local image ID and asserts it still exits non-zero. It needs no secrets and contains no publish-style command, no deploy step and no upload step.
    - _Requirements: 12.7, 14.6, 14.7, 14.8_
    - Acceptance check: `scripts/check-publish-paths.ps1` exits 0 on the workflow file; workflow run log saved to `docs/evidence/web-ci-run.txt` after the first run.

- [ ] 17. README, dependency record and package test (later, open)
  - [ ] 17.1 Write `apps/web/README.md`
    - Open: written after the slice is stable. Documents `npm.cmd ci`, build command, output directory `out`, Vercel Root Directory `apps/web`, that no environment variable is needed, how to run `check`, and that nothing is deployed.
    - _Requirements: 10.7_
    - Acceptance check: MANUAL-REVIEW; a person follows the README from a fresh clone and records the result in `apps/web/evidence/readme-walkthrough.txt`.

  - [ ] 17.2 Write `apps/web/DEPENDENCIES.md`
    - Open: copies the verified content of `apps/web/evidence/dependencies.txt` into the document required by Requirement 12.5, using the real recorded values.
    - _Requirements: 12.5, 12.6_
    - Acceptance check: `node --test tests/package.test.mjs` (task 17.3) checks versions equal the lockfile; evidence in `apps/web/evidence/test-package.txt`.

  - [ ]* 17.3 Write the package allowlist test
    - Open: optional hardening. `tests/package.test.mjs`: dependency allowlist, exact versions, lockfile present, `DEPENDENCIES.md` versions match the lockfile, no publish-style command in scripts.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 14.6_
    - Acceptance check: `node --test tests/package.test.mjs`; evidence in `apps/web/evidence/test-package.txt`.

- [ ] 18. Vercel preview deployment (later, blocked)
  - [ ] 18.1 Deploy a preview only, after explicit user confirmation (blocked)
    - Blocked until: slice 1 is reviewed (task 10.1), the manual checks in task 14 pass, task 11 is done or its CSP gap is accepted in writing, and the user explicitly confirms in the conversation. Not started without that confirmation.
    - Root Directory `apps/web`; preview only, no production; no environment variable, no secret, no engine image, no upload, no function. Record the unverified items from the design: headers on Vercel's 404 response and CSP behaviour.
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6_
    - Acceptance check: written user confirmation saved in `docs/evidence/web-preview-confirmation.txt`; deployment log and the preview URL's response headers saved in `docs/evidence/web-preview.txt`; `scripts/check-publish-paths.ps1` exit 0.

- [ ] 19. Grounded assistant (later, open; mostly blocked)
  - [ ] 19.1 Build the documentation corpus and inventory
    - Open: needs the `/docs` pages (task 13). The corpus holds only original ReproLab documents and the recorded sample's own logs and manifests. An inventory file lists each indexed path and its origin. Excludes `docs/evidence/licensing/`, upstream docs, and the Seeds file contents.
    - _Requirements: 13.4, 13.6_
    - Acceptance check: `node --test tests/assistant-corpus.test.mjs` (inventory vs. 12-word test against the licensing corpus); evidence in `docs/evidence/assistant-corpus-inventory.txt`.

  - [ ] 19.2 Build the retrieval index
    - Open: depends on 19.1. Build-time inverted index (JSON), chunked by heading or log line range; no vector database and no embeddings.
    - _Requirements: 13.4, 13.6, 13.9_
    - Acceptance check: `node --test tests/assistant-index.test.mjs` (only allowlisted paths indexed; context-size bound); evidence in `docs/evidence/assistant-index.txt`.

  - [ ] 19.3 Write the citation and abstain contracts
    - Open: depends on 19.2. Implement the `Answer | Abstain` schema, the quote-hash verifier, and the run-citation line check from the design. Any unverifiable claim becomes an abstention that states that evidence is missing.
    - _Requirements: 13.4, 13.5, 13.7_
    - Acceptance check: `node --test tests/assistant-contracts.test.mjs`; evidence in `docs/evidence/assistant-contracts.txt`.

  - [ ] 19.4 Write the refusal policy
    - Open: depends on 19.3. Refuse to invent, alter, approve or medically interpret an analysis; no convergence or diagnosis judgement without a validated method and explicit caveat.
    - _Requirements: 13.8_
    - Acceptance check: `node --test tests/assistant-refusal.test.mjs`; evidence in `docs/evidence/assistant-refusal.txt`.

  - [ ] 19.5 Write the prompt-injection tests
    - Open: depends on 19.3 and 19.4. Cases include instruction-like text inside log fixtures, file names and retrieved passages.
    - _Requirements: 13.10_
    - Acceptance check: `node --test tests/assistant-injection.test.mjs`; evidence in `docs/evidence/assistant-injection.txt`.

  - [ ] 19.6 Write the unsupported-question evaluation set and the gate
    - Open: depends on 19.3 and 19.4. `assistant/eval/cases.json` with at least one case of each type: out-of-corpus question, adversarial instruction, request to approve results, request for medical advice, request for an unsupported engine claim; plus positive cases that must cite the right section or line. A gate test fails when the enable flag is `true` and the stored evaluation result does not list every case as passed for the current corpus hash. Do not invent expected answers; derive positives from real log lines.
    - _Requirements: 13.12_
    - Acceptance check: `node --test tests/assistant-eval.test.mjs`; evidence in `docs/evidence/assistant-eval.txt`.

  - [ ] 19.7 Do not enable assistant UI until evaluation passes
    - Open: a standing guard. Add a test that fails if any build config, environment default, or source sets the assistant enable flag to a true value while task 19.6's stored evaluation result is missing or has any failed case. The flag default is `false`. The Disabled_Features_Guard keeps rejecting chat inputs while the flag is off.
    - _Requirements: 13.1, 13.12_
    - Acceptance check: `node --test tests/assistant-gate.test.mjs` passes with the flag `false` and fails on a fixture with the flag `true` and no evaluation result; evidence in `docs/evidence/assistant-gate.txt`.

  - [ ] 19.8 Build the assistant UI behind a flag defaulting to off (blocked)
    - Blocked until: task 19.7 passes, task 19.6 passes with all cases, and a requirements change is approved because a chat input conflicts with Requirements 9.1, 9.2, 10.3 and 11.2 of this spec. Not started now.
    - _Requirements: 13.1, 13.2, 13.12_
    - Acceptance check: `npm.cmd run check` with the flag off shows no chat element in `out/`; evidence in `docs/evidence/assistant-ui-flag-off.txt`.

  - [ ] 19.9 Add a server-side model call (blocked)
    - Blocked until: a separate cost, key-handling and privacy review is approved by the user, and a requirements change allows a server endpoint. Needs per-client rate limiting; the key stays server-side outside git and the client bundle. Not started now.
    - _Requirements: 13.9, 13.11_
    - Acceptance check: `node --test tests/assistant-ratelimit.test.mjs` and a bundle and git secret scan; evidence in `docs/evidence/assistant-server.txt`.

- [ ] 20. Checkpoint - Review with the user
  - Review slice 1 results, the evidence files, and the open and blocked tasks with the user. Ask the user which later task to do next. Ask questions if anything is unclear.

## Notes

- Tasks marked `*` are optional. The slice-1 test tasks are not optional, because the slice request names them and `npm run check` runs them.
- **Enforcement.** Kiro reads only the `waves` array in the JSON below. The `blocked_until` key is advisory text for people. Real enforcement is `scripts/release-guard.ps1` and `scripts/check-publish-paths.ps1`, only where they are run (task 10.1, and task 16.1 once CI exists). Nothing enforces the blocked tasks automatically.
- **Deviations from `design.md`, which is not changed.** (1) The scripts are the seven named in the slice request (`dev`, `build`, `start-static`, `lint`, `typecheck`, `test`, `check`). The design's `data`, `smoke`, `csp` and `verify` scripts are replaced: run the generator with `node scripts/build-sample-data.mjs --write`, run smoke tests with `node --test tests/smoke.*.test.mjs`, and `csp` is added by task 11.1. (2) `next.config.mjs` also sets `images.unoptimized` as requested, although the design says it is not needed because `next/image` is unused. (3) The design's `content-rules.test.mjs` and `smoke.test.mjs` are split into one file per property (`content-rules.*.test.mjs`, `smoke.*.test.mjs`) so that tasks can run in parallel; the `test` glob runs them all. (4) The generated slice-1 `vercel.json` has no CSP, so Requirements 11.1 to 11.4 stay partly met until task 11.
- `npm test` fails when `out/` is missing. This is intentional; `npm run check` builds first.
- Evidence files must contain real command output. Do not write results by hand.
- Requirement 12.5 asks for `DEPENDENCIES.md`; slice 1 records the same facts in `apps/web/evidence/dependencies.txt`, and task 17.2 writes the document.
- The task list's "accessibility statement page" is task 13.5.

## Blocked by decisions outside this spec

These items cannot be settled by any task in this plan. Each needs a decision by a person.

- **Licensing review.** Any use of upstream text, example files (Seeds model, data, initial values), or the engine image is blocked. The review is incomplete: GPL v2 versus v3 text conflict, tarball older than upstream r1018, unknown `libOpenBUGS.so` build revision, unknown CpcBeautifier and TAUCS terms, unknown Examples data rights, tarball checksum not cross-checked with SourceForge. The site shows names, sizes and hashes only.
- **Numerical validation.** The pre-declared comparison failed on all five nodes. No task makes or implies a validated-results, convergence or scientific-validity claim.
- **Production isolation.** Isolation was tested only on Docker Desktop. No public engine run is allowed until a production worker host is tested.
- **Repository LICENSE choice.** This is task 6.4 of `00-engine-feasibility`. No task here adds a root `LICENSE` or claims one.

No task in this plan publishes an image, enables uploads, or enables public engine execution. Task 18.1 is a static preview deployment and is blocked until the user confirms.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "8.6"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2", "4.1", "7.1", "7.2", "7.3", "8.1", "8.7", "9.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.2", "6.1", "9.2"] },
    { "id": 3, "tasks": ["5.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "8.2"] },
    { "id": 4, "tasks": ["6.12"] },
    { "id": 5, "tasks": ["8.3", "8.4", "8.5", "8.8", "8.9", "8.10", "8.11", "8.12", "8.13", "8.14"] },
    { "id": 6, "tasks": ["8.15"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["11.1", "12.1", "14.1", "16.1", "17.1", "17.2", "17.3", "19.1"] },
    { "id": 9, "tasks": ["11.2", "13.1", "19.2"] },
    { "id": 10, "tasks": ["13.2", "13.3", "13.4", "13.6", "15.1", "19.3", "19.4"] },
    { "id": 11, "tasks": ["14.2", "14.3", "14.4", "14.5", "14.6", "19.5", "19.6"] },
    { "id": 12, "tasks": ["13.5", "18.1", "19.7"] },
    { "id": 13, "tasks": ["19.8"] },
    { "id": 14, "tasks": ["19.9"] }
  ],
  "blocked_until": {
    "18.1": "slice 1 reviewed (10.1), manual checks 14.2 to 14.6 pass, explicit user confirmation",
    "19.8": "19.6 and 19.7 pass, plus a requirements change for a chat input",
    "19.9": "separate cost, key-handling and privacy review approved by the user, plus a requirements change for a server endpoint",
    "13.5": "results of manual checks in task 14 should exist before the page states them",
    "14.2": "slice 1 reviewed (10.1)",
    "14.3": "slice 1 reviewed (10.1)",
    "14.4": "slice 1 reviewed (10.1)",
    "14.5": "slice 1 reviewed (10.1)",
    "14.6": "slice 1 reviewed (10.1)"
  }
}
```

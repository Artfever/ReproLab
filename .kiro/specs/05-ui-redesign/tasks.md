# Implementation Plan: 05-ui-redesign

## Overview

Redesigns `apps/local/public` and `apps/web` along the direction in `design.md`. One local branch `ui-redesign`, one commit per task, no push. Tick a task only after its acceptance check ran and its evidence exists under `docs/evidence/ui-redesign/`.

## Executor notes

- Windows host. Node v26.13.1 (the project pins 24.x; `npm` warns EBADENGINE, tests run). Docker is **not installed** on this machine, so every Docker-dependent check (runner unit tests, real engine runs, `multi-engine-browser-check.py`, the Results audit against a real Coin run) is recorded as SKIPPED with this reason.
- The shell tool truncates long commands. Commands run through `.scratch/run.mjs <cwd> <log> <command>`, which writes the real exit code into the log.
- Visual review of the Results page without Docker uses a preview harness in `.scratch/` that starts `src/server.mjs` with `tests/helpers/fake-docker.mjs`. Screenshots made that way are labelled as fake-engine previews and are not run evidence.

## Tasks

- [x] 1. Spec, steering and baseline
  - Branch `ui-redesign`; this spec; `.kiro/steering/design.md`; dated amendment notes in 01-web-mvp and 03-local-product.
  - _Requirements: 8.1_
  - Acceptance check: `docs/evidence/ui-redesign/baseline-local-test.txt` (253 pass, 2 skipped, 0 fail), `baseline-web-check.txt` (86 pass, `EXIT=0`), `baseline-audit-tracked.txt`, `baseline-check-license.txt`.

- [ ] 2. Vendored libraries, font and server support
  - `apps/local/scripts/vendor-ui-libs.mjs`, `public/vendor/**`, `public/fonts/**`, `vendor/manifest.json`, MIME entries, notices, `tests/vendor-integrity.test.mjs`, server test for `.woff2`/`.webp`.
  - _Requirements: 2.1-2.5_
  - Acceptance check: `npm.cmd test` in `apps/local` passes including `vendor-integrity`; `node scripts/audit-tracked.mjs` passes.

- [ ] 3. Design tokens and shared shell for all eight local pages
  - _Requirements: 3.1-3.4, 4.1-4.3_
  - Acceptance check: `npm.cmd test` passes; `node scripts/ui-a11y-review.mjs` passes on every page that does not need Docker.

- [ ] 4. Motion foundation (`motion.js`, `motion-logic.js`, `site.js`)
  - _Requirements: 5.1-5.3_
  - Acceptance check: `tests/motion-logic.test.mjs` passes; the reduced-motion check of the accessibility review passes.

- [ ] 5. Hash tag signature on Results
  - _Requirements: 6.3, 6.6_
  - Acceptance check: `shortHash` tests pass; results.js ID test passes.

- [ ] 6. Run timeline and Results layout
  - _Requirements: 1.6, 6.1, 6.2, 6.6_
  - Acceptance check: `timelineFromLog` tests (success, engine_error at each step, timed_out, unknown) and the adapter.py marker pin test pass.

- [ ] 7. Sample plot
  - _Requirements: 1.5, 6.4_
  - Acceptance check: `parseCoda`, `histogram`, `betaPdf` tests pass.

- [ ] 8. Run page
  - _Requirements: 4.1, 6.6_
  - Acceptance check: run.html tests in `ui-logic.test.mjs` pass; `scripts/ui-browser-check.mjs` passes.

- [ ] 9. Home page: Specimen_Case, machine strip, recorded replay
  - _Requirements: 1.4, 5.1_
  - Acceptance check: showcase data test passes; Home audit passes.

- [ ] 10. How it works, Documentation, Limitations, Privacy, Terms
  - _Requirements: 1.1, 5.3_
  - Acceptance check: `pages.test.mjs` copy assertions pass; audit passes on these pages.

- [ ] 11. Assistant panel styling
  - _Requirements: 1.1_
  - Acceptance check: `assistant-status.test.mjs` passes.

- [ ] 12. NiftyNet volume viewer
  - _Requirements: 6.5_
  - Acceptance check: `parseNpy` tests pass, including bad headers and size limits.

- [ ] 13. Public_Site redesign
  - _Requirements: 7.1-7.5, 1.2_
  - Acceptance check: `npm.cmd run check` in `apps/web` exits 0.

- [ ] 14. Full verification, evidence and write-up
  - _Requirements: 8.1-8.3_
  - Acceptance check: every suite output saved under `docs/evidence/ui-redesign/final-*`; screenshots at 1280, 390 and 320; skipped checks named.

- [ ] 15. unslop story video
  - Acceptance check: `unslop-story/story.html` exists and the rendered MP4 plays; credit "unslop by @heydamir" visible.

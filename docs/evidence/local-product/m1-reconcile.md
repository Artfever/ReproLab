# M1 reconcile: `01-web-mvp/tasks.md` against evidence on disk

Task 1.5 of `03-local-product`, requirement 2.2, 2.3, 2.7, 2.8.

Method: for each 01-web-mvp task I compared its own "Acceptance check" with the files that exist: `apps/web/evidence/{check,dependencies,audit}.txt`, `docs/evidence/local-product/m1-*`, and the test files in `apps/web/tests/`. A box is ticked only if the stated check has evidence on disk showing the stated result. Missing named evidence files are not created by hand or back-filled after the fact. Only `[ ]` to `[x]` was edited in `01-web-mvp/tasks.md` (`m1-spec-diff.txt`: one line changed). No wording was amended: the 03 acceptance check allows only checkbox changes, so the gaps below are listed here and the deviations stay recorded in the slice 1 notes of that file.

Result: **1 task ticked (8.15). Every other task is left open.**

## Defects and regression tests (task 1.4 follow-up)

Two defects were fixed in task 1.4 (`m1-browser-review.md`). The review said no regression test exists for either. Two dependency-free `node:test` files were added in `apps/web/tests/` (picked up by the existing `tests/**/*.test.mjs` glob):

| File | Defect covered | What it asserts |
|---|---|---|
| `serve-static.test.mjs` | `serve-static.mjs` answered 404 for `/sample-run` (folder `out/sample-run/` has no `index.html`; the page is `out/sample-run.html`) | `out/` has that folder-plus-html shape; `GET /sample-run` and `/sample-run/` return 200 with the Seeds `h1`; an unknown path returns 404 with the "Page not found" `h1` |
| `table-layout.test.mjs` | Tables crushed to one-letter columns at 390 px | `table` has `min-width` of at least 30rem; `.table-scroll` has `overflow-x: auto`; `th, td` use `overflow-wrap: break-word` and not `anywhere` or `break-all`; `.hash` keeps `overflow-wrap: anywhere` |

The table test reads the CSS text. It does not render a browser, so it shows the rule is present, not that the layout looks right. The visual result rests on the screenshots in `shots/`.

Check runs (`npm.cmd run check` in `apps/web`, output saved with an `exit=` line appended):

1. `m1-check-after-fix-run1-failed.txt`: 86 tests, 85 pass, 1 fail, exit 1. My own new test was wrong: it asserted the text "Page not found" is absent from `/sample-run`, but the exported page contains that string in Next's embedded not-found payload. The server behaviour was correct. I changed the assertion to look at the `<h1>`.
2. `m1-check-after-fix.txt`: lint and typecheck clean, build OK, **86 tests, 86 pass, 0 fail, `exit=0`** (78 earlier tests plus 8 new).

No other source change was made. The two earlier fixes (`serve-static.mjs`, `globals.css`) are unchanged by this task.

## Home page Status text

Checked, not changed. It says "Repository licence: not chosen". No `LICENSE` file exists at the repository root (file search), so this is still true until task 10.1 of `03-local-product`.

## Per-task table

Common gap: the acceptance checks name a per-task evidence file (for example `evidence/test-drift.txt`). Only `check.txt`, `dependencies.txt` and `audit.txt` exist in `apps/web/evidence/`. Slice 1 notes item 6 and item 7 say the same. Where a combined `npm run check` log contains the passing test, that is useful context but it is not the evidence the check names, so the task stays open.

| Task | State | Why |
|---|---|---|
| 1 Scaffold (parent) | open | 1.1 and 1.2 open |
| 1.1 Config files | open | `evidence/scaffold-config.txt` not produced; no MANUAL-REVIEW record of dependency lists against Requirement 12.1 |
| 1.2 Install, lockfile, audit | open | `evidence/dependencies.txt` exists with `npm ls` output and versions, but it lacks the `npm ci` output and the audit summary line (audit is in separate `audit.txt`), and it still says "npm ci ... has NOT been run yet". A successful `npm ci` (344 packages, exit 0) is recorded in `m1-ci.txt`, which is outside the file the check names. Left open rather than edited after the fact |
| 2 Content pipeline (parent) | open | children open |
| 2.1 Validator and helpers | open | `evidence/validate-sample-data.txt` not produced; the "exits 1 on a broken copy" half is covered only inside `sample-data.test.mjs` |
| 2.2 Generator and JSON | open | `evidence/sample-data-generate.txt` (`--write`, `--check`, SHA-256) not produced |
| 2.3 Drift test | open | `tests/sample-data.drift.test.mjs` does not exist (drift test lives in `sample-data.test.mjs`); `evidence/test-drift.txt` not produced |
| 2.4 Schema mutation test | open | `tests/sample-data.schema.test.mjs` does not exist (mutations are in `sample-data.test.mjs`); `evidence/test-schema.txt` not produced |
| 3 Tokens and CSS (parent) | open | children open |
| 3.1 `globals.css` | open | `evidence/css-tokens.txt` not produced |
| 3.2 Contrast test | open | `tests/contrast.test.mjs` exists and passes in `check.txt` (25 pairs) but `evidence/test-contrast.txt` with printed ratios was not produced; the test does not print ratios |
| 4 Shell (parent) | open | children open |
| 4.1 Copy and shell components | open | components are consolidated in `shell.tsx` (deviation 1); `evidence/shell-components.txt` not produced; `tests/smoke.structure.test.mjs` (task 8.8) does not exist |
| 4.2 Layout and metadata | open | `evidence/build-shell.txt` not produced; layout differs from the task text (deviation 2) |
| 5 Homepage (parent) | open | child open |
| 5.1 `page.tsx` | open | MANUAL-CONTENT record `evidence/manual-content-home.txt` does not exist; `tests/smoke.structure.test.mjs` does not exist |
| 6 Sample run (parent) | open | children open |
| 6.1 Loader and data components | open | `evidence/sample-run-components.txt` not produced; `DataTable`, `Hash`, `StatusText`, `ProgramOutput` are in one file |
| 6.2 About section | open | `AboutSection.tsx` does not exist (section is in `Sections.tsx`); named test and evidence files missing |
| 6.3 Comparison section | open | `ComparisonSection.tsx` and `tests/smoke.comparison-order.test.mjs` missing. Content is present and the consolidated smoke test checks that the pre-declared failure comes first |
| 6.4 Post hoc section | open | `PostHocSection.tsx`, `tests/smoke.post-hoc.test.mjs` and its evidence missing; labels are present and checked in `smoke.test.mjs` |
| 6.5 Inputs section | open | separate file, `smoke.structure` test and evidence missing |
| 6.6 Settings section | open | separate file, `smoke.numbers` test and evidence missing |
| 6.7 Output summary section | open | same as 6.6 |
| 6.8 Runs section | open | same as 6.6 |
| 6.9 Reproducibility section | open | separate file, drift and structure tests and `evidence/test-drift.txt` missing |
| 6.10 Errors section | open | `tests/content-rules.program-output.test.mjs` and evidence missing |
| 6.11 Limitations section | open | `tests/content-rules.phrases.test.mjs` and MANUAL-CONTENT record missing |
| 6.12 Assemble sample-run page | open | `out/sample-run.html` exists, but `evidence/build-sample-run.txt` (build output plus `Get-ChildItem out`) not produced |
| 7 Not-found, error, empty (parent) | open | children open |
| 7.1 `EmptyState` | open | `src/components/EmptyState.tsx` and `tests/render.test.mjs` do not exist |
| 7.2 `not-found.tsx` | open | the 404 page is tested in `smoke.test.mjs` (h1, link home) and `serve-static.test.mjs` now checks status 404, but `evidence/test-smoke-structure.txt` is not produced |
| 7.3 `error.tsx` | open | `tests/render.test.mjs` missing; the invalid-data and error branches are not render-tested (slice 1 note 6) |
| 8 Automated tests (parent) | open | 8.1 to 8.14 open |
| 8.1 Helpers and static server | open | `tests/helpers/static-server.mjs`, `required-text.mjs`, `tsx-loader.mjs`, `tests/helpers.test.mjs` do not exist |
| 8.2 Claims-evidence test | open | `tests/content-rules.claims.test.mjs` missing (one case in `sample-data.test.mjs`); no evidence file |
| 8.3 Displayed-claims test | open | `tests/content-rules.displayed.test.mjs` missing; only the one-direction check exists in `smoke.test.mjs` |
| 8.4 Program-output test | open | named test file missing; the 12-word test exists in `smoke.test.mjs` |
| 8.5 Phrases test | open | named test file missing; forbidden-claims checks exist in `smoke.test.mjs` |
| 8.6 Guard scanner and negative fixtures | open | `tests/fixtures/guard/*` and `tests/disabled-features.negative.test.mjs` missing (negative samples are inline in `disabled-features.test.mjs`) |
| 8.7 Real-tree guard test | open | `disabled-features.test.mjs` passes in `check.txt`, but `evidence/test-guard.txt` not produced and the scan covers `src/` only, not the whole `apps/web` tree |
| 8.8 Structural smoke test | open | `tests/smoke.structure.test.mjs` missing; consolidated `smoke.test.mjs` covers much of it but not every listed assertion (for example heading-level skips, table caption/scope, `alt` on images) |
| 8.9 Comparison-order test | open | named file and evidence missing |
| 8.10 Post-hoc label test | open | named file and evidence missing |
| 8.11 Displayed-numbers test | open | named file missing; the check in `smoke.test.mjs` is narrower than "every numeric cell" |
| 8.12 Internal-links test | open | named file and evidence missing; a link check is inside `smoke.test.mjs` |
| 8.13 External-links test | open | named file and evidence missing; `external-hosts.json` exists and a check is inside `smoke.test.mjs` |
| 8.14 Render test | open | `tests/render.test.mjs` and the invalid-sample fixture missing |
| **8.15 `npm run check` recorded** | **ticked** | Check: `npm.cmd run check` exits 0 with evidence in `apps/web/evidence/check.txt` holding the complete output and the exit code. File shows lint, typecheck, build ("sample data OK"), 78 tests pass, 0 fail, last line `exit=0`. `start-static` serving `out/` was exercised in task 1.4 (`m1-browser-review.md`: pages served on `127.0.0.1:4173`) and again by `serve-static.test.mjs`. Reproduced after the 1.5 test additions: `m1-check-after-fix.txt`, 86 pass, `exit=0`. Not verified: "no environment variable set for the build" was not separately recorded; no variable is required by the build script |
| 9 Basic headers (parent) | open | children open |
| 9.1 `vercel.json` | open | file exists with basic headers, but `tests/headers.test.mjs` and `evidence/test-headers.txt` do not exist, so its check has no evidence |
| 9.2 Headers test | open | `tests/headers.test.mjs` does not exist |
| 10 Slice-1 review (parent) | open | 10.1 open |
| 10.1 Review and commit slice 1 | open | `docs/evidence/web-slice1-review.txt` does not exist; nothing committed (M1 commit is task 1.6 of 03). The release-guard and publish-path outputs are in `m1-release-guard-tests.txt` and `m1-publish-paths.txt` but they are tests of the scripts, not the specified review record |
| 11.1, 11.2 CSP | open | later task by design; no CSP exists |
| 12.1 How-it-works page | open | later task; page does not exist |
| 13.1 to 13.6 Docs pages | open | later tasks; pages do not exist |
| 14.1 Checklist | open | `apps/web/ACCESSIBILITY_CHECKLIST.md` does not exist |
| 14.2 to 14.6 Manual checks | open | person tasks. Task 1.4 did no keyboard, 320 px real-device, 200% zoom, screen-reader or forced-colours run (`m1-browser-review.md`, "Not seen"). Not recorded as done here |
| 15.1 Terms and Privacy drafts | open | later task |
| 16.1 CI workflow | open | no workflow file exists |
| 17.1 `apps/web/README.md` | open | file does not exist |
| 17.2 `DEPENDENCIES.md` | open | file does not exist |
| 17.3 Package test (optional) | open | file does not exist; the allowlist check is partly in `disabled-features.test.mjs` |
| 18.1 Vercel preview | open | blocked; nothing deployed |
| 19.1 to 19.9 Assistant | open | later or blocked; none started |
| 20 Checkpoint | open | needs the user |

## Kept as recorded

- The pre-declared comparison failed on all five nodes (also for seeds-c). That result is unchanged and still comes first on the page.
- Post hoc passes (chain 1 only, and the 20,000 burn-in pooled run) keep the "post hoc" labels. They were chosen after the pre-declared comparison failed and are not an independent confirmation. No convergence or scientific-validity claim is made.
- No file under `apps/web/content` or `apps/web/src/components` was touched in this task.

## Remaining uncertainty

- The regression tests need a built `out/`; `npm test` without a prior build fails by design (stated in the 01 notes).
- The 85/1 first run is kept as evidence of my mistaken assertion, not hidden.
- Mobile table usability (Result column off-screen at 390 px, clipped captions, narrow Status column) from the browser review is still unfixed and untested.

# Evidence for spec 05-ui-redesign

Every `.txt` file here is tool output written by the command named on its last line (`EXIT=<code> (<seconds>) cmd: …`), with machine paths replaced by `<repo-or-home>` or `<path>`. Nothing is typed by hand.

Host for every run: Windows 11, Node v26.13.1 (project pin 24.x, so npm prints EBADENGINE), Google Chrome installed, **Docker not installed, WSL not installed**.

## Before the redesign

| File | Result |
|---|---|
| `baseline-local-test.txt` | `apps/local` `npm test`: 255 tests, 253 pass, 2 skipped (Docker-dependent), 0 fail |
| `baseline-web-check.txt` | `apps/web` `npm run check`: lint, typecheck, build, 86 tests pass, `EXIT=0` |
| `baseline-audit-tracked.txt`, `baseline-check-license.txt` | PASS, `MIT OK` |

## After the redesign (final)

| File | Result |
|---|---|
| `final-local-test.txt` | 297 tests, 295 pass, 2 skipped (Docker-dependent), 0 fail. New: `vendor-integrity`, `motion-logic`, `ui-redesign` test files |
| `final-web-data.txt`, `final-web-check.txt` | Sample data regenerated (only the recorded hash of the edited `docs/third-party-notices.md` changed), then lint, typecheck, build and 86 tests pass |
| `final-a11y-review.txt` | `scripts/ui-a11y-review.mjs` on all eight pages: 162 passed, 0 failed (landmarks, labels, contrast from computed styles, focus rings, tab order, zero motion under reduced motion, no sideways scroll at 1280, 390 and 320) |
| `final-ui-browser-check.txt` | `scripts/ui-browser-check.mjs`: 22 passed, 0 failed |
| `final-release-gate-tests.txt` | 39 cases, 0 failures |
| `final-publish-paths.txt` | exit 0 |
| `final-audit-tracked.txt`, `final-check-license.txt` | PASS (485 tracked files), `MIT OK` |
| `final-extract-seeds-tests.txt` | **1 of 9 checks failed for an environment reason**: the case "ps1 missing member: names the missing file" calls `wsl`, and WSL is not installed on this host ("The Windows Subsystem for Linux is not installed"). Spec 05 changed no script under `scripts/`. Re-run on a host with WSL |

## SKIPPED (Docker is not installed)

- Runner unit tests inside the image.
- `apps/local/scripts/results-browser-check.mjs` and `multi-engine-browser-check.py`: they need real engine runs.
- The two Docker journey tests inside `npm test` (the 2 skipped).
- The accessibility review's Results audit "with a real coin run": that run ended in `runner_error` because Docker is missing, so the Results page was audited in that state, not with a succeeded run.

## Screenshots

- `shots-web/`: the built static site (`apps/web/out`) served by `scripts/serve-static.mjs`, at 1280 and 390.
- `shots-local-preview/`: **preview harness screenshots, not run evidence.** `.scratch/preview.mjs` (not committed) started the real `apps/local` server and run manager with the test fake `tests/helpers/fake-docker.mjs`. The Coin log lines and the error log are the recorded ones from `docs/evidence`; the CODA sample values behind the plot are synthetic Beta(8, 4) draws made by the harness. They show the layout with plausible numbers only.
- `docs/evidence/local-product/shots/local-*.png` were rewritten by the final accessibility review run (real server, no Docker).

## Story video

`unslop-story/story.html` and `unslop-story/unslop-story.mp4` (square, about 8 s, four steps: Spacing, Color and type, Details, Timeline and plot), rendered with the unslop skill's `scripts/story.mjs` using Playwright Chromium and ffmpeg. Step 0 copies the spec 03 Results styles; the hashes and log lines are the recorded Coin run; the bars in the last step are a drawing and are labelled so. The video carries the "unslop by @heydamir" credit.

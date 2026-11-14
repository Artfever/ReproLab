# Implementation Plan: 03-local-product

## Overview

Builds the local product specified in `requirements.md` and `design.md`: a dependency-free Node server and plain web interface in `apps/local` that run OpenBUGS in the pinned local Docker image, a grounded assistant, open-source packaging, and a judgeable submission. Four milestones, one commit each: M1 reconcile and verify (tasks 1), M2 local product (2 to 9), M3 open source and install (10 to 12), M4 judgeable submission (13).

All checkboxes are unticked. Tick a task only after its acceptance command ran and its evidence file exists. No task pushes, publishes, uploads or deploys anything. No task commits an OpenBUGS binary, tarball, image, upstream example or upstream documentation. Specs 00, 01-web-mvp (requirements and design), 01-end-to-end-web-run and 02-grounded-assistant stay unedited, except that task 1.5 may tick checkboxes in `01-web-mvp/tasks.md`.

## Executor notes

- Windows machine: use `npm.cmd`, not `npm`. Node is v24.18.0. Docker Desktop is available. Image `reprolab-openbugs:3.2.3` exists locally with ID `sha256:f65e2244463b5899308e9fd51361589de518f9a534fbc62d758e17277e76b88f`.
- The shell tool lags. Write every command's output to a file under `docs/evidence/local-product/` (for example `cmd *> docs/evidence/local-product/x.txt; "exit=$LASTEXITCODE" | Add-Content ...`) and read the file back. Never type results by hand.
- The OpenBUGS tarball copy used for the image is `.scratch/gh.tar.gz` (SHA-256 `a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8`, verified equal to the pin in `infra/openbugs/Dockerfile`). It is gitignored. Never commit it.
- Git identity: the repository's configured identity (author `artfever`). Stage by explicit path, never `git add -A`. No `git push`.
- `MANUAL` marks a check a person must perform. The executor records what was and was not done.
- Real assistant end-to-end test: it needs a reachable Ollama or a user-supplied key. Tasks 6.3 and 7.1 use only a Fake_Provider (a test double). Task 6.5 is the only real test. The final report must say whether 6.5 was actually exercised. If it was not, the evidence file says `NOT EXERCISED`.
- Evidence directory: `docs/evidence/local-product/` (create it in task 1.1).

## Tasks

- [x] 1. Milestone 1: reconcile and verify
  - [x] 1.1 Copy the recorded web check evidence
    - Copy `.scratch/m1/ci.txt`, `check.txt`, `git.txt`, `runner-files.txt`, `runner-ls.txt`, `done.txt` byte for byte to `docs/evidence/local-product/m1-ci.txt`, `m1-check.txt`, `m1-git.txt`, `m1-runner-files.txt`, `m1-runner-ls.txt`, `m1-done.txt`. Write `m1-copy-hashes.txt` with `Get-FileHash` SHA-256 of each source and copy.
    - _Requirements: 2.1_
    - Acceptance check: `m1-check.txt` shows 78 passing tests and `m1-ci.txt` ends with `ci exit=0` (read both files); `m1-copy-hashes.txt` shows equal hashes pairwise.

  - [x] 1.2 Run the Runner unit tests inside the image
    - Run the 14 tests in `services/runner/tests/test_runner.py` with the image's Python and engine, in the same way `docs/evidence/unit_tests_run.txt` was produced (tests read-only bind-mounted or copied in; `--network none`). Record the exact command first in the evidence file.
    - _Requirements: 2.4_
    - Acceptance check: output in `docs/evidence/local-product/m1-runner-tests.txt` ends with `Ran 14 tests` and `OK`. If a test fails, record it, fix the real defect, rerun, and note both runs.

  - [x] 1.3 Run the release-guard and publish-path tests
    - `powershell -ExecutionPolicy Bypass -File scripts/tests/test-release-gate.ps1` and `scripts/check-publish-paths.ps1`; save outputs.
    - _Requirements: 1.5, 2.5_
    - Acceptance check: `m1-release-guard-tests.txt` shows 39 cases passed, 0 failed; `m1-publish-paths.txt` shows exit 0.

  - [x] 1.4 Local browser review of `apps/web`
    - `npm.cmd run build` in `apps/web`, serve `out/` with `npm.cmd run start-static` (start it with `control_pwsh_process`, stop it afterwards). Capture headless Edge or Chrome screenshots of `/` and `/sample-run` at 1280x800 and 390x844 into `docs/evidence/local-product/shots/m1-<page>-<size>.png`. Read each PNG with the image reader. Write observations (layout, overflow, banner, comparison-first order, contrast, anything broken) to `m1-browser-review.md`.
    - _Requirements: 2.6_
    - Acceptance check: four PNG files exist and are non-empty; `m1-browser-review.md` names each PNG and states what was seen. MANUAL for any judgement beyond what the PNG shows (keyboard, zoom).

  - [x] 1.5 Reconcile `01-web-mvp/tasks.md` and fix real defects
    - Compare each task's acceptance check with existing evidence (`apps/web/evidence/*`, `docs/evidence/local-product/m1-*`). Tick only tasks whose check has evidence showing the stated result. Leave the rest unticked. Write `m1-reconcile.md`: table of task id, ticked or not, evidence file, gap. Fix any defect found in task 1.4 or the checks, rerun `npm.cmd run check` in `apps/web` into `m1-check-after-fix.txt`.
    - _Requirements: 2.2, 2.3, 2.7, 2.8_
    - Acceptance check: `git diff --stat -- .kiro/specs/01-web-mvp` shows only `tasks.md`, and `git diff -- .kiro/specs/01-web-mvp/tasks.md` shows only `[ ]` to `[x]` changes (saved to `m1-spec-diff.txt`); if code changed, `m1-check-after-fix.txt` still shows at least 78 passing tests and exit 0.

  - [x] 1.6 Milestone 1 review and commit
    - Review `git status` and `git diff`; stage only M1 paths (evidence files, `01-web-mvp/tasks.md`, any defect fix). Commit `chore(m1): reconcile web MVP evidence and verify checks` with the configured identity. No push.
    - _Requirements: 2.1 to 2.8_
    - Acceptance check: `git log -1 --stat` saved to `docs/evidence/local-product/m1-commit.txt` lists only M1 paths; `git status --short` shows no tracked-file surprises.

- [x] 2. Milestone 2 foundations
  - [x] 2.1 Scaffold `apps/local`
    - Create `apps/local/package.json` (`"type": "module"`, `engines.node` `24.x`, no dependencies, scripts `start` = `node src/server.mjs`, `test` = `node --test tests/`), empty module files listed in `design.md` Directory layout, `tests/helpers/`. Extend `.gitignore` with `local-data/`, `vendor/`, `apps/local/node_modules/`. Keep `*.tar.gz` ignored.
    - _Requirements: 1.6, 10.3, 17.1_
    - Acceptance check: `npm.cmd test` in `apps/local` exits 0 with zero tests (`docs/evidence/local-product/scaffold-test.txt`); `git check-ignore -v local-data vendor/x.tar.gz` output in `scaffold-ignore.txt` shows both ignored; `node -p "Object.keys(require('./package.json').dependencies||{}).length"` prints `0`.

  - [x] 2.2 Implement `validate.mjs` with tests
    - `validateRunRequest` per design: ranges, ASCII, byte caps, monitor regex and duplicates, inits count equals chains, unknown keys, plain-English messages with field names. Test file `tests/validate.test.mjs`: min, max, min-1, max+1 for burn-in, samples, thin, seed, timeout (1 to 300), chains (1 to 4); sizes 0, max, max+1 for model, data, inits; non-ASCII and NUL; 25 and 26 monitors; a pin test that reads `services/runner/reprolab_runner/adapter.py` and asserts the same numeric ranges (except timeout 300 vs 3600).
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 4.10_
    - Acceptance check: `node --test tests/validate.test.mjs` in `apps/local` exits 0; output in `docs/evidence/local-product/test-validate.txt`.

  - [x] 2.3 Implement `sanitize.mjs` with tests
    - `scrubPaths`, `safeBaseName`, `isRunId`, `isSafeFileName`. Tests: canary with `process.cwd()` repository root, `os.homedir()`, forward and back slashes, `file:///` and URL-encoded forms, nested JSON strings; names with `/`, `\`, `..`, NUL are rejected.
    - _Requirements: 7.2, 7.3, 7.5, 7.7_
    - Acceptance check: `node --test tests/sanitize.test.mjs`; output in `docs/evidence/local-product/test-sanitize.txt`.

  - [x] 2.4 Write the ReproLab demonstration models
    - `examples/reprolab/coin/{model.txt,data.txt,inits1.txt,inits2.txt,README.md}` and `examples/reprolab/coin-invalid/{model.txt,README.md}` as in `design.md` Data Models. README states the analytic Beta(8, 4), mean 0.6667, sd about 0.1307, tolerance 0.01 absolute for both, and that the model is ReproLab-authored. Plain ASCII.
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
    - Acceptance check: `node --test tests/examples.test.mjs` (new, in `apps/local/tests`) passes: files exist, are ASCII, within size caps, pass `validateRunRequest` when assembled; the invalid model has unbalanced parentheses; output in `docs/evidence/local-product/test-examples.txt`.

- [x] 3. Server and container execution
  - [x] 3.1 Implement the server skeleton
    - `src/server.mjs`: bind `127.0.0.1` on `REPROLAB_PORT` (default 8765, reject any bind-address setting), Host and Origin checks, security headers, 1 MiB body reader, JSON parse errors, 405, static serving from `apps/local/public` with traversal protection, a route table with one file per route group under `src/routes/` (`health.mjs`, `demos.mjs`, `runs.mjs`, `assistant.mjs`) returning 501 until later tasks fill them. Export `createServer(deps)` taking injected `docker`, `runs`, `provider` for tests.
    - _Requirements: 3.1 to 3.10_
    - Acceptance check: `node --test tests/server.test.mjs` passes cases for: bind address is 127.0.0.1, bad Host 403, bad Origin 403, `localhost` accepted, 1 MiB + 1 byte body 413, invalid JSON 400, wrong method 405, `..` traversal 404, all headers present; output in `docs/evidence/local-product/test-server.txt`.

  - [x] 3.2 Implement `docker.mjs` and the flag-list test
    - The only module importing `node:child_process`. Functions per design. All calls `spawn(cmd, argsArray, {shell:false})`. Test asserts the container flag list equals Requirement 5.2 exactly, no value comes from a client, and `grep`-style test that no other file under `apps/local/src` or `assistant` imports `child_process`.
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.12_
    - Acceptance check: `node --test tests/docker.test.mjs`; output in `docs/evidence/local-product/test-docker.txt`.

  - [x] 3.3 Implement run lifecycle, manifest and routes
    - `src/runs.mjs`, `src/routes/runs.mjs`, `src/routes/health.mjs`: submit, one-at-a-time with 429, states mapping per Requirement 6, Run_Dir persistence, stale-container cleanup at start, manifest merge and scrub, file-name allow list, bounded log, startup recovery of `state.json`. Tests with a stub `docker`: state mapping for `succeeded`, `failed`, `timed_out`, missing manifest and cap; busy rejection; cleanup called on every path; canary scan of every response and the manifest; unknown id 404; unknown file name 404.
    - _Requirements: 5.8, 5.9, 5.10, 5.11, 6.1 to 6.10, 7.1 to 7.7, 8.2_
    - Acceptance check: `node --test tests/runs.test.mjs`; output in `docs/evidence/local-product/test-runs.txt`.

  - [x] 3.4 Real container smoke run (coin model)
    - Start the server (`control_pwsh_process`, `node src/server.mjs` in `apps/local`), POST the coin Run through the HTTP API with a small script `apps/local/scripts/smoke-run.mjs`, poll to completion, save the final JSON, manifest and log. Confirm the open risk in `design.md` (root-owned files from `docker cp`). If it fails, fix `docker.mjs` (for example set ownership through the tar header) and rerun.
    - _Requirements: 5.2 to 5.5, 6.2, 8.1 to 8.4_
    - Acceptance check: `docs/evidence/local-product/m2-coin-run.json`, `m2-coin-manifest.json`, `m2-coin-log.txt` show state `succeeded`, engine version `3.2.3 rev 1012`, CODA files with SHA-256; `docker ps -a --filter label=reprolab.run` in `m2-no-leftover-containers.txt` lists no container; a grep for the repository path in the three files prints nothing (`m2-canary.txt`).

  - [x] 3.5 Runner change and Python test (conditional)
    - Only if tasks 3.3 or 3.4 show the Runner needs a change (for example a machine-readable `summarize` flag or a stable error exit code), make the smallest change in `services/runner/reprolab_runner` and add a `unittest` case to `services/runner/tests/test_runner.py`. If no change is needed, write `docs/evidence/local-product/runner-no-change.txt` saying so with the evidence that justified it. Rebuild of the image is not needed for the test (tests mount the package), but a rebuild is part of task 11.1.
    - _Requirements: 17.7_
    - Acceptance check: either `runner-tests-after-change.txt` shows all tests including the new one passing in the image, or `runner-no-change.txt` exists.

- [x] 4. Demonstrations
  - [x] 4.1 Implement `/api/demos`
    - `src/demos.mjs`, `src/routes/demos.mjs`: coin, coin-invalid, and "Seeds (your own upstream copy)" only when all four files exist in `local-data/upstream/` and match the hashes in `docs/evidence/input_hashes_upstream_examples.txt` (parsed at runtime). Demo entries carry the assembled Run_Request. Seeds entry carries the historical label and, when absent, a `missingReason` field.
    - _Requirements: 9.7, 10.4, 10.5, 10.6_
    - Acceptance check: `node --test tests/demos.test.mjs` with a temporary directory standing in for `local-data/upstream` filled with synthetic files: absent, partial, wrong hash (omitted), correct-hash synthetic fixture built in the test by computing a hash list file in a temp copy; output in `docs/evidence/local-product/test-demos.txt`.

  - [x] 4.2 Write the Seeds extraction scripts
    - `scripts/extract-seeds.ps1` and `scripts/extract-seeds.sh`: take the tarball path, extract only the four Seeds files (via `tar` with explicit member names discovered by listing, never extracting other members), write to `local-data/upstream/`, verify SHA-256 against `docs/evidence/input_hashes_upstream_examples.txt`, delete extracted files and exit non-zero on mismatch or missing member. Print which hash matched.
    - _Requirements: 10.1, 10.2, 10.3_
    - Acceptance check: `scripts/tests/test-extract-seeds.ps1` builds a synthetic tarball from ReproLab text with wrong content, runs the script, expects non-zero exit and an empty `local-data/upstream/`; output in `docs/evidence/local-product/test-extract-seeds.txt`. Real run (uses `.scratch/gh.tar.gz` as the local copy): `scripts/extract-seeds.ps1 -Tarball .scratch/gh.tar.gz` output in `extract-seeds-real.txt` shows four matched hashes; `git status --short` in `extract-seeds-git.txt` shows `local-data/` not listed.

  - [x] 4.3 Coin accuracy check against the analytic posterior
    - `apps/local/tests/coin-check.test.mjs`: runs the coin model (2 chains, burn-in 1000, samples 10000, seed 1) through the real HTTP API, reads the summary, compares pooled mean and sd of `p` with 0.66667 and 0.13074, tolerance 0.01 absolute (fixed in the test source before the first run). Writes mean, sd, differences and the verdict to `docs/evidence/local-product/coin-check.txt`. Skips loudly when Docker or the image is missing.
    - _Requirements: 9.4, 9.5, 9.6, 17.6_
    - Acceptance check: `node --test tests/coin-check.test.mjs` exits 0; `coin-check.txt` shows the actual numbers. If it fails, keep the failing record, investigate (do not widen the tolerance to pass), and report.

- [x] 5. Local interface
  - [x] 5.1 Shell, styles and static pages
    - `apps/local/public/`: `index.html` (Home), `run.html`, `results.html`, `how-it-works.html`, `docs.html`, `limitations.html`, `privacy.html`, `terms.html`, `styles.css`. Shared header, skip link, nav, footer, one `h1` each. Wording per Requirements 1.1, 1.2, 15.2, 15.3, 15.4. No remote resource, no inline script.
    - _Requirements: 1.1, 1.2, 15.1 to 15.7_
    - Acceptance check: `node --test tests/pages.test.mjs` parses each file for: one `h1`, `lang`, skip link first, `nav[aria-label]`, no `http(s)://` resource URL except documented link text, required sentences present, no `<script>` without `src`; output in `docs/evidence/local-product/test-pages.txt`. A contrast test (WCAG formula, copied approach from `apps/web/tests/helpers/contrast.mjs`, rewritten here) checks every colour pair in `styles.css` against 4.5:1 (3:1 for large text and non-text).

  - [x] 5.2 Run page with validation messages
    - `run.html` plus `app.js` module: demo picker, file inputs with names and sizes, monitors, settings with range hints, chains selector, client-side checks mirroring `validate.mjs` (shared via a copied constants block tested for equality), call `/api/validate` before submit, show problems next to fields, focus first problem, submit, then redirect to `results.html?id=<id>`.
    - _Requirements: 4.7, 4.8, 8.7, 11.1 to 11.5_
    - Acceptance check: `node --test tests/ui-logic.test.mjs` runs `app.js` pure helpers (exported for test) for each message; MANUAL: keyboard-only pass recorded in `docs/evidence/local-product/ui-keyboard.md`.

  - [x] 5.3 Results page
    - `results.html` and `results.js`: state badge, details, bounded log with truncation note, file table (caption, scope), manifest download, summary table with the required label, aria-live status region, polling 1 to 2 s, `textContent` only.
    - _Requirements: 8.1 to 8.8_
    - Acceptance check: `node --test tests/ui-logic.test.mjs` extended: log truncation note, no HTML interpretation (a log line containing `<img onerror>` stays text), summary label present, summary absent shows the reason; output in `docs/evidence/local-product/test-ui-logic.txt`.

  - [x] 5.4 Responsive and accessibility review
    - With the server running, capture headless screenshots of every page at 1280x800 and 390x844 and of Run and Results at 320 px width into `docs/evidence/local-product/shots/local-*.png`, read them, and write `local-ui-review.md` (overflow, focus, labels, contrast). Fix real defects.
    - _Requirements: 15.5, 15.6_
    - Acceptance check: PNGs exist; `local-ui-review.md` lists each page and finding. MANUAL: screen reader and 200% zoom check by a person, recorded as done or not done.

- [x] 6. Grounded assistant
  - [x] 6.1 Write the assistant documents
    - `docs/assistant/{setup,running,validation,states,files,assistant,limitations,privacy}.md`, original ReproLab text, `##` headings per topic, each passage short. State facts only as true of this repository (limits, states, flags, files). No upstream text.
    - _Requirements: 12.1, 12.2, 12.9_
    - Acceptance check: `node --test tests/docs-assistant.test.mjs`: files exist, ASCII, every passage under 1200 characters, no 12-word window shared with `docs/evidence/licensing/*.txt` or `.scratch` upstream text if present; output in `docs/evidence/local-product/test-docs-assistant.txt`. MANUAL: read for accuracy against the code.

  - [x] 6.2 Corpus and retrieval
    - `assistant/corpus.mjs`, `assistant/retrieve.mjs`: stable ids, Run passages, BM25, `MIN_SCORE`, `TOP_K = 5`, deterministic ties. Tests: expected top passage for several real questions, below-threshold question returns empty, same input same output (run twice), ids stable, bounds on question length and context size.
    - _Requirements: 12.3 to 12.8_
    - Acceptance check: `node --test tests/retrieve.test.mjs`; output in `docs/evidence/local-product/test-retrieve.txt`, including the printed constants.

  - [x] 6.3 Provider client, answer verification and ask route
    - `assistant/provider.mjs`, `assistant/answer.mjs`, `src/routes/assistant.mjs`: env-only config, URL validation, 60 s timeout, 64 KiB cap, error classes, citation verification, fixed Decline_Message, key scrubbing. `tests/helpers/fake-provider.mjs` is the Fake_Provider (test-only). Tests: retrieval ranking reaches the prompt; cited answer shown with source; unsupported question declined with the fake's call count 0; uncited answer rejected; wrongly cited answer rejected; connection refused, timeout, 500, malformed JSON; the key never appears in any response, error, log capture or manifest; validity or convergence question declined.
    - _Requirements: 12.6, 13.1 to 13.10_
    - Acceptance check: `node --test tests/assistant.test.mjs`; output in `docs/evidence/local-product/test-assistant.txt`.

  - [x] 6.4 Assistant status and interface
    - `src/routes/assistant.mjs` status handler with 3 s probe and 10 s cache; assistant panel in `run.html` and `results.html` (or a shared include): disabled box with reason, aria-live region, citations list, model-generated label.
    - _Requirements: 13.5, 14.1 to 14.6_
    - Acceptance check: `node --test tests/assistant-status.test.mjs`: no config gives `disabled` with the required reason; Fake_Provider up gives `enabled`; Fake_Provider down gives `disabled` unreachable; response never contains the key or a URL path; UI helper test shows disabled textarea and reason; output in `docs/evidence/local-product/test-assistant-status.txt`.

  - [x] 6.5 Real provider end-to-end test (MANUAL)
    - MANUAL: with Ollama running at `http://127.0.0.1:11434/v1` and a pulled model (or a user-supplied key through environment variables, never written to a file), ask three questions through the UI: one answerable from `docs/assistant`, one about a finished run's log, one unsupported. Save the status JSON and the three responses (key removed) to `docs/evidence/local-product/assistant-real.txt`. If no provider is available, write `NOT EXERCISED: <reason>` in that file.
    - _Requirements: 13.11_
    - Acceptance check: `assistant-real.txt` exists and states exercised or `NOT EXERCISED`; a grep for `sk-` and `Bearer` over `docs/evidence/local-product` prints nothing (`assistant-real-grep.txt`).

- [x] 7. User-journey test
  - [x] 7.1 Drive the real API against the real image
    - `apps/local/tests/journey.test.mjs`: probe Docker and image; if missing, print `SKIPPED: <what is missing>` to stderr and `t.skip`. Otherwise start the server on port 0, then: validate (bad then good), coin Run to `succeeded` with summary and manifest checks, invalid-syntax Run to `engine_error` with the engine error line, undefined-variable Run to `engine_error`, 3 s timeout Run to `timed_out`, busy rejection while a Run is running, then canary scan of all collected responses and `docker ps -a --filter label=reprolab.run` empty.
    - _Requirements: 5.8, 5.9, 6.2 to 6.9, 7.4, 17.5, 17.6_
    - Acceptance check: `npm.cmd test` in `apps/local` exit 0, output in `docs/evidence/local-product/test-journey.txt` showing the journey test passed (not skipped). Also run once with the image tag set to a missing tag via `REPROLAB_IMAGE=reprolab-openbugs:absent` and save the loud skip output to `test-journey-skipped.txt`.

- [x] 8. Public site pages
  - [x] 8.1 Add static pages to `apps/web` if cheap, else record the gap
    - Try adding How it works, Docs, Limitations, Privacy and Terms to `apps/web` using existing `PageShell`, static text, no form or fetch, wording that names the local tool and states there is no hosted service. Keep the guard unchanged. Time-box: if `npm.cmd run check` cannot pass without changing the guard or dependencies, revert and write `docs/evidence/local-product/web-pages-gap.md` instead.
    - _Requirements: 16.1 to 16.4_
    - Acceptance check: `npm.cmd run check` in `apps/web` exit 0 with at least 78 tests, output in `docs/evidence/local-product/m2-web-check.txt`; or `web-pages-gap.md` exists and `git diff --stat -- apps/web` is empty. In both cases the Seeds comparison text is unchanged (`git diff -- apps/web/content apps/web/src/components/sample-run` saved to `m2-web-sample-diff.txt` is empty).

- [x] 9. Milestone 2 close
  - [x] 9.1 Run all suites
    - `npm.cmd test` in `apps/local`; `npm.cmd run check` in `apps/web`; Runner tests in the image; `scripts/tests/test-release-gate.ps1`; `scripts/check-publish-paths.ps1`. Save each output.
    - _Requirements: 1.5, 16.1, 17.8_
    - Acceptance check: `m2-final-local.txt`, `m2-final-web.txt`, `m2-final-runner.txt`, `m2-final-guard.txt`, `m2-final-publish-paths.txt` all show passing results and exit 0; skipped tests are listed by name in `m2-final-local.txt`.

  - [x] 9.2 Milestone 2 review and commit
    - Review `git status` and `git diff` for secrets, host paths, upstream bytes and `local-data` content. Stage M2 paths explicitly. Commit `feat(local): add local OpenBUGS runner, interface, and grounded assistant`. No push.
    - _Requirements: 1.4, 7.4_
    - Acceptance check: `git log -1 --stat` and `git status --short` saved to `m2-commit.txt`; `git ls-files | Select-String -Pattern 'local-data|vendor|\.tar'` in `m2-ls-files-check.txt` prints nothing.

- [x] 10. Milestone 3: licence and notices
  - [x] 10.1 Add the MIT LICENSE
    - Root `LICENSE` with the SPDX MIT template text and first line after the title `Copyright (c) 2026 artfever` (read the holder from `git log -1 --format=%an`). **The user must confirm that `artfever` is the legal name** to be used as copyright holder; record the open question in the final report.
    - _Requirements: 18.1, 18.2, 18.3_
    - Acceptance check: `node scripts/check-license.mjs` (new, small) compares `LICENSE` with the embedded SPDX MIT template modulo the copyright line and prints `MIT OK`; output in `docs/evidence/local-product/license-check.txt`; `git log -1 --format=%an` output saved beside it.

  - [x] 10.2 Audit dependency licences
    - `scripts/licence-table.mjs`: reads `apps/web/package-lock.json` (`packages[*].license`), groups by identifier, lists packages with missing or unusual identifiers (for example optional `sharp` and libvips components, LGPL, or `0BSD`). Output a markdown table. Also list any other committed code with third-party origin (none expected) via `git ls-files` review.
    - _Requirements: 18.5_
    - Acceptance check: `node scripts/licence-table.mjs > docs/evidence/local-product/licence-table.md` exits 0 and the file has one row per identifier with a count; unresolved packages are listed explicitly.

  - [x] 10.3 Update `docs/third-party-notices.md`
    - Component by component: ReproLab code (MIT, covers ReproLab-owned code only, no rights to OpenBUGS, BlackBox, CpcBeautifier, examples or documentation), `examples/reprolab`, `services/runner/reference/seeds_published.json`, Node dependencies (table from 10.2 with verdicts), `apps/local` (no dependencies), Worker_Image contents and Debian layers, upstream tarball held by the user, mirror caveat. Keep the open items plain: GPL v2/v3 inconsistency, tarball predates r1018, unknown `libOpenBUGS.so` revision, CpcBeautifier, TAUCS, Examples rights, no legal review. Replace the "No LICENSE file" text.
    - _Requirements: 18.4, 18.6, 18.7_
    - Acceptance check: `node --test tests/notices.test.mjs` (in `apps/local/tests`) asserts the strings `MIT`, `grants no rights`, each open item and the table heading exist; output in `docs/evidence/local-product/test-notices.txt`. MANUAL: person reads for accuracy; not legal advice.

- [x] 11. Milestone 3: install and packaging
  - [x] 11.1 Vendored-tarball Dockerfile and build script
    - Change `infra/openbugs/Dockerfile` build stage to `COPY vendor/OpenBUGS-3.2.3.tar.gz /src/openbugs.tar.gz`, `sha256sum -c` with the pinned hash, no `curl`, no `ca-certificates`, network only for Debian `apt-get`. Change `.dockerignore` to allow only the Dockerfile, the vendored tarball and the runner package. Add `scripts/build-image.ps1` and `.sh`: check the file exists, print its SHA-256 next to "the copy we tested", fail on mismatch, `docker build`; optional `-FetchMirror` / `--fetch-mirror` flag downloads from the old pinned URL into `vendor/` and prints "unauthenticated mirror copy, not upstream-verified". Copy `.scratch/gh.tar.gz` to `vendor/OpenBUGS-3.2.3.tar.gz` as a recorded stand-in for the manual step. Build under a new tag `reprolab-openbugs:3.2.3-vendored` first; do not retag the original tag.
    - _Requirements: 19.2 to 19.6_
    - Acceptance check: `scripts/build-image.ps1 -Tag reprolab-openbugs:3.2.3-vendored` output in `docs/evidence/local-product/build-image.txt` shows the hash check and a successful build with no `curl`; `docker image inspect` ID saved in `build-image-id.txt` (record whether it equals the earlier ID; a different ID is expected to be explained, not hidden); runner tests pass in the new tag (`build-image-runner-tests.txt`); `Select-String 'curl|raw.githubusercontent' infra/openbugs/Dockerfile` prints nothing. MANUAL: decide whether to retag.

  - [x] 11.2 Start and reset scripts
    - `scripts/start.ps1`/`.sh`: check Node 24.x, Docker running, image present (warn with exact fix, do not abort), then start `apps/local` on 127.0.0.1 and print the URL. `package.json` root script not required; add `npm start` in `apps/local`. `scripts/reset-local.ps1`/`.sh`: remove `local-data/runs`, `local-data/tmp` and containers labelled `reprolab.run`; never touch tracked files or `local-data/upstream`.
    - _Requirements: 19.7, 19.10_
    - Acceptance check: run `scripts/start.ps1 -CheckOnly` (prints prerequisite results and exits) into `docs/evidence/local-product/start-check.txt`; start the server through `start.ps1`, `GET /api/health` saved to `start-health.json`; `scripts/reset-local.ps1` then `git status --short` before and after are identical (`reset-git-status.txt`).

  - [x] 11.3 Tracked-file audit script and test
    - `scripts/audit-tracked.mjs` implementing Requirement 20.1 to 20.4 with an injectable file list; `apps/local/tests/audit.test.mjs` synthetic failures for each rule and a pass for the real tree.
    - _Requirements: 1.4, 20.1 to 20.5_
    - Acceptance check: `node --test tests/audit.test.mjs` passes; `node scripts/audit-tracked.mjs` exit 0 output in `docs/evidence/local-product/audit-tracked.txt`.

  - [x] 11.4 Root README
    - `README.md` per Requirement 19: product boundary, prerequisites with versions, clean clone, `npm ci` (where needed), independent tarball download with the prominent manual-step box, `vendor/` placement, SHA-256 of the tested copy (honest label), build, start, coin run, Seeds run through `extract-seeds`, assistant setup, tests, expected outputs, limitations, troubleshooting (Docker not running, image missing, port in use, WSL seek problem), reset, MIT scope sentence, "How Kiro shaped this" (specs `00` to `03`, steering files, hook, release gate and guard, task evidence). Every command in it appears in `scripts/` or `package.json`.
    - _Requirements: 18.4, 19.1 to 19.11_
    - Acceptance check: `node --test tests/readme.test.mjs` extracts fenced commands and asserts each referenced script and npm script exists, the required headings exist, no SourceForge checksum is claimed, and the words "authenticated upstream" never describe a mirror; output in `docs/evidence/local-product/test-readme.txt`.

- [ ] 12. Milestone 3 close
  - [-] 12.1 Milestone 3 review and commit
    - Run `node scripts/audit-tracked.mjs`, `npm.cmd test` in `apps/local`, `scripts/check-publish-paths.ps1`. Review diff; stage explicitly; commit `chore(m3): add MIT licence, notices, README, vendored build, scripts`. No push. Keep `.kiro` tracked.
    - _Requirements: 19.11, 20.1_
    - Acceptance check: outputs and `git log -1 --stat` in `docs/evidence/local-product/m3-commit.txt`; `git ls-files .kiro | Measure-Object` count in the same file is greater than 0; no `.tar.gz` or `vendor/` in `git ls-files`.

- [ ] 13. Milestone 4: judgeable local submission
  - [ ] 13.1 Clean-clone verification script and run
    - `scripts/verify-clean-clone.ps1 [-Tarball path]`: clone the committed repository to a temp directory outside the working tree, follow README commands in order (copy tarball to `vendor/`, hash check, `build-image`, `npm.cmd ci` in `apps/web`, `npm.cmd test` in `apps/local`, `npm.cmd run check` in `apps/web`, start, health probe, coin Run through the API), write the transcript, remove the clone and containers in `finally`. MANUAL: the independent browser download from SourceForge. If the executor cannot do it, run with `.scratch/gh.tar.gz` and the evidence states "stand-in for the manual browser download; hash a289c4da...". Use a distinct image tag so existing tags are not removed.
    - _Requirements: 21.1 to 21.5_
    - Acceptance check: `docs/evidence/local-product/clean-clone.txt` ends with `RESULT: PASS` or the first failing step; temp directory no longer exists (`Test-Path` printed in the file); no leftover containers.

  - [ ] 13.2 Demo script and shot list
    - `docs/demo/script.md` (timed segments totalling under 3:00, with narration drawn from real README wording and the real product: validation error, coin run, results with SHA-256, invalid model failure, assistant disabled or enabled state as it really is, limitations page) and `docs/demo/shot-list.md`. States that the recording is of the real product and that no upload has occurred.
    - _Requirements: 22.1, 22.2_
    - Acceptance check: `node --test tests/demo-docs.test.mjs` sums the segment durations in `script.md` (a `[mm:ss-mm:ss]` format) and asserts the total is under 180 seconds and that the words "uploaded" and "published" do not appear as claims; output in `docs/evidence/local-product/test-demo-docs.txt`. MANUAL: person records the screen capture.

  - [ ] 13.3 Devpost checklist
    - `docs/devpost-checklist.md`: repository link (tryout/test build) `MISSING`, YouTube link `MISSING`, category Resurrection, Kiro usage write-up drafted from real files (specs 00 to 03, steering, hook, release gate, guard tests, evidence directory, task acceptance checks), setup instructions for judges (README link), hosting-free note, repository availability through judging, open items (legal name, real assistant test status, independent tarball download status).
    - _Requirements: 22.3 to 22.5_
    - Acceptance check: `node --test tests/devpost-docs.test.mjs` asserts every referenced file path in the write-up exists and each missing link is marked `MISSING`; output in `docs/evidence/local-product/test-devpost-docs.txt`.

  - [ ] 13.4 Final verification
    - Rerun `npm.cmd test` in `apps/local`, `npm.cmd run check` in `apps/web`, `node scripts/audit-tracked.mjs`, `scripts/check-publish-paths.ps1`, release-guard tests. Write `docs/evidence/local-product/final-status.md`: each requirement id with evidence file or gap, what was MANUAL and not done, assistant real test status, tarball independence status, legal-name confirmation status.
    - _Requirements: 1.4, 1.5, 17.8, 20.1_
    - Acceptance check: `final-*.txt` files show exit 0; `final-status.md` has no requirement without an evidence file or an explicit gap.

  - [ ] 13.5 Milestone 4 review and commit
    - Review diff; stage explicitly; commit `docs(m4): add clean-clone verification, demo script, devpost checklist, final evidence`. No push.
    - _Requirements: 21.1, 22.1, 22.3_
    - Acceptance check: `git log -1 --stat` and `git status --short` in `docs/evidence/local-product/m4-commit.txt`; `node scripts/audit-tracked.mjs` exit 0 after the commit.

## Notes

- Tasks marked MANUAL need a person; record done or not done, never imply it was done.
- Advisory `blocked_until` as in `01-web-mvp/tasks.md`: Kiro reads only `waves`. Real gates are the acceptance checks.
- Property-based tests are not used (no library allowed by the dependency-free rule); see `design.md` Testing Strategy.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "2.1", "3.5"] },
    { "id": 1, "tasks": ["1.5", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["1.6", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1", "5.1", "6.1", "8.1"] },
    { "id": 4, "tasks": ["3.3", "4.2", "6.2"] },
    { "id": 5, "tasks": ["3.4", "4.3", "5.2", "6.3"] },
    { "id": 6, "tasks": ["5.3", "6.4"] },
    { "id": 7, "tasks": ["5.4", "6.5", "7.1"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] },
    { "id": 10, "tasks": ["10.1", "10.2", "11.1", "11.2", "11.3"] },
    { "id": 11, "tasks": ["10.3", "11.4"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 14, "tasks": ["13.4"] },
    { "id": 15, "tasks": ["13.5"] }
  ],
  "blocked_until": {
    "2.2": "1.6 commit is advisory only: stage M1 paths explicitly",
    "10.1": "9.2 (M2 commit)",
    "13.1": "12.1 (M3 commit; the clone is taken from the committed repository)",
    "6.5": "a reachable Ollama or user-supplied key; otherwise record NOT EXERCISED",
    "13.5": "13.4"
  }
}
```

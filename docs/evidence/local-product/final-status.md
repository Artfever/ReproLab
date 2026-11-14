# Final status (task 13.4)

Every requirement of `.kiro/specs/03-local-product/requirements.md` with its evidence file or explicit gap. All files are in `docs/evidence/local-product/` unless a path is given. Details of every gap are in `final-open-items.md`. Re-run results for this task are in `final-*.txt`.

Status words: MET (evidence shows it), PARTLY (evidence shows part; the gap is named), GAP (not met).

| Req | Status | Evidence | Gap |
|---|---|---|---|
| 1 Product boundary | MET | `test-pages.txt` (1.1, 1.2), `test-server.txt`, `test-docker.txt` (1.3), `final-audit-tracked.txt` and `final-git-ls-files.txt` (1.4), `final-publish-paths.txt` (1.5) | 1.6: no Vercel config added; checked by reading the tracked-file list, no dedicated test. 49 own-page PNGs are tracked (not engine files). |
| 2 Milestone 1 | PARTLY | `m1-ci.txt`, `m1-check.txt`, `m1-copy-hashes.txt`, `m1-runner-tests.txt`, `m1-release-guard-tests.txt`, `m1-browser-review.md`, `m1-reconcile.md`, `m1-spec-diff.txt` | `m1-commit.txt` missing. Browser review had no keyboard, zoom or screen-reader check, and part of `/sample-run` was not viewed. 01-web-mvp has one ticked task; the rest stay open. |
| 3 Loopback-only server | MET | `test-server.txt`, `final-local.txt` | none found |
| 4 Validation and dry run | MET (automated) | `test-validate.txt`, `test-ui-logic.txt`, `test-ui-run.txt` | Screen-reader and human keyboard checks of the messages not done (see 11). |
| 5 Containerised execution | MET | `test-docker.txt`, `test-runs.txt`, `m2-coin-run.json`, `m2-no-leftover-containers.txt`, `test-journey.txt`, `final-local.txt` | Only Docker Desktop on Windows was exercised. |
| 6 Run states | MET | `test-runs.txt`, `test-journey.txt` (succeeded, engine_error x2, timed_out, busy), `final-local.txt` | none found |
| 7 Manifest and sanitisation | MET | `test-sanitize.txt`, `test-runs.txt`, `m2-canary.txt`, `m2-coin-manifest.json` | Canary covers the repository path and user profile only. |
| 8 Results page | MET (automated) | `test-ui-logic.txt`, `test-ui-results.txt`, `local-ui-review.md` | No human screen-reader check of the live region. |
| 9 Coin demonstration | MET | `test-examples.txt`, `coin-check.txt` (mean 0.66862, sd 0.12978; tolerance 0.01; PASS), `final-local.txt` | Toy model only. Not a validity claim. |
| 10 Seeds from user's tarball | MET | `test-extract-seeds.txt`, `extract-seeds-real.txt`, `extract-seeds-real-sh.txt`, `test-demos.txt`, `extract-seeds-git.txt` | The tarball is the maintainers' own copy, not independently downloaded. |
| 11 User-selected files | PARTLY | `test-ui-logic.txt`, `ui-keyboard.md` | The keyboard-only operation (11.4) was checked by script only. Human pass NOT DONE. |
| 12 Corpus and retrieval | MET | `test-retrieve.txt`, `test-docs-assistant.txt`, `docs-assistant-check.txt` | MANUAL accuracy read of `docs/assistant` not recorded. |
| 13 Provider and verification | PARTLY | `test-assistant.txt` (Fake_Provider), `assistant-real.txt` (real Ollama, HTTP API only) | 13.11: real test exercised partly: 2 questions, API not UI, weak answer, no real-model rejection case, `assistant-real-grep.txt` not written. Secret grep run for this task found nothing. |
| 14 Assistant status and UI | MET (automated) | `test-assistant-status.txt`, `test-assistant-ui.txt`, `assistant-real.txt` (status enabled) | Screen-reader announcement not tested. |
| 15 Local pages | PARTLY | `test-pages.txt`, `local-ui-review.md` (162 checks pass, 30 PNGs) | 15.5: WCAG 2.2 AA checked by own script only (no axe, no screen reader, no 200% zoom by a person). Two cosmetic defects at 320 px unfixed. |
| 16 Public site | PARTLY | `final-web.txt` (86 tests pass), `m2-web-sample-diff.txt` (empty), `web-pages-gap.md` | 16.2 not done; gap recorded as 16.3 allows. |
| 17 Automated tests | MET | `final-local.txt` (252 pass, 0 skipped), `test-journey.txt`, `test-journey-skipped.txt`, `final-runner.txt`, `scaffold-deps.txt` | 17.7: no Runner change, see `runner-no-change.txt`. |
| 18 Licence and notices | PARTLY | `license-check.txt`, `final-check-license.txt`, `licence-table.md`, `test-notices.txt` | 18.3: legal name NOT confirmed. GitHub licence detection not verified. Licence review is incomplete and is not legal advice. |
| 19 README and installation | MET (automated) | `test-readme.txt`, `build-image.txt`, `build-image-id.txt`, `start-check.txt`, `start-health.json`, `reset-git-status.txt`, `start-reset-tests-ps1.txt`, `start-reset-tests-sh.txt` | The independent tarball download was not done. The vendored image ID differs from the original and is unexplained. |
| 20 Tracked-file audit | MET | `test-audit.txt`, `audit-tracked.txt`, `final-audit-tracked.txt` | none found |
| 21 Clean-clone verification | PARTLY | `clean-clone-pass2.txt` (`RESULT: PASS`, commit `0e7896f`), `clean-clone.txt` (first run, `RESULT: FAIL`), `clean-clone-defects.md` | Stand-in tarball (SHA-256 `a289c4da...`), not an independent download. No separate `audit-tracked` run in the clone transcript. Windows PowerShell only. |
| 22 Demo script and Devpost checklist | PARTLY | `test-demo-docs.txt`, `test-devpost-docs.txt`, `docs/demo/script.md`, `docs/demo/shot-list.md`, `docs/devpost-checklist.md` | No video exists. YouTube link and Devpost text description `MISSING`. Checklist has two stale statements about the clean-clone transcript. |

## Items asked for by the task

- MANUAL and not done: keyboard-only pass, screen reader, 200% zoom, independent tarball download, demo recording, accuracy reads of docs and notices, legal name. See section 4 of `final-open-items.md`.
- Assistant real test status: exercised partly (Ollama `llama3.2:3b`, HTTP API, 2 questions). Answer quality weak. `assistant-real.txt`.
- Tarball independence status: NOT independent. The local copy `.scratch/gh.tar.gz` (SHA-256 `a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8`) stood in for the browser download in both clean-clone runs.
- Legal-name confirmation status: NOT confirmed. `LICENSE` uses `artfever`.
- Release guard: BLOCKED for both local images (`final-guard-real-digest.txt`, `final-guard-vendored-digest.txt`). G1 to G4 UNMET. No APPROVED row.
- Exit codes: all `final-*.txt` show `exit=0` except the two guard-digest files, which show `exit=1` because blocking is the required result.

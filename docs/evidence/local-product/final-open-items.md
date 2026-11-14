# Final open items (task 13.4)

Spec: `.kiro/specs/03-local-product`. Written after re-running every suite in the working tree (HEAD `0e7896f` plus uncommitted changes listed in section 6). Paths are redacted as `<repo>`. Nothing was ticked or unticked in `tasks.md` by this task. Each item below is either a task that is ticked but has an evidence gap, a task that is still open, or something a person must still do.

## 1. What was re-run and what it showed

| Check | Evidence file | Result |
|---|---|---|
| `npm.cmd test` in `apps/local` | `final-local.txt` | 252 tests, 252 pass, 0 fail, 0 skipped, `exit=0`. The journey test ran against the real image (not skipped). It uses the local-only Seeds files, which exist on this machine. On a fresh clone, 1 test is skipped until `extract-seeds` is run (`clean-clone-defects.md`). |
| `npm.cmd run check` in `apps/web` | `final-web.txt` | lint, typecheck, build ("sample data OK"), 86 tests, 86 pass, `exit=0` |
| Runner unit tests in `reprolab-openbugs:3.2.3`, `--network none` | `final-runner.txt` | `Ran 14 tests`, `OK`, `exit=0` |
| Release-guard tests | `final-guard.txt` | 39 cases, 0 failures, `exit=0`. H2 confirms the real `docs/release-decision.md` has no APPROVED row. |
| `scripts/check-publish-paths.ps1` | `final-publish-paths.txt` | OK, 1057 files scanned, `exit=0` |
| `node scripts/audit-tracked.mjs` | `final-audit-tracked.txt` | 416 tracked files, PASS, `exit=0` |
| `node scripts/check-license.mjs` | `final-check-license.txt` | `MIT OK`, `exit=0` |
| Release guard on the real image digest (`reprolab-openbugs:3.2.3`, `sha256:f65e2244...`) | `final-guard-real-digest.txt` | **BLOCKED, `exit=1`**: G1, G2, G3, G4 UNMET; no Decision log row for the digest. A non-zero exit is the required result here. |
| Release guard on the other local image (`reprolab-openbugs:3.2.3-vendored`, `sha256:4d9ebd5f...`) | `final-guard-vendored-digest.txt` | **BLOCKED, `exit=1`**, same five reasons. |
| `docs/release-decision.md` APPROVED rows | grep for APPROVED | Only prose about the guard. No APPROVED Decision log row exists. |
| Spec format validation (00, 01-web-mvp, 03) | `final-spec-validation.txt` | No errors. One warning on `03/design.md`: no "Correctness Properties" section (the spec says property tests are not used). |
| Secret grep (`sk-...`, `Bearer `) over `docs/evidence/local-product` | none found | Run for this task. The file `assistant-real-grep.txt` named by task 6.5 was never written (see 2.6). |
| `git ls-files` content | `final-git-ls-files.txt` | 416 files. No `.tar`, `.tgz`, `.gz`, `.zip`, `.so`, `.dll`, `.exe`, `.odc`, `.bmp`, no `vendor/`, `local-data/`, `runs/`, `.scratch/`, `node_modules/` path. No file over 1 MiB. No file named like an upstream example or engine file. |
| Containers labelled `reprolab.run` after the runs | none left | `docker ps -a --filter label=reprolab.run` empty. |
| Stray processes | none started by this task | A `node src/server.mjs` (started 03:15) and Ollama (`ollama app.exe` 03:18, `ollama.exe serve` 03:18) were already running before this task began at about 03:46. I left them alone. |

Caveat on the `git ls-files` check: 49 PNG screenshots of ReproLab's own pages are tracked under `docs/evidence/local-product/shots/` (spec 1.4 and 5.4 evidence). They are not engine binaries, tarballs or container images, and the audit rules in Requirement 20.1 do not forbid them. I did not inspect each PNG for machine paths or personal data.

## 2. Ticked tasks whose acceptance evidence has a gap

I left these ticked. The task text for most of them marks the gap as MANUAL and says the executor records what was and was not done, so the recorded gap is what the task asks for. You may still prefer to untick some. My recommendation is in the last column.

| # | Task | Gap | Evidence | Suggested action |
|---|---|---|---|---|
| 2.1 | 1.4 Local browser review of `apps/web` | Four PNGs exist and were read. No keyboard, zoom or screen-reader check was done. Lower parts of `/sample-run` were not viewed (the per-run file tables, Reproducibility, Errors and Limitations sections). | `m1-browser-review.md` ("Not seen") | Keep ticked. The MANUAL part is recorded as not done. |
| 2.2 | 1.6 Milestone 1 review and commit | The named evidence file `m1-commit.txt` does not exist. The commit itself exists (`30ae5e3`, "chore(m1): reconcile web MVP evidence..."). | `git log` only | Create the file from `git log -1 --stat 30ae5e3` or untick. Not done here because it would be a reconstruction. |
| 2.3 | 3.5 Runner change (conditional) | Not a gap. The "no change" branch applies, and `runner-no-change.txt` exists. | `runner-no-change.txt` | None. |
| 2.4 | 5.2 Run page with validation messages | The automated Tab-order check passed. The MANUAL keyboard-only pass by a person was **not done**. `ui-keyboard.md` says so. Also untested: Enter and Space activation, Shift+Tab, the native file chooser, focus ring visibility on screen. | `ui-keyboard.md`, `test-ui-run.txt`, `test-ui-run2.txt` | Keep ticked only if you accept "recorded as not done". Otherwise untick until a person runs it. |
| 2.5 | 5.4 Responsive and accessibility review | Screen reader pass NOT DONE. 200% zoom by a person NOT DONE. Real keyboard pass NOT DONE. Only 4 of the 30 PNGs were opened by me; the rest are measured by script only. The review says "The task checkbox stays unticked", but the box is ticked in `tasks.md`. This is an inconsistency. Contrast uses ReproLab's own formula, not axe. Two cosmetic defects left unfixed (Run page legend wraps on the border and the demo `select` clips its text at 320 px). Only Chrome was used. | `local-ui-review.md`, `ui-a11y-review-run1.txt`, `ui-a11y-review-run2.txt` | Strongest candidate to untick, since the evidence file itself says it stays unticked. |
| 2.6 | 6.5 Real provider end-to-end test (MANUAL) | Exercised partly. Two questions through the HTTP API (a run-log question, an off-topic question), not three through the UI. No docs-only question. The answer to the run-log question was weak: it did not quote the log line "variable nn is not defined" and said the cause was unclear, but it carried a valid citation so the server showed it. The rejection path for a bad provider answer was not seen with a real model. Only one small model (`llama3.2:3b`). The first request timed out at 60 s on a cold model. The named file `assistant-real-grep.txt` was never written. I ran the grep for this task and found nothing. | `assistant-real.txt`, `assistant-ollama-check-6-4.txt` (older, says "NOT EXERCISED"; superseded by `assistant-real.txt`) | Keep ticked; the task allows "exercised or NOT EXERCISED" and the file is explicit. Add the missing grep file or accept the new grep result. |
| 2.7 | 6.1 Assistant documents | The MANUAL read for accuracy against the code has no record of being done. Automated checks only (ASCII, passage length, 12-word overlap). | `test-docs-assistant.txt`, `docs-assistant-check.txt` | Keep ticked; record who read them, or untick. |
| 2.8 | 8.1 Public site pages | Not added. The gap is recorded as the task's alternative allows. Requirement 16.2 (add the pages where cheap) is therefore not met, by design of the task. | `web-pages-gap.md` | Keep ticked. State plainly it is a deferral. |
| 2.9 | 9.2 Milestone 2 review and commit | `m2-commit.txt` and `m2-ls-files-check.txt` do not exist. Commits exist (`467add0` and earlier). | `git log` only | Same as 2.2. |
| 2.10 | 10.1 MIT LICENSE | Legal name of the copyright holder not confirmed. `LICENSE` uses the git author name `artfever`. GitHub licence detection was not checked. | `license-check.txt`, `license-author.txt`, `final-check-license.txt` | Keep ticked. You must confirm the legal name. |
| 2.11 | 10.3 Third-party notices | MANUAL read for accuracy by a person not recorded. Not legal advice. Legal review was not done. | `test-notices.txt` | Keep ticked; record the read. |
| 2.12 | 11.1 Vendored-tarball Dockerfile | "MANUAL: decide whether to retag" is open. The image `reprolab-openbugs:3.2.3-vendored` (`sha256:4d9ebd5f...`) differs from the original `3.2.3` (`sha256:f65e2244...`). The cause was not investigated (also seen in the two clean-clone builds, `77fad08b...`). The engine reports 3.2.3 rev 1012 in all of them. The default tag in the scripts is now `-vendored`, which is a different image from the one the earlier Seeds comparison used. | `build-image-id.txt`, `build-image-runner-tests.txt` | Keep ticked. Treat the digest difference as unexplained. |
| 2.13 | 12.1 Milestone 3 review and commit | `m3-commit.txt` does not exist. Commits exist (`4c55670`, `6345619`, `9426862`, `0394def`, `2cafe9c`). | `git log` only | Same as 2.2. This box is also uncommitted: the 12 and 12.1 ticks are in the working tree only. |
| 2.14 | 13.1 Clean-clone verification | The independent browser download of the tarball was **not done**. The local copy (SHA-256 `a289c4da...`) was used as the stand-in. `clean-clone.txt`, the file the task names, ends `RESULT: FAIL at npm test apps/local`. The passing run is in `clean-clone-pass2.txt` (`RESULT: PASS`, commit `0e7896f`). The first run's defects were fixed in commit `fee7136`. The transcript has no separate run of `scripts/audit-tracked.mjs` in the clone (the audit test inside `npm test` did run). Only Windows PowerShell was driven. | `clean-clone.txt`, `clean-clone-pass2.txt`, `clean-clone-defects.md` | Keep ticked, but note the named file ends in FAIL. Consider replacing it with pass 2 or renaming. |
| 2.15 | 13.2 Demo script and shot list | MANUAL screen recording not done. No video exists. | `test-demo-docs.txt` | Keep ticked. The recording is a person task. |
| 2.16 | 13.3 Devpost checklist | Contains statements that are no longer true: "A clean-clone transcript (task 13.1) is not yet produced; no file for it exists" and "the clean-clone verification (task 13.1) has no transcript yet". Transcripts now exist. The YouTube link and the text description for the form are `MISSING`. The "assistant" row says "DONE, partly". | `docs/devpost-checklist.md` lines 21 and 108, `test-devpost-docs.txt` | Fix those two lines. I did not edit the checklist because it is outside this task. |

## 3. Tasks still open

| Task | State | Note |
|---|---|---|
| 13.4 Final verification | In progress (`[-]`) | This task. Outputs are the `final-*` files. `final-status.md` is written. The orchestrator sets the checkbox. |
| 13.5 Milestone 4 review and commit | Open | Needs a commit, and `m4-commit.txt`. Not started. Nothing was staged or committed by this task. |

Note on `final-*.txt` exit codes: all are `exit=0` except `final-guard-real-digest.txt` and `final-guard-vendored-digest.txt`, which are `exit=1` because the release guard must block. That is the expected result, not a failure. The acceptance text "final-*.txt files show exit 0" does not fit those two files literally.

## 4. Things a person must still do (MANUAL, not done)

1. Keyboard-only pass on the Run and Results pages (Enter, Space, Shift+Tab, the file chooser, visible focus). Task 5.2.
2. Screen reader pass and 200% browser zoom. Task 5.4.
3. Download the OpenBUGS 3.2.3 tarball in a browser from SourceForge and rerun the clean clone with it. Tasks 11.4 and 13.1.
4. Confirm the legal name for `LICENSE`. Task 10.1.
5. Read `docs/assistant/*.md` and `docs/third-party-notices.md` for accuracy. Tasks 6.1 and 10.3.
6. Record the demo video, upload it, and add the link to the checklist. Tasks 13.2 and 13.3.
7. Write the Devpost text description.
8. Decide whether to retag the vendored image, and look into why its ID differs. Task 11.1.
9. Real-provider tests of the assistant through the UI with a docs question, and with other models. Task 6.5.
10. Legal review of the OpenBUGS licence terms. Gates G1 to G4 stay UNMET, so the image must not be published.

## 5. Other findings

- `tasks.md` Overview still says "All checkboxes are unticked", which is no longer true.
- `design.md` of this spec has no Correctness Properties section (validator warning only).
- `01-web-mvp/tasks.md` has one ticked task (8.15). Every other task there is open (`m1-reconcile.md`), including its manual accessibility checks. That spec is historical and was not edited.
- The coin accuracy test rewrites the tracked file `coin-check.txt` on every `npm test`, so `git status` shows it modified after any test run. The README says so. The new values (mean 0.6686, sd 0.1298) are within the 0.01 tolerance.
- Another `node src/server.mjs` instance has held port 8765 since before this task. I did not start or stop it.
- `docs/evidence/local-product/assistant-ollama-check-6-4.txt` says 6.5 "remains open". It predates `assistant-real.txt` and is out of date.
- The assistant has produced a weak (cited but unhelpful) answer and, in the clean-clone check, a decline for a docs question with the 3B model. Answer quality is unproven.

## 6. Working tree state at the end of this task

Uncommitted: `.kiro/specs/03-local-product/tasks.md` (ticks for 12, 12.1, 13.1, 13.2, 13.3 and the 13.4 marker), `.kiro/specs/03-local-product/tasks.meta.json`, `docs/evidence/local-product/clean-clone-defects.md`, `coin-check.txt`, `clean-clone-pass2.txt` and the new `final-*` files. Nothing was staged, committed or pushed by this task.

# Clean-clone verification: README defects found (task 13.1)

Verified against the pushed `main` (commit 2cafe9c). Transcript: `clean-clone.txt`. Script: `scripts/verify-clean-clone.ps1` with the HTTP driver `scripts/clean-clone-drive.mjs`.

Stand-in, stated plainly: the README's manual step is a browser download of the tarball from SourceForge. A script cannot do that, so the locally held copy (SHA-256 a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8, equal to the README value) was copied to `vendor/OpenBUGS-3.2.3.tar.gz`. The independent browser download was not done.

Image tag: the default tag `reprolab-openbugs:3.2.3-vendored` already exists on this machine, so the clean build used a separate temporary tag (`-Tag`, with `REPROLAB_IMAGE` set to the same value, exactly as the README describes) and the tag was removed afterwards. The default-tag path (`build-image` with no `-Tag`) was verified earlier in task 11.1 (`build-image.txt`, `build-image-id.txt`).

Port: 8765 was held by an unrelated older server on this machine, so `REPROLAB_PORT=18765` was used (documented in the README).

## Defects found

| # | Defect | Where it showed | Fix (main working repo, not yet committed or pushed) |
|---|---|---|---|
| 1 | README names `runs/` in a code span. The path does not exist in a clean clone, so `apps/local/tests/readme.test.mjs` fails ("every path ... named in the README exists") and `npm test` exits 1. It passed in the working repo only because an untracked `runs/` folder existed there. | `npm test` in `apps/local` | README wording changed to "a top-level folder named runs". |
| 2 | No `.gitattributes`. On Windows with `core.autocrlf=true`, a clone checks every text file out with CRLF. `npm run check` in `apps/web` then fails with "content/sample-run.json is out of date with the evidence" (evidence hashes are byte-exact), and the coin and Seeds inputs sent to the engine differ in size and SHA-256 from the recorded runs (coin `data.txt` 21 bytes instead of 20). Bash scripts would also get CRLF. | `npm run check` in `apps/web`; coin run file table | Added `.gitattributes` (`* text=auto eol=lf`, binaries marked). |
| 3 | Committed `apps/web/content/sample-run.json` recorded the size and hash of `docs/evidence/comparisons.txt` as it exists in the author's working tree (8170 bytes, 10 CRLF line endings). The committed blob is 8160 bytes (LF). So the committed data could not match the committed evidence on any machine. | same check | Normalised the working copy of `comparisons.txt` to LF (same blob, `git diff` empty) and regenerated `sample-run.json` with `npm run data`. The diff is two lines (hash, bytes). |
| 4 | The coin accuracy test rewrites the tracked file `docs/evidence/local-product/coin-check.txt`, so `git status` is dirty after `npm test`. The README did not say so. | `git status` in the clone after `npm test` | README now says so and gives the `git checkout --` command. |

These fixes exist only in the working tree. They take effect for strangers only after they are committed and pushed. Re-running the clean clone against the unpushed fixes is therefore not possible; instead the fixes were checked as follows (see the task report): a fresh clone of the pushed repository with `.gitattributes` and the regenerated `sample-run.json` applied passes `validate-sample-data`; `npm run check` in `apps/web` and `npm test` in `apps/local` pass in the working repo.

| 5 | README said the full run has none skipped. In a fresh clone `npm test` reports 1 skipped (the Seeds sub-test of the journey test) until `extract-seeds` has been run. | `npm test` summary: `skipped 1` | README now says so. |

Note on the transcript: `clean-clone.txt` records the run against the pushed commit, so it still ends `RESULT: FAIL at npm test apps/local` and lists `npm run check apps/web` as also failed. Those are defects 1 to 3. `npm test` in the clone ran 239 tests: 237 passed, 1 failed (defect 1), 1 skipped (defect 5). The working repo has more tests (252) because other tasks added tests after the push.

Assistant, honest status: with Ollama `llama3.2:3b` configured, status was `enabled`. The one question asked ("What port does the server listen on?") returned `declined`: the server rejected or declined the 3B model's output rather than showing an answer. No answer was produced, so no answer quality claim is made.

## What worked from a clean clone

`git clone`, vendored-tarball hash check, `npm ci`, `build-image` (the build was fully cached from the earlier default-tag build; the two image IDs differ and the cause was not investigated; the engine reports OpenBUGS 3.2.3 rev 1012 in both), `start -CheckOnly`, `start`, `/api/health`, coin run (`succeeded`), coin syntax-error run (`engine_error`, first engine line `expected right parenthesis error pos 28 (error on line 3)`), `extract-seeds` (four MATCH lines), Seeds run (`succeeded`), results pages and manifests, assistant status (`disabled` without a provider; `enabled` with Ollama `llama3.2:3b`).

---

# Pass 2: clean clone of the pushed fixes (task 13.1)

Transcript: `clean-clone-pass2.txt` (pass 1 `clean-clone.txt` is unchanged). Same script and driver as pass 1: `scripts/verify-clean-clone.ps1`, `scripts/clean-clone-drive.mjs`. Result line: `RESULT: PASS`.

Tested commit: `0e7896f` (`origin/main` at the time; `git ls-remote`, the clone HEAD and the working repo HEAD were identical). Fresh clone in a temp directory outside the working repo, removed afterwards (`Test-Path <tmp>` was False).

Same stand-in as pass 1, stated plainly: the README's manual step is a browser download of the OpenBUGS 3.2.3 tarball from SourceForge. A script cannot do that, so the locally held copy (SHA-256 a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8, equal to the README value) was copied to `vendor/OpenBUGS-3.2.3.tar.gz`. The independent browser download was not done.

Image tag: the default tag `reprolab-openbugs:3.2.3-vendored` exists locally, so the clean build used the temporary tag `reprolab-openbugs:cleanclone-0ee2ef` (`build-image.ps1 -Tag`, `REPROLAB_IMAGE` set to the same value). The existing default-tag image (`sha256:4d9ebd5f...`) was not replaced. The temporary tag was removed (`docker rmi` exit 0). The build gave image ID `sha256:77fad08b...`, which again differs from the default-tag ID; the cause was not investigated (same as pass 1). The engine reports OpenBUGS 3.2.3 rev 1012.

Port: 8765 is held by an unrelated older node server on this machine (PID not started by this run, left running), so `REPROLAB_PORT=18765` was used.

## Required results

| Check | Result |
|---|---|
| `npm ci` in `apps/web` | exit 0 |
| `build-image` | exit 0 |
| `start -CheckOnly` | exit 0 |
| `npm test` in `apps/local` | exit 0: 252 tests, 251 passed, 0 failed, 1 skipped. The skip is the Seeds sub-test of the journey test, which needs `extract-seeds` first; the README says so (defect 5). Defect 1 is gone. |
| `npm run check` in `apps/web` (lint, typecheck, build with `sample data OK`, tests) | exit 0: 86 tests, 86 passed. Defects 2 and 3 are gone. |
| Coin run | `succeeded`, engine 3.2.3 rev 1012, 10 files, summary label present, manifest HTTP 200 (4604 bytes), results page HTTP 200. `data.txt` is 20 bytes, so line endings are LF (defect 2 fixed). |
| Invalid-model run | `engine_error`; first engine line: `expected right parenthesis error pos 26 (error on line 3)`; no summary; manifest HTTP 200. The position is 26 here and was 28 in pass 1 because pass 1 had CRLF in the model file. |
| `extract-seeds` | four MATCH lines, "OK: four Seeds files matched the recorded hashes" |
| Seeds original sample run | `succeeded`, engine 3.2.3 rev 1012, 1.777 s, 10 files, `model.txt` sha256 eccd496e... equal to the recorded value, manifest HTTP 200 (4778 bytes), results page HTTP 200. The summary carries the "not a convergence or validity claim" label. |
| Assistant status without a provider | `{"status":"disabled","reason":"No language-model endpoint is configured."}` |
| Assistant with Ollama `llama3.2:3b` | status `enabled`. One question, "What port does the server listen on?", returned `{"kind":"declined","message":"I cannot answer that from the ReproLab documentation or this run's log and manifest."}`. This is the same outcome as pass 1. The server declined; no answer was produced, so no answer-quality claim is made. |
| Cleanup | containers labelled `reprolab.run` removed (0 left), temporary image removed, temp clone removed, server process stopped |

Ollama was already running before this pass (started 03:18 local time, before the run), so it was not started or stopped by this pass. The older node server on 8765 was likewise left alone.

## New defects

None found in pass 2.

Observations, not defects:

- After `npm test` the clone's `git status` shows `docs/evidence/local-product/coin-check.txt` modified. This is defect 4, which the README now documents.
- In the transcript, the line "first engine error line in log" for the two `succeeded` runs shows the OpenBUGS statistics header. That label belongs to the driver's loose pattern, which only means something for the invalid-model run. It is a test-driver display quirk, not product behaviour.

Remaining uncertainty: the tarball was not downloaded independently by a person in a browser; the Ollama question was declined, so the assistant's answering path with a real model was exercised only as far as a decline; Windows PowerShell was the only platform driven (the `.sh` scripts were checked separately under WSL in task 11.2).

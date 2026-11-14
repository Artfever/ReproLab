# Devpost checklist (Kiroween 2026)

Spec: `.kiro/specs/03-local-product/requirements.md`, Requirement 22.3 to 22.5. Task 13.3.

Every entry below is DONE (with an evidence path), MISSING, or MANUAL (needs a person). Nothing here has been submitted to Devpost, and no video exists or has been uploaded.

## Required items

| Item | Status | Evidence or note |
|---|---|---|
| Public GitHub repository URL (also the test-build link) | DONE, with caveats | https://github.com/Artfever/ReproLab. Fetched without credentials with `web_fetch` on the date of this task; the page returned the project README, so it was reachable and readable without login. `git ls-remote` was not run because the tooling blocked outbound git calls from the session. Re-check by hand before submitting (see "Repository availability"). |
| Public YouTube demo video URL | MISSING | No video has been recorded or uploaded. The script is `docs/demo/script.md`. Add the URL here and in the Devpost form once it exists. |
| Category | DONE | Resurrection (bring an old technology back to life). ReproLab re-runs a supported old analysis with its original engine, OpenBUGS 3.2.3. |
| Kiro usage write-up | DONE (draft) | Section "Kiro usage write-up" below. Drafted from files in this repository only. |
| Setup instructions for judges | DONE | Section "Judge setup" below and `README.md`. |
| Open source licence file, visible on the repository | DONE, with caveats | `LICENSE` (MIT). The copyright holder line uses the git author name, not a confirmed legal name. Whether GitHub shows the licence in the About box was not verified. |
| `/.kiro` directory at the repository root, not git-ignored | DONE | `.kiro/specs`, `.kiro/steering`, `.kiro/hooks`. Tracked-file audit output: `docs/evidence/local-product/audit-tracked.txt`. Confirm with `git ls-files .kiro` before submitting. |
| Text description of features and functionality | MISSING | Not written for the Devpost form. Draft it from `README.md`. |
| Hosting or deployment | DONE (none used) | See "No hosting or deployment". |
| Real assistant test with a language model | DONE, partly | `docs/evidence/local-product/assistant-real.txt` (Ollama, llama3.2:3b, HTTP API only; the UI was not driven). |
| Independent browser download of the OpenBUGS tarball | MANUAL | Not done by anyone other than the maintainers' own copy. A clean-clone run of the pushed repository passed using the local tarball copy as a stand-in for this manual step: `docs/evidence/local-product/clean-clone-pass2.txt` (pass 1, `clean-clone.txt`, failed and led to fixes). |
| Manual keyboard and screen-reader checks | MANUAL | Not done. See `docs/evidence/local-product/ui-keyboard.md`. |
| Demo recording | MANUAL | A person must record the real product. |
| Confirmation of legal name for `LICENSE` | MANUAL | See `docs/evidence/local-product/license-author.txt`. |

## Kiro usage write-up

Draft text for the Devpost form. Each claim points at a file that exists in the repository.

ReproLab was built in the Kiro IDE with specs, steering, one hook and evidence-ticked tasks. The product is a local tool that runs OpenBUGS models in a Docker container and records the real log, output files and a manifest. It does not judge results.

**Spec-driven development.** Five spec folders in `.kiro/specs/`, each with `requirements.md`, `design.md` and `tasks.md`:

- `.kiro/specs/00-engine-feasibility/tasks.md`: can OpenBUGS 3.2.3 run in a container, and what is the licence position.
- `.kiro/specs/01-web-mvp/tasks.md` and `.kiro/specs/01-end-to-end-web-run/tasks.md`: the static comparison site and the run path.
- `.kiro/specs/02-grounded-assistant/tasks.md`: a documentation assistant whose answers must cite real passages.
- `.kiro/specs/03-local-product/tasks.md`: the local product. Requirements use numbered acceptance criteria, and each task lists the requirement ids it covers.

Every task names an acceptance check and an output file. The orchestrator handed one task at a time to a task-execution subagent. The subagent was not allowed to update task status. A task box was ticked only after its evidence file existed. The `03-local-product` tasks file marks unfinished tasks with open or in-progress boxes; the 13.x tasks are still open.

**Steering.** `.kiro/steering/product.md`, `engineering.md`, `security-and-privacy.md`, `scientific-integrity.md` and `open-source.md`. They fixed rules that the work kept to: no fabricated results, every claim about a run needs a log line, no arbitrary executable upload, no hosted execution, keep the GPL and third-party material out of the repository.

**Hook.** `.kiro/hooks/validate-on-save.json` defines a TypeScript check after saving `.ts` or `.tsx` files. It is disabled (`"enabled": false`) because it was not tested in the installed Kiro. It has not saved any time in this build.

**Release gate and guard.** `docs/release-decision.md` records NO-GO and the gate conditions. `scripts/release-guard.ps1` fails closed. `scripts/check-publish-paths.ps1` looks for publish-style commands. `scripts/tests/` holds the guard cases, with output in `docs/evidence/release-guard-tests.txt` and `docs/evidence/local-product/m2-final-guard.txt`. The guard is a text check and cannot stop a hand-typed command.

**Evidence directory.** `docs/evidence/` and `docs/evidence/local-product/` hold test output, real run logs, manifests and review notes, one file per task check.

**What the process caught.** These are the failures the checks exposed, as recorded in the files cited:

- A pre-declared comparison that failed. `docs/evidence/comparisons.txt` is labelled "pre-declared test, expected FAIL" for the pooled Seeds comparison, with exit code 2. The expected result was recorded before the run, and the failure was kept instead of loosening the test.
- The `REPROLAB_IMAGE_DIGEST` bug, found by the real container run. The fix is covered by the test named "REPROLAB_IMAGE_DIGEST is the image id, never the run id; absent when unknown; bad ids rejected" in `apps/local/tests/docker.test.mjs`. The two coin manifests `docs/evidence/local-product/m2-coin-manifest.json` and `docs/evidence/local-product/default-tag-coin-manifest.json` hold different image ids because they came from two different image tags (`docs/evidence/local-product/build-image-id.txt`). The account of how the bug was found comes from the build session, not from a saved log; the test is the file evidence.
- A run reported `succeeded` too early. The test "a run reads as running, with no manifest, until summary, files and manifest are final" in `apps/local/tests/runs.test.mjs` covers it, with output in `docs/evidence/local-product/test-runs.txt`. The same file tests that success is never derived from an exit code alone.

**Not used or not shown.** No MCP server, custom agent, Kiro power or property-based testing library is part of this repository. (`.kiro/specs/03-local-product/tasks.md` says property-based tests are not used because the dependency-free rule forbids a library.) The write-up makes no claim about them.

## Judge setup

Follow `README.md`. In order:

1. Install Node.js 24.x, Docker (running) and Git. The image targets linux/amd64.
2. **Manual tarball step first.** Download OpenBUGS 3.2.3 (`OpenBUGS-3.2.3.tar.gz`) yourself in a web browser from SourceForge and save it as `vendor/OpenBUGS-3.2.3.tar.gz`. No script can fetch it from SourceForge. The build script checks its SHA-256 against the value printed in the README.
3. Build the local image with `scripts/build-image.ps1` (Windows) or `scripts/build-image.sh` (Linux).
4. Start the app with `scripts/start.ps1` or `scripts/start.sh` and open the address it prints (127.0.0.1).
5. Run the built-in coin demo from the Run page.

The Seeds example needs the four input files extracted from your own tarball with `scripts/extract-seeds.ps1` or `scripts/extract-seeds.sh`. The repository does not contain them.

The setup needs Docker and a local image build. The first build takes a while and was not timed for this checklist.

## No hosting or deployment

ReproLab has no hosted site, no deployment step and no Vercel configuration added by this spec. It runs on `127.0.0.1`. The Docker image is never pushed, saved or exported (`docs/release-decision.md`). The Devpost "functional application" and "test build" link is therefore the repository itself. A judge cannot try the product without building the image locally.

## Repository availability

The repository must stay public, with its open source licence, until the judging period ends. The rules page gives the judging period as December 16, 2026 to January 29, 2027 (see below). Do not make the repository private, rename it or force-push over `.kiro/` before then.

## Kiroween rules page check

Source: https://kiroween.devpost.com/rules, fetched with `web_fetch`. Content was paraphrased.

Verified from the page text:

- Category Resurrection exists and is described as bringing old or obsolete technology back to life.
- A GitHub repository URL is required, and it must be public with an open source licence file that is visible in the repository About section.
- The repository must contain `/.kiro` at its root, and the directory must not be in `.gitignore`.
- A demo video under three minutes, uploaded and public on YouTube, is required, with no third-party trademarks or copyrighted music without permission.
- A Kiro usage write-up is required. The page lists topics (IDE/CLI/Web/Crew, custom agents, hooks, specs, steering, MCP, property-based testing, powers).
- The project must be available free of charge for testing until the judging period ends.
- Projects must be newly created after the start of the submission period, and any pre-existing code must be disclosed.
- Submission period October 30, 2026 to December 4, 2026 (2:00 pm Pacific). Judging period December 16, 2026 to January 29, 2027.

Could not verify:

- Whether this project was created inside the submission period. The repository's creation date was not checked, and the checklist makes no claim about it. Disclose any earlier code (for example the engine feasibility work) in the Devpost text.
- Whether GitHub shows the MIT licence in the About box.
- Whether the repository is also still public on the submission date. It was readable unauthenticated when fetched for this task only.
- Eligibility of the entrant, and any other Devpost form field not on the rules page.
- Whether judges accept a local build as a "functional application" link. The rules allow a "test build", but a build that needs a manually downloaded tarball and a local Docker image is a risk.

## Known limitations and open items

- The legal name of the copyright holder in `LICENSE` is not confirmed. It currently uses the git author name.
- The licence review of OpenBUGS, its bundled library and its examples is incomplete (`docs/licensing-review.md`). This is not legal advice.
- Manual keyboard and screen-reader checks have not been done (`docs/evidence/local-product/ui-keyboard.md`). Only Chrome was used in automated checks.
- The assistant answer quality is weak. In the real test, the answer to a failure question said it was unclear why the run failed, even though the log contained the line "variable nn is not defined". The first request on a cold model also timed out at 60 seconds (`docs/evidence/local-product/assistant-real.txt`).
- The independent browser download of the tarball has not been done, and the clean-clone run used the maintainers' local tarball copy as a stand-in (`docs/evidence/local-product/clean-clone-pass2.txt`).
- The demo video has not been recorded or uploaded. The YouTube link is MISSING.
- The Devpost text description has not been written.
- The Docker image is not distributed, so every judge must build it.
- The repository must remain public and available through judging.

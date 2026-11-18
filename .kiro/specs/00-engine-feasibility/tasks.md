# Implementation Plan: OpenBUGS feasibility

## Overview

This plan tracks the feasibility milestone for running the original OpenBUGS 3.2.3 engine on the Seeds example. E1 to E5 are the original tasks. E6 to E21 are open work found while verifying the evidence and while correcting the licence and release position.

A task is checked only after its work was run and verified, with a pointer to the evidence in `docs/evidence/` or `docs/engine-feasibility.md`. If E4 fails, no demo UI is built over mocked output.

Status at this review: the engine runs Seeds and the evidence is recorded. The pre-declared pooled comparison at 1,000 burn-in FAILED on all five nodes. **Image_Distribution and the Web_Runner remain NO-GO.** The **licence review is INCOMPLETE**; it has not been legally reviewed and no maintainer has been contacted. `docs/release-decision.md` holds the default NO-GO and its Decision log has **no approval row**, so gates G1 to G4 are all UNMET. `scripts/release-guard.ps1` and `scripts/check-publish-paths.ps1` now exist and are tested (`docs/evidence/release-guard-tests.txt`); the guard blocks the real record. Task 21.3, the person approval row, is still open and has not been done by anyone. Publishing or sharing the image is blocked until the rules in "Release Gate (blocking rules)" below are satisfied.

## Tasks

- [x] 1. E1: Identify upstream source, exact version, checksum and licence notices; document provenance
  - [x] 1.1 Record version, engine banner, source URL, pinned commit and SHA-256
    - Evidence: `docs/engine-feasibility.md` section E1 (`OpenBUGS version 3.2.3 rev 1012`, commit `27abd6d1...`, SHA-256 `a289c4da...`).
    - _Requirements: 1.1_
  - [x] 1.2 Quote the `COPYING` licence statement and the bundled components
    - Evidence: `docs/engine-feasibility.md` section E1 (Licence inside the tarball row); `docs/evidence/tarball_inspection.txt`.
    - _Requirements: 1.2, 1.6_
  - [x] 1.3 Record the configure, build and install commands and the prebuilt 32-bit `libOpenBUGS.so`
    - Evidence: `docs/engine-feasibility.md` section E1 (Build row and Engine library row).
    - _Requirements: 1.3, 1.5_
  - [x] 1.4 State the authenticity limit: SourceForge refused scripted downloads, so the checksum was not compared with an upstream value
    - Evidence: `docs/engine-feasibility.md` section E1, paragraph "Authenticity (revised 2026-11-13, see `docs/licensing-review.md`)", and `docs/licensing-review.md` section 3. The paragraph says the tarball is partly corroborated against upstream Subversion and not proven, and that SourceForge returns HTTP 403 to scripts. The browser cross-check itself is open in E7.
    - _Requirements: 1.4_
  - [x] 1.5 Write `docs/third-party-notices.md` recording the open licence questions without claiming ownership
    - Evidence: `docs/third-party-notices.md`, revised after the 2026-11-13 licensing review. It now contains: status "licence review INCOMPLETE" and a pointer to `docs/release-decision.md`; the GPL v3 `COPYING` versus the GPL v2 text in `doc/Manuals/GNU-Licence.html` and on the SourceForge page; upstream r1018 and the fact that the tarball predates it; the prebuilt `libOpenBUGS.so` without source and the unknown build revision; BlackBox terms; CpcBeautifier (unknown); TAUCS (unknown); the Examples, GeoBUGS and Reliability material (rights unknown); GNU build files and Debian layers; the statement that no repository licence is chosen and no `LICENSE` exists; and no ownership claim. The questions themselves stay open in E6.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

- [x] 2. E2: Create the pinned worker image and prove `--help` runs
  - [x] 2.1 Build from a digest-pinned base with a checksum-verified source download
    - Evidence: `infra/openbugs/Dockerfile` (`sha256sum -c` stops the build on mismatch).
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Run as a non-root user and show `OpenBUGS --help` exits 0
    - Evidence: non-root user: `infra/openbugs/Dockerfile` (`USER 10001`) and `docs/evidence/image_f65e2244_id_u.txt` (`id -u` printed `10001`, exit 0, run against the full final local image ID `sha256:f65e2244463b...6b88f`; `id` gave `uid=10001(bugs)`; `config_user=10001`). `docs/evidence/e2b_uid_and_paths.txt` is also from an earlier build and is superseded by that file. `--help` exit 0 and usage text: `docs/evidence/e2_image_and_help.txt` (`== exit=0`), which comes from an earlier build (image ID `9e78f53f...`) and does not show the uid.
    - _Requirements: 2.3, 2.4_
  - [x] 2.3 Record the engine banner, the local image ID, the unpinned parts and the rebuild commands
    - Evidence: banner `3.2.3 rev 1012` in `docs/evidence/seeds-a/manifest.json`; image ID `sha256:f65e2244...` in `docs/evidence/summary.txt` and the manifest; the unpinned `apt` note and the rebuild commands in `docs/engine-feasibility.md` section E2. The image ID is a **local ID only**. A registry digest must NOT be created before the Release_Gate is met; task 9.2 is blocked for that reason.
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 3. E3: Add the Seeds run path and generate a supported batch script
  - [x] 3.1 Implement script generation and input validation in `services/runner/reprolab_runner/adapter.py`
    - Evidence: `docs/evidence/seeds-a/script.txt`; unit tests `ScriptTests` and `InputTests`. The script has no `modelDisplay` or `modelSaveLog`.
    - _Requirements: 3.1, 3.3, 3.4, 3.7, 7.1, 7.2, 9.1, 9.5_
  - [x] 3.2 Read the Seeds model, data and two init files from the image; do not commit them
    - Evidence: `docs/evidence/input_hashes_upstream_examples.txt`; no upstream example files in the repository.
    - _Requirements: 3.2, 3.8, 3.9, 11.6_
  - [x] 3.3 Start the engine with an argument list and no shell; save stdout and stderr separately; write the manifest
    - Evidence: `argv` `[engine, "-t", "script.txt"]`, `log.txt`, `stderr.txt` and file hashes in `docs/evidence/seeds-a/manifest.json`.
    - _Requirements: 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 3.4 Run on container-local storage with the isolation flags and record the Linux constraints
    - Evidence: `scripts/run-container.ps1`; `docs/evidence/seeds-a/container_state.json`; `docs/engine-feasibility.md` section E3 (bind-mount `Reader.SetPos` error, flags, limits). Docker Desktop only; not a production sandbox test (E11).
    - _Requirements: 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4_

- [x] 4. E4: Execute Seeds, capture genuine logs and sample exports, and compare against the transcribed baseline
  - [x] 4.1 Run seeds-a, seeds-b, seeds-c and seeds-longburn and capture logs, exit codes, runtimes and CODA files
    - Evidence: `docs/evidence/checks.txt` (all four `succeeded`, 1.921 s, 1.921 s, 1.92 s, 5.132 s); `docs/evidence/seeds-*/manifest.json`.
    - _Requirements: 3.1, 3.3, 4.6_
  - [x] 4.2 Run the pre-declared pooled comparison at 1,000 burn-in. Result: FAILED on all five nodes
    - Evidence: `docs/evidence/checks.txt` ("seeds-a pooled burn-in 1000 ... exit=2 expected=2"); `docs/engine-feasibility.md` section E4. Tolerance: mean within 4 x baseline MC_error, sd within 10%. Baseline transcribed by eye from an image; chain count not stated by the source page.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.11_
  - [x] 4.3 Run the labelled post hoc comparisons and state their status
    - Evidence: chain 1 only passes, post hoc; chain 2 only fails, post hoc; pooled 20,000 burn-in passes 5 of 5, but 20,000 was chosen after the 1,000 failure, so it is a post hoc setting and not an independent confirmation. Matching the baseline does not establish convergence. See `docs/evidence/checks.txt` and `docs/engine-feasibility.md` "What the comparison does and does not show".
    - _Requirements: 6.8, 6.9, 6.10, 12.5, 12.6_
  - [x] 4.4 Show same-seed determinism and different-seed difference
    - Evidence: `docs/evidence/checks.txt` (seeds-a and seeds-b CODA hashes identical; seeds-c differs). One image on one machine only; cross-machine check is open in E8.
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 5. E5: Exercise invalid models, timeout and cleanup; publish limitations and the go/no-go decision
  - [x] 5.1 Run the syntax-error and undefined-node models and preserve the real logs
    - Evidence: `docs/evidence/bad-syntax/log.txt` and `docs/evidence/bad-undefined/log.txt`; both `failed` although the engine exit code was 0 (`checks.txt`).
    - _Requirements: 5.3, 5.6, 8.1, 8.2, 8.3, 8.4_
  - [x] 5.2 Run the timeout case and confirm cleanup
    - Evidence: `timeout-live` `timed_out` at 3.001 s with partial log (`checks.txt`); "no leftover rl-* containers" check passed (19 of 19). Volumes were not checked by that script.
    - _Requirements: 5.5, 8.5, 8.6_
  - [x] 5.3 Classify the outcome from log markers and output files
    - Evidence: `classify` in `adapter.py`; `RealLogTests` use the verbatim real logs.
    - _Requirements: 5.1, 5.2, 5.4, 5.7, 5.8_
  - [x] 5.4 Write limitations and the go/no-go decision in `docs/engine-feasibility.md`
    - Evidence: Decision section of `docs/engine-feasibility.md` and `docs/release-decision.md`. Current decision: GO for the engine; NO-GO for Image_Distribution and for the Web_Runner until the four gates in `docs/release-decision.md` are met; the licence review is incomplete. The section lists the open uncertainties and the untested failure modes.
    - _Requirements: 8.7, 10.5, 12.1, 12.3, 12.4, 12.7_
  - [x] 5.5 Run the 14 unit tests
    - Evidence: `docs/evidence/unit_tests_run.txt` (`Ran 14 tests`, `OK`, WSL Ubuntu, Python 3.12.3).
    - _Requirements: 4.4, 5.8, 6.11, 9.5_
  - [x] 5.6 Run `scripts/feasibility-e2e.ps1`
    - Evidence: `docs/evidence/checks.txt` and `summary.txt`: 19 of 19 checks passed, `failures=0`. Expected failures are asserted as expected, so a pass does not mean a match with the published table.
    - _Requirements: 4.6, 5.5, 7.3, 7.4, 8.6, 10.1_
  - [x] 5.7 Confirm no public model upload feature exists or is enabled
    - Evidence: `docs/evidence/no_public_upload_check.txt` (no `apps`, `packages`, `web`, `api`, `server`, `src`, `pages`, `app` or `public` directory; no upload or server code in py, ps1 or Dockerfile; no `EXPOSE`, `CMD` or `ENTRYPOINT` in the Dockerfile). The reviewer also listed the repository root and searched `scripts`, `infra` and `services` for `docker push|tag|save|login` (no match). Search-based evidence only; not a security test.
    - _Requirements: 10.5, 10.6_

- [ ] 6. E6: Resolve licence questions in `docs/third-party-notices.md`
  - Open because Image_Distribution and the Web_Runner stay NO-GO while any question is unanswered. **The licence review is INCOMPLETE.**
  - Done in the 2026-11-13 licensing review: `docs/licensing-review.md`, `docs/release-inventory.md` and a corrected `docs/third-party-notices.md` record evidence for each component and a GO / NO-GO table. They are engineering notes, not legal advice.
  - Still open: GPL v3 (`COPYING`, upstream `OpenBUGS-License.odc`) versus the GPL v2 text inside the package (`doc/Manuals/GNU-Licence.html`) and on the SourceForge page; upstream r1018 "Clarified licence of libOpenBUGS.so" postdates our tarball and is not in our `COPYING`; the build revision of the prebuilt `libOpenBUGS.so` is unknown; the BlackBox licence conditions (notice reproduction, source-availability information) are not met by the image; the CpcBeautifier licence is unknown; the TAUCS status is unknown; `doc/Examples`, `doc/GeoBUGS` and `doc/Reliability` have no licence marker; no root `LICENSE` is chosen. Follow-up tasks are E16 to E20; per-component redistribution permission is recorded in task 6.5; the publication block is the gate in E21.
  - [ ] 6.1 Resolve GPL version 3 in the archive `COPYING` versus GPL version 2 on the SourceForge page
    - _Requirements: 11.1, 12.3_
  - [ ] 6.2 Resolve the terms for the prebuilt `libOpenBUGS.so` without source, and for BlackBox Component Builder and CpcBeautifier
    - Depends on 16.1 (maintainer answers).
    - _Requirements: 11.2, 11.3, 12.3_
  - [ ] 6.3 Decide whether OpenBUGS example files and documentation may be redistributed in this repository
    - _Requirements: 11.4, 11.6, 12.3_
  - [ ] 6.4 Decide the licence for ReproLab_Code only (not an Upstream_Component licence)
    - Do not add a root `LICENSE` in this milestone (Requirement 11.7). The decision belongs to the next milestone, after the legal review (17.1). It grants no rights over OpenBUGS, BlackBox, CpcBeautifier, TAUCS or the examples.
    - Depends on 17.1.
    - _Requirements: 11.5, 11.7, 11.9_
  - [ ] 6.5 Record redistribution permission per Upstream_Component in `docs/third-party-notices.md`
    - Components: OpenBUGS wrapper and library, BlackBox parts, CpcBeautifier, TAUCS, `doc/Examples`, `doc/GeoBUGS`, `doc/Reliability`, Debian packages. Record each as granted, not granted or unknown, with the evidence. Permission never comes from the ReproLab_Code licence.
    - Depends on 17.1.
    - _Requirements: 11.2, 11.3, 11.4, 11.9_

- [ ] 7. E7: Cross-check the tarball SHA-256
  - Open because the checksum is only what the pinned GitHub commit serves.
  - Done in the 2026-11-13 licensing review: the tarball was compared with upstream Subversion (`cli/trunk` r1018). The small source and script files (the list is in `docs/licensing-review.md` section 3) and `COPYING` (r1017) are byte-identical. Evidence: `docs/evidence/licensing/02_*` and `03_*`.
  - Still open: the prebuilt `libOpenBUGS.so` and the documentation have no upstream counterpart, and SourceForge returns HTTP 403 to scripts, so no upstream checksum was reachable. A person must still download the archive in a browser from SourceForge and compare its SHA-256 (the task below). The authenticity result is "partially corroborated, not proven". This is gate G1.
  - [ ] 7.1 Download the archive manually from SourceForge in a browser, compare its SHA-256 with `a289c4da...` and record the result in `docs/engine-feasibility.md`
    - _Requirements: 1.4, 12.7, 13.2_

- [ ] 8. E8: Repeat the end-to-end script on a second machine
  - Open because determinism was shown on one machine and one image only.
  - [ ] 8.1 Run `scripts/feasibility-e2e.ps1` from a clean checkout on another machine and record whether the CODA SHA-256 values match `docs/evidence/`
    - _Requirements: 7.3, 7.5, 7.6_

- [ ] 9. E9: Pin the image inputs
  - Open because `apt` versions are unpinned and the image has only a local ID. Pinning is allowed now. Publishing is BLOCKED (task 9.2).
  - [ ] 9.1 Pin `apt` package versions in `infra/openbugs/Dockerfile` and rebuild
    - Part of gate G3 (pinned Debian package versions).
    - _Requirements: 2.7, 13.4_
  - [ ] 9.2 BLOCKED: Publish the image to a registry and record the registry digest
    - **MUST NOT be started until 6.1, 6.2, 6.3, 7.1, 9.1, 16.1, 17.1, 18.1, 19.1, 21.1, 21.2 and 21.3 are all done.** As of this revision none of them is done and `docs/release-decision.md` has no approval row.
    - The first step MUST be `scripts/release-guard.ps1` with the exact image digest. If it exits non-zero, stop. The step MUST cite its Decision-log row in `docs/release-decision.md`.
    - If the image is rebuilt after 21.3, the digest changes and task 21.4 must be done first.
    - _Requirements: 2.6, 2.9, 13.1, 13.7_

- [ ] 10. E10: Verify the transcribed baseline
  - Open because one person transcribed the numbers by eye from `seeds3.bmp`.
  - [ ] 10.1 Have a second person check `services/runner/reference/seeds_published.json` against the original results image and record the outcome
    - _Requirements: 6.5, 12.7_

- [ ] 11. E11: Test isolation on the intended worker host
  - Open because all Runs used Docker Desktop on a developer machine.
  - [ ] 11.1 Run the isolation flags and limits on the worker host and record the result before any public upload feature
    - _Requirements: 10.4, 10.5, 12.4_

- [ ] 12. E12: Add property-based tests for the design's correctness properties
  - Open because no property-based test exists; Hypothesis is not installed. Tests go in separate files under `services/runner/tests/properties/`. All sub-tasks are optional. Property 12 (the release guard) is task 21.5.
  - [ ]* 12.1 Add Hypothesis as a development dependency
    - _Requirements: 3.7_
  - [ ]* 12.2 Write property test for script order and allowed commands
    - **Property 1: Generated script is ordered, restricted to known commands, and never emits Linux-unsupported commands**
    - **Validates: Requirements 3.1, 3.3, 7.1, 9.1, 9.5**
  - [ ]* 12.3 Write property test for rejected names and workdirs
    - **Property 2: Disallowed names and workdirs are rejected before any script is produced**
    - **Validates: Requirements 3.7**
  - [ ]* 12.4 Write property test for seed range
    - **Property 3: Seeds outside 1 to 14 are always rejected**
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 12.5 Write property test for bounded ASCII input
    - **Property 4: Text input reads accept exactly bounded plain ASCII**
    - **Validates: Requirements 3.7**
  - [ ]* 12.6 Write property test for known engine errors
    - **Property 5: A log containing a known engine error is never succeeded**
    - **Validates: Requirements 5.1, 5.3**
  - [ ]* 12.7 Write property test for the `succeeded` conditions
    - **Property 6: succeeded implies every success condition and the result is one of three statuses**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5, 5.7**
  - [ ]* 12.8 Write property test for the CODA round trip
    - **Property 7: CODA export round trip**
    - **Validates: Requirements 6.2**
  - [ ]* 12.9 Write property test for summary statistics
    - **Property 8: Summary mean is the arithmetic mean of the pooled samples**
    - **Validates: Requirements 6.2**
  - [ ]* 12.10 Write property test for the tolerance rule
    - **Property 9: A node passes if and only if both tolerance conditions hold**
    - **Validates: Requirements 6.3, 6.4**
  - [ ]* 12.11 Write property test for monotonic tolerance (no test exists today)
    - **Property 10: Comparison is monotone in tolerance**
    - **Validates: Requirements 6.3**
  - [ ]* 12.12 Write property test for the manifest round trip
    - **Property 11: Run_Manifest JSON round trip**
    - **Validates: Requirements 4.4**

- [ ] 13. E13: Test the untested failure modes
  - Open because these were listed as not tested.
  - [ ] 13.1 Run a Run that exceeds the memory limit and record the outcome and cleanup
    - _Requirements: 8.7_
  - [ ] 13.2 Run a Run against a full disk and record the outcome and cleanup
    - _Requirements: 8.7_
  - [ ] 13.3 Start concurrent Runs and record the outcome and cleanup
    - _Requirements: 8.7_

- [ ] 14. E14: Review and commit the work
  - Open because the repository has no commits and none was made in this milestone. Committing the repository's own files is not Image_Distribution and is not gated.
  - [ ] 14.1 User reviews the changes and creates the first commit; record the commit hash in `docs/engine-feasibility.md`
    - _Requirements: 12.9_

- [ ] 15. E15: Checkpoint - Review go/no-go with the user
  - Walk through the Decision section of `docs/engine-feasibility.md`, `docs/release-decision.md` and the open tasks above. Ask the user if questions arise.
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 16. E16: Ask the maintainers about the engine build and licences
  - Open because the build revision and several licences cannot be found from public sources. This is a person task (email or issue), not code. Gate G1 and G3 depend on it.
  - [ ] 16.1 Ask the maintainers (`AUTHORS` names Chris Jackson) for: the SVN revision and toolchain that built the 3.2.3 Linux `libOpenBUGS.so`; the CpcBeautifier licence; whether TAUCS or other third-party code is linked; and whether "GPL v2" on the SourceForge page is stale. Record the question, the date and the answer (or no answer) in `docs/licensing-review.md`
    - _Requirements: 1.4, 11.1, 11.2, 11.3, 13.2, 13.4_

- [ ] 17. E17: Legal review of the licence position
  - Open because the r1018 statement is the maintainer's assertion and was not checked against each component. This is a person task. No legal review is recorded.
  - [ ] 17.1 Have a legal reviewer assess the r1018 statement against the BlackBox Open Source License conditions (notice reproduction, source-availability information) and the unknown CpcBeautifier terms; record the outcome in `docs/third-party-notices.md`
    - Depends on 16.1.
    - _Requirements: 11.3, 12.3, 13.3_

- [ ] 18. E18: Rebuild the image with the full licence set for any public distribution
  - Open because the original image shipped only the r1017 `COPYING`, `AUTHORS` and `NEWS` under `/opt/openbugs/licenses`, and the current Dockerfile still lacks several distribution requirements. This is a code and Dockerfile task. It depends on 9.1, 16.1, 17.1 and 19.1. Rebuilding locally is allowed. **No push, export or share of the rebuilt image may follow until 21.3 (the approved Decision-log row) exists.**
  - 2026-11-18 partial progress: new runtime images also include the full GPL v3 text copied from Debian. The r1018 clarification, BlackBox notice and matching source information remain absent; E18 stays open.
  - [ ] 18.1 Change `infra/openbugs/Dockerfile` so the image contains: the GPL v3 text, the r1018 `COPYING`, the BlackBox licence text, component notices, a source pointer or offer matched to the library build, the Debian `copyright` files, and pinned `apt` versions. Rebuild, then list `/opt/openbugs/licenses` in the built image and record the listing in `docs/evidence/`
    - _Requirements: 2.7, 11.2, 12.3, 13.3, 13.4_

- [ ] 19. E19: Decide and implement the Examples policy
  - Open because `doc/Examples`, `doc/GeoBUGS` and `doc/Reliability` have no licence marker and reproduce third-party datasets.
  - 2026-11-18 progress: the Dockerfile now excludes the complete upstream documentation and example tree from new runtime images. A local build and real-run tests passed. Keep the task open until the publication policy and legal review are complete; older local images still contain the tree.
  - [ ] 19.1 Either obtain written permission to redistribute `doc/Examples`, `doc/GeoBUGS` and `doc/Reliability`, or build the published image without them and make the runner read user-supplied inputs. Keep upstream example files out of git in both cases
    - Depends on 17.1.
    - _Requirements: 3.8, 11.4, 11.6, 13.3_

- [ ] 20. E20: Add the repository LICENSE (next milestone, not this one)
  - Belongs to the next milestone. Requirement 11.7 says this milestone's repository SHALL NOT contain a root `LICENSE`, so do not start this task until that milestone opens. It depends on 6.4 (the decision) and 17.1. Task 6.4 decides the licence; task 20.1 only implements the decision.
  - [ ] 20.1 After 6.4 is decided, add the root `LICENSE` file for ReproLab_Code and record the choice in `docs/third-party-notices.md`
    - This does not and cannot grant redistribution of any Upstream_Component. That permission is recorded per component in 6.5.
    - _Requirements: 11.5, 11.7, 11.9_

- [ ] 21. E21: Release gate for Image_Distribution
  - `docs/release-decision.md` currently has **NO approval row** and gates G1, G2, G3 and G4 are all UNMET. Nothing in `scripts/` or the Dockerfile pushes, tags, saves or exports the image (searched). The guard (21.1) and its tests (21.2) now exist; they enforce the block only where someone runs them, and no CI exists. The licence review is INCOMPLETE.
  - [x] 21.1 Build `scripts/release-guard.ps1`
    - Evidence: `scripts/release-guard.ps1` and `scripts/check-publish-paths.ps1` exist. The guard and the checker run only when someone runs them; the repository has no CI. Any publishing script must call the guard first (the checker flags a publish-style command without an earlier guard call).
    - Spec: takes an image digest. Exits non-zero unless `docs/release-decision.md` has an APPROVED Decision-log row whose image digest equals the digest given and whose G1, G2 and G3 evidence links are present. Also exits non-zero if the log is missing. It must not push, tag, save or export anything itself.
    - _Requirements: 13.1, 13.4, 13.6, 13.7, 13.9_
  - [x] 21.2 Test the guard with example cases and record the output in `docs/evidence/`
    - Evidence: `docs/evidence/release-guard-tests.txt` ends with `cases=39 failures=0`; the cases are in `scripts/tests/test-release-gate.ps1`. The synthetic GO fixture (F1, made-up digest `sha256:aaaa...`, temp directory) is a test fixture, not a release decision. The real `docs/release-decision.md` is unchanged by the tests (H1, same SHA-256 before and after) and still has no approval row (H2).
    - Cases: no row, NO-GO row, row for a different digest, valid row (use a temporary copy of the record, not the real file).
    - Depends on 21.1.
    - _Requirements: 13.9_
  - [ ] 21.3 PERSON TASK: add the APPROVED Decision-log row to `docs/release-decision.md`
    - Only after G1, G2 and G3 are met. The row names the date, the decider, the exact image digest and links to the G1, G2 and G3 evidence.
    - Depends on 6.1, 6.2, 6.3, 7.1, 9.1, 16.1, 17.1, 18.1, 19.1, 21.1 and 21.2.
    - _Requirements: 13.4, 13.5, 13.6_
  - [ ] 21.4 Re-verify the gate evidence if the image is rebuilt after 21.3
    - A new digest needs a new Decision-log row.
    - Depends on 21.3.
    - _Requirements: 13.8_
  - [ ]* 21.5 Write property test for the release guard
    - **Property 12: Release guard succeeds only for an approved digest**
    - **Validates: Requirements 13.9**

## Release Gate (blocking rules)

Image_Distribution means a registry push, release asset, download link, `docker save` or exported file given to someone, or a copy in a hosted image store. Local builds and local test Runs are not Image_Distribution. Task 9.2 and any future task that pushes, exports, releases or shares the image is blocked until every task in its row is done.

| Gated task | Blocked until these tasks are done |
|---|---|
| 9.2 Publish image | 6.1, 6.2, 6.3, 7.1, 9.1, 16.1, 17.1, 18.1, 19.1, 21.1, 21.2, 21.3 |
| 21.3 Approval row | 6.1, 6.2, 6.3, 7.1, 9.1, 16.1, 17.1, 18.1, 19.1, 21.1, 21.2 |
| 18.1 Rebuild with full licence set | 9.1, 16.1, 17.1, 19.1 |
| 19.1 Examples policy | 17.1 |
| 17.1 Legal review | 16.1 |
| 6.2 Library, BlackBox, CpcBeautifier terms | 16.1 |
| 6.4 Licence decision for ReproLab_Code | 17.1 |
| 6.5 Per-component permission record | 17.1 |
| 20.1 Add root LICENSE | 6.4, 17.1 |
| 21.2 Guard test | 21.1 |
| 21.4 Re-verify after rebuild | 21.3 |

Gates (from `docs/release-decision.md`): G1 provenance (7.1, 16.1), G2 licence obligations (6.1, 6.2, 6.3, 17.1, 18.1, 19.1), G3 matching source (16.1, 18.1, 9.1), G4 recorded decision (21.3). All four are UNMET at this revision. Task 14.1 (first commit) and task 20.1 are separate from 9.2 and do not unblock it.

The `blocked_until` field in the dependency graph below and this table are ADVISORY. Kiro reads only the `waves` array (evidence: `docs/evidence/kiro-blocked-until-check.txt`). Real enforcement is `scripts/release-guard.ps1` plus `scripts/check-publish-paths.ps1`, and only where they are run (no CI exists). Having tasks 21.1 and 21.2 done does not unblock anything: the real record has no approval row and 21.3 is open.

## Notes

- Tasks marked with `*` are optional.
- Checked tasks point to evidence; open tasks state why they are open.
- E6 to E14 and E16 to E21 are not code-only; they need a person, a second machine, the worker host or legal review. E18 and E21.1 are code tasks among them.
- The `blocked_until` field in the Task Dependency Graph is ADVISORY: Kiro reads only `waves` (`docs/evidence/kiro-blocked-until-check.txt`). Real enforcement is `scripts/release-guard.ps1` plus `scripts/check-publish-paths.ps1`, where they are run. The guard exists and is tested (`docs/evidence/release-guard-tests.txt`, 39 cases, 0 failures). The real decision record is still NO-GO with no approval row, every gate is UNMET, and 21.3 is open and not done by anyone.
- The licence review is INCOMPLETE. No document of this milestone may call it complete.
- Evidence files the reviewer opened for this correction: `docs/evidence/checks.txt`, `docs/evidence/summary.txt`, `docs/evidence/unit_tests_run.txt`, `docs/evidence/e2_image_and_help.txt`, `docs/evidence/e2b_uid_and_paths.txt`, `docs/evidence/no_public_upload_check.txt`, `docs/evidence/seeds-a/manifest.json` (engine_version `3.2.3 rev 1012`, image_digest `sha256:f65e2244...`), plus `infra/openbugs/Dockerfile`, `docs/engine-feasibility.md`, `docs/release-decision.md`, `docs/third-party-notices.md` and the headings of `docs/licensing-review.md`. Existence only was checked for the files in `docs/evidence/seeds-longburn/`.
- `docs/release-decision.md` holds the default NO-GO and an empty approval log. Its Enforcement section lists what exists (guard, path checker, tests) and what does not (CI, publish script).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["6.1", "7.1", "9.1", "12.1", "16.1", "21.1"] },
    { "id": 1, "tasks": ["6.2", "8.1", "12.2", "12.3", "12.4", "12.5", "12.6", "12.7", "12.8", "12.9", "12.10", "12.11", "12.12", "17.1", "21.2", "21.5"] },
    { "id": 2, "tasks": ["6.3", "10.1", "13.1", "19.1"] },
    { "id": 3, "tasks": ["6.5", "11.1", "13.2", "18.1"] },
    { "id": 4, "tasks": ["6.4", "13.3", "21.3"] },
    { "id": 5, "tasks": ["9.2", "14.1", "20.1", "21.4"] }
  ],
  "blocked_until": {
    "9.2": ["6.1", "6.2", "6.3", "7.1", "9.1", "16.1", "17.1", "18.1", "19.1", "21.1", "21.2", "21.3"],
    "21.3": ["6.1", "6.2", "6.3", "7.1", "9.1", "16.1", "17.1", "18.1", "19.1", "21.1", "21.2"],
    "18.1": ["9.1", "16.1", "17.1", "19.1"],
    "19.1": ["17.1"],
    "17.1": ["16.1"],
    "6.2": ["16.1"],
    "6.4": ["17.1"],
    "6.5": ["17.1"],
    "20.1": ["6.4", "17.1"],
    "21.2": ["21.1"],
    "21.4": ["21.3"]
  }
}
```

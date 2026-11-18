# Release decision record: OpenBUGS engine image

This file is the only place a decision to publish or distribute the OpenBUGS engine image can be recorded. It is engineering
record-keeping, **not legal advice**, and it does not claim the licence review is complete.

## Current status

**NO-GO. No release decision has been recorded.** Reassessed 2026-11-18 after reducing the runtime image to executables, library and notices. The guard script exists and blocks this record (see Enforcement). The licence review is **incomplete** (see `docs/licensing-review.md`,
section 6, and `docs/third-party-notices.md`).

This status is a project release gate for public redistribution of the Docker image. It does not say OpenBUGS lacks permission to be used, modified or redistributed under its GPL licence, and it does not block local building and use. The remaining checks concern compliance for this image's prebuilt engine library and bundled components.

## What counts as publishing or distributing

Any step that makes the image, its layers, or the OpenBUGS files in it available to anyone outside the machine that built it: a registry push (public or
private to other people), a release asset, a download link, `docker save` or an exported file given to someone, or a copy placed in a hosted service's image store.
Building and running the image locally for tests is not covered here. Running the engine on our own server and returning outputs to users is **not decided here**;
it needs its own review before any public launch.

## Gate conditions (all four must be met before a push, release asset or download)

| Gate | Condition | Status 2026-11-18 | Evidence now | What would satisfy it |
|---|---|---|---|---|
| G1 Provenance | The 3.2.3 tarball checksum matches a value from SourceForge (browser download) or the maintainer, and the build revision of the prebuilt `libOpenBUGS.so` is known | **UNMET** | `docs/licensing-review.md` section 3: 9 small files match upstream SVN r1018; library and docs have no upstream counterpart; SourceForge returned HTTP 403 to scripts | Task 7.1 and task 16.1 done and recorded |
| G2 Licence obligations | The v2/v3 conflict is resolved; the image carries the GPL v3 text, the r1018 `COPYING`, the BlackBox licence text and component notices; CpcBeautifier and TAUCS terms are answered; the Examples policy is implemented; Debian notices are kept; a legal review is recorded | **UNMET** | `docs/third-party-notices.md`; `docs/release-inventory.md`; the current Dockerfile excludes upstream examples and documentation and adds GPL v3 text to new runtime images, but r1018 `COPYING`, BlackBox notice and matching source information remain absent | Tasks 6.1 to 6.3, 17.1, 18.1, 19.1 done |
| G3 Matching source | A written source pointer or offer for `libOpenBUGS.so` names the SVN revision and toolchain that produced the distributed binary; Debian source offer or pinned package versions exist | **UNMET** | Build revision unknown; upstream `package.sh` says the library is built locally | Task 16.1 answer plus task 18.1 |
| G4 Recorded decision | An entry in the Decision log below names the date, the decider, the exact image digest, and links the evidence for G1 to G3 | **UNMET** | No entry | A person adds the entry after G1 to G3 are met (task 21.3) |

Rules while any gate is unmet: no script, CI job or document may push, tag for publication, export or share the image. A publication step must cite a Decision log entry here.

## Enforcement (what exists and what does not)

| Mechanism | State 2026-11-13 | Verified how |
|---|---|---|
| `scripts/release-guard.ps1 -ImageDigest sha256:<64 hex>`: fail-closed check of this file. Exit 0 only for an APPROVED row naming exactly that digest, with gates G1-G4 marked MET and G1-G3 evidence links to existing, non-empty files. Exit 1 blocked, exit 2 guard error (also blocked). Read-only: runs no docker, git or network command | Built (task 21.1). Tested with 39 cases (task 21.2) | `docs/evidence/release-guard-tests.txt`; run `scripts/tests/test-release-gate.ps1` |
| `scripts/check-publish-paths.ps1`: text check that any script, CI file or Kiro hook containing a publish-style command (docker push/save/export/login/tag, buildx --push, skopeo copy, gh release, ...) calls the guard on an earlier, non-comment line | Built. Real repository: no publish-style command exists | same test run, cases G1-G9 |
| A publishing script or workflow | **Does not exist.** None may be added without calling the guard first and citing a Decision log row | `check-publish-paths.ps1` |
| CI that runs the two checks on every change | **Does not exist** (the repository has no CI). Until it does, the checks run only when someone runs them | n/a |
| Kiro enforcement of the `blocked_until` field in `tasks.md` | **Not enforced.** Searched the installed Kiro (`resources/app/extensions/kiro.kiro-agent/dist/extension.js`): the dependency-graph parser requires only a `waves` array; `blocked_until` occurs nowhere in the installation. Treat it as advisory documentation | `docs/evidence/kiro-blocked-until-check.txt` |

Limits: both scripts are text checks. They cannot stop someone typing `docker push` by hand, and they do not replace the human review in G4. When an APPROVED row is added, the same change must set the gate statuses above to MET; otherwise the guard stays blocked, on purpose.

## Decision log

| Date | Decision | Decider | Image digest | Evidence for G1 | G2 | G3 | Notes |
|---|---|---|---|---|---|---|---|
| 2026-11-13 | **NO-GO** (assessment, not a release decision) | review session | local ID `sha256:f65e2244...b88f`, never pushed | partial | unmet | unmet | Reasons in `docs/release-inventory.md` GO / NO-GO |

No row above records approval. Add a new row only when all of G1 to G3 are met.

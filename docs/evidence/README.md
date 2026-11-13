# Evidence directory

Raw records behind `docs/engine-feasibility.md`, `docs/licensing-review.md` and `docs/release-decision.md`. Nothing here is an upstream OpenBUGS file.

- `seeds-*`, `bad-*`, `timeout-live`: log, script, manifest and container state of each engine run (engine output, our own generated script). CODA sample files and the upstream model, data and init files are **not** kept (gitignored under `runs/`); their SHA-256 values are in the manifests and in `input_hashes_upstream_examples.txt`.
- `checks.txt`, `comparisons*.txt`, `summary.txt`, `EVIDENCE.txt`, `unit_tests_run.txt`: test and comparison output. The pre-declared pooled comparison at 1,000 burn-in is a recorded FAIL.
- `licensing/`: measurements from the 2026-11-13 licence review (hashes, diffs, listings). Not legal advice.
- `image_f65e2244_id_u.txt`: `id -u` run in the final local image by full image ID.
- `release-guard-tests.txt`: results of `scripts/tests/test-release-gate.ps1`.
- `kiro-blocked-until-check.txt`: why `blocked_until` is advisory.
- `no_public_upload_check.txt`: search showing no upload or server code exists.

Edits made for publication, by hand, on 2026-11-13: local user names, local file-system paths and third-party e-mail addresses were replaced or removed; the upstream README, INSTALL, `package.sh` and manual prose that appeared in some probe outputs were cut and replaced by a bracketed note; two comparison header lines that had printed a local path now name the run. Hashes, numbers and conclusions were not changed.
Two files are older than the final image and say so inside: `e2_image_and_help.txt` (an earlier build) and `e2b_uid_and_paths.txt` (an earlier build); the current runtime check is `image_f65e2244_id_u.txt`.
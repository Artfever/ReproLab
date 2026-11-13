# OpenBUGS engine feasibility (spec 00-engine-feasibility)

Date of runs: 2026-11-13. Host: Windows 11, Docker Desktop 29.9.2 (linux/amd64 engine, WSL2). Everything below is
taken from files in `docs/evidence/`; nothing is estimated. Where a result is unflattering it is stated as such.

## Decision

**GO for the engine: the original OpenBUGS 3.2.3 binary runs the Seeds example on Linux x86-64, reproduces the
published summaries, fails visibly on invalid models, and can be killed on timeout.**

**NO-GO for publishing or distributing the engine image** (registry push, release asset or download), and NO-GO (blocked) for the public web runner, until the four gates in `docs/release-decision.md` are met (the licence review is incomplete; items are in `docs/release-inventory.md`): provenance of the prebuilt library is unproven, its corresponding source cannot be tied to the binary, the image lacks the full licence set, and the CpcBeautifier licence and Examples rights are unknown. Committing this repository's own files (no upstream bytes) is not blocked. The web runner also needs the isolation gate in the build plan tested on the real worker host. Two scientific caveats also apply (see "What the comparison does and does not show").

## E1. Provenance (spec requirement 1)

| Item | Value |
|---|---|
| Software | OpenBUGS 3.2.3, Linux source package ("OpenBUGS-3.2.3.tar.gz"), engine banner `OpenBUGS version 3.2.3 rev 1012` |
| Project page / stated licence | https://sourceforge.net/projects/openbugs/ (licence field: GPL v2) |
| Where the build fetches it | `https://raw.githubusercontent.com/chjackson/openbugsdoc/27abd6d1eca1bebddedb6ee7366eab7907727c01/OpenBUGS-3.2.3.tar.gz` (commit "Add OpenBUGS Linux package", 2024-12-04, repo `chjackson/openbugsdoc`, the archive of the OpenBUGS 3.2.3 documentation maintained by the Linux package maintainer) |
| SHA-256 | `a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8` (3,066,528 bytes; MD5 `196253b34ba07886ac9db0c734e31fbf`) |
| Licence inside the tarball | `COPYING` (identical to upstream r1017): "OpenBUGS may be modified and redistributed under the terms of the GPL version 3"; names BlackBox Component Builder and CpcBeautifier components. The tarball (dated 2014-03-06) **predates** upstream r1018 (2014-07-09, "Clarified licence of libOpenBUGS.so"), which appends that the library may be redistributed under GPL v3. `doc/Manuals/GNU-Licence.html` is GPL **v2** text |
| Build | `./configure --prefix=/opt/openbugs && make && make install` (from the tarball `README`); only a ~15 KB C wrapper (`src/OpenBUGSCli.c`, built with `-m32`) is compiled |
| Engine library | `lib/libOpenBUGS.so` is **prebuilt**, 32-bit Intel 80386 ELF, 3,090,092 bytes. Its source is Component Pascal in the Windows package and is not in this tarball |

**Authenticity (revised 2026-11-13, see `docs/licensing-review.md`).** The GitHub copy is **not labelled authentic**. What was checked against the upstream Subversion repository (https://svn.code.sf.net/p/openbugs/code/, r1018, scriptable): `AUTHORS ChangeLog Makefile.am NEWS README bin/OpenBUGS src/Makefile.am src/OpenBUGS.h src/OpenBUGSCli.c` are byte-identical to `cli/trunk`, and `COPYING` is byte-identical to r1017. That corroborates the package maintainer's origin but does not prove the file. The prebuilt `lib/libOpenBUGS.so` and the 1,500+ documentation files have no upstream counterpart I could reach: the SVN holds no built library or `doc/Examples|Manuals|...`, upstream `package.sh` says the library is built locally, and SourceForge returns HTTP 403 to scripted file listings, so no upstream checksum for 3.2.3 was obtainable. Upstream's own `OpenBUGS-3.2.1.tar.gz` (SHA-256 `bfbc43e3...9699`) is a different version. To close: download the 3.2.3 tarball in a browser from SourceForge and compare SHA-256, or ask the maintainer. Evidence: `docs/evidence/licensing/`, `docs/evidence/tarball_inspection.txt`.

## E2. Pinned Linux x86-64 environment (requirement 2)

- `infra/openbugs/Dockerfile`, two stages. Base `debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc`.
- Build stage: `gcc-multilib` + `libc6:i386`, downloads the tarball, **fails the build unless SHA-256 matches**, then configure/make/install.
- Runtime stage: `libc6:i386`, `python3-minimal`, `libpython3.11-stdlib` (the adapter), non-root uid 10001, `/work` volume.
- Build: `docker build --platform linux/amd64 -f infra/openbugs/Dockerfile -t reprolab-openbugs:3.2.3 .`
- Image used for the final evidence runs: `sha256:f65e2244463b5899308e9fd51361589de518f9a534fbc62d758e17277e76b88f` (local image ID, amd64). It was rebuilt from the Dockerfile after the last code edits. An earlier build (`sha256:787acefe...`) produced **byte-identical CODA files** for the same four Seeds runs, so output did not depend on the rebuild. Both are local IDs, not registry digests; nothing was pushed.
- `OpenBUGS --help` exits 0 and prints the usage text (`docs/evidence/e2_image_and_help.txt`). `OpenBUGSCli` banner: `OpenBUGS version 3.2.3 rev 1012`.
- `apt` package versions are not pinned (Debian point-release packages may change on a later rebuild). The base-image digest pins the base layer only.

## E3. Seeds fixture and generated script (requirement 3)

The model, data and both initial-value files were **not copied into the repository**. The run reads the files
shipped inside the image at `/opt/openbugs/share/doc/openbugs-3.2.3/Examples/` (`Seedsmodel.txt`, `Seedsdata.txt`,
`Seedsinits1.txt`, `Seedsinits2.txt`), which avoids redistributing upstream files before the licence is settled.
SHA-256 of the originals: `docs/evidence/input_hashes_upstream_examples.txt`.

- Data: 21 plates (`N = 21`), model: random-effects logistic regression, monitored `alpha0 alpha1 alpha2 alpha12 sigma`.
- Chain 1 inits: all `alpha* = 0`, `tau = 1`, `b = 0`. Chain 2 inits: all `alpha* = 10`, `tau = 0.1`, `b` non-zero. Two separate files, one per chain.
- Generated script (`docs/evidence/seeds-a/script.txt`): `modelSetWD`, `modelCheck`, `modelData`, `modelCompile(2)`, `modelSetRN(1)`, two `modelInits`, `modelUpdate(burn-in)`, `samplesSet` x5, `modelUpdate(10000,1)`, `samplesStats('*')`, `samplesCoda('*','coda_')`, `modelQuit('yes')`.
- Invocation (argument list, no shell): `/opt/openbugs/bin/OpenBUGS -t script.txt`, stdout to `log.txt`, stderr to `stderr.txt` (empty in all runs).
- Container flags: `--network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1024m --cpus 1 --tmpfs /tmp`, user 10001.

**Linux-specific findings that cost time and are now in the code:**
1. `modelDisplay('log')` is **not a valid command** in the Linux build (`unknown script command`); the log always goes to stdout, as the manual says.
2. With the work directory on a **Windows bind mount**, `modelCheck` died with `Sorry something went wrong in procedure Reader.SetPos in module HostFiles`; on container-local storage the same files work. Runs therefore use a Docker volume and `docker cp` the results out (`scripts/run-container.ps1`).
3. The engine returns **exit code 0 even for invalid models** (see E5). Success is decided from the log, not from the exit status.

## E4. Runs and comparison (requirement 4)

All runs: 2 chains, 10,000 samples after burn-in, `modelSetRN(1)` unless noted. Numbers below are from the final end-to-end run (`docs/evidence/checks.txt`, 19 of 19 checks passed). Runtime = engine process wall time from the manifest; it varied by about 5% between the first and final run (2.022 s vs 1.921 s for seeds-a) while the samples were identical.

| Run | Burn-in | Seed | Status | Engine runtime | Evidence |
|---|---|---|---|---|---|
| seeds-a | 1,000 | 1 | succeeded | 1.921 s | `docs/evidence/seeds-a/` |
| seeds-b | 1,000 | 1 | succeeded | 1.921 s | identical CODA files to seeds-a |
| seeds-c | 1,000 | 2 | succeeded | 1.920 s | different CODA files from seeds-a |
| seeds-longburn | 20,000 | 1 | succeeded | 5.132 s | `docs/evidence/seeds-longburn/` |

**Reproducibility.** seeds-a and seeds-b give byte-identical `coda_CODAchain1.txt`, `coda_CODAchain2.txt`, `coda_CODAindex.txt` and `log.txt`
(SHA-256 `c8c5db54...`, `f18c7189...`). Seed 2 gives different files. Only `script.txt` differs between a and b, because the work-directory name differs.
This shows determinism for one image on one machine. It does not show cross-machine identity.

**Published baseline.** `services/runner/reference/seeds_published.json`: mean, sd, MC_error for the five nodes, **read by eye from the results
image (`seeds3.bmp`) in the OpenBUGS 3.2.3 `Seeds.html` example page** ("burn in of 1000 updates followed by a further 10000 updates", start 1001, sample 10000).
The page does not say how many chains produced it. Transcription errors are possible.

**Tolerance, fixed before looking at results:** `|mean - ref_mean| <= 4 x ref_MC_error` and `|sd - ref_sd| <= 10% of ref_sd`, computed by ReproLab code
from the exported CODA samples (not from the engine's printed table).

| Comparison | Result |
|---|---|
| seeds-a, pooled 2 chains, burn-in 1,000 (the pre-declared test) | **FAIL**, all 5 nodes. e.g. alpha0 mean 0.028 (ref -0.550), sd 1.776 (ref 0.197); sigma mean 2.316 (ref 0.292) |
| seeds-c, pooled, burn-in 1,000 | **FAIL**, all 5 nodes |
| seeds-a, chain 1 only (post hoc) | pass, 5/5. alpha0 -0.5466 (ref -0.5499), sigma 0.2854 (0.2922) |
| seeds-a, chain 2 only (post hoc) | fail. alpha0 mean 0.603, sd 2.369; sigma mean 4.346, sd 7.972 |
| seeds-c, chain 1 only / chain 2 only (post hoc) | chain 1 pass 5/5; chain 2 fail |
| **seeds-longburn, pooled 2 chains, burn-in 20,000** | **PASS, 5/5** (`docs/evidence/seeds-longburn/compare_pooled.json`) |

seeds-longburn, pooled, ReproLab-computed vs published: alpha0 -0.5538 vs -0.5499 (sd 0.1962 vs 0.1965); alpha1 0.0813 vs 0.0890 (0.3193 vs 0.3124);
alpha12 -0.8114 vs -0.8410 (0.4365 vs 0.4372); alpha2 1.3478 vs 1.3560 (0.2749 vs 0.2772); sigma 0.2861 vs 0.2922 (0.1450 vs 0.1467).
The largest mean difference (alpha12, 0.0296) is 85% of its tolerance (0.0349).

### What the comparison does and does not show

- The first run did **not** match. Chain 2 starts at `alpha = 10`; with 1,000 burn-in updates its early iterations are still in the sample and inflate the pooled mean and sd. With 20,000 burn-in the pooled output matches.
- **I chose the 20,000 burn-in after seeing the 1,000 burn-in fail.** The pass at 20,000 is therefore a diagnosis-driven re-run, not an independent confirmation. The settings that reproduce the published table's *numbers* are not the settings the page states for it, and the published page most likely used one chain (its sample count equals one chain's 10,000).
- Matching published means and sds supports "this engine build produces the same posterior summaries on this example". It does not prove convergence in general, and ReproLab has no validated convergence diagnostic. No convergence claim is made.
- Differences of a few hundredths remain (e.g. alpha12 -0.811 vs -0.841), consistent with Monte Carlo error but not tested beyond the tolerance above.
- The comparison is one example, one machine, one image.

## E5. Error capture, timeout, cleanup (requirement 5)

| Case | Engine exit code | Adapter status | Real log evidence |
|---|---|---|---|
| `examples/openbugs/invalid/bad_syntax_model.txt` | **0** | `failed` | `expected right parenthesis error pos 58 (error on line 4)` followed by a cascade of `model must be ...` lines |
| `examples/openbugs/invalid/undefined_node_model.txt` | **0** | `failed` | `variable gamma_missing is not defined` (and `data loaded (variables not in the model: x2)`) |
| Seeds with `--timeout 3`, 50,000+40,000 updates (timeout-live) | killed | `timed_out` after 3.001 s | log stops after `model is initialized`; container state `exited`, `OOMKilled: false` |

- Exit code 0 on invalid models means any exit-status-only check would report success. The adapter requires an ordered set of success messages and refuses known error patterns.
- Cleanup: after all runs `docker ps -a --filter name=rl-` is empty and no run volumes remain (`docker rm -v`). Work directories exist only in the container volume.
- Not tested: out-of-memory kill, disk-full, concurrent runs, process-tree kill beyond the engine's own process group, `ulimit`-style limits inside the container.

## Tests actually executed

- `python3 -m unittest discover -v -s tests` in `services/runner` (WSL Ubuntu 24.04, Python 3.12.3): **14 tests, all OK** (`docs/evidence/unit_tests_run.txt`). They cover script generation (including no `modelDisplay`/`modelSaveLog`) and injection rejection, input validation, clean errors for a missing input and an existing output directory, classification against the *real* success/failure log text, CODA parsing, tolerance logic, a manifest JSON round trip (including script text and seed) and manifest-write failure, and a fake-engine timeout. They are example-based; no property-testing library is installed.
- `scripts/feasibility-e2e.ps1`: rebuilds the image, runs all 7 cases against the real engine, runs 5 comparisons in the container and asserts the outcomes above. Result: **19 of 19 checks PASS** (`docs/evidence/checks.txt`, `docs/evidence/summary.txt`). The checks include the expected failures (pre-declared pooled comparison at burn-in 1,000, chain 2 alone, seed 2 pooled), so "PASS" there means "behaved as documented", not "matched the published table".
- Not run: any browser/UI test (out of scope), CI, the image on a second machine, a rebuild from scratch on another host.

## Repeat the test (another developer)

Requirements: Docker with a linux/amd64 engine and PowerShell (or translate `scripts/run-container.ps1`). Python 3 is needed only for the unit tests. Everything in one command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/feasibility-e2e.ps1` (about 3 minutes here). Step by step:

```powershell
docker build --platform linux/amd64 -f infra/openbugs/Dockerfile -t reprolab-openbugs:3.2.3 .
$ex = '/opt/openbugs/share/doc/openbugs-3.2.3/Examples'
$a = "run|--model|$ex/Seedsmodel.txt|--data|$ex/Seedsdata.txt|--inits|$ex/Seedsinits1.txt|$ex/Seedsinits2.txt|--monitor|alpha0|alpha1|alpha2|alpha12|sigma|--burn-in|20000|--samples|10000|--seed|1|--timeout|300|--out|/work/seeds-longburn"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-container.ps1 -Name seeds-longburn -RunnerArgs $a
cd services/runner
python3 -m reprolab_runner.cli compare --dir ../../runs/seeds-longburn --reference reference/seeds_published.json   # exit 0 = within tolerance
python3 -m unittest discover -v -s tests
```

`-ExecutionPolicy Bypass` applies to that one process only (this machine blocks unsigned scripts by default).
Expected from the engine log for that run: `OpenBUGS version 3.2.3 rev 1012` ... `Node statistics` with `alpha0 -0.5538 0.1962`. Because the engine is deterministic for a fixed seed, CODA hashes should match
`docs/evidence/seeds-longburn/manifest.json` if the image is equivalent; if they differ on another machine, record that rather than assume an error.

## Uncertainty and open items

1. The tarball is partly corroborated against upstream Subversion but its checksum, and the prebuilt library, are not verified against any upstream-published value (E1; `docs/licensing-review.md` section 3).
2. Licence: `COPYING` and upstream say GPL v3; the package's own legal link and the SourceForge page say v2; the tarball lacks upstream's r1018 clarification; the library's build revision is unknown; CpcBeautifier and example-data terms are unknown. Publishing the image is NO-GO (`docs/release-inventory.md`).
3. The published baseline was transcribed from a bitmap by eye.
4. `apt` packages are not pinned; the image is not pushed to a registry, so there is no registry digest.
5. Isolation: `--network none`, read-only root, dropped capabilities and cgroup limits were used on Docker Desktop. This is not a per-job sandbox test on the intended production host, so public custom uploads stay disabled.
6. The engine library file in the tarball is dated 2014-03-06; I did not check whether OpenBUGS is still maintained. Long-term support risk is unassessed.
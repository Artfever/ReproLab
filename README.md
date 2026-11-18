# ReproLab

ReproLab runs a supported old analysis with its original engine on your own computer, shows the real log and output files, and records what ran. The first engine is OpenBUGS 3.2.3, run in a local Docker container.

A finished run is not a scientific finding. ReproLab only reports what the engine produced.

Source: https://github.com/Artfever/ReproLab

## What this is and is not

| It is | It is not |
|---|---|
| A local tool. A small Node server on `127.0.0.1` and a plain web interface in `apps/local`. | A hosted service. There is no public site that runs models. |
| A runner for OpenBUGS 3.2.3 inside a Docker image you build yourself. | A place to upload arbitrary programs. Only OpenBUGS model, data and initial-value text is accepted, with size and range limits. |
| A recorder: logs, CODA output files with SHA-256 hashes, and a run manifest. | A validator. It does not judge convergence, correctness or medical meaning. |
| A documentation assistant that is off unless you configure a language model. | An analyst. It cannot approve, change or interpret a result. |

### Product scope and licence

The project owner authorizes reuse, modification and redistribution of ReproLab-authored code under the MIT terms in [`LICENSE`](LICENSE). OpenBUGS 3.2.3 is included in ReproLab's local execution stack as its third-party inference engine. The repository contains the adapter, runner, interface and tests; judges build the Docker image locally from their own OpenBUGS archive. OpenBUGS keeps its own licence and notices; see [`docs/third-party-notices.md`](docs/third-party-notices.md).

OpenBUGS licence references for judges: the 3.2.3 archive includes `COPYING` with GPLv3 terms, and the upstream [r1018 `COPYING` file](https://sourceforge.net/p/openbugs/code/HEAD/tree/cli/trunk/COPYING) clarifies redistribution of `libOpenBUGS.so`.

### Test the real OpenBUGS engine

Judges can build the local image from their own OpenBUGS 3.2.3 archive, then try the built-in Coin model and the deliberate syntax-error model from the Run page. The first exercises a successful inference; the second shows the real engine reporting an invalid model. The Seeds example can also be run with input files extracted from the judge's own archive. The full setup starts below.

ReproLab does not modify legacy software to remove its need for OpenBUGS. It preserves and records a legacy analysis by running it with the original engine. The optional AI documentation assistant is a separate feature: it is off by default, uses a provider configured by the user, and does not assess scientific validity.

ReproLab's own example models are in `examples/reprolab/`. The OpenBUGS Seeds files are not in this repository. You extract them from your own tarball (see "Seeds run").

## Prerequisites

| Need | Version | Notes |
|---|---|---|
| Node.js | 24.x | `apps/local` has no npm dependencies. |
| Docker | Docker Desktop with WSL2 (Windows), or Docker Engine (Linux) | Must be running. The image targets `linux/amd64`. |
| Git | any recent | |
| Python | only inside the image | You do not need it on your computer. |
| PowerShell | Windows PowerShell 5.1 or later | For the `.ps1` scripts. Linux uses the `.sh` scripts (bash, `tar`, `sha256sum`). |

On Windows, run every script as `powershell -ExecutionPolicy Bypass -File scripts\<name>.ps1`. This avoids the default script-execution policy.

## Manual step: get the OpenBUGS tarball yourself

> **You must download this file yourself, in a web browser.**
>
> 1. Open the OpenBUGS project page on SourceForge and download the **OpenBUGS 3.2.3 Linux source package** (`OpenBUGS-3.2.3.tar.gz`) in your browser.
> 2. Save it as `vendor/OpenBUGS-3.2.3.tar.gz` inside your clone. Create the `vendor/` folder if it does not exist.
>
> SourceForge refuses scripted downloads (the maintainers got HTTP 403 from scripts), so no script here can fetch it from SourceForge. SourceForge publishes no checksum we could verify against, and this README invents none.
>
> `vendor/` is git-ignored. Never commit the tarball.

The build script prints the SHA-256 of your file next to this value and stops if they differ:

```
a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8
```

This is **the copy we tested, not a checksum published by upstream.** It is the hash of the one file the maintainers built and tested with. A mismatch means your file is not byte-identical to that copy. It does not by itself mean your file is wrong or unsafe, and a match does not prove the file is authentic upstream code.

Optional convenience, off by default: `build-image` has a flag (`-FetchMirror` on Windows, `--fetch-mirror` on Linux) that downloads a copy from a GitHub mirror (`chjackson/openbugsdoc`). That copy is an unauthenticated mirror copy, not upstream-verified. The mirror is not the upstream project. Prefer the browser download.

## Quick start

```powershell
git clone https://github.com/Artfever/ReproLab.git
cd ReproLab
```

Put the tarball at `vendor/OpenBUGS-3.2.3.tar.gz` (previous section), then build the image and start the server.

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-image.ps1
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

Linux:

```bash
scripts/build-image.sh
scripts/start.sh
```

Then open http://127.0.0.1:8765/.

About the tag. Both `build-image` and `apps/local` use `reprolab-openbugs:3.2.3-vendored` by default, so you pass no tag. To use another tag, pass it to `build-image` (`-Tag` on Windows, `--tag` on Linux) and set the environment variable `REPROLAB_IMAGE` to the same tag before `start`.

What `build-image` does: it checks that the tarball exists, prints both SHA-256 values, stops on a mismatch, then runs `docker build` with `infra/openbugs/Dockerfile`. Only Debian package downloads use the network during the build. The runtime image contains the OpenBUGS executables, library, notices copied from the tarball, and Debian's GPL v3 text; it does not include upstream documentation or examples. It never pushes or saves the image. Build time depends on your machine.

What `start` does: it checks Node 24.x (a wrong version stops it), Docker and the image (only warns, with the exact fix), then starts `apps/local` on `127.0.0.1`. To check without starting:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -CheckOnly
```

```bash
scripts/start.sh --check-only
```

`npm start` inside `apps/local` starts the server too, without the prerequisite checks.

Environment variables read by the server and scripts:

| Variable | Default | Meaning |
|---|---|---|
| `REPROLAB_PORT` | `8765` | Port on `127.0.0.1`. The bind address cannot be changed; any attempt to set one is refused. |
| `REPROLAB_IMAGE` | `reprolab-openbugs:3.2.3-vendored` | Docker image tag used for runs. |
| `REPROLAB_NODE`, `REPROLAB_DOCKER` | `node`, `docker` | Executables used by the start and reset scripts. |
| `REPROLAB_LLM_BASE_URL`, `REPROLAB_LLM_MODEL`, `REPROLAB_LLM_API_KEY` | unset | Assistant setup (below). |

## Sample runs

### 1. Coin (known answer)

On the **Run** page choose "Coin (ReproLab example, known answer)" and submit. This is ReproLab's own toy model: 7 successes in 10 flips with a uniform prior, so the exact posterior is Beta(8, 4) with mean 0.6667 and sd about 0.1307. See `examples/reprolab/coin/README.md`.

Recorded output (`docs/evidence/local-product/m2-coin-run.json`): state `succeeded`, engine version `3.2.3 rev 1012`, CODA files listed with SHA-256. Recorded accuracy check (`docs/evidence/local-product/coin-check.txt`, 2 chains, burn-in 1000, 10000 samples, seed 1): sampled mean 0.66862 and sd 0.12978, both inside the 0.01 tolerance fixed before the first run. This compares one Monte Carlo summary with a closed-form value for a toy model. It says nothing about any other model.

### 2. Coin with a deliberate syntax error

Choose "Coin with a deliberate syntax error". Expected result: state `engine_error`, with the engine's own message from the log shown as the reason. This confirms that failures are reported as failures.

### 3. Seeds, from your own tarball

The Seeds example comes from the OpenBUGS examples. It is not redistributed here. Extract the four files you need from the tarball you downloaded. Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\extract-seeds.ps1 -Tarball vendor\OpenBUGS-3.2.3.tar.gz
```

Linux:

```bash
scripts/extract-seeds.sh vendor/OpenBUGS-3.2.3.tar.gz
```

The script lists the archive, extracts only `Seedsmodel.txt`, `Seedsdata.txt`, `Seedsinits1.txt` and `Seedsinits2.txt` to a temporary folder, compares each SHA-256 with `docs/evidence/input_hashes_upstream_examples.txt`, and copies them to `local-data/upstream/` only if all four match. On any mismatch or missing member it deletes what it extracted and exits 1. After success, reload the Run page and choose "Seeds (your own upstream copy)".

**Read this before you trust the Seeds output.** Seeds is a historical example. The maintainers' pre-declared comparison of the pooled two-chain run against the published reference values **failed** for all five monitored nodes (`alpha0`, `alpha1`, `alpha2`, `alpha12`, `sigma`). A comparison of chain 1 alone, decided after seeing the results (post hoc), was inside tolerance. Chain 2 was not. The same seed reproduced identical files, and a different seed produced different files. The full numbers are in `docs/evidence/comparisons_seeds-a_seeds-c.txt`, and the public static page in `apps/web` shows the comparison first. ReproLab does not claim to know why. Do not present a Seeds run from this tool as a reproduction of the published values.

## Assistant setup and honest status

The assistant answers questions about ReproLab and about one finished run, using only the documents in `docs/assistant/` and that run's log and manifest. Each answer must cite a retrieved passage or it is rejected. Questions it cannot support are declined with a fixed message, and questions about whether a result is valid or converged are declined without calling the model. It is disabled unless you configure it. No model is bundled.

Local model through Ollama (no key):

```powershell
$env:REPROLAB_LLM_BASE_URL = "http://127.0.0.1:11434/v1"
$env:REPROLAB_LLM_MODEL = "llama3.2:3b"
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

```bash
REPROLAB_LLM_BASE_URL=http://127.0.0.1:11434/v1 REPROLAB_LLM_MODEL=llama3.2:3b scripts/start.sh
```

Or your own OpenAI-compatible endpoint: set the same two variables, plus `REPROLAB_LLM_API_KEY` in your own environment. Never put a key in a file in this repository. When enabled, your question and the retrieved passages are sent to that endpoint. See the Privacy page.

**Honest status:**

- A real model was exercised **once**: Ollama with `llama3.2:3b`, through the HTTP API, on a failed run (`docs/evidence/local-product/assistant-real.txt`).
- **Answer quality was weak.** The model said the cause was "unclear" and did not quote the log line `variable nn is not defined`, yet its answer was shown because it cited a valid retrieved passage. The server checks that citations exist, not that an answer is useful.
- The first request timed out after 60 s while the 3B model loaded on a CPU-only machine.
- An off-topic question was declined before any model call.
- The path where the server rejects a bad model answer was not seen with a real model. It is tested only with a fake provider.
- The three-question session through the browser interface was not done. Other models are untried.
- The unit tests use a fake provider (`apps/local/tests/helpers/fake-provider.mjs`), not a real model.

## Tests

```powershell
cd apps\local
npm.cmd test
```

`npm test` runs `node --test "tests/**/*.test.mjs"`. It includes a journey test that runs the real image. If Docker or the image is missing, Docker-dependent tests print `SKIPPED: ...` and skip; a passing exit code alone does not prove an engine run. A recorded full run passed 208 tests, none skipped (`docs/evidence/local-product/test-journey.txt`). In a fresh clone, the Seeds sub-test also skips until you have run `extract-seeds` (see "Seeds, from your own tarball"). When Docker is available, the coin accuracy test (`tests/coin-check.test.mjs`) rewrites the tracked file `docs/evidence/local-product/coin-check.txt` with its new numbers, so `git status` may show that file as modified after `npm test`. Discard it with `git checkout -- docs/evidence/local-product/coin-check.txt` if you do not want the change.

Other checks:

```powershell
# Static public site in apps/web
cd apps\web
npm.cmd ci
npm.cmd run check

# Runner unit tests inside the image (no network)
docker run --rm --network none -v "${PWD}/services/runner:/runner-src:ro" -w /runner-src --entrypoint python3 reprolab-openbugs:3.2.3-vendored -B -m unittest discover -v -s tests

# Release guard and publish-path checks
powershell -ExecutionPolicy Bypass -File scripts\tests\test-release-gate.ps1
powershell -ExecutionPolicy Bypass -File scripts\check-publish-paths.ps1
powershell -ExecutionPolicy Bypass -File scripts\tests\test-extract-seeds.ps1

# Repository hygiene
node scripts/audit-tracked.mjs
node scripts/check-license.mjs
```

Run the Docker command from the repository root. On Linux use `$(pwd)` instead of `${PWD}` and `npm` instead of `npm.cmd`.

`audit-tracked.mjs` fails if the repository tracks tarballs, binaries, `vendor/`, `local-data/` or a top-level folder named runs, upstream example files with a listed hash, credential-looking text, machine user paths, or files over 5 MiB. `check-license.mjs` compares `LICENSE` with the SPDX MIT template and prints `MIT OK`.

## Expected outputs

- `start -CheckOnly` on a ready machine: `OK` lines for Node.js, Docker and the image, then `Check only: nothing started. The server would listen on http://127.0.0.1:8765/`.
- `GET http://127.0.0.1:8765/api/health`: `{"ok":true,"docker":"ok","image":"present","imageId":"sha256:..."}`.
- A coin run ends in `succeeded` in a few seconds. Results list `coda_CODAchain1.txt`, `coda_CODAchain2.txt`, `coda_CODAindex.txt`, the inputs, `log.txt` and a manifest, each with size and SHA-256. A summary table appears with a label saying it is computed from the samples.
- The invalid model ends in `engine_error`. A run that exceeds its time limit ends in `timed_out`.
- `extract-seeds` success prints four `MATCH` lines and `OK: four Seeds files matched ...`.

Run states: `running`, `succeeded`, `engine_error`, `timed_out`, `runner_error`. Success is never inferred from an exit code alone. Documented in `docs/assistant/states.md`.

## Limitations

- One run at a time. A second submit is refused while one is running.
- Limits (`apps/local/src/validate.mjs`): burn-in 0 to 50000, samples 1 to 50000, thin 1 to 100, seed 1 to 14, time limit 1 to 300 s, 1 to 4 chains, at most 25 monitored names, ASCII text only, size caps on each file.
- Containers run with no network, no host mounts and resource limits. The server binds only to `127.0.0.1` and checks `Host` and `Origin`.
- Run data lives in `local-data/runs/` on your computer. Nothing is uploaded by ReproLab. Only the optional assistant calls the endpoint you configure.
- Supports Docker Desktop with WSL2 and Linux Docker Engine. Other setups are untested.
- The summary table is computed from CODA samples and is labelled so. It does not include convergence diagnostics.
- OpenBUGS 3.2.3 is required for local model execution. The judge setup above builds and tests it locally; licence references and third-party notices are in `docs/third-party-notices.md`.

## Troubleshooting

| Symptom | What to do |
|---|---|
| `start` prints `WARN  Docker: installed but not running` | Start Docker Desktop (or the Docker service) and wait until it reports running. Pages open without it, but runs fail. |
| `WARN  Image: reprolab-openbugs:3.2.3-vendored is not present` | Build it (Quick start). Check the tag matches `REPROLAB_IMAGE`. |
| `build-image` says `vendor/OpenBUGS-3.2.3.tar.gz is missing` | Do the manual browser download and place the file there. |
| `build-image` says `MISMATCH` | Your file is not byte-identical to the copy we tested. Download it again in the browser. Nothing was built. |
| Port in use | Set `REPROLAB_PORT` to a free port, then start again. The address stays `127.0.0.1`. |
| `FAIL  Node.js ... needs Node 24.x` | Install Node 24 and open a new terminal. |
| Script blocked on Windows | Use `powershell -ExecutionPolicy Bypass -File ...`. |
| A file seek error from the engine | The engine library cannot seek on a Windows bind mount (recorded in `docs/engine-feasibility.md`). `apps/local` therefore copies inputs into a container and results out with `docker cp`, and mounts no host folder. If you change the Docker commands or run the runner by hand, keep the working folder on container-local storage, not a host bind mount. |
| Run says `runner_error` | Read the reason on the Results page. It states whether Docker, the image or the manifest was the problem. |

## Quick reset

```powershell
powershell -ExecutionPolicy Bypass -File scripts\reset-local.ps1
```

```bash
scripts/reset-local.sh
```

Add `-DryRun` (Windows) or `--dry-run` (Linux) to see what would be removed. The script removes `local-data/runs`, `local-data/tmp` and containers labelled `reprolab.run`. It leaves `local-data/upstream`, your `vendor/` tarball and every tracked file alone.

## How Kiro shaped this

ReproLab was built with Kiro using specs, steering and checks that live in the repository under `.kiro/`.

- **Specs** in `.kiro/specs/`: `00-engine-feasibility` (can the engine run in a container, and what is the licence situation), `01-web-mvp` and `01-end-to-end-web-run` (the static comparison-first site and the run path), `02-grounded-assistant` (citation-checked answers), and `03-local-product` (this local tool, including requirements, design and tasks).
- **Steering** in `.kiro/steering/`: `product.md`, `engineering.md`, `security-and-privacy.md`, `scientific-integrity.md`, `open-source.md`. They set rules such as "do not fabricate results", "every claim about a run needs a real log line" and "no arbitrary executable upload".
- **Hook**: `.kiro/hooks/validate-on-save.json` defines a check after saving TypeScript files. It is currently disabled (`"enabled": false`) pending a test in the installed Kiro.
- **Task evidence**: each task in `.kiro/specs/*/tasks.md` names an acceptance check. Outputs are saved in `docs/evidence/` and `docs/evidence/local-product/`, and task boxes are ticked only after that evidence exists.

## Repository map

| Path | Contents |
|---|---|
| `apps/local/` | Local Node server (`src/`), plain web interface (`public/`), assistant (`assistant/`), tests (`tests/`). No npm dependencies. |
| `apps/web/` | Static Next.js site with the recorded Seeds comparison. Hosts no engine. |
| `services/runner/` | Python runner and CODA parsing used inside the image, with unit tests. |
| `infra/openbugs/` | Dockerfile for the local OpenBUGS image. |
| `examples/reprolab/` | ReproLab-authored coin models. |
| `examples/openbugs/invalid/` | Small invalid-model examples. |
| `docs/assistant/` | The documents the assistant retrieves from. |
| `docs/evidence/` | Recorded outputs: feasibility runs, comparisons, licensing evidence, `local-product/` task evidence. |
| `docs/*.md` | Setup, engine feasibility, third-party notices, assistant help, demo and judge guidance. |
| `scripts/` | `start`, `reset-local`, `build-image`, `extract-seeds` (`.ps1` and `.sh`), `check-license.mjs`, `audit-tracked.mjs`, and `tests/`. |
| `.kiro/` | Specs, steering and hook. Tracked on purpose. |
| `vendor/`, `local-data/` | Git-ignored. Your tarball and your run data. |

## Licence

MIT for ReproLab-authored code. See "Product scope and licence" above and `docs/third-party-notices.md`.

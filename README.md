# ReproLab

ReproLab runs a supported old analysis with its original engine on your own computer, shows the real log and output files, and records what ran. The first engine is OpenBUGS 3.2.3, run in a local Docker container.

A finished run is not a scientific finding. ReproLab only reports what the engine produced.

### Build the eight additional engine images

The **Run** page lists OpenBUGS, PyMC 2, Caffe, Theano, Chainer, QIIME 1, TopHat2, Cufflinks and NiftyNet. The app probes the corresponding local image before showing it as Ready. See the [verification ledger](.kiro/specs/04-multi-engine/tasks.md) for completed browser journeys and remaining work.

Build OpenBUGS using [Quick start](#quick-start). Build the other CPU images from the repository root, one at a time. Both loops report failures and continue with the remaining engines.

Windows (PowerShell):

```powershell
foreach ($engine in 'pymc2','caffe','theano','chainer','qiime1','tophat2','cufflinks','niftynet') {
    docker build --platform linux/amd64 --target $engine -t "reprolab-${engine}:cpu-v1" infra/engines
    if ($LASTEXITCODE -ne 0) { Write-Warning "Build failed for $engine" }
}
```

Linux (Bash):

```bash
for engine in pymc2 caffe theano chainer qiime1 tophat2 cufflinks niftynet; do
    docker build --platform linux/amd64 --target "$engine" -t "reprolab-${engine}:cpu-v1" infra/engines ||
        printf 'Build failed for %s\n' "$engine" >&2
done
```

Docker stores its image layers and build cache on its configured data disk. Check physical free space as well as `docker system df`. The eight fixture workers use the Linux amd64 CPU path and run with one CPU, a 1 GiB memory cap, up to 128 processes, and a 120-second engine budget plus time for collection. Use the existing OpenBUGS form for uploads. The other workers accept only their built-in cases, with an additional TopHat2 run ID field for the Cufflinks linked case.

On Results, execution status and comparison are shown separately. Download artifacts individually, use the JSON bundle for outputs and rerun metadata, or choose **Metadata only**. Choose **Include local input files** to add the OpenBUGS input bytes. JSON bundle file contents are base64 encoded. To reproduce Cufflinks linked mode, first run the TopHat2 demonstration and use its run ID.

To repeat the browser check, follow [Verify on a second machine](#verify-on-a-second-machine).

The [verification evidence](docs/evidence/multi-engine.md) includes an optional native Ollama GPU benchmark. The app's engine workflows use CPU. To keep your historical OpenBUGS accuracy evidence intact when running the local tests, set `REPROLAB_COIN_EVIDENCE` to an output path under the ignored `local-data` directory before running the suite.

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
| Python | 3.12 tested for browser verification | The app and manual runs need no host Python. The automated browser check needs host Python, Playwright and Google Chrome. |
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
Copy-Item .env.example .env
```

On Linux, use `cp .env.example .env`. Leave the keys blank for engine verification. Add your own keys if you want to test the optional assistant or voice input. Git ignores `.env`.

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
| `CHAT_MODEL`, `GEMINI_API_KEY` | `gemini-3.5-flash-lite`, key unset | Optional text assistant. Gemini API key is required to enable it. |
| `CHAT_BASE_URL` | Gemini OpenAI-compatible endpoint | Optional override for another OpenAI-compatible chat endpoint. |
| `STT_MODEL`, `GROQ_API_KEY` | `whisper-large-v3`, key unset | Optional voice transcription. Groq API key is required to enable it. |
| `REPROLAB_LLM_BASE_URL`, `REPROLAB_LLM_MODEL`, `REPROLAB_LLM_API_KEY` | unset | Backward-compatible chat settings; `CHAT_*` settings take precedence. |

## Verify on a second machine

Use a separate x86-64 Windows machine with Docker Desktop and WSL2, or a separate x86-64 Linux machine with Docker Engine. The full suite was verified on Windows 11 with WSL2 and Linux amd64 containers. The second-machine check is open. ARM hosts and macOS are outside this verification checklist.

- Install Git and Node.js 24.x. Start Docker in Linux container mode and confirm `docker info` succeeds. Build access needs the package and image registries referenced in the Dockerfiles. The run containers use CPU and run offline.
- Check free space on the drive that stores Docker data, including its build cache. Budget about 30 GiB of initially free disk space for a fresh nine-image build. This is a planning estimate. The verified host had 24 GiB RAM and gave Docker about 12 GiB and 6 CPUs. Builds run sequentially. A GPU, API keys, Ollama and the upstream Seeds example are optional.
- Clone the repo and record the commit with `git rev-parse HEAD`. Obtain the matching OpenBUGS archive using the [manual archive instructions](#manual-step-get-the-openbugs-tarball-yourself). Follow [Quick start](#quick-start) to build OpenBUGS and start the server, then build the [eight additional images](#build-the-eight-additional-engine-images) from the repository root in a second terminal.
- Open [Run](http://127.0.0.1:8765/run.html) and check that all nine engines show **Ready**. A **Setup required** entry means the image is missing or its probe did not pass. Save the build output or runner reason for that engine and continue with the others.

### Run the automated browser check

Install Google Chrome. Create a Python environment from the repository root in the second terminal and run the check while the app is running.

Windows (PowerShell):

```powershell
python -m venv local-data/browser-verify
.\local-data\browser-verify\Scripts\python.exe -m pip install playwright
.\local-data\browser-verify\Scripts\python.exe apps/local/scripts/multi-engine-browser-check.py
```

Linux (Bash):

```bash
python3 -m venv local-data/browser-verify
local-data/browser-verify/bin/python -m pip install playwright
local-data/browser-verify/bin/python apps/local/scripts/multi-engine-browser-check.py
```

With no engine arguments the check runs all nine. Expect a `PASS` for each demo and deliberate failure, the OpenBUGS repeat with matching CODA hashes, and the linked TopHat2 to Cufflinks run. The script downloads manifests and artifacts, checks artifact hashes, and verifies the results bundle. It exits nonzero for a failed check or blocked engine. Pass engine IDs to run a subset, and include both `tophat2 cufflinks` to verify the linked case. If you changed the app port, pass `--base` with the new loopback URL.

For a manual check, select each engine and run its demo and deliberate failure. OpenBUGS calls these **Coin** and **Coin with a deliberate syntax error**. Check for **Succeeded** and a passed comparison on the demo, **Engine error** on the deliberate failure, and working downloads on both. Use the successful TopHat2 run ID in Cufflinks to verify the linked case.

Record the Git commit, OS and architecture, Node.js and Docker versions, and the browser check output. If an engine fails, include its name, image ID if available, and the exact error. Compare the run comparisons and expected failure states with the [reference evidence](docs/evidence/multi-engine.md). A rebuild can produce a different local image ID, so record the ID observed on the test machine.

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

## Assistant setup, voice input and honest status

The optional assistant has separate text-chat and speech-to-text providers. No model or API key is bundled. Start from the root `.env.example` copied to `.env`; the normal Windows and Linux start scripts and `npm start` load that ignored root file.

**Text chat uses Gemini 3.5 Flash-Lite.** Add a Google AI Studio key to `GEMINI_API_KEY` in `.env`. ReproLab sends chat-completions requests to Google's OpenAI-compatible Gemini endpoint with `CHAT_MODEL=gemini-3.5-flash-lite`. This model is served by Google, not Groq. The app can also use another OpenAI-compatible service by setting `CHAT_BASE_URL` and `CHAT_MODEL`. For Ollama, set the following in `.env` and leave both API keys empty:

```env
CHAT_BASE_URL=http://127.0.0.1:11434/v1
CHAT_MODEL=llama3.2:3b
```

**Optional voice input uses Groq Whisper.** Add your Groq key to `GROQ_API_KEY`; `STT_MODEL=whisper-large-v3` is the default. On Run or Results, choose **Record a question**, allow microphone access, then choose **Stop and transcribe**. The recording is sent to Groq and the transcript is inserted into the question box. Review it and press **Ask** to send the text to Gemini with the retrieved context. Audio is not stored by ReproLab. Voice remains disabled if no Groq key is set.

### What the assistant can explain

For general questions, ReproLab retrieves short cited passages from the authored notes in `docs/assistant/`. On a Results page, select **Include this run’s log and manifest excerpts** when you want the assistant to see context from that run. The question and retrieved passages are sent to the configured chat provider when you press **Ask**. ReproLab displays an answer only when its citations refer to passages actually retrieved for that question. Unsupported questions are declined; questions asking the assistant to judge validity, convergence or medical meaning are rejected before a model call. It cannot run commands, change model files or approve an analysis. Read the Privacy page before enabling a remote provider.

The assistant is disabled until Gemini's key is configured. Voice input is separately disabled until Groq's key is configured. You can use typed questions with Gemini alone, or disable both features by leaving the keys blank.

On 2026-11-18, the configured Gemini and Groq pipelines were also exercised live using keys from the ignored root `.env`; the key values were not recorded. Gemini returned a cited answer to an answerable documentation question, and Groq Whisper transcribed a short synthesized phrase. This smoke check confirms the configured endpoints and request formats work; it is not a broad answer-quality review. Automated tests use fake providers and do not require real keys. See `docs/evidence/local-product/assistant-gemini-groq-smoke.md`.

**Honest status:**

- A real model was previously exercised once: Ollama with `llama3.2:3b`, through the HTTP API, on a failed run (`docs/evidence/local-product/assistant-real.txt`). A separate Gemini/Groq smoke check is recorded in `docs/evidence/local-product/assistant-gemini-groq-smoke.md`.
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
- OpenBUGS 3.2.3 is required for the OpenBUGS workflow. The other engines use their own images. Licence references and third-party notices are in `docs/third-party-notices.md`.

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
- **Spec 05, UI redesign** in `.kiro/specs/05-ui-redesign/`: a redesign of both front ends that changes no copy, claim or element the tests pin. It adds a run timeline built from the runner's seven success markers, a plot of the exported samples with the exact Beta(8, 4) curve for the Coin toy model, a hash tag on every recorded file, a three.js specimen case and NiftyNet volume viewer, and a server-rendered Seeds comparison chart on the static site. Steering for it is in `.kiro/steering/design.md`. The direction came from the [unslop](https://github.com/heydamir/unslop) skill (unslop by Damir Sokolovsky, @heydamir, CC BY 4.0) run in Kiro. GSAP, anime.js, three.js and IBM Plex Mono are self-hosted with a hash manifest (`apps/local/public/vendor/manifest.json`); GSAP's licence is not an open-source licence (see `docs/third-party-notices.md`).
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

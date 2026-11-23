# Local engine verification

Host observations and task status are in [the Kiro ledger](../../.kiro/specs/04-multi-engine/tasks.md). Docker Desktop stores its WSL data on D:. The initial build queue serialized native compilation. Independent image downloads and wheel installs overlapped while the native toolchain downloaded. Windows reported about 19.6 GiB free on D: during the builds. No cleanup of unrelated images or volumes was performed.

The Chrome check uses the actual Run form, waits for the real Results page, downloads its manifest, artifacts and JSON bundle, and checks artifact SHA-256. It also verified selection by keyboard and no horizontal overflow on the Run page at 390 pixels. Reported RSS is the larger of the worker or child process high-water marks.

| Engine | Success and comparison | Deliberate failure | CPU fixture time / RSS / artifacts |
|---|---|---|---|
| OpenBUGS | 20,000 draws, mean 0.66862377 and SD 0.12977737, both within 0.01 of the reference | Syntax error, exit 0, classified as engine error | 0.032 s / unmeasured / 260,563 bytes |
| PyMC 2 | 20,000 draws, mean 0.66795730 and SD 0.13011427, both within 0.01 of the reference | Engine raised `pymc.Node.ZeroProbability` for 11 heads in 10 trials | 0.873 s / 72,240 KiB / 536,678 bytes |
| Caffe | NCHW [1,1,2,3], scores [24.5,7] | Input shape rejected | 0.627 s / 138,480 KiB / 2,113 bytes |
| Theano | Float64 output [0,2] and gradient [12,16] | Engine raised a dimension mismatch for (2,2) × (3,1) | 2.982 s / 102,712 KiB / 251 bytes |
| Chainer | Logits [11.5,-2] before and after checkpoint restore | Checkpoint matrix shape rejected | 0.515 s / 55,032 KiB / 537 bytes |
| QIIME 1 | Sample totals [6,9], feature totals [5,2,8] | Malformed BIOM rejected with `KeyError: 'columns'` | 1.633 s / 143,760 KiB / 291 bytes |
| TopHat2 | Four BAM records, one reference named artificial | FASTQ sequence and quality mismatch (2 versus 0) | 0.330 s / 97,576 KiB / 585 bytes |
| Cufflinks | One isoform with positive FPKM in each of the independent and linked runs | Malformed SAM yielded an empty isoform table and was classified as an engine error | 0.011 s / 11,948 KiB / 343 bytes (independent) |
| NiftyNet | All 24 float32 voxels matched, shape [2,3,4], PNG 160 × 120 | TensorFlow refused the missing checkpoint prefix | 1.761 s / 299,972 KiB / 4,577 bytes |

Local image IDs, distinct from registry digests:

- OpenBUGS: `sha256:4d9ebd5fd85cbe9bc2d2e847ef4bcdbb99d2c4b6b4128558282a53c43c992ac7`
- PyMC 2: `sha256:bde6937432168733472eafb3e59a1045500fd72d05eb2661ff41710bb44ee824`
- Caffe: `sha256:b7dd96e075ffdb15e4eb53f2b48ff72d7d08b7eb91d5b08891e6bc465c15be43`
- Theano: `sha256:ecdc5d2cc63ea1a5c4b81643ec530cc76b19a129f4b3d8244d7634ce6288980f`
- Chainer: `sha256:7cef7e4b91f967bff5dd72fcea68df67457fdd34a49b8c289b3d08b0cfbf523d`
- QIIME 1: `sha256:2fa7d39c7dcc053ab0860e7f7c6949842c2d7f9914ae746884dca40a074616c9`
- TopHat2: `sha256:a7a4265af4a346ac1436bce7b0eab1969eda0ddedd601d0ca29c3970af84fb15`
- Cufflinks: `sha256:3cff9ea644e5c60233b5dc03d405f58336c7f8e80703adc1f4d73e24fcf212d3`
- NiftyNet: `sha256:647620af69cffcd036ec5759ac424b9c58d334f54070dc76c8014a3db5afb384`

OpenBUGS's real API journey also passed timeout, busy rejection and container cleanup. The recorded Seeds comparison and its display order were preserved. TopHat2 initially reached the output check and raised `OSError: [Errno 2] No such file or directory` because the image did not provide `samtools`. The replacement checks the genuine BAM's magic bytes, reference name and length, and record IDs and lengths.

The OpenBUGS and PyMC 2 coin demos share the observed counts, prior, burn-in, thinning, chain count and retained draws. They use engine-specific RNGs. The means differed by 0.00066647 and the sample SDs by 0.00033690. Both met the independently fixed Beta(8,4) thresholds.

Theano initially raised `ImportError: failed to map segment from shared object` loading compiled extensions in Docker's non-executable `/tmp`. Its runner command now compiles into its container-only `/work/theano` directory. Cufflinks 2.2.1 reported `unrecognized option '--version'`, so its probe verifies the exact banner from `--help`. The linked browser test checked the recorded parent run ID and the downloaded BAM's SHA-256 against the child's manifest.

Cancellation and a metadata-only export passed through the real API. A local Ollama question about a real OpenBUGS failure cited the run log and manifest and identified the line, but did not explain the cause. This check does not establish answer quality.

For direct reproduction, run each of the eight new images with the command defined in `apps/local/src/engines.mjs`, substituting `probe`, `demo` and `failure` in turn. Use Docker's isolated CPU flags from `apps/local/src/docker.mjs`. For OpenBUGS use the built-in coin and invalid coin cases. The source and parent image pins are recorded in `infra/engines/Dockerfile` and each run manifest.

## Clean worktree repeat

All nine images rebuilt successfully from a detached worktree at runtime commit `8875f59`. BuildKit reused layers and the NiftyNet build used the SHA-256 checked TensorFlow wheel. OpenBUGS used the owner-supplied archive with its checked SHA-256. The rebuilt tags were then selected by a verification server using the regular browser routes, scheduler and Docker adapter. Every successful browser manifest matched its rebuilt image ID. All deliberate failures, downloads and the linked TopHat2 to Cufflinks run passed again. The OpenBUGS CODA hashes matched with the same seed and no test run container was left behind.

| Engine | Local rebuild ID |
|---|---|
| OpenBUGS | `sha256:23c3fa69033b8055587d7e1075e8996bfc9d42d46a4a9d86f843c7597eae07b3` |
| PyMC 2 | `sha256:1598de9dd3b93a47a52d555b07e1f693666aba747b8bd8eaf3183413bf1eef66` |
| Caffe | `sha256:56408387eb0da65d5ef756781b2d15bbcfc5068a17901fd8221b3a4aaeeb926a` |
| Theano | `sha256:563a0ca7e5e61459be39b103000a61a87559fb33d685da7701887b6d2bd9c8cf` |
| Chainer | `sha256:9d61ef558220e95367a8d048f65c6cb6403f219a7c0e477cd6ed84edb65e7888` |
| QIIME 1 | `sha256:45dce2d634cc51d57e724400cfd12e960e71c8934ab3535feeb279ae69d820fd` |
| TopHat2 | `sha256:c3d932e9dacb3a9306610efe7b014595738a2e68f59251533e5fcff7c67dc365` |
| Cufflinks | `sha256:116a4a65bc7a8092ecdd9be640fc28cf56023bace0438785c91479aae38ea127` |
| NiftyNet | `sha256:eb6495fc3681e8d80cf4ade643cff512e07f296753af27d169f474706618c827` |

PyMC 2 used GNU Fortran 12.2.0 (Debian `12.2.0-14+deb12u1`). Theano used g++ 12.2.0 (Debian `12.2.0-14`). NiftyNet reported no broken requirements in `pip check`. Open items are a second machine, a complete transitive dependency inventory, and a separate Docker work volume quota with per-engine peak temporary disk measurements.

## Optional Ollama GPU check

Ollama 0.40.15, `nomic-embed-text:latest` (local model ID prefix `0a109f422b47`), RTX 3070 Laptop GPU driver 616.92. Same 32 synthetic strings, four requested threads, one warm-up call per mode. Native Windows loopback `POST /api/embed` used `num_gpu=0` for CPU and `num_gpu=99` for GPU. Each mode was unloaded before the next. One measured request per mode:

| Mode | End-to-end | Ollama reported time | Ollama model size | Ollama VRAM |
|---|---:|---:|---:|---:|
| CPU | 917.9 ms | 887.4 ms | 389,053,152 bytes | 0 bytes |
| GPU | 270.7 ms | 238.9 ms | 335,743,549 bytes | 335,743,549 bytes |

Maximum absolute component difference was 0.00014222 and minimum cosine similarity was 0.99999913. This verifies acceleration of this optional Ollama workload. Legacy engine acceptance uses CPU.

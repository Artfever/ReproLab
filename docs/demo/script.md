# ReproLab demo script (target 2:55, limit 3:00)

Spec: `.kiro/specs/03-local-product`, task 13.2, Requirements 22.1 and 22.2.

## Status of the video

**No video exists yet.** None has been recorded for this repository, and none has been uploaded to YouTube or anywhere else. This script and `shot-list.md` are the plan for a person to record. When a recording exists, the YouTube link is added by hand to the Devpost checklist. Until then that link stays `MISSING`.

The recording must be a real screen capture of the running local product (`apps/local`). Use no mock-ups, no staged output and no edited result numbers. Cut only dead time. If a take shows something different from the narration below, change the narration, not the footage.

## Segment table

Segment times use the `[mm:ss-mm:ss]` format and run back to back. Duration is the end minus the start.

| Segment | Time | Seconds | Page |
|---|---|---|---|
| 1. What it is | [00:00-00:20] | 20 | Home |
| 2. A mistake is explained | [00:20-00:40] | 20 | Run |
| 3. A real coin run | [00:40-01:10] | 30 | Run, then Results |
| 4. Files, hashes, manifest | [01:10-01:40] | 30 | Results |
| 5. A failed model is a failure | [01:40-02:05] | 25 | Run, then Results |
| 6. The assistant, as it really is | [02:05-02:25] | 20 | Results |
| 7. Seeds and limits | [02:25-02:55] | 30 | Limitations |

Total: 175 seconds (2:55). The 5 seconds left under the 3:00 limit are slack for page loads.

Narration pace is about 2.3 words per second. Read the narration aloud once with a timer before recording.

## Segments

### [00:00-00:20] 1. What it is

On screen: Home page. The heading "Run an old analysis with its original engine, on this computer", the header line "Runs on your machine only. Not a hosted service.", and the specimen case closing over the recorded Coin hash. (Spec 05 changed the heading; it was "ReproLab local", which is now the line above it.)

> **Narration:** ReproLab runs the OpenBUGS command-line workflow on your own computer. It uses the original engine inside a locked-down Docker container and shows you the real log and output files. It runs only on this machine. It is not a hosted service.

### [00:20-00:40] 2. A mistake is explained

On screen: Run page. Set Samples to 0 and press "Check and run". Show the error summary.

> **Narration:** First, a mistake. I set samples to zero and press Check and run. Before any container starts, the page explains the problem in plain English: Samples must be from 1 to 50000, but it is 0.

### [00:40-01:10] 3. A real coin run

On screen: Run page. Choose "Coin (ReproLab example, known answer)", set Samples back to a valid value (the demo loads its own), press "Check and run". Results page shows the state change from running to `succeeded`.

> **Narration:** Now a real run. This coin model is ReproLab's own toy example: seven successes in ten flips, so the exact answer is known. I press Check and run. OpenBUGS runs in the container, and the state reads succeeded after a couple of seconds.

### [01:10-01:40] 4. Files, hashes, manifest

On screen: Results page. Scroll to the engine log, the output files table (file, size, SHA-256), the "Download manifest.json" button, and the summary table with its label.

> **Narration:** Every value comes from the engine log or its output files. Each file has a size and a SHA-256 checksum, and the manifest records the settings, engine version and hashes. The summary table is computed by ReproLab from the samples, and it is labelled that way. A finished run is not a scientific finding.

### [01:40-02:05] 5. A failed model is a failure

On screen: Run page. Choose "Coin with a deliberate syntax error", press "Check and run". Results page shows state `engine_error`, the reason, and the box "First engine error line in the log".

> **Narration:** Failures are reported as failures. This model has a deliberate syntax error. The state is engine error, and the reason is the engine's own line from the log, shown here. Success is never guessed from an exit code.

### [02:05-02:25] 6. The assistant, as it really is

On screen: Assistant panel on the Results page. Show whichever state the recording machine has (see the fallback in `shot-list.md`).

> **Narration (assistant switched off):** There is an optional assistant. On this machine it is switched off, and the page says why. No language model is bundled. When you enable one, it answers only from cited passages, and it declines questions about whether a result is valid.

> **Narration (assistant enabled):** There is an optional assistant, and here it is enabled with a local model. Answers must cite a retrieved passage, and it declines questions about validity. In our one real test with a small model, the answer quality was weak, so always check the citations.

Record only one of the two versions, the one that matches the screen.

### [02:25-02:55] 7. Seeds and limits

On screen: Limitations page. Show the "Seeds" paragraph and the engine description.

> **Narration:** One last honest point. The Seeds example is historical. Our pre-declared comparison against the published values failed, and we report it as failed. Do not read a Seeds run as a reproduction. ReproLab uses OpenBUGS as its original engine, and the app records the real engine logs and output files.

## What NOT to claim

- Do not say or show that a video has been recorded, uploaded or published unless it has. Today none has.
- Do not say Seeds reproduced the published values. The pre-declared comparison FAILED for all five monitored nodes. The chain-1 comparison was decided after seeing results (post hoc) and must not be presented as a pass.
- Do not call any run a scientific finding, a validated result or proof of convergence. The tool computes no convergence diagnostics.
- Do not say the assistant is always on, accurate or an analyst. It is off unless configured, and its one real test gave a weak answer.
- Do not say there is a hosted site, a public runner or a live demo URL. There is none.
- Do not say the MIT licence covers OpenBUGS, its examples or its documentation. It covers ReproLab code only.
- Do not read the coin run time as a performance claim. It depends on the machine.
- Do not show the OpenBUGS tarball, upstream Seeds files or any key, token or personal path on screen.

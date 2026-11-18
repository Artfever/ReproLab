# Requirements Document

## Introduction

ReproLab revives the OpenBUGS command-line workflow through reproducible local execution and a modern interface. It does not translate the OpenBUGS language and does not claim to repair arbitrary old software. This spec (`03-local-product`) adds a local product next to the public static site. Specs `00-engine-feasibility`, `01-web-mvp` and `02-grounded-assistant` and the placeholder `01-end-to-end-web-run` stay unedited as the historical record. This spec supersedes the hosted-service direction of `01-web-mvp` and `02-grounded-assistant` for the submission build.

Binding facts (from `docs/release-decision.md`, `docs/licensing-review.md`, `docs/third-party-notices.md`, `docs/evidence/`):

- Release gates G1 to G4 are UNMET. Image redistribution and any public execution stay NO-GO. No OpenBUGS binary, container image, upstream example or upstream documentation is committed, published or uploaded.
- No Vercel hosting or deployment is part of this spec.
- The public static site `apps/web` keeps its no-forms, no-fetch, no-`child_process` guard and its recorded Seeds evidence page. The pre-declared Seeds comparison failed on all five nodes. Its post hoc labels stay unchanged. Neither is independent validation.
- The pinned local image `reprolab-openbugs:3.2.3` (ID `sha256:f65e2244463b5899308e9fd51361589de518f9a534fbc62d758e17277e76b88f`) exists on the developer machine. The OpenBUGS 3.2.3 tarball copy used to build it is held locally and is not committed.
- Four milestones: M1 reconcile and verify, M2 local product, M3 open source and install, M4 judgeable local submission.

## Glossary

- **Local_Server**: The dependency-free Node program in `apps/local` (`node:http`, `node:fs`, `node:crypto`, `node:child_process` allowed only there).
- **Local_UI**: The plain HTML, CSS and vanilla JavaScript interface in `apps/local/public`.
- **Public_Site**: The static Next.js site in `apps/web`.
- **Worker_Image**: The local Docker image `reprolab-openbugs:3.2.3` (tag configurable), containing OpenBUGS and `services/runner`.
- **Runner**: The Python package `services/runner/reprolab_runner`. Its `classify()` function decides run success from the engine log.
- **Run**: One OpenBUGS execution requested through the Local_Server.
- **Run_Id**: A random opaque identifier of a Run (at least 128 bits of entropy, lowercase hex).
- **Run_State**: One of `queued`, `running`, `succeeded`, `engine_error`, `timed_out`, `runner_error`.
- **Run_Dir**: `local-data/runs/<Run_Id>/`, gitignored.
- **Run_Request**: The JSON body of `POST /api/runs` and `POST /api/validate`: model text, data text, one inits text per chain, monitors, burn-in, samples, thin, seed, timeout.
- **Run_Manifest**: The sanitised `manifest.json` of a Run.
- **Host_Path**: Any absolute path of the host machine, including the repository root and the user profile directory.
- **ReproLab_Demo**: The ReproLab-authored beta-binomial model under `examples/reprolab/`.
- **Seeds_Local**: The four upstream Seeds files extracted from the user's own OpenBUGS tarball into `local-data/upstream/`.
- **Upstream_Material**: Any file, documentation or binary from the OpenBUGS distribution or its examples.
- **Assistant**: The grounded question-answering feature in `apps/local/assistant`.
- **Corpus**: The Assistant's only knowledge sources: ReproLab-authored `docs/assistant/*.md` passages and the current Run's log lines and Run_Manifest fields.
- **Passage**: A unit of the Corpus with a stable id (for example `setup-01`, `run-log-L12`, `run-manifest-status`).
- **Provider**: An OpenAI-compatible chat-completions HTTP endpoint configured through `REPROLAB_LLM_BASE_URL`, `REPROLAB_LLM_MODEL` and optional `REPROLAB_LLM_API_KEY`.
- **Decline_Message**: The fixed Assistant text returned when no supported answer exists.
- **Fake_Provider**: A test-only local HTTP server that imitates a Provider. It is never shipped as a feature.
- **Evidence_Dir**: `docs/evidence/local-product/`.
- **Tracked_File_Audit**: The script and test that inspect `git ls-files` for forbidden content.
- **Judge**: A person who clones the public repository to evaluate the submission.

## Requirements

### Requirement 1: Product boundary

**User Story:** As a researcher, I want ReproLab to state exactly what it does, so that I do not mistake it for a validated or hosted service.

#### Acceptance Criteria

1. THE Local_UI SHALL state on its home page that ReproLab runs the OpenBUGS command-line workflow locally and does not translate the OpenBUGS language.
2. THE Local_UI SHALL state on its home page that a finished Run is not a valid scientific finding and not a convergence claim.
3. THE Local_Server SHALL expose no endpoint that accepts an executable, an image name, a container flag or a shell string from a client.
4. THE repository SHALL contain no OpenBUGS binary, no container image, no upstream example file and no upstream documentation text, as proven by the Tracked_File_Audit.
5. THE repository SHALL contain no push, publish, save, export or login command for the Worker_Image, as proven by `scripts/check-publish-paths.ps1` exiting 0.
6. THE repository SHALL contain no Vercel configuration added by this spec and no deployment step.

### Requirement 2: Milestone 1 reconcile and verify

**User Story:** As a maintainer, I want spec `01-web-mvp` ticked only where evidence exists, so that the record is honest before new work starts.

#### Acceptance Criteria

1. WHEN Milestone 1 starts, THE maintainer SHALL copy the recorded clean `npm ci` and `npm run check` output from `.scratch/m1` to `docs/evidence/local-product/m1-*.txt` without editing it.
2. WHEN a task in `.kiro/specs/01-web-mvp/tasks.md` has an acceptance check whose evidence file exists and shows the stated result, THE maintainer SHALL tick that task.
3. IF a task in `.kiro/specs/01-web-mvp/tasks.md` lacks evidence, THEN THE maintainer SHALL leave it unticked and record the gap in `docs/evidence/local-product/m1-reconcile.md`.
4. WHEN the Runner unit tests run inside the Worker_Image, THE results SHALL be recorded in `docs/evidence/local-product/m1-runner-tests.txt` with the test count.
5. WHEN `scripts/tests/test-release-gate.ps1` runs, THE result SHALL show 39 passing cases and SHALL be recorded in `docs/evidence/local-product/m1-release-guard-tests.txt`.
6. WHEN the built Public_Site is served locally, THE maintainer SHALL capture headless Edge or Chrome screenshots of `/` and `/sample-run` at 1280 x 800 and 390 x 844, read each PNG, and record observations in `docs/evidence/local-product/m1-browser-review.md`.
7. IF the review finds a real defect in `apps/web` or `scripts/`, THEN THE maintainer SHALL fix it, add or adjust a test, and record the defect and the fix in `docs/evidence/local-product/m1-reconcile.md`.
8. THE spec files `00-engine-feasibility`, `01-web-mvp` (except task checkboxes ticked under criterion 2), `01-end-to-end-web-run` and `02-grounded-assistant` SHALL keep their requirements and design content unchanged.

### Requirement 3: Loopback-only server

**User Story:** As a user, I want the local server reachable only from my own machine, so that nobody else on the network can start runs.

#### Acceptance Criteria

1. THE Local_Server SHALL bind only to `127.0.0.1`.
2. THE Local_Server SHALL accept no configuration value that changes the bind address to a non-loopback address.
3. IF a request carries a `Host` header whose host part is not `127.0.0.1`, `localhost` or `[::1]` on the server port, THEN THE Local_Server SHALL answer 403 and run no handler.
4. IF a request carries an `Origin` header that is not `http://127.0.0.1:<port>` or `http://localhost:<port>`, THEN THE Local_Server SHALL answer 403.
5. WHEN a request body exceeds 1 MiB, THE Local_Server SHALL answer 413 and read no more than 1 MiB plus one chunk.
6. IF a request body is not valid JSON or fails the schema of its endpoint, THEN THE Local_Server SHALL answer 400 with a plain-English message and no stack trace.
7. THE Local_Server SHALL send `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store` on every response.
8. THE Local_Server SHALL serve only files that exist in `apps/local/public` and reject path traversal with 404.
9. THE Local_Server SHALL answer methods other than those listed for a route with 405.
10. THE Local_Server SHALL provide exactly these routes: `GET /api/health`, `GET /api/demos`, `POST /api/validate`, `POST /api/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/manifest`, `GET /api/runs/:id/files/:name`, `POST /api/assistant/ask`, `GET /api/assistant/status`, and static files.

### Requirement 4: Input validation and dry run

**User Story:** As a researcher, I want problems in my inputs explained before a run starts, so that I do not wait for a container to learn that a value is out of range.

#### Acceptance Criteria

1. THE Local_Server SHALL accept chains 1 to 4, burn-in 0 to 50000, samples 1 to 50000, thin 1 to 100, seed 1 to 14 and timeout 1 to 300 seconds, each as an integer.
2. THE Local_Server SHALL accept 1 to 25 monitors, each matching `^[A-Za-z][A-Za-z0-9_.]{0,63}$`, and SHALL reject duplicate monitor names.
3. THE Local_Server SHALL accept a model of 1 to 262144 bytes and data or inits files of 1 to 2097152 bytes each, in plain ASCII with no NUL byte.
4. THE Local_Server SHALL require exactly one inits text per chain.
5. WHEN `POST /api/validate` receives a Run_Request, THE Local_Server SHALL return a list of problems, each with the field name and a plain-English sentence, and SHALL start no container.
6. IF a Run_Request has any problem, THEN `POST /api/runs` SHALL answer 400 with the same problem list and SHALL create no Run.
7. THE Local_UI SHALL show client-side messages for out-of-range numbers, non-ASCII text and empty files before submission.
8. WHEN the Local_UI receives a problem list, THE Local_UI SHALL show each problem next to its field and move keyboard focus to the first problem.
9. FOR ALL Run_Requests, THE Local_Server validation and the Runner `RunSettings.validate` SHALL accept the same integer ranges, except that the Local_Server timeout maximum is 300 seconds.
10. THE Local_Server SHALL stage inputs under the fixed names `model.txt`, `data.txt` and `inits1.txt` to `inits4.txt` and SHALL never use a client-supplied name as a path.

### Requirement 5: Containerised execution

**User Story:** As a user, I want the engine to run in a locked-down container, so that a bad model cannot touch my machine or network.

#### Acceptance Criteria

1. WHEN a Run starts, THE Local_Server SHALL call Docker through `child_process.spawn` with an argument array and no shell.
2. THE Local_Server SHALL create the container with `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--pids-limit 128`, `--memory 1024m`, `--cpus 1`, `--tmpfs /tmp`, user `10001` and a container-local volume at `/work`.
3. THE Local_Server SHALL deliver input files into the container with `docker cp` and SHALL create no host bind mount.
4. THE Local_Server SHALL copy outputs out with `docker cp` into the Run_Dir.
5. THE Local_Server SHALL name each container uniquely per Run and SHALL remove it with `docker rm -f -v` after success, failure, timeout and server-side cap.
6. THE Local_Server SHALL use the image tag from `REPROLAB_IMAGE` and default to `reprolab-openbugs:3.2.3`, and SHALL accept no image value from a client.
7. THE Local_Server SHALL enforce a server-side wall-clock cap of the engine timeout plus 30 seconds and SHALL run `docker kill` when the cap is reached.
8. WHILE a Run is `running`, THE Local_Server SHALL accept no second Run to start.
9. IF a second Run is requested while another is `queued` or `running`, THEN THE Local_Server SHALL answer 429 with a message that one run at a time is supported.
10. IF Docker is not installed, not running, or the image does not exist, THEN THE Local_Server SHALL set the Run_State to `runner_error` and show a plain-English reason naming the missing item.
11. WHEN the server starts, THE Local_Server SHALL remove containers that carry the label `reprolab.run` and are left from an earlier process.
12. THE Local_Server SHALL set the label `reprolab.run=<Run_Id>` on each container.

### Requirement 6: Run states and success decision

**User Story:** As a researcher, I want the state of a run to come from the engine log, so that an invalid model is never shown as a success.

#### Acceptance Criteria

1. THE Local_Server SHALL report one of the six Run_States for every Run.
2. WHEN the Runner manifest status is `succeeded`, THE Local_Server SHALL report `succeeded`.
3. WHEN the Runner manifest status is `failed`, THE Local_Server SHALL report `engine_error`.
4. WHEN the Runner manifest status is `timed_out`, THE Local_Server SHALL report `timed_out`.
5. IF the container exits without a readable Runner manifest, or the server-side cap fires, or Docker fails, THEN THE Local_Server SHALL report `runner_error`.
6. THE Local_Server SHALL never derive `succeeded` from a process or container exit code alone.
7. WHEN a model has invalid syntax, THE Local_Server SHALL report `engine_error` and show the first engine error line from the log.
8. WHEN a model uses an undefined variable, THE Local_Server SHALL report `engine_error` and show the engine's `is not defined` line.
9. WHEN a Run exceeds its engine timeout, THE Local_Server SHALL report `timed_out`.
10. THE Local_Server SHALL keep the Run_Dir of failed Runs so that their log remains viewable.

### Requirement 7: Manifest and path sanitisation

**User Story:** As a user, I want shared manifests and API responses to reveal nothing about my machine.

#### Acceptance Criteria

1. THE Run_Manifest SHALL contain the Run_Id, state, reason, engine version, image reference and image ID, settings, runtime, creation time, engine argument vector, generated engine script, and the SHA-256 and byte size of each input and output file.
2. THE Run_Manifest SHALL contain no Host_Path.
3. THE Local_Server SHALL replace any Host_Path in any API response, log excerpt or file served with the text `<local-path>`.
4. FOR ALL API responses and Run_Manifests produced during tests, a canary search for the repository's absolute path and the user profile directory SHALL find no match.
5. THE Local_Server SHALL serve `GET /api/runs/:id/files/:name` only for names in the Run's own file list and SHALL answer 404 for any other name, including names containing `/`, `\` or `..`.
6. THE Local_Server SHALL answer 404 for an unknown or malformed Run_Id without revealing whether a directory exists.
7. THE Run_Manifest SHALL record original upload names, when supplied, only as base names of at most 100 plain characters.

### Requirement 8: Results page

**User Story:** As a researcher, I want one page with the status, logs, files and a downloadable manifest, so that I can keep a reproducible record.

#### Acceptance Criteria

1. THE Local_UI SHALL show the Run_State as a visible word, the engine version, settings, runtime and reason.
2. THE Local_UI SHALL show the engine log, bounded to the first 2000 lines or 256 KiB, with a visible note when it is truncated.
3. THE Local_UI SHALL list each output file with name, size and SHA-256 and a download link.
4. THE Local_UI SHALL offer a download of the sanitised `manifest.json`.
5. WHERE a Run succeeded and CODA files exist, THE Local_Server SHALL compute a summary by calling the Runner `summarize` command inside the Worker_Image, and THE Local_UI SHALL label it "Computed by ReproLab from the exported samples. Not a convergence or validity claim."
6. IF the summary cannot be computed, THEN THE Local_UI SHALL show the reason and no numbers.
7. WHILE a Run is `queued` or `running`, THE Local_UI SHALL poll `GET /api/runs/:id` at intervals of 1 to 2 seconds and announce state changes in an `aria-live="polite"` region.
8. THE Local_UI SHALL render log text as text and never as HTML.

### Requirement 9: ReproLab demonstration model

**User Story:** As a judge, I want a small model that ships with the repository and has a known answer, so that I can verify a real run without any upstream file.

#### Acceptance Criteria

1. THE repository SHALL contain `examples/reprolab/coin/` with a ReproLab-authored model `r ~ dbin(p, n)`, `p ~ dbeta(1, 1)`, data `r = 7, n = 10`, and two inits files.
2. THE repository SHALL contain `examples/reprolab/coin/README.md` stating the analytic posterior Beta(8, 4), mean 0.6667 and standard deviation about 0.1307, and stating that sampled values are expected to agree only within a stated tolerance.
3. THE repository SHALL contain a deliberately invalid variant under `examples/reprolab/coin-invalid/` for the invalid-input demonstration.
4. WHEN the coin demo runs against the Worker_Image with 2 chains, 1000 burn-in, 10000 samples and seed 1, THE test SHALL compare the sampled pooled mean and standard deviation of `p` with the analytic values and SHALL record both values and the tolerance in `docs/evidence/local-product/coin-check.txt`.
5. THE stated tolerance SHALL be fixed in the test before the first run and SHALL be an absolute difference of 0.01 for the mean and 0.01 for the standard deviation.
6. IF the comparison exceeds the tolerance, THEN THE test SHALL fail and the record SHALL be kept unchanged.
7. THE Local_UI SHALL list the coin demo and the invalid variant through `GET /api/demos` and load them without file selection.

### Requirement 10: Seeds from the user's own upstream copy

**User Story:** As a researcher with my own OpenBUGS download, I want to run the historical Seeds example without ReproLab redistributing it.

#### Acceptance Criteria

1. THE repository SHALL contain `scripts/extract-seeds.ps1` and `scripts/extract-seeds.sh`, each taking the path of the user's tarball and extracting only `Seedsmodel.txt`, `Seedsdata.txt`, `Seedsinits1.txt` and `Seedsinits2.txt` into `local-data/upstream/`.
2. WHEN extraction finishes, THE scripts SHALL compare each file's SHA-256 with `docs/evidence/input_hashes_upstream_examples.txt` and SHALL delete the extracted files and exit non-zero on any mismatch.
3. THE `.gitignore` SHALL exclude `local-data/`, `vendor/` and `*.tar.gz`.
4. WHEN all four files exist in `local-data/upstream/`, THE `GET /api/demos` response SHALL include the entry "Seeds (your own upstream copy)".
5. IF a file is missing, THEN THE `GET /api/demos` response SHALL omit that entry and the Local_UI SHALL explain how to create it.
6. THE Local_UI SHALL label Seeds_Local results as historical and SHALL link to the Public_Site evidence page text, which states that the pre-declared comparison failed.

### Requirement 11: User-selected local files

**User Story:** As a researcher, I want to run my own model, data and initial values, so that I can use ReproLab on my own small analyses.

#### Acceptance Criteria

1. THE Local_UI SHALL let the user select one model file, one data file and one inits file per chain with `<input type="file">` and SHALL read them in the browser.
2. WHEN the user submits, THE Local_UI SHALL send the file texts in a Run_Request to the Local_Server.
3. THE Local_UI SHALL offer a monitors field, numeric fields for each setting with the allowed range shown, and a chains selector from 1 to 4.
4. THE Local_UI SHALL keep every control reachable and operable by keyboard alone.
5. THE Local_UI SHALL show the file names it read and their byte sizes before submission.

### Requirement 12: Assistant corpus and retrieval

**User Story:** As a user, I want the assistant to answer only from documentation I can inspect, so that I can trust what it cites.

#### Acceptance Criteria

1. THE Assistant Corpus SHALL consist only of `docs/assistant/*.md` passages written for ReproLab and the current Run's log lines and Run_Manifest fields.
2. THE Assistant SHALL exclude Upstream_Material, web pages and all other repository files from the Corpus.
3. THE Assistant SHALL split each `docs/assistant/*.md` file into Passages at second-level headings and assign stable ids of the form `<file-stem>-NN`.
4. THE Assistant SHALL assign Run Passages the ids `run-log-L<n>` for log line `n` and `run-manifest-<field>` for each Run_Manifest field.
5. THE Assistant SHALL rank Passages with a dependency-free lexical method (BM25 or TF-IDF), return at most 5 Passages, and drop Passages whose score is below a fixed minimum.
6. IF no Passage reaches the minimum score, THEN THE Local_Server SHALL return the Decline_Message and SHALL NOT call the Provider.
7. FOR ALL questions, THE Assistant SHALL produce the same ranked Passage ids for the same Corpus (deterministic ranking with ties broken by id).
8. THE Assistant SHALL limit a question to 500 characters and the context sent to the Provider to 6000 characters.
9. THE repository SHALL contain `docs/assistant/*.md` files covering setup, running, validation errors, run states, files and manifest, assistant, limitations and privacy, each written by ReproLab and containing no upstream text.

### Requirement 13: Assistant provider and answer verification

**User Story:** As a user, I want the assistant to fail loudly instead of inventing answers, so that I never act on an unsupported claim.

#### Acceptance Criteria

1. THE Assistant SHALL read the Provider settings only from the server environment variables `REPROLAB_LLM_BASE_URL`, `REPROLAB_LLM_MODEL` and optional `REPROLAB_LLM_API_KEY`.
2. THE Assistant SHALL send the retrieved Passages with their ids and an instruction to answer only from them and to cite ids in square brackets.
3. WHEN the Provider answers, THE Local_Server SHALL check that the answer cites at least one id and that every cited id is among the retrieved ids.
4. IF the answer has no citation or cites an id that was not retrieved, THEN THE Local_Server SHALL return the Decline_Message and discard the Provider text.
5. WHEN an answer is accepted, THE Local_UI SHALL show the answer with each cited Passage's id, source file or Run line, and text.
6. IF the Provider is unreachable, times out after 60 seconds, answers with a non-200 status, or returns malformed JSON, THEN THE Local_Server SHALL return an error message naming the failure class and no answer text.
7. THE Local_Server SHALL never include the API key in any response, log line, manifest or error text, and the Local_UI code SHALL never contain it.
8. THE Local_Server SHALL permit a Provider base URL only with scheme `http` or `https` and SHALL reject URLs with embedded credentials.
9. THE Assistant SHALL make claims about a specific Run only from that Run's own log lines and manifest fields, and SHALL say when evidence is missing.
10. THE Assistant SHALL produce no scientific-validity, convergence or medical judgement, and THE Decline_Message SHALL be used for questions that ask for one.
11. THE tasks of this spec SHALL state whether a real Provider end-to-end test was exercised, and the Fake_Provider SHALL appear only under `apps/local/tests`.

### Requirement 14: Assistant status and interface

**User Story:** As a user without an LLM set up, I want the interface to say so clearly, so that I am not left guessing why a box does nothing.

#### Acceptance Criteria

1. WHEN `GET /api/assistant/status` is called, THE Local_Server SHALL return `enabled` or `disabled` with a plain-English reason and SHALL include no key and no full URL path.
2. IF no Provider is configured, THEN THE status SHALL be `disabled` with the reason "No language-model endpoint is configured".
3. IF the Provider does not answer a health probe within 3 seconds, THEN THE status SHALL be `disabled` with the reason that the endpoint is unreachable.
4. WHILE the status is `disabled`, THE Local_UI SHALL disable the question box and show the reason beside it.
5. THE Local_UI SHALL display the Decline_Message and error messages in an `aria-live="polite"` region.
6. THE Local_UI SHALL label every assistant answer "Generated by a language model from the cited passages. Check the citations."
7. THE Local_Server SHALL support Gemini chat completions through the Gemini OpenAI-compatible endpoint using `CHAT_MODEL` and `GEMINI_API_KEY`, with credentials read only from the environment.
8. THE Local_UI SHALL offer optional microphone recording only when Groq transcription is configured; WHEN a recording is transcribed, THE Local_UI SHALL insert the returned text for review and SHALL NOT submit it automatically.
9. THE Local_Server SHALL send bounded audio uploads to Groq's transcription endpoint using `STT_MODEL` and `GROQ_API_KEY`, SHALL NOT persist audio, and SHALL return no API key or provider response body to the browser.
10. THE Local_UI SHALL clearly tell the user that recorded audio is sent to Groq and that the transcript reaches the chat provider only after the user chooses Ask.

### Requirement 15: Local pages

**User Story:** As a new user, I want How it works, documentation, limitations, privacy and terms pages inside the app, so that I understand what the tool does with my data.

#### Acceptance Criteria

1. THE Local_UI SHALL provide the pages Home, Run, Results, How it works, Documentation, Limitations, Privacy and Terms, reachable from a persistent navigation landmark.
2. THE Privacy page SHALL state that no data leaves the machine except optional calls to configured AI providers, SHALL describe question/context sent to chat and audio sent to speech-to-text only after recording, and SHALL state that ReproLab does not save audio.
3. THE Terms page SHALL state that the terms are for the open-source local tool, that no hosted service exists, and that the MIT licence covers ReproLab code only.
4. THE Limitations page SHALL state the gates G1 to G4 as unmet, that public execution is NO-GO, that Docker Desktop isolation is the only isolation tested, and that Seeds results are historical.
5. THE Local_UI SHALL meet WCAG 2.2 AA for text contrast (4.5:1), visible focus, a skip link, one `h1` per page, labelled form controls and no content that requires a pointer.
6. THE Local_UI SHALL remain usable at 320 CSS pixels width without horizontal page scrolling, except inside labelled scroll regions for tables and logs.
7. THE Local_UI SHALL load no script, style, font or image from another origin.

### Requirement 16: Public site

**User Story:** As a maintainer, I want the public static site to stay exactly as honest and restricted as before.

#### Acceptance Criteria

1. THE Public_Site SHALL keep the Home and Sample run pages, the recorded Seeds evidence and the Disabled_Features_Guard passing, with no form, no `fetch`, no `child_process` and no new runtime dependency.
2. WHERE How it works, Docs, Limitations, Privacy and Terms pages can be added to the Public_Site with the guard and its 78 tests passing, THE Public_Site SHALL include them with wording that names the local tool.
3. IF those pages cannot be added cheaply, THEN THE maintainer SHALL record the gap in `docs/evidence/local-product/web-pages-gap.md`.
4. THE Public_Site SHALL present the failed pre-declared comparison and its post hoc labels unchanged.

### Requirement 17: Automated tests

**User Story:** As a maintainer, I want a dependency-free test suite that proves the local product's safety properties, so that I can change it with confidence.

#### Acceptance Criteria

1. THE `apps/local` tests SHALL use only `node:test` and `node:assert` and need no `npm install`.
2. THE tests SHALL cover each validation limit at its minimum, maximum and one step outside, ASCII and size rules, and duplicate monitors.
3. THE tests SHALL cover manifest sanitisation, the Host_Path canary, the loopback Host and Origin checks, the 1 MiB body bound, and one-run-at-a-time.
4. THE tests SHALL cover assistant retrieval ranking, citation display with source, decline without a Provider call, rejection of an uncited answer, Provider failure classes, and that the API key never appears in any response.
5. WHEN Docker and the Worker_Image are present, THE user-journey test SHALL drive the HTTP API through validate, a successful coin Run, an invalid-syntax Run, an undefined-variable Run and a timeout Run against the real image.
6. IF Docker or the Worker_Image is missing, THEN THE user-journey test SHALL be skipped with a loud message printed to standard error that names what is missing, and the test report SHALL show it as skipped.
7. WHEN the Runner changes, THE change SHALL be covered by a Python `unittest` case in `services/runner/tests`.
8. THE test command SHALL be `npm.cmd test` from `apps/local` and SHALL exit 0 only when every non-skipped test passes.

### Requirement 18: Licence and third-party notices

**User Story:** As a downstream user, I want a clear licence for ReproLab's own code and an honest list of everything else.

#### Acceptance Criteria

1. THE repository SHALL contain a root `LICENSE` file with the standard MIT licence text and the line `Copyright (c) 2026 artfever`, where `artfever` is the configured git author name of this repository.
2. THE `LICENSE` text SHALL match the SPDX `MIT` template so that GitHub detects it.
3. THE tasks SHALL flag that the user must confirm the legal name of the copyright holder.
4. THE README and `docs/third-party-notices.md` SHALL state that MIT covers ReproLab-owned code only and grants no rights to OpenBUGS, BlackBox, CpcBeautifier, the examples or the documentation.
5. THE `docs/third-party-notices.md` SHALL contain a table of every dependency in `apps/web/package-lock.json` grouped by licence identifier, with a compatibility verdict with MIT distribution of source.
6. THE `docs/third-party-notices.md` SHALL list unresolved items plainly, including the OpenBUGS GPL v2 versus v3 inconsistency, the tarball predating upstream r1018, the unknown `libOpenBUGS.so` build revision, CpcBeautifier and TAUCS terms, and the Examples data rights.
7. THE `docs/third-party-notices.md` SHALL describe each component one by one: ReproLab code, ReproLab examples, `seeds_published.json`, the Node dependencies, the Worker_Image contents, and the Debian layers.

### Requirement 19: README and installation

**User Story:** As a judge on Windows with WSL2 and Docker Desktop, or on Linux, I want a README I can follow from a clean clone to a real run.

#### Acceptance Criteria

1. THE root `README.md` SHALL list prerequisites with versions: Node 24.x, Docker (Docker Desktop with WSL2 on Windows, Docker Engine on Linux), Git, and Python only inside the image.
2. THE README SHALL instruct the Judge to obtain the OpenBUGS 3.2.3 Linux source tarball independently from the upstream SourceForge project page in a browser, state prominently that this is a manual step because SourceForge refuses scripted downloads, and state where to place it (`vendor/OpenBUGS-3.2.3.tar.gz`).
3. THE README SHALL give the SHA-256 of the copy the maintainers tested, labelled "the copy we tested, not a checksum published by upstream", and SHALL invent no SourceForge checksum and call no mirror authenticated upstream.
4. WHERE an unauthenticated mirror fetch is offered, THE README and the script SHALL label it as an unauthenticated convenience flag that is off by default.
5. THE `infra/openbugs/Dockerfile` default build SHALL use `vendor/OpenBUGS-3.2.3.tar.gz` and verify its SHA-256, and SHALL contact the network only for Debian packages.
6. THE `.dockerignore` SHALL allow the vendored tarball, the Dockerfile and `services/runner/reprolab_runner/**` and nothing else.
7. THE repository SHALL contain `scripts/start.ps1` and `scripts/start.sh` that check prerequisites, build the Local_UI assets if any build step exists, and start `apps/local` on `127.0.0.1`, and an `npm` script that does the same.
8. THE README SHALL cover the coin run, the optional Seeds run, assistant setup with Ollama at `http://127.0.0.1:11434/v1` or a user-supplied key, tests, expected outputs, limitations and troubleshooting for Docker not running, image missing, port in use, and the WSL file-system seek problem.
9. THE README SHALL contain a concise "How Kiro shaped this" section naming the specs, steering files, hook, release gate and task evidence.
10. THE repository SHALL contain `scripts/reset-local.ps1` and `scripts/reset-local.sh` that remove `local-data/runs` and containers labelled `reprolab.run` and touch no tracked file.
11. THE `.kiro` directory SHALL stay tracked.

### Requirement 20: Tracked-file audit

**User Story:** As a maintainer, I want an automatic check that the repository contains nothing it must not publish.

#### Acceptance Criteria

1. THE Tracked_File_Audit SHALL fail when `git ls-files` lists a file with extension `.tar`, `.tar.gz`, `.tgz`, `.zip`, `.so`, `.dll`, `.exe`, `.odc`, `.bmp`, or a path under `vendor/`, `local-data/` or `runs/`.
2. THE Tracked_File_Audit SHALL fail when a tracked file name matches an upstream example name from `docs/evidence/input_hashes_upstream_examples.txt` and its SHA-256 matches the listed hash.
3. THE Tracked_File_Audit SHALL fail when a tracked text file matches a credential pattern (private key header, `sk-` followed by 20 or more word characters, `Bearer ` followed by 20 or more word characters, or an assignment to `REPROLAB_LLM_API_KEY` with a non-empty value).
4. THE Tracked_File_Audit SHALL fail when a tracked file larger than 5 MiB exists.
5. THE Tracked_File_Audit SHALL have a test that feeds each rule a synthetic file list and expects a failure, and one that expects a pass for the real tree.

### Requirement 21: Clean-clone verification

**User Story:** As a maintainer, I want proof that a stranger can follow the README, so that judging does not fail on setup.

#### Acceptance Criteria

1. THE repository SHALL contain `scripts/verify-clean-clone.ps1` that clones the repository into a temporary directory outside the working tree, follows the README commands in order, and writes a transcript to `docs/evidence/local-product/clean-clone.txt`.
2. THE verification SHALL include the tarball step, using the independently obtained tarball when supplied through a parameter.
3. IF the maintainer cannot perform the manual browser download, THEN THE evidence file SHALL state that the locally held tarball copy served as a recorded stand-in for the manual step and SHALL give its SHA-256.
4. THE verification SHALL run `npm ci`, `npm test` in `apps/local`, the image build, the audit, a coin Run through the HTTP API, and a start-up probe of `GET /api/health`.
5. THE verification SHALL delete its temporary clone and remove its containers on completion or failure.

### Requirement 22: Demo script and Devpost checklist

**User Story:** As a submitter, I want a demo script and an honest checklist, so that the submission shows the real product and flags every missing item.

#### Acceptance Criteria

1. THE repository SHALL contain `docs/demo/script.md` with a timed script under 3 minutes and `docs/demo/shot-list.md` for a screen recording of the real product.
2. THE script SHALL use only real footage of the running product and SHALL not claim that a video was uploaded.
3. THE repository SHALL contain `docs/devpost-checklist.md` with entries for the public GitHub repository link (the tryout and test-build link), the public YouTube video link, category Resurrection, the Kiro usage write-up drafted from real artifacts, setup instructions for judges, and a note that no hosting is used and the repository must remain available through judging.
4. WHEN a link or artifact does not exist, THE checklist SHALL mark it `MISSING`.
5. THE Kiro write-up SHALL cite real files: the specs, the steering files, the hook, the release gate record and the evidence directory.

// Authored (hand-written, original-wording) content and classification for the sample-run page.
// Facts that come from evidence files are NOT written here; they are read by build-sample-data.mjs.

export const RUN_ORDER = ['seeds-a', 'seeds-b', 'seeds-c', 'seeds-longburn', 'bad-syntax', 'bad-undefined', 'timeout-live'];

export const RUN_PURPOSE = {
  'seeds-a': 'Pre-declared setting: two chains, 1,000 burn-in updates, 10,000 kept updates, seed 1.',
  'seeds-b': 'Repeat of seeds-a with the same seed, to see whether the output is byte-identical.',
  'seeds-c': 'Same setting as seeds-a with seed 2, to see whether a different seed gives different output.',
  'seeds-longburn': 'Same model and data with 20,000 burn-in updates, chosen after the 1,000 burn-in comparison failed.',
  'bad-syntax': 'Deliberately invalid model (a syntax error) to check that the failure is captured.',
  'bad-undefined': 'Deliberately invalid model (an undefined variable) to check that the failure is captured.',
  'timeout-live': 'Valid model with a very long update count and a 3 second limit, to check that the time limit stops the engine.',
};

export const MODEL_SUMMARY =
  'A random-effects logistic regression over 21 plates of seeds. Five quantities are monitored: alpha0, alpha1, alpha2, alpha12 and sigma.';

export const TOLERANCE_RULE = {
  mean: 'The ReproLab mean must be within 4 times the published Monte Carlo error of the published mean.',
  sd: 'The ReproLab standard deviation must be within 10% of the published standard deviation.',
  source: 'Fixed in the project record before any results were seen.',
  fixed_before_results: true,
};

// Classification of the sections of docs/evidence/comparisons.txt. `header` must be found in the evidence file.
export const COMPARISONS = [
  { id: 'seeds-a-pooled-1000', kind: 'pre_declared', run: 'seeds-a', setting: '2 chains pooled, burn-in 1000',
    header: 'seeds-a pooled burn-in 1000 (pre-declared test, expected FAIL)', note: 'The pre-declared comparison.' },
  { id: 'seeds-c-pooled-1000', kind: 'pre_declared', run: 'seeds-c', setting: '2 chains pooled, burn-in 1000, seed 2',
    header: 'seeds-c pooled burn-in 1000 (expected FAIL)',
    note: 'Same setting as the pre-declared comparison with a different seed. A second failed comparison, not the pre-declared comparison itself.' },
  { id: 'seeds-a-chain1', kind: 'post_hoc', run: 'seeds-a', setting: 'chain 1 only, burn-in 1000',
    header: 'seeds-a chain 1 only (post hoc)', note: 'Chosen after the pooled comparison failed.' },
  { id: 'seeds-a-chain2', kind: 'post_hoc', run: 'seeds-a', setting: 'chain 2 only, burn-in 1000',
    header: 'seeds-a chain 2 only (post hoc, expected FAIL)', note: 'Chosen after the pooled comparison failed.' },
  { id: 'seeds-longburn-pooled-20000', kind: 'post_hoc', run: 'seeds-longburn', setting: '2 chains pooled, burn-in 20000',
    header: 'seeds-longburn pooled burn-in 20000 (post hoc setting, expected PASS)',
    note: 'The burn-in was chosen after the 1,000 burn-in comparison failed. This is not an independent confirmation.' },
];

export const INPUT_ROLE = { 'model.txt': 'Seedsmodel.txt', 'data.txt': 'Seedsdata.txt', 'inits1.txt': 'Seedsinits1.txt', 'inits2.txt': 'Seedsinits2.txt' };
export const RIGHTS = 'Not published here: rights unknown';
export const REPRO_FILES = ['coda_CODAchain1.txt', 'coda_CODAchain2.txt', 'coda_CODAindex.txt', 'log.txt'];

// Program output lines shown on the page (each must equal an exact line of the named log).
export const PROGRAM_OUTPUT = [
  { run: 'bad-syntax', text: 'expected right parenthesis error pos 58 (error on line 4)' },
  { run: 'bad-undefined', text: 'variable gamma_missing is not defined' },
  { run: 'timeout-live', text: 'model is initialized' },
];

// Claims: each states a fact and names the evidence that backs it. The generator checks every assertion.
// kinds: contains (file contains `detail`), line_equals (file has a line exactly equal to `detail`),
//        json_eq (`detail` = "path.to.key=value" against a JSON file).
const D = 'docs/evidence/';
export const CLAIMS = [
  { id: 'engine-version', page: 'home', text: 'The engine reported itself as OpenBUGS version 3.2.3 rev 1012.',
    evidence: [D + 'seeds-a/log.txt'], asserted: [{ path: D + 'seeds-a/log.txt', kind: 'line_equals', detail: 'OpenBUGS version 3.2.3 rev 1012' }] },
  { id: 'predeclared-failed', page: 'sample-run', text: 'The pre-declared comparison failed on all five nodes.',
    evidence: [D + 'comparisons.txt'], asserted: [{ path: D + 'comparisons.txt', kind: 'contains', detail: '(pre-declared test, expected FAIL) (exit=2, expected 2)' }] },
  { id: 'posthoc-label', page: 'sample-run', text: 'The 20,000 burn-in comparison used a setting chosen after the first comparison failed.',
    evidence: [D + 'comparisons.txt'], asserted: [{ path: D + 'comparisons.txt', kind: 'contains', detail: '(post hoc setting, expected PASS)' }] },
  { id: 'bad-syntax-line', page: 'sample-run', text: 'The engine reported a syntax error for the invalid model.',
    evidence: [D + 'bad-syntax/log.txt'], asserted: [{ path: D + 'bad-syntax/log.txt', kind: 'line_equals', detail: 'expected right parenthesis error pos 58 (error on line 4)' }] },
  { id: 'bad-syntax-exit0', page: 'sample-run', text: 'The engine exit code was 0 for the invalid syntax model.',
    evidence: [D + 'bad-syntax/manifest.json'], asserted: [{ path: D + 'bad-syntax/manifest.json', kind: 'json_eq', detail: 'exit_code=0' }] },
  { id: 'bad-undefined-line', page: 'sample-run', text: 'The engine reported an undefined variable.',
    evidence: [D + 'bad-undefined/log.txt'], asserted: [{ path: D + 'bad-undefined/log.txt', kind: 'line_equals', detail: 'variable gamma_missing is not defined' }] },
  { id: 'timeout-status', page: 'sample-run', text: 'The time-limit run was recorded as timed_out.',
    evidence: [D + 'timeout-live/manifest.json'], asserted: [{ path: D + 'timeout-live/manifest.json', kind: 'json_eq', detail: 'status=timed_out' }] },
  { id: 'baseline-by-eye', page: 'sample-run', text: 'The published baseline numbers were read by eye from an image, and the source page does not state the number of chains.',
    evidence: ['services/runner/reference/seeds_published.json'],
    asserted: [{ path: 'services/runner/reference/seeds_published.json', kind: 'contains', detail: 'manually read from the published image' },
               { path: 'services/runner/reference/seeds_published.json', kind: 'contains', detail: 'chain count not stated on the page' }] },
  { id: 'source-licence', page: 'home', text: 'ReproLab-authored code is MIT licensed; OpenBUGS 3.2.3 is the third-party engine in the local execution stack.',
    evidence: ['docs/third-party-notices.md', 'README.md'], asserted: [{ path: 'docs/third-party-notices.md', kind: 'contains', detail: 'authorizes reuse, modification and redistribution of ReproLab-owned code under the MIT licence' },
                                                                       { path: 'README.md', kind: 'contains', detail: "OpenBUGS 3.2.3 is included in ReproLab's local execution stack" }] },
  { id: 'static-site', page: 'home', text: 'This website displays recorded results; model execution is available in the local ReproLab app.',
    evidence: ['README.md'], asserted: [{ path: 'README.md', kind: 'contains', detail: 'Static Next.js site with the recorded Seeds comparison. Hosts no engine.' }] },
  { id: 'isolation-scope', page: 'sample-run', text: 'Isolation options were used on Docker Desktop only, not tested on a production host.',
    evidence: ['docs/engine-feasibility.md'], asserted: [{ path: 'docs/engine-feasibility.md', kind: 'contains', detail: 'This is not a per-job sandbox test on the intended production host' }] },
  { id: 'single-example', page: 'sample-run', text: 'Only one example was run, on one machine with one image.',
    evidence: ['docs/engine-feasibility.md'], asserted: [{ path: 'docs/engine-feasibility.md', kind: 'contains', detail: 'Docker Desktop 29.9.2' }] },
];

export const LIMITATIONS = [
  { id: 'lim-public', text: 'This static comparison site shows recorded results. Model execution is available in the local ReproLab app.', claim_ids: ['static-site'] },
  { id: 'lim-isolation', text: 'Isolation options were used on Docker Desktop only. A production host has not been tested.', claim_ids: ['isolation-scope'] },
  { id: 'lim-scope', text: 'This is one example, run on one machine with one image.', claim_ids: ['single-example'] },
  { id: 'lim-engine', text: 'The local app uses OpenBUGS 3.2.3 in Docker. It can be built and tested by following the README.', claim_ids: ['engine-version'] },
  { id: 'lim-licence-repo', text: 'ReproLab-authored code is MIT licensed; OpenBUGS is the included third-party engine and has its own licence.', claim_ids: ['source-licence'] },
  { id: 'lim-baseline', text: 'The published baseline was read by eye from an image, and its chain count is not stated.', claim_ids: ['baseline-by-eye'] },
  { id: 'lim-coda', text: 'The website build copies recorded numbers. It does not recompute anything from the sample files.', claim_ids: [] },
];

export const STATUS_FACTS = [
  { id: 'repository_licence', label: 'ReproLab-authored code', value: 'MIT', claim_ids: ['source-licence'] },
  { id: 'execution_engine', label: 'Local execution engine', value: 'OpenBUGS 3.2.3', claim_ids: ['engine-version'] },
  { id: 'site_mode', label: 'This website', value: 'Recorded sample; no live execution', claim_ids: ['static-site'] },
];

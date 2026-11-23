import { validateRunRequest } from './validate.mjs';

export const openbugsAdapter = {
  validate: validateRunRequest,

  prepare(value) {
    return [
      ['model.txt', value.model],
      ['data.txt', value.data],
      ...value.inits.map((text, index) => [`inits${index + 1}.txt`, text]),
    ];
  },

  command(value) {
    return [
      'python3', '-m', 'reprolab_runner.cli', 'run',
      '--model', '/work/in/model.txt', '--data', '/work/in/data.txt',
      '--inits', ...value.inits.map((_, index) => `/work/in/inits${index + 1}.txt`),
      '--monitor', ...value.monitors,
      '--burn-in', String(value.burnIn), '--samples', String(value.samples),
      '--thin', String(value.thin), '--seed', String(value.seed),
      '--timeout', String(value.timeoutS), '--out', '/work/out',
    ];
  },

  interpret(manifest) {
    const state = new Map([['succeeded', 'succeeded'], ['failed', 'engine_error'], ['timed_out', 'timed_out']]).get(manifest.status);
    const note = typeof manifest.reason === 'string' ? manifest.reason : 'The Runner gave no reason.';
    return { state: state ?? 'runner_error', reason: state ? note : `The run manifest has an unknown status. ${note}` };
  },

  summaryFiles(names) {
    return names.filter((name) => /^coda_[A-Za-z0-9_.-]+\.txt$/.test(name));
  },

  summaryCommand: ['python3', '-m', 'reprolab_runner.cli', 'summarize', '--dir', '/work/in'],
};

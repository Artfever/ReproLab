// Demo routes (spec 03-local-product, task 4.1). GET /api/demos lists the coin demos and the
// Seeds entry. Seeds carries a `request` only when all four upstream files verify; otherwise it
// carries `missingReason` and no `request`. Tests inject `deps.demos` (examplesDir, upstreamDir, hashFile).
import { listDemos } from '../demos.mjs';
import { engineById, fixtureDemos } from '../engines.mjs';

export function routes(deps = {}) {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/demos$/,
      handler: ({ url }) => {
        const id = url.searchParams.get('engine') ?? 'openbugs';
        const engine = engineById(id);
        if (!engine) return { status: 404, json: { error: 'Unknown engine.' } };
        if (id !== 'openbugs') return { status: 200, json: fixtureDemos(engine) };
        try {
          return { status: 200, json: listDemos(deps.demos ?? {}) };
        } catch {
          return { status: 500, json: { error: 'The demonstration files could not be read. Check that examples/reprolab exists.' } };
        }
      },
    },
  ];
}

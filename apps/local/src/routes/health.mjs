// Health route (spec 03-local-product, task 3.3): Docker and image presence, for the UI and scripts.
import { getRuns } from './runs.mjs';

export function routes(deps = {}) {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/health$/,
      handler: async () => ({ status: 200, json: await getRuns(deps).health() }),
    },
  ];
}

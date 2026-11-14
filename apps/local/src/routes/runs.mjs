// Run routes (spec 03-local-product, task 3.3). Requirements 4.5, 5.9, 7.5, 7.6.
// Id and file-name segments are captured loosely and checked by the run manager (404 on any failure).
import * as realDocker from '../docker.mjs';
import { createRunManager, BUSY_MESSAGE } from '../runs.mjs';
import { validateRunRequest } from '../validate.mjs';

const NOT_FOUND = { status: 404, json: { error: 'Run not found.' } };

/** The injected manager, or one built lazily on first use from the injected or real docker module. */
export function getRuns(deps) {
  if (!deps.runs) deps.runs = createRunManager({ docker: deps.docker ?? realDocker });
  return deps.runs;
}

function decodeSegment(s) {
  try { return decodeURIComponent(s); } catch { return ''; }
}

export function routes(deps = {}) {
  return [
    {
      method: 'POST',
      pattern: /^\/api\/validate$/,
      handler: ({ body }) => {
        const r = validateRunRequest(body);
        return { status: 200, json: { ok: r.ok, problems: r.problems } };
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/runs$/,
      handler: async ({ body }) => {
        const r = validateRunRequest(body);
        if (!r.ok) return { status: 400, json: { ok: false, problems: r.problems } };
        const out = await getRuns(deps).submit(r.value);
        if (out.busy) return { status: 429, json: { error: BUSY_MESSAGE } };
        return { status: 202, json: { id: out.id, state: out.state } };
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/runs\/(?<id>[^/]+)$/,
      handler: async ({ params }) => {
        const runs = getRuns(deps);
        await runs.ready;
        const run = runs.getRun(decodeSegment(params.id));
        return run ? { status: 200, json: run } : NOT_FOUND;
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/runs\/(?<id>[^/]+)\/manifest$/,
      handler: async ({ params }) => {
        const runs = getRuns(deps);
        await runs.ready;
        const buf = runs.getManifest(decodeSegment(params.id));
        if (!buf) return NOT_FOUND;
        return {
          stream: (res, { send }) => send(res, 200, {
            body: buf,
            contentType: 'application/json; charset=utf-8',
            headers: { 'Content-Disposition': 'attachment; filename="manifest.json"' },
          }),
        };
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/runs\/(?<id>[^/]+)\/files\/(?<name>[^/]+)$/,
      handler: async ({ params }) => {
        const runs = getRuns(deps);
        await runs.ready;
        const name = decodeSegment(params.name);
        const buf = runs.getFile(decodeSegment(params.id), name);
        if (!buf) return { status: 404, json: { error: 'File not found.' } };
        return {
          stream: (res, { send }) => send(res, 200, {
            body: buf,
            contentType: 'text/plain; charset=utf-8',
            headers: { 'Content-Disposition': `attachment; filename="${name}"` },
          }),
        };
      },
    },
  ];
}

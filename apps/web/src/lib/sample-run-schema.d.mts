export type SchemaResult = { ok: true } | { ok: false; field: string };
export function validateSampleRun(data: unknown): SchemaResult;
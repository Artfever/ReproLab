import raw from '../../content/sample-run.json';
import { validateSampleRun } from './sample-run-schema.mjs';

export type NodeName = 'alpha0' | 'alpha1' | 'alpha12' | 'alpha2' | 'sigma';
export interface FileEntry { name: string; bytes: number; sha256: string }
export interface Run {
  name: string; purpose: string; status: 'succeeded' | 'failed' | 'timed_out'; reason: string; exit_code: number | null; runtime_s: number;
  engine_version: string; image_id: string; chains: number; burn_in: number; samples: number; thin: number; seed: number; timeout_s: number;
  monitors: string[]; outputs: FileEntry[]; inputs: FileEntry[];
}
export interface ComparisonRow {
  node: NodeName; ref_mean: number; mean: number; d_mean: number; mean_tol: number; mean_ok: boolean;
  ref_sd: number; sd: number; d_sd: number; sd_tol: number; sd_ok: boolean; ok: boolean;
}
export interface Comparison {
  id: string; label: string; kind: 'pre_declared' | 'post_hoc'; run: string; setting: string; exit_code: number; expected_exit_code: number;
  rows: ComparisonRow[]; overall: { result: 'pass' | 'fail'; nodes_failed: number; nodes_total: number }; note: string;
}
export interface Claimed { id: string; text?: string; label?: string; value?: string; claim_ids?: string[] }
export interface SampleRun {
  engine: { name: string; version: string; image_id: string; image_pushed: boolean };
  model_summary: string;
  published_baseline: { source: string; settings: string; transcribed_by: string; nodes: Record<NodeName, { mean: number; sd: number; mc_error: number }> };
  tolerance_rule: { mean: string; sd: string; source: string };
  inputs: { name: string; upstream_name: string; bytes: number; sha256: string; rights_status: string }[];
  runs: Run[]; comparisons: Comparison[];
  output_summary: { run: string; label: string; nodes: Record<NodeName, { mean: number; sd: number; median: number; q2_5: number; q97_5: number; n: number }> };
  reproducibility: { seeds_a_vs_b: { file: string; identical: boolean }[]; seeds_c_vs_a: { file: string; identical: boolean }[]; scope: string };
  program_output: { run: string; line_no: number; text: string }[];
  limitations: { id: string; text: string; claim_ids: string[] }[];
  status_facts: { id: string; label: string; value: string; claim_ids: string[] }[];
  claims: { id: string; page: string; text: string; evidence: string[] }[];
}
export type Loaded = { ok: true; data: SampleRun } | { ok: false; field: string };

export const NODE_ORDER: NodeName[] = ['alpha0', 'alpha1', 'alpha12', 'alpha2', 'sigma'];

export function loadSampleRun(input: unknown = raw): Loaded {
  const r = validateSampleRun(input);
  return r.ok ? { ok: true, data: input as SampleRun } : { ok: false, field: r.field };
}
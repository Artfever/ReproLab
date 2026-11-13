"""Compare computed summaries with a published reference.

Tolerance is fixed BEFORE looking at results (see docs/engine-feasibility.md):
  |mean - ref_mean| <= MEAN_K * ref_mc_error   and   |sd - ref_sd| <= SD_REL * ref_sd
"""
from __future__ import annotations

MEAN_K = 4.0
SD_REL = 0.10


def compare(summary: dict[str, dict[str, float]], reference: dict[str, dict[str, float]], mean_k: float = MEAN_K, sd_rel: float = SD_REL) -> list[dict]:
    rows = []
    for node, ref in reference.items():
        got = summary.get(node)
        if got is None:
            rows.append({"node": node, "ok": False, "note": "node missing from run"})
            continue
        dmean = got["mean"] - ref["mean"]
        dsd = got["sd"] - ref["sd"]
        mean_ok = abs(dmean) <= mean_k * ref["mc_error"]
        sd_ok = abs(dsd) <= sd_rel * ref["sd"]
        rows.append({"node": node, "ref_mean": ref["mean"], "mean": got["mean"], "d_mean": dmean, "mean_tol": mean_k * ref["mc_error"], "mean_ok": mean_ok,
                     "ref_sd": ref["sd"], "sd": got["sd"], "d_sd": dsd, "sd_tol": sd_rel * ref["sd"], "sd_ok": sd_ok, "ok": mean_ok and sd_ok})
    return rows
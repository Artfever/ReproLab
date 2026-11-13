"""Parse OpenBUGS CODA exports and compute labelled summaries from real samples."""
from __future__ import annotations

import math
from pathlib import Path


class CodaParseError(Exception):
    pass


def read_coda(directory: Path, stem: str = "coda_") -> dict[str, list[list[float]]]:
    """Return {node: [chain1_samples, chain2_samples, ...]}."""
    index = directory / f"{stem}CODAindex.txt"
    if not index.is_file():
        raise CodaParseError(f"missing {index.name}")
    ranges: dict[str, tuple[int, int]] = {}
    for n, line in enumerate(index.read_text(encoding="ascii").splitlines(), 1):
        parts = line.split()
        if not line.strip():
            continue
        if len(parts) != 3:
            raise CodaParseError(f"{index.name}:{n}: expected 3 fields, got {len(parts)}")
        try:
            ranges[parts[0]] = (int(parts[1]), int(parts[2]))
        except ValueError as exc:
            raise CodaParseError(f"{index.name}:{n}: {exc}") from exc
    chains = sorted(directory.glob(f"{stem}CODAchain*.txt"), key=lambda p: int(p.stem.rsplit("chain", 1)[1]))
    if not chains:
        raise CodaParseError("no chain files")
    out: dict[str, list[list[float]]] = {k: [] for k in ranges}
    for path in chains:
        rows: list[float] = []
        for n, line in enumerate(path.read_text(encoding="ascii").splitlines(), 1):
            parts = line.split()
            if not parts:
                continue
            if len(parts) != 2:
                raise CodaParseError(f"{path.name}:{n}: expected 2 fields")
            try:
                rows.append(float(parts[1]))
            except ValueError as exc:
                raise CodaParseError(f"{path.name}:{n}: {exc}") from exc
        for node, (lo, hi) in ranges.items():
            if hi > len(rows):
                raise CodaParseError(f"{path.name}: index range {lo}-{hi} exceeds {len(rows)} rows")
            out[node].append(rows[lo - 1 : hi])
    return out


def _quantile(sorted_vals: list[float], q: float) -> float:
    pos = q * (len(sorted_vals) - 1)
    lo = math.floor(pos)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def summarize(samples: dict[str, list[list[float]]]) -> dict[str, dict[str, float]]:
    """Pooled-chain mean, sd, quantiles. Simple descriptive statistics only."""
    result: dict[str, dict[str, float]] = {}
    for node, chains in samples.items():
        vals = [v for c in chains for v in c]
        n = len(vals)
        if n < 2:
            raise CodaParseError(f"{node}: need at least 2 samples")
        mean = math.fsum(vals) / n
        var = math.fsum((v - mean) ** 2 for v in vals) / (n - 1)
        s = sorted(vals)
        result[node] = {"n": float(n), "mean": mean, "sd": math.sqrt(var), "q2.5": _quantile(s, 0.025), "median": _quantile(s, 0.5), "q97.5": _quantile(s, 0.975)}
    return result

def summarize_per_chain(samples: dict[str, list[list[float]]]) -> dict[str, list[dict[str, float]]]:
    """Per-chain summaries, to show whether chains agree (a necessary, not sufficient, sanity check)."""
    return {node: list(summarize({node: [chain]})[node] for chain in chains) for node, chains in samples.items()}

def select_chains(samples: dict[str, list[list[float]]], keep: list[int]) -> dict[str, list[list[float]]]:
    """Keep only the given 1-based chain numbers (used for labelled, per-chain comparisons)."""
    out: dict[str, list[list[float]]] = {}
    for node, chains in samples.items():
        for k in keep:
            if not 1 <= k <= len(chains):
                raise CodaParseError(f"chain {k} not available (have {len(chains)})")
        out[node] = [chains[k - 1] for k in keep]
    return out
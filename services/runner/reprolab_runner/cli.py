"""Command line entry: run | summarize | compare."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .adapter import RunnerError, RunSettings, run_openbugs
from .coda import CodaParseError, read_coda, select_chains, summarize, summarize_per_chain
from .compare import compare


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="reprolab_runner")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--model", type=Path, required=True)
    r.add_argument("--data", type=Path, required=True)
    r.add_argument("--inits", type=Path, nargs="+", required=True)
    r.add_argument("--monitor", nargs="+", required=True)
    r.add_argument("--burn-in", type=int, required=True)
    r.add_argument("--samples", type=int, required=True)
    r.add_argument("--thin", type=int, default=1)
    r.add_argument("--seed", type=int, required=True, help="1-14, passed to modelSetRN")
    r.add_argument("--timeout", type=int, default=300)
    r.add_argument("--out", type=Path, required=True)
    s = sub.add_parser("summarize")
    s.add_argument("--dir", type=Path, required=True)
    s.add_argument("--per-chain", action="store_true")
    c = sub.add_parser("compare")
    c.add_argument("--dir", type=Path, required=True)
    c.add_argument("--reference", type=Path, required=True)
    c.add_argument("--chains", type=int, nargs="+", help="compare only these 1-based chains (default: all, pooled)")
    a = ap.parse_args(argv)
    try:
        if a.cmd == "run":
            st = RunSettings(tuple(a.monitor), a.burn_in, a.samples, a.thin, a.seed, a.timeout)
            res = run_openbugs(st, a.model, a.data, a.inits, a.out, image_digest=os.environ.get("REPROLAB_IMAGE_DIGEST"))
            print(json.dumps(res.__dict__, indent=2))
            return 0 if res.status == "succeeded" else 1
        samples = read_coda(a.dir)
        if a.cmd == "compare" and a.chains:
            samples = select_chains(samples, a.chains)
        summ = summarize(samples)
        if a.cmd == "summarize":
            if a.per_chain:
                print(json.dumps(summarize_per_chain(samples), indent=2, sort_keys=True))
                return 0
            print(json.dumps(summ, indent=2, sort_keys=True))
            return 0
        ref = json.loads(a.reference.read_text(encoding="utf-8"))["nodes"]
        rows = compare(summ, ref)
        print(json.dumps(rows, indent=2))
        return 0 if all(x["ok"] for x in rows) else 2
    except (RunnerError, CodaParseError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
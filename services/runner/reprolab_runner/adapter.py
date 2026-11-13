"""Typed OpenBUGS batch adapter.

Linux notes: modelDisplay/modelSaveLog do not exist in the Linux build (the log is always
stdout), and the engine library cannot seek on Windows bind mounts, so runs must use
container-local storage.\n\nSecurity notes: the engine is started with an argument list (never a shell
string); staged files get fixed generated names; every value that is written
into the generated script is validated against a strict allowlist first.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import signal
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Sequence

DEFAULT_ENGINE = "/opt/openbugs/bin/OpenBUGS"
MAX_MODEL_BYTES = 256 * 1024
MAX_DATA_BYTES = 2 * 1024 * 1024
NODE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.]{0,63}$")
VERSION_RE = re.compile(r"OpenBUGS version (\S+) rev (\S+)")

# The engine exits 0 even when the model is invalid, so success is decided from the log.
# Patterns below are copied from real OpenBUGS 3.2.3 output (see docs/engine-feasibility.md).
ENGINE_ERROR_PATTERNS = (
    re.compile(r"error pos \d+"),                 # e.g. "expected right parenthesis error pos 58 (error on line 4)"
    re.compile(r"\bis not defined\b"),            # e.g. "variable gamma_missing is not defined"
    re.compile(r"^model must ", re.MULTILINE),    # cascade after an earlier failed step
    re.compile(r"unknown script command"),
    re.compile(r"Sorry something went wrong"),
)
# Every one of these must appear (in this order) for a run to count as successful.
REQUIRED_SUCCESS_MARKERS = (
    "model is syntactically correct",
    "data loaded",
    "model compiled",
    "model is initialized",
    "updates took",
    "Node statistics",
    "CODA files written",
)

class RunnerError(Exception):
    """Base class for adapter failures."""


class InputError(RunnerError):
    """A caller-supplied value or file was rejected before the engine ran."""


@dataclass(frozen=True)
class RunSettings:
    monitors: tuple[str, ...]
    burn_in: int
    samples: int
    thin: int = 1
    seed: int | None = None
    timeout_s: int = 300

    def validate(self, n_chains: int) -> None:
        if not 1 <= n_chains <= 4:
            raise InputError(f"chains must be 1-4, got {n_chains}")
        if not 0 <= self.burn_in <= 50_000:
            raise InputError("burn_in must be 0-50000")
        if not 1 <= self.samples <= 50_000:
            raise InputError("samples must be 1-50000")
        if not 1 <= self.thin <= 100:
            raise InputError("thin must be 1-100")
        if self.seed is not None and not 1 <= self.seed <= 14:
            raise InputError("seed must be an integer 1-14 (modelSetRN range)")
        if not 1 <= self.timeout_s <= 3600:
            raise InputError("timeout_s must be 1-3600")
        if not 1 <= len(self.monitors) <= 25 or len(set(self.monitors)) != len(self.monitors):
            raise InputError("monitors must be 1-25 unique names")
        for name in self.monitors:
            if not NODE_RE.match(name):
                raise InputError(f"invalid monitor name: {name!r}")


@dataclass
class RunResult:
    status: str  # succeeded | failed | timed_out
    reason: str
    exit_code: int | None
    runtime_s: float
    engine_version: str | None
    out_dir: str


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def read_text_input(path: Path, limit: int, label: str) -> bytes:
    """Bounded read; plain ASCII, no NUL bytes (OpenBUGS Linux needs ASCII)."""
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise InputError(f"{label}: cannot read {path}: {exc.strerror}") from exc
    if size == 0 or size > limit:
        raise InputError(f"{label}: size must be 1..{limit} bytes, got {size}")
    raw = path.read_bytes()
    if b"\x00" in raw:
        raise InputError(f"{label}: contains NUL byte")
    try:
        raw.decode("ascii")
    except UnicodeDecodeError as exc:
        raise InputError(f"{label}: not plain ASCII ({exc})") from exc
    return raw


def build_script(settings: RunSettings, n_chains: int, workdir: str) -> str:
    settings.validate(n_chains)
    if not re.fullmatch(r"[A-Za-z0-9_./-]+", workdir):
        raise InputError("workdir contains unsupported characters")
    lines = [f"modelSetWD('{workdir}')", "modelCheck('model.txt')", "modelData('data.txt')", f"modelCompile({n_chains})"]
    if settings.seed is not None:
        lines.append(f"modelSetRN({settings.seed})")
    lines += [f"modelInits('inits{c}.txt',{c})" for c in range(1, n_chains + 1)]
    lines.append(f"modelUpdate({settings.burn_in})")
    lines += [f"samplesSet('{m}')" for m in settings.monitors]
    lines.append(f"modelUpdate({settings.samples},{settings.thin})")
    lines += ["samplesStats('*')", "samplesCoda('*','coda_')", "modelQuit('yes')"]
    return "\n".join(lines) + "\n"


def classify(exit_code: int | None, timed_out: bool, log_text: str, expected_files: Sequence[Path]) -> tuple[str, str]:
    """Never report success from the exit code alone."""
    if timed_out:
        return "timed_out", "engine exceeded the time limit and was killed"
    if exit_code != 0:
        return "failed", f"engine exited with status {exit_code}"
    for pat in ENGINE_ERROR_PATTERNS:
        m = pat.search(log_text)
        if m:
            line = next((l.strip() for l in log_text.splitlines() if pat.search(l)), m.group(0))
            return "failed", f"engine reported a problem: {line[:200]}"
    pos = 0
    for marker in REQUIRED_SUCCESS_MARKERS:
        pos = log_text.find(marker, pos)
        if pos < 0:
            return "failed", f"log lacks expected engine message: {marker!r}"
    absent = [p.name for p in expected_files if not p.is_file() or p.stat().st_size == 0]
    if absent:
        return "failed", f"expected output files missing or empty: {absent}"
    return "succeeded", "engine finished and all expected files exist"


def run_openbugs(
    settings: RunSettings,
    model: Path,
    data: Path,
    inits: Sequence[Path],
    out_dir: Path,
    engine: str = DEFAULT_ENGINE,
    image_digest: str | None = None,
) -> RunResult:
    n_chains = len(inits)
    settings.validate(n_chains)
    staged = {
        "model.txt": read_text_input(model, MAX_MODEL_BYTES, "model"),
        "data.txt": read_text_input(data, MAX_DATA_BYTES, "data"),
    }
    for i, p in enumerate(inits, start=1):
        staged[f"inits{i}.txt"] = read_text_input(p, MAX_DATA_BYTES, f"inits{i}")

    out_dir = out_dir.resolve()
    try:
        out_dir.mkdir(parents=True, exist_ok=False)  # unique work dir per run
    except FileExistsError as exc:
        raise InputError(f"output directory already exists: {out_dir}") from exc
    for name, raw in staged.items():
        (out_dir / name).write_bytes(raw)
    script = build_script(settings, n_chains, out_dir.as_posix())
    (out_dir / "script.txt").write_text(script, encoding="ascii")

    argv = [engine, "-t", "script.txt"]  # -t: no template expansion
    log_path, err_path = out_dir / "log.txt", out_dir / "stderr.txt"
    start = time.monotonic()
    timed_out, exit_code = False, None
    with log_path.open("wb") as out, err_path.open("wb") as err:
        proc = subprocess.Popen(argv, cwd=out_dir, stdout=out, stderr=err, stdin=subprocess.DEVNULL, start_new_session=True)
        try:
            exit_code = proc.wait(timeout=settings.timeout_s)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
    runtime = time.monotonic() - start

    log_text = log_path.read_text(encoding="ascii", errors="replace")
    expected = [out_dir / f"coda_CODAchain{c}.txt" for c in range(1, n_chains + 1)] + [out_dir / "coda_CODAindex.txt"]
    status, reason = classify(exit_code, timed_out, log_text, expected)
    m = VERSION_RE.search(log_text)
    version = f"{m.group(1)} rev {m.group(2)}" if m else None

    manifest = {
        "status": status,
        "reason": reason,
        "argv": argv,
        "script": script,
        "exit_code": exit_code,
        "runtime_s": round(runtime, 3),
        "engine_version": version,
        "image_digest": image_digest,
        "settings": asdict(settings),
        "n_chains": n_chains,
        "files": {p.name: {"sha256": sha256_file(p), "bytes": p.stat().st_size} for p in sorted(out_dir.iterdir()) if p.is_file() and p.name != "manifest.json"},
    }
    try:
        (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="ascii")
    except OSError as exc:
        raise RunnerError(f"cannot write manifest.json: {exc}") from exc
    return RunResult(status, reason, exit_code, round(runtime, 3), version, str(out_dir))
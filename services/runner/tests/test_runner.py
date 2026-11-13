"""Focused tests for the adapter, CODA parser and comparison (stdlib unittest; also runs under pytest)."""
import json
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from reprolab_runner.adapter import InputError, RunnerError, RunSettings, build_script, classify, read_text_input, run_openbugs  # noqa: E402
from reprolab_runner.coda import CodaParseError, read_coda, select_chains, summarize  # noqa: E402
from reprolab_runner.compare import compare  # noqa: E402

GOOD = RunSettings(monitors=("alpha0", "sigma"), burn_in=10, samples=20, seed=1)


class ScriptTests(unittest.TestCase):
    def test_script_order_and_values(self):
        s = build_script(GOOD, 2, "/work/run1").splitlines()
        self.assertEqual(s[0], "modelSetWD('/work/run1')")
        self.assertIn("modelCompile(2)", s)
        self.assertIn("modelInits('inits2.txt',2)", s)
        self.assertLess(s.index("modelUpdate(10)"), s.index("samplesSet('alpha0')"))  # burn-in precedes monitoring
        self.assertEqual(s[-1], "modelQuit('yes')")
        text = "\n".join(s)
        self.assertNotIn("modelDisplay", text)  # not available in the Linux build
        self.assertNotIn("modelSaveLog", text)

    def test_rejects_injection_and_ranges(self):
        for bad in ("a'); modelQuit('yes'); ('", "1abc", "", "x y"):
            with self.assertRaises(InputError):
                build_script(RunSettings((bad,), 1, 1), 1, "/w")
        with self.assertRaises(InputError):
            build_script(RunSettings(("a",), 1, 1, seed=15), 1, "/w")
        with self.assertRaises(InputError):
            build_script(GOOD, 5, "/w")
        with self.assertRaises(InputError):
            build_script(GOOD, 1, "/w with space")


class InputTests(unittest.TestCase):
    def test_ascii_nul_size(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "m.txt"
            p.write_bytes(b"model { }")
            self.assertEqual(read_text_input(p, 100, "m"), b"model { }")
            p.write_bytes(b"a\x00b")
            with self.assertRaises(InputError):
                read_text_input(p, 100, "m")
            p.write_bytes("caf\u00e9".encode("utf-8"))
            with self.assertRaises(InputError):
                read_text_input(p, 100, "m")
            p.write_bytes(b"")
            with self.assertRaises(InputError):
                read_text_input(p, 100, "m")


class ClassifyTests(unittest.TestCase):
    def test_never_success_from_exit_code_alone(self):
        self.assertEqual(classify(None, True, "", [])[0], "timed_out")
        self.assertEqual(classify(1, False, "", [])[0], "failed")
        self.assertEqual(classify(0, False, "nothing useful", [])[0], "failed")  # exit 0 but no engine success messages


REAL_OK_LOG = """OpenBUGS version 3.2.3 rev 1012
model is syntactically correct
data loaded
model compiled
initial values loaded and chain initialized but another chain contain uninitialized variables
model is initialized
1000 updates took 0 s
monitor set
10000 updates took 1 s
Node statistics
\t\tmean\tsd\tMC_error\tval2.5pc\tmedian\tval97.5pc\tstart\tsample
\talpha0\t0.02839\t1.776\t0.1236\t-0.9313\t-0.5146\t5.901\t1001\t20000
CODA files written
"""
REAL_SYNTAX_LOG = "OpenBUGS version 3.2.3 rev 1012\nexpected right parenthesis error pos 58 (error on line 4)\nmodel must be checked before data is loaded\n"
REAL_UNDEF_LOG = "OpenBUGS version 3.2.3 rev 1012\nmodel is syntactically correct\ndata loaded (variables not in the model: x2)\nvariable gamma_missing is not defined\nmodel must be compiled before initial values loaded\n"


class RealLogTests(unittest.TestCase):
    def test_success_log_not_tripped_by_mc_error_header(self):
        with tempfile.TemporaryDirectory() as t:
            files = []
            for n in ("a", "b"):
                p = Path(t) / n
                p.write_text("x")
                files.append(p)
            self.assertEqual(classify(0, False, REAL_OK_LOG, files)[0], "succeeded")
            self.assertEqual(classify(0, False, REAL_OK_LOG, [Path(t) / "missing"])[0], "failed")

    def test_invalid_models_fail_even_with_exit_code_zero(self):
        st, reason = classify(0, False, REAL_SYNTAX_LOG, [])
        self.assertEqual(st, "failed")
        self.assertIn("error pos 58", reason)
        st, reason = classify(0, False, REAL_UNDEF_LOG, [])
        self.assertEqual(st, "failed")
        self.assertIn("gamma_missing", reason)


class CodaTests(unittest.TestCase):
    def _write(self, d: Path, c1, c2):
        (d / "coda_CODAindex.txt").write_text(f"a 1 {len(c1)}\n")
        for n, vals in ((1, c1), (2, c2)):
            (d / f"coda_CODAchain{n}.txt").write_text("".join(f"{i} {v}\n" for i, v in enumerate(vals, 1)))

    def test_parse_and_summary(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            self._write(d, [1.0, 2.0, 3.0], [4.0, 5.0, 6.0])
            s = summarize(read_coda(d))["a"]
            self.assertAlmostEqual(s["mean"], 3.5)
            self.assertAlmostEqual(s["sd"], 1.8708286933869707)
            self.assertAlmostEqual(s["median"], 3.5)

    def test_select_chains(self):
        s = {"a": [[1.0, 2.0], [10.0, 20.0]]}
        self.assertEqual(select_chains(s, [2]), {"a": [[10.0, 20.0]]})
        with self.assertRaises(CodaParseError):
            select_chains(s, [3])

    def test_malformed(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            self._write(d, [1.0, 2.0], [3.0, 4.0])
            (d / "coda_CODAchain1.txt").write_text("1 abc\n2 3\n")
            with self.assertRaises(CodaParseError):
                read_coda(d)
            with self.assertRaises(CodaParseError):
                read_coda(d / "missing")


class CompareTests(unittest.TestCase):
    def test_tolerance(self):
        ref = {"x": {"mean": 1.0, "sd": 1.0, "mc_error": 0.01}}
        self.assertTrue(compare({"x": {"mean": 1.03, "sd": 1.05}}, ref)[0]["ok"])
        self.assertFalse(compare({"x": {"mean": 1.05, "sd": 1.0}}, ref)[0]["ok"])  # > 4*0.01
        self.assertFalse(compare({"x": {"mean": 1.0, "sd": 1.2}}, ref)[0]["ok"])
        self.assertFalse(compare({}, ref)[0]["ok"])


@unittest.skipUnless(sys.platform.startswith("linux"), "needs POSIX process groups")
class TimeoutTests(unittest.TestCase):
    def test_timeout_kills_engine_and_reports(self):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            for n in ("m.txt", "d.txt", "i.txt"):
                (t / n).write_text("x")
            fake = t / "fake_engine"
            fake.write_text("#!/bin/sh\nsleep 30\n")
            fake.chmod(fake.stat().st_mode | stat.S_IXUSR)
            st = RunSettings(("a",), 1, 1, timeout_s=1)
            res = run_openbugs(st, t / "m.txt", t / "d.txt", [t / "i.txt"], t / "out", engine=str(fake))
            self.assertEqual(res.status, "timed_out")
            self.assertLess(res.runtime_s, 10)
            self.assertEqual(json.loads((t / "out" / "manifest.json").read_text())["status"], "timed_out")


@unittest.skipUnless(sys.platform.startswith("linux"), "needs POSIX shell")
class ManifestTests(unittest.TestCase):
    def _inputs(self, t: Path):
        for n in ("m.txt", "d.txt", "i.txt"):
            (t / n).write_text("x")

    def _fake(self, t: Path, body: str) -> str:
        p = t / "fake_engine"
        p.write_text("#!/bin/sh\n" + body + "\n")
        p.chmod(p.stat().st_mode | stat.S_IXUSR)
        return str(p)

    def test_manifest_round_trip(self):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            self._inputs(t)
            st = RunSettings(("a",), 1, 1, seed=3, timeout_s=10)
            run_openbugs(st, t / "m.txt", t / "d.txt", [t / "i.txt"], t / "out", engine=self._fake(t, "echo nothing useful"), image_digest="sha256:test")
            text = (t / "out" / "manifest.json").read_text()
            obj = json.loads(text)
            self.assertEqual(json.loads(json.dumps(obj, indent=2, sort_keys=True)), obj)
            self.assertEqual(obj["status"], "failed")  # exit 0 but no engine success messages
            self.assertEqual(obj["exit_code"], 0)
            self.assertEqual(obj["image_digest"], "sha256:test")
            self.assertEqual(obj["settings"]["seed"], 3)
            self.assertIn("modelSetRN(3)", obj["script"])
            for name in ("model.txt", "data.txt", "inits1.txt", "script.txt", "log.txt", "stderr.txt"):
                self.assertEqual(len(obj["files"][name]["sha256"]), 64)

    def test_unwritable_manifest_raises(self):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            self._inputs(t)
            st = RunSettings(("a",), 1, 1, timeout_s=10)
            with self.assertRaises(RunnerError):
                run_openbugs(st, t / "m.txt", t / "d.txt", [t / "i.txt"], t / "out", engine=self._fake(t, "mkdir manifest.json"))


class CleanErrorTests(unittest.TestCase):
    def test_missing_input_and_existing_output_dir(self):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            (t / "d.txt").write_text("x")
            (t / "i.txt").write_text("x")
            st = RunSettings(("a",), 1, 1)
            with self.assertRaises(InputError):
                run_openbugs(st, t / "nope.txt", t / "d.txt", [t / "i.txt"], t / "out", engine="/bin/true")
            (t / "m.txt").write_text("x")
            (t / "out").mkdir()
            with self.assertRaises(InputError):
                run_openbugs(st, t / "m.txt", t / "d.txt", [t / "i.txt"], t / "out", engine="/bin/true")

if __name__ == "__main__":
    unittest.main()
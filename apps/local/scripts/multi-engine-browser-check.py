"""Drive the real app with Playwright. Start the local server before invoking."""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def verify(page, base, engine, case, temp, parent=None):
    page.goto(base + "/run.html")
    selector = page.locator("#engine-select")
    expect(selector.locator("option")).to_have_count(9, timeout=25000)
    selector.select_option(engine)
    if engine == "openbugs":
        page.locator("#demo").select_option("coin" if case == "demo" else "coin-invalid")
    else:
        if not page.locator("#submit").is_enabled():
            raise RuntimeError(page.locator("#engine-note").inner_text())
        page.locator("#fixture-case").select_option(case)
        if parent:
            page.locator("#parent-run").fill(parent["run_id"])
    page.locator("#submit").click()
    page.wait_for_url("**/results.html?id=*")
    page.locator("#manifest-link").wait_for(timeout=165000)
    with page.expect_download() as event:
        page.locator("#manifest-link").click()
    manifest_path = temp / "manifest.json"
    event.value.save_as(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected = "engine_error" if case == "failure" else "succeeded"
    if manifest["state"] != expected:
        raise RuntimeError(f"{manifest['state']}: {manifest['reason']}")
    if expected == "succeeded" and manifest["comparison"]["status"] != "passed":
        raise RuntimeError(f"comparison {manifest['comparison']}")
    if parent:
        assert manifest["parent_run_id"] == parent["run_id"]
        assert manifest["inputs"]["alignment"]["sha256"] == parent["alignmentHash"]
    downloads = []
    for artifact in manifest["output_files"]:
        name = artifact["name"]
        if name in {"model.txt", "data.txt", "inits1.txt", "inits2.txt"}:
            continue
        with page.expect_download() as event:
            page.get_by_role("link", name=f"Download {name}", exact=True).click()
        target = temp / name
        event.value.save_as(target)
        data = target.read_bytes()
        if hashlib.sha256(data).hexdigest() != artifact["sha256"]:
            raise RuntimeError(f"download hash mismatch: {name}")
        downloads.append(name)
    assert downloads
    with page.expect_download() as event:
        page.locator("#bundle-output").click()
    bundle_path = temp / "bundle.json"
    event.value.save_as(bundle_path)
    bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    assert bundle["manifest"]["run_id"] == manifest["run_id"]
    assert all(name in bundle["files"] for name in downloads)
    assert not {"model.txt", "data.txt", "inits1.txt"}.intersection(bundle["files"])
    return {key: manifest.get(key) for key in ("run_id", "image", "engine_version", "state", "exit_code", "runtime_s", "peak_rss_kib", "reason", "comparison")} | {
        "downloaded": downloads, "artifactBytes": sum(a["bytes"] for a in manifest["output_files"]),
        "alignmentHash": next((a["sha256"] for a in manifest["output_files"] if a["name"] == "accepted_hits.bam"), None),
        "traceHashes": {a["name"]: a["sha256"] for a in manifest["output_files"] if a["name"].startswith("coda_CODA")},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8765")
    parser.add_argument("engines", nargs="*")
    config = parser.parse_args()
    failed = False
    with sync_playwright() as playwright, tempfile.TemporaryDirectory() as directory:
        browser = playwright.chromium.launch(channel="chrome")
        page = browser.new_page(accept_downloads=True)
        response = page.request.get(config.base + "/api/engines")
        engines = response.json()
        assert len(engines) == 9
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(config.base + "/run.html")
        selector = page.locator("#engine-select")
        expect(selector.locator("option")).to_have_count(9, timeout=25000)
        assert page.locator("html").evaluate("(el) => el.scrollWidth === el.clientWidth")
        selector.focus()
        selector.press("ArrowDown")
        assert selector.input_value() == "pymc2"
        expect(selector).to_be_focused()
        print("PASS selector narrow viewport and keyboard selection", flush=True)
        parent = None
        for entry in engines:
            engine = entry["id"]
            if config.engines and engine not in config.engines:
                continue
            if entry["status"] != "ready":
                print(f"BLOCKED {engine}: {entry['setup']}", flush=True)
                failed = True
                continue
            cases = ["demo", "failure"]
            if engine == "cufflinks" and parent:
                cases.append("linked")
            for case in cases:
                try:
                    result = verify(page, config.base, engine, case, Path(directory), parent if case == "linked" else None)
                    print(f"PASS {engine} {case} {json.dumps(result)}", flush=True)
                    if engine == "openbugs" and case == "demo":
                        repeat = verify(page, config.base, engine, case, Path(directory))
                        assert len(result["traceHashes"]) == 3 and repeat["traceHashes"] == result["traceHashes"]
                        print("PASS openbugs same-seed CODA hashes", flush=True)
                    if engine == "tophat2" and case == "demo":
                        parent = result
                except Exception as error:
                    print(f"FAIL {engine} {case}: {error}", flush=True)
                    failed = True
        browser.close()
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())

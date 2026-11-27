# Evidence for spec 05-ui-redesign

Every file here is tool output written by the command named at its end (`EXIT=<code> … cmd: …`) or by the script named below. Nothing is typed by hand.

| File | What it is |
|---|---|
| `baseline-local-test.txt` | `npm.cmd test` in `apps/local` before any change: 255 tests, 253 pass, 2 skipped (Docker-dependent), 0 fail |
| `baseline-web-check.txt` | `npm.cmd run check` in `apps/web` before any change: lint, typecheck, build, 86 tests pass, `EXIT=0` |
| `baseline-audit-tracked.txt`, `baseline-check-license.txt` | Repository hygiene before any change |

Host for every run: Windows 11, Node v26.13.1 (project pin 24.x), Chrome installed, **Docker not installed**. Checks that need Docker are SKIPPED and say so.

# Release inventory (what would be committed or published)

Originally assessed 2026-11-13; updated for the 2026-11-18 runtime-image reduction. Based on `docs/licensing-review.md` (evidence paths in `docs/evidence/licensing/`). Not legal advice.
"Source available" = corresponding source obtainable for the exact artefact we would distribute.

| # | Component | Origin | Version / hash | Licence evidence | Source available? | Commit to repo? | Action before public distribution |
|---|---|---|---|---|---|---|---|
| 1 | ReproLab adapter, scripts, tests, docs, Dockerfile | This project | n/a | Root `LICENSE` (MIT) for ReproLab-owned work | Yes (it is ours) | **Yes** | Keep the MIT boundary clear. Nothing in it embeds OpenBUGS source |
| 2 | `examples/openbugs/invalid/*` | Written for ReproLab | n/a | Original work under root MIT licence | Yes | **Yes** | No OpenBUGS example files included |
| 3 | `services/runner/reference/seeds_published.json` | 15 numbers read by eye from the OpenBUGS Seeds page image | n/a | Source terms unknown; numbers are facts, but attribution is kept | n/a | **Yes** (attributed) | Second-person check of transcription; confirm acceptable under the unknown example terms |
| 4 | `OpenBUGS-3.2.3.tar.gz` (build input only) | GitHub `chjackson/openbugsdoc@27abd6d1` copy of the SourceForge Linux package | SHA-256 `a289c4da...b4ed8`, 3,066,528 bytes. **Authenticity not proven** (section 3 of the review) | Contains `COPYING` r1017 (GPL v3 wording) | Yes, it is a source package, except the prebuilt library | **No** (URL + hash only) | Compare with a browser download from SourceForge; keep pin |
| 5 | `src/OpenBUGSCli.c`, `src/OpenBUGS.h`, `bin/OpenBUGS` (wrapper) | Same tarball; byte-identical to upstream SVN `cli/trunk` r1018 | `59cdd293...` / `41caf51c...` / `069b058f...` | No header in the files; Developer docs label the same code "GNU General Public Licence"; authorship credit to Nathan Coulter | Yes (public SVN) | **No** | Treat as GPL-3.0; include if the image is distributed |
| 6 | `lib/libOpenBUGS.so` (engine) | Same tarball; built locally by the maintainer (`package.sh`) | SHA-256 `3fc1b64d...a11cf`, 3,090,092 bytes, 32-bit i386 | `COPYING`: GPL v3. Upstream r1018 adds: library redistributable under GPL v3 because all sources are GPL-compatible. **Our copy predates r1018** | **Partly.** Source is upstream SVN `openbugs/trunk` (public), but the revision/toolchain that produced this binary is unknown, and the build needs BlackBox on Windows | **No** | Obtain build revision from maintainer; include r1018 text, GPL v3 text and a source pointer/offer matched to the binary; legal review |
| 7 | BlackBox Component Builder parts inside OpenBUGS | Oberon microsystems | version unknown | `Docu/BB-Open-Source-License.odc`: BSD-style; requires notice reproduction in docs and info on obtaining complete source | Yes (oberon.ch, per `COPYING`); which files are affected is unknown | **No** | Include BlackBox licence text and notice in the image; legal check of its "GPL-compatible" status (asserted by r1018, unverified) |
| 8 | CpcBeautifier parts | "Zinn" (zinnamturm.eu) | version unknown | **None found**; upstream source files carry no licence text | Unknown | **No** | Ask maintainer/author for licence; confirm whether any of it is in the shipped library |
| 9 | TAUCS 2008-02-28 | Upstream SVN `compiled/taucs20080228/btaucs.dll` | n/a | Not stated; not named in `COPYING`. The upstream developer tools page says the library version does not use TAUCS | Unknown for the exact prebuilt binary | **No** | Ask maintainer whether it is linked into this Linux library |
| 10 | `doc/Manuals`, `doc/Developer` (HTML + images) | Tarball | 24 + 18 html | Package says GPL v3 (`COPYING`) but its own legal link points to a GPL **v2** text | In tarball | **No** | Excluded from new runtime images; resolve the v2/v3 discrepancy for the remaining engine binary |
| 11 | `doc/Examples` (313 html, 240 data/model, 270 bmp), incl. Seeds model/data/inits | Tarball; reproduce third-party datasets | Seeds files hashed in `docs/evidence/input_hashes_upstream_examples.txt` | **No licence or copyright marker in any file**; third-party data | In tarball | **No** | Excluded from new runtime images by the current Dockerfile. Users supply their own inputs |
| 12 | `doc/GeoBUGS`, `doc/Reliability` | Tarball | 50 + 108 html | No marker found | In tarball | **No** | Excluded from new runtime images by the current Dockerfile |
| 13 | `configure`, `aclocal.m4`, `Makefile.in`, `missing`, `INSTALL`, `install-sh` | Tarball (autotools output) | n/a | FSF notices; `install-sh` is X11-style | In tarball | **No** | Standard notices; keep in any source distribution |
| 14 | Debian bookworm-slim base + `libc6:i386`, build tools (build stage only), ~110 packages | Debian | base digest `sha256:734a72b3...179bc`; apt versions unpinned | Debian per-package licences (e.g. glibc LGPL) | Debian source archive | **No** (pulled at build time) | Keep `/usr/share/doc/*/copyright` in image; provide source offer or pin versions for an image we publish |
| 15 | Python 3.11 stdlib (`python3-minimal`, `libpython3.11-stdlib`) | Debian | 3.11.2 | PSF licence | Debian | **No** | Same as 14 |
| 16 | Built image `reprolab-openbugs:3.2.3` | Our Dockerfile | local ID `sha256:f65e2244...b88f`; no registry digest | Aggregate of rows 5-15 | See row 6 | **No** (never pushed) | See GO/NO-GO below |

## GO / NO-GO

The formal gate (G1 provenance, G2 licence obligations, G3 matching source, G4 recorded decision) and the decision log are in docs/release-decision.md. The licence review behind this table is **incomplete**.

**Publishing the engine image (registry push, release asset or download): NO-GO.** Evidence:

1. The current Dockerfile ships GPL v3 text with the r1017 `COPYING`, but not the r1018 clarification, the BlackBox licence text, or a CpcBeautifier statement (`docs/evidence/licensing/runtime-scope-2026-11-18.txt`). BlackBox requires notice reproduction and a source-availability statement for binary redistribution.
2. The corresponding source for `libOpenBUGS.so` cannot be tied to the binary: build revision unknown, no published build record, and `package.sh` says the library is built locally (`03_*`). GPL v3 section 6 needs source matching what is distributed.
3. The binary's provenance is not verified: no upstream checksum reachable (SourceForge returns 403 to scripts), no 3.2.3 Linux artefact or `.so` in SVN (`01_*`, `03_*`).
4. The package contradicts itself on the GPL version (v3 `COPYING` vs v2 `GNU-Licence.html`; SourceForge page says v2) (`06_*`).
5. The CpcBeautifier licence is unknown; the r1018 compatibility claim covers it only by the maintainer's assertion.
6. Older local image builds contain Examples, GeoBUGS and Reliability material. The current Dockerfile excludes these trees from new runtime images; this resolves the image-content part of the examples issue, while the other blockers above remain.

**Conditions that would flip this to GO** (all needed): browser-verified tarball checksum; maintainer answers on build revision, CpcBeautifier and TAUCS; image rebuilt with the full licence set, source pointer/offer, no unlicensed example data; Debian package pinning or source offer; legal review of the r1018 statement.

**What is acceptable now (does not need the above):**
- **Committing this repository's own files** (rows 1-3 plus the Dockerfile, which only downloads upstream bytes and verifies a hash): GO. No upstream binary, example or documentation is in the repository, and nothing in it conflicts with any licence found.
- **Running the engine privately or on our own server and returning outputs to users**: not distribution of the program; I found nothing in GPL v3 or the BlackBox policy page that forbids it, but this is not legal advice and the hosted product's terms should be reviewed before launch.
- **Root `LICENSE`**: MIT covers ReproLab-owned work only. It does not grant redistribution rights to OpenBUGS or other upstream material; the engine image remains NO-GO under `docs/release-decision.md`.

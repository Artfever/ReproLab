# OpenBUGS provenance and licensing review

**Review status: INCOMPLETE.** This review sampled evidence and left open questions (section 6). It must not be cited as a completed licence review or as clearance to distribute. The release gate is in docs/release-decision.md.

Review date: 2026-11-13. Scope: spec `00-engine-feasibility`, tasks "resolve licence questions" and "cross-check the tarball".
This is engineering evidence, **not legal advice**. Every statement is marked **VERIFIED** (I fetched or computed it, evidence file named),
**UNVERIFIED** (reported by someone, not independently confirmed) or **UNKNOWN** (could not be determined). Raw measurements are in
`docs/evidence/licensing/`. Upstream licence documents are referenced by URL and SHA-256 only; their text is not copied here.

Upstream base URL used below: `https://svn.code.sf.net/p/openbugs/code/` (SourceForge Subversion, HTTPS, scriptable). HEAD was **r1018** when fetched.

## 1. The tarball under review

| Fact | Status | Evidence |
|---|---|---|
| File: `OpenBUGS-3.2.3.tar.gz`, 3,066,528 bytes, SHA-256 `a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8` | VERIFIED | `docs/evidence/licensing/02_*`, `06_*` |
| Obtained from `chjackson/openbugsdoc` (GitHub) commit `27abd6d1eca1bebddedb6ee7366eab7907727c01` | VERIFIED | GitHub API, see `docs/engine-feasibility.md` E1 |
| 1,559 regular files, 18 MB unpacked; every entry dated 2014-03-06 | VERIFIED | `04_*` |
| Top level: `AUTHORS COPYING ChangeLog INSTALL Makefile.am Makefile.in NEWS README aclocal.m4 autom4te.cache/ bin/ configure configure.ac doc/ install-sh lib/ missing src/` | VERIFIED | tarball listing |
| Only two licence-named files exist inside it: `COPYING` and `doc/Manuals/GNU-Licence.html` | VERIFIED | `find -iname '*licen*' -o -iname '*copying*'` |

## 2. The upstream r1018 change ("Clarified licence of libOpenBUGS.so")

- Commit page: https://sourceforge.net/p/openbugs/code/1018/ . VERIFIED: author `chris-jackson`, date 2014-07-09, parent r1017, **one file changed: `/cli/trunk/COPYING`**.
- File at r1018: `https://svn.code.sf.net/p/openbugs/code/cli/trunk/COPYING?p=1018` (1,624 bytes, SHA-256 `d44f03cd6db29408b994aba5ff3f79d35261d07549472f3be3a443a38ea83bb7`). VERIFIED identical to HEAD.
- File at r1017: `...COPYING?p=1017` (1,471 bytes, SHA-256 `d6d108baf21e9f7d23a7004b0a4452c6aac9a072aadca0f9c859b7758eb2589c`).
- **VERIFIED: our tarball's `COPYING` is byte-identical to r1017**, and also identical to the `COPYING` inside upstream's `OpenBUGS-3.2.1.tar.gz`.
- **VERIFIED: r1018 appends exactly three sentences** saying that all of "these sources" are GPL-compatible and that the shared library `libOpenBUGS.so` may therefore be redistributed under GPL version 3 (`02_*` has the diff).
- **VERIFIED consequence: our tarball (dated 2014-03-06) predates that clarification and does not contain it.** The only place the sentence exists is upstream SVN. The image built from our tarball therefore ships the *un-clarified* `COPYING`.
- UNVERIFIED: that the statement is legally correct. It is the maintainer's assertion. I could not check each underlying component (see section 4). No later revision exists (HEAD = r1018).

## 3. Authenticity: our tarball vs upstream

Authentic upstream artefacts I could obtain: the SVN tree (`cli/trunk` at r1018, plus `openbugs/trunk`), including `cli/trunk/OpenBUGS-3.2.1.tar.gz` (3,165,790 bytes, last-modified 2011-03-23, SHA-256 `bfbc43e3cf520765be784e972a659dbd61e7761dd978dc67c87a9f9635009699`).

| Item | Result | Evidence |
|---|---|---|
| `AUTHORS ChangeLog Makefile.am NEWS README bin/OpenBUGS src/Makefile.am src/OpenBUGS.h src/OpenBUGSCli.c` vs SVN `cli/trunk` r1018 | **VERIFIED byte-identical** | `03_*` |
| `COPYING` vs SVN r1017 | **VERIFIED byte-identical** (r1018 differs, see section 2) | `02_*` |
| `Makefile.in aclocal.m4 configure`, `doc/OpenBUGS.1` vs SVN | differ (SVN holds older/other generated output; `configure.ac` there says version `0.1`, tarball says `3.2.3`). Not analysed further | `03_*` |
| `src/Makefile.in`, `INSTALL`, `lib/libOpenBUGS.so`, `doc/{Developer,Examples,GeoBUGS,Manuals,Reliability}/` | **not in SVN `cli/trunk`**, so no upstream file to compare | `03_*` |
| 3.2.3 Linux tarball or any 3.2.3 checksum from the project | **UNKNOWN / blocked**: SourceForge file pages, RSS and `/files/` return HTTP 403 or the HTML project page to scripts; `best_release.json` reports no release; `openbugs.net` returns 404 and `openbugs.info` redirects to a landing page (`01_*`) | `01_*` |
| `libOpenBUGS.so` (3,090,092 bytes, SHA-256 `3fc1b64d775030ed370975dbab677f035aeaa3c177bb65c45a74c5b8b37a11cf`) | **UNVERIFIABLE**: upstream `cli/trunk/package.sh` states the Linux library is "built locally" by the maintainer and the SVN holds no built `.so`. The 3.2.1 library has a different hash (`c57bcf24...`) | `03_*`, `04_*` |
| 3.2.3 vs upstream 3.2.1 tarball | 1,559 vs 1,191 files; 323 files differ, 5 only in 3.2.3, 1 only in 3.2.1; first 400 Examples files identical | `04_*` |

**Conclusion on authenticity (not assumed): partially corroborated, not proven.** The small source/script files match upstream's own Subversion
repository, which supports that the package was produced by the upstream Linux-package maintainer. The prebuilt library and the 1,500+ documentation
files cannot be matched to any upstream-published artefact or checksum I could reach. I do **not** label the GitHub copy authentic.
Blocker for full verification: SourceForge returns 403 to non-browser clients. Action: download `OpenBUGS-3.2.3.tar.gz` manually from the SourceForge
Files tab in a browser (SourceForge shows MD5/SHA1 there) and compare, or ask the maintainer (`AUTHORS` names Chris Jackson) for the checksum.

## 4. Licence evidence, component by component

### 4.1 OpenBUGS itself
- VERIFIED: tarball `COPYING` states copyright holders "(c) 2010-2011 OpenBUGS Project Management Group; (c) 1990-1996 Medical Research Council, UK; (c) 1996-2010 MRC (UK) and Imperial College, UK" and that OpenBUGS "may be modified and redistributed under the terms of the GPL version 3".
- VERIFIED upstream: `openbugs/trunk/Docu/OpenBUGS-License.odc` (36,151 bytes) contains the GNU GPL **version 3** text; `openbugs/trunk/gpl-3.0.txt` (35,147 bytes, SHA-256 `8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903`) is GPL v3.
- VERIFIED: sampled upstream source files (`Bugs/Mod/BRugs.odc`, `Bugs/Mod/C.odc`, `Bugs/Mod/CLI.odc`, `Math/Mod/AESolver.odc`, `Math/Mod/BGR.odc`, `Std/Mod/Cmds1.odc`) carry "GNU General Public Licence" and a link to `Docu/OpenBUGS-License` (`09_*`). Ten files were sampled (6 carry the "GNU General Public Licence" text, 2 only link to the licence page, 2 are the CpcBeautifier files with no licence); the upstream tree has several hundred, so this is a sample, not an audit.
- **CONFLICT inside the package:** `doc/Manuals/Manual.html` links "please click here to read the legal bit" to `doc/Manuals/GNU-Licence.html`, which is the GPL **version 2** text (June 1991) (SHA-256 `cef2bc1c...`). `COPYING` and upstream say version 3. VERIFIED that both exist in the tarball. Which governs is a legal question; `COPYING` plus upstream `OpenBUGS-License.odc` are the more specific statements.
- **CONFLICT outside the package:** the SourceForge project page lists the licence as GPL v2 (fetched 2026-11-13). UNVERIFIED which is stale; this is project metadata, not a licence grant.
- No "or any later version" wording found in `COPYING`: treat as **GPL-3.0-only unless the maintainers say otherwise** (UNKNOWN).

### 4.2 `lib/libOpenBUGS.so`
- VERIFIED: ELF 32-bit Intel 80386, stripped, SONAME `libOpenBUGS.so`, NEEDED only `libdl.so.2` and `libc.so.6`; exports `CLI BugsCmd CharArray CmdInterpreter Guard Integer IntegerArray Real RealArray SetTempDir SetWorkingDir UseBufferFile UseConsole` (`05_*`).
- VERIFIED: contains **no** licence or copyright text (0 matches for GPL, GNU, Copyright, BlackBox, Beautif). So the binary itself carries no notice.
- VERIFIED: source is not in the Linux package; `COPYING` says it is in the Windows package as Component Pascal `.odc` files and "cross-compiled on Windows". The public equivalent is upstream SVN `openbugs/trunk` (listing in `07_*`).
- UNKNOWN: which SVN revision built our binary, with what toolchain settings. `package.sh` shows the maintainer builds locally; no build record is published. Corresponding-source obligations (GPLv3 section 6) need the source that matches the distributed binary. This is the main unresolved source-availability gap.
- UNKNOWN: whether it embeds other third-party code beyond BlackBox and CpcBeautifier. SVN has `compiled/taucs20080228/btaucs.dll` (a Windows DLL of the TAUCS sparse-solver library, not mentioned in `COPYING`). I found no `taucs` strings in the Linux library and it has no other shared-library dependency, which is weak evidence it is not linked in; absence of strings is not proof.

### 4.3 BlackBox Component Builder (Oberon microsystems)
- VERIFIED named in `COPYING` and in upstream `Docu/other-software.odc` as "modified and unmodified components" included in OpenBUGS.
- VERIFIED licence text exists upstream: `Docu/BB-Open-Source-License.odc` (3,861 bytes): "Copyright (c) 1994-2007 Oberon microsystems", a BSD-style licence. Its conditions include keeping the notice in source, **reproducing the notice in documentation for binary redistribution**, and (condition 3) accompanying every form of redistribution with **information on how to obtain complete source code** for the Software and any accompanying software that uses it, which must be freely redistributable on reasonable conditions. A fourth condition forbids using Oberon's name for endorsement. `Docu/BB-Licensing-Policy.odc` says it is based on the Sleepycat licence. `Docu/BB-License.odc` is listed upstream but I did not fetch it.
- VERIFIED: the BlackBox policy page states that building and deploying a web service is not "redistribution" in its sense. Applies to BlackBox licensing only.
- The Fedora project's licence page (https://fedoraproject.org/wiki/Licensing/Sleepycat) calls the Sleepycat licence free and GPL-compatible; BlackBox's licence is "closely based on" it, not identical. **UNVERIFIED** that BlackBox's variant is GPL-compatible; r1018 asserts it for all components.
- Which exact OpenBUGS files are BlackBox-derived: UNKNOWN (each `.odc` is supposed to state its own licence).

### 4.4 Component Pascal Source Code Beautifier (CpcBeautifier)
- VERIFIED named in `COPYING`/`other-software.odc`; origin URL `http://www.zinnamturm.eu/downloadsAC.htm` (not fetched).
- VERIFIED: upstream `Cpc/Mod/Beautifier.odc` and `BeautifierOptions.odc` credit "Zinn" (contact address omitted) and contain **no licence text** in their extractable text (`09_*`).
- **UNKNOWN: the licence of CpcBeautifier.** This is the least documented component. It is a development tool (a source formatter); whether any of it is compiled into `libOpenBUGS.so` is UNKNOWN.

### 4.5 Other files in the tarball
| Path | Licence evidence | Status |
|---|---|---|
| `src/OpenBUGSCli.c`, `src/OpenBUGS.h`, `bin/OpenBUGS` | No licence header in the C/shell files. `doc/Developer/CBugs.html` and `BRugsH.html` (which reproduce this code) are headed "GNU General Public Licence". Credits Nathan Coulter | VERIFIED text; header-less files UNVERIFIED as GPL by inheritance |
| `configure`, `aclocal.m4`, `Makefile.in`, `missing`, `INSTALL` | FSF copyright notices; `configure` states "unlimited permission to copy, distribute and modify it" | VERIFIED notices; not analysed further |
| `install-sh` | X Consortium (MIT/X11-style) notice, Copyright (C) 1994 X Consortium | VERIFIED |
| `doc/Examples/` (313 html, 240 txt data/model files, 270 bmp) | **No licence or copyright marker in any of them** (0 files match). 52 pages match a citation pattern ("et al" or "(year)"). Datasets come from third-party publications (e.g. Crowder 1978 for Seeds) | VERIFIED absence; redistribution rights **UNKNOWN** |
| `doc/GeoBUGS/`, `doc/Reliability/` | No copyright text found in html/txt | VERIFIED absence; rights UNKNOWN |
| `doc/Manuals/` (24 html, 125 bmp), `doc/Developer/` | OpenBUGS documentation; Developer pages also describe BlackBox and Oberon's tools | covered by OpenBUGS GPL by assumption; UNVERIFIED |

### 4.6 What the Docker image ships (built from this tarball)
- 1,542 files, 18 MB under `/opt/openbugs`, plus 110 Debian packages from the base image (`10_*`).
- `/opt/openbugs/licenses/` contains only `COPYING` (r1017 text), `AUTHORS`, `NEWS`. The image also contains `doc/Manuals/GNU-Licence.html` (v2).
- **The image does NOT contain:** the GPL v3 text, the r1018 clarification, the BlackBox licence text, any CpcBeautifier notice, any pointer or offer for `libOpenBUGS.so` corresponding source, or the Debian `copyright` review. Whether Debian-layer notices are intact was not audited.

## 5. Rebuild
No engine rebuild was performed: no finding changed the build inputs. The findings change what must ship with a published image (section 4.6), which is listed as an open task.

## 6. Open items that need a person
1. Download the 3.2.3 tarball from SourceForge in a browser; compare SHA-256 with `a289c4da...` and, if equal, record it. If different, replace the pin.
2. Ask the maintainers (Chris Jackson, `AUTHORS`) for: the SVN revision used for the 3.2.3 Linux `libOpenBUGS.so`, the CpcBeautifier licence, whether TAUCS or other third-party code is linked, and whether "GPL v2" on the SourceForge page is stale.
3. Have a legal reviewer assess the r1018 statement against `BB-Open-Source-License.odc` condition 3 and the (unknown) CpcBeautifier terms.
4. Decide the Examples policy (keep reading them from the image; do not commit or publish) until rights are clarified.
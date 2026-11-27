# Third-party notices

**Status: licence review INCOMPLETE.** Nothing here clears the worker image or any OpenBUGS file for distribution. The gate is in docs/release-decision.md.

This file is engineering notes, **not legal advice**, and no lawyer has reviewed it. Evidence and exact paths are in `docs/licensing-review.md` and
`docs/evidence/licensing/`. A component table with actions is in `docs/release-inventory.md`. The dependency table below comes from
`docs/evidence/local-product/licence-table.md`, which `scripts/licence-table.mjs` generates from `apps/web/package-lock.json`.

ReproLab does not own OpenBUGS, BlackBox, CpcBeautifier or the OpenBUGS examples, and claims no ownership of them.

## Boundary: what the ReproLab licence covers

The project owner authorizes reuse, modification and redistribution of ReproLab-owned code under the MIT licence in the root `LICENSE` (copyright notice: `artfever`). This grant does not cover third-party components or source material listed below.

**OpenBUGS licence reference:** the OpenBUGS 3.2.3 Linux archive's `COPYING` grants use, modification and redistribution under GPL version 3, subject to its conditions. The upstream repository's [r1018 `cli/trunk/COPYING`](https://sourceforge.net/p/openbugs/code/HEAD/tree/cli/trunk/COPYING) contains the maintainer's clarification for redistribution of `libOpenBUGS.so`, and the repository provides the [GPL v3 text](https://sourceforge.net/p/openbugs/code/HEAD/tree/openbugs/trunk/gpl-3.0.txt). The package also contains GPL v2 text in its manual and the SourceForge project page lists GPLv2; see the evidence and remaining scope questions in [`licensing-review.md`](licensing-review.md).
That licence covers only code and text written for ReproLab. It **grants no rights** to OpenBUGS, BlackBox, CpcBeautifier, the OpenBUGS examples
or the OpenBUGS documentation. Any rights to use or redistribute those components come from their respective licences, not the ReproLab licence.
Nothing in this repository relicenses any third-party file.

## Additional local engine runtimes

The recipes in `infra/engines/Dockerfile` fetch the runtimes during local builds. Each runtime and dependency keeps its upstream terms. The ReproLab fixtures and checkpoints created by the fixture scripts are authored for this repository. This inventory does not clear the resulting images for redistribution.

| Engine | Runtime reference |
|---|---|
| PyMC 2.3.8 | [PyPI release and Academic Free License metadata](https://pypi.org/project/pymc/2.3.8/) |
| Caffe CPU 1.0 | [Ubuntu focal source package](https://launchpad.net/ubuntu/focal/+source/caffe), upstream [licence](https://github.com/BVLC/caffe/blob/1.0/LICENSE) |
| Theano 1.0.5 | [PyPI release](https://pypi.org/project/Theano/1.0.5/), upstream [licence](https://github.com/Theano/Theano/blob/rel-1.0.5/LICENSE.txt) |
| Chainer 7.8.1 | [PyPI release](https://pypi.org/project/chainer/7.8.1/), upstream [licence](https://github.com/chainer/chainer/blob/v7.8.1/LICENSE) |
| QIIME 1.9.1 | [Bioconda package](https://anaconda.org/bioconda/qiime) and [upstream repository](https://github.com/biocore/qiime) |
| TopHat 2.1.1 | [Bioconda package](https://anaconda.org/bioconda/tophat) and [upstream repository](https://github.com/infphilo/tophat) |
| Cufflinks 2.2.1 | [Bioconda package](https://anaconda.org/bioconda/cufflinks) and [upstream repository](https://github.com/cole-trapnell-lab/cufflinks) |
| NiftyNet 0.6.0 | [PyPI release and Apache 2.0 metadata](https://pypi.org/project/NiftyNet/0.6.0/) |

Before any distribution review, inventory installed package versions and component notices from each exact image. The BioContainers parent images include tools beyond the engines named in the selector.

## Component by component

| Component | Origin | In this repository? | Licence position |
|---|---|---|---|
| ReproLab code: `apps/web`, `apps/local`, `services/runner`, `scripts`, `infra`, tests, docs | Written for ReproLab (with Kiro assistance; no code copied from other projects) | Yes | MIT (root `LICENSE`) |
| `examples/reprolab/*` (coin and coin-invalid models, data, READMEs) | Written for ReproLab | Yes | MIT. These are ReproLab-authored toy models, not OpenBUGS examples |
| `examples/openbugs/invalid/*` | Written for ReproLab (two invalid BUGS models) | Yes | MIT |
| `services/runner/reference/seeds_published.json` | 5 nodes x 3 numbers (mean, sd, MC error) read by eye from the results image of the OpenBUGS Seeds example page. The example credits Crowder (1978) and Breslow and Clayton (1993) | Yes, as comparison values with attribution | Facts and numbers, but the source's terms are unknown. **Not covered by the MIT grant**; kept as attributed comparison data |
| `apps/local` | Written for ReproLab | Yes | MIT. It has **no npm dependencies** (`package.json` lists none). Since spec 05 it serves the self-hosted browser files listed in the next row |
| Browser files in `apps/local/public/vendor/` and `apps/local/public/fonts/` (spec 05-ui-redesign) | npm tarballs, copied unmodified by `apps/local/scripts/vendor-ui-libs.mjs`; SHA-256 of each file in `apps/local/public/vendor/manifest.json` | Yes, the built files only | **Not covered by the MIT grant.** GSAP 3.15.1 and ScrollTrigger: GreenSock Standard "no charge" licence (https://gsap.com/standard-license), which is **not an OSI open-source licence**; see `vendor/gsap-3.15.1/LICENSE-NOTICE.txt`. anime.js 4.5.0: MIT, copyright Julian Garnier (`vendor/animejs-4.5.0/LICENSE.md`). three.js 0.187.0: MIT, copyright three.js authors (`vendor/three-0.187.0/LICENSE`). IBM Plex Mono 2.5.0 Regular and Medium: SIL Open Font License 1.1 (`fonts/OFL.txt`) |
| Download URL and SHA-256 of the OpenBUGS tarball | `infra/openbugs/Dockerfile`, `scripts/build-image.*` | Yes | Metadata only, no upstream bytes |
| Evidence files in `docs/evidence/` | Our own logs, manifests and measurements | Yes | Derived output (engine log lines and Seeds statistics) plus short excerpts kept as evidence. No upstream file is copied. Upstream text beyond those excerpts was removed |
| OpenBUGS binaries, `libOpenBUGS.so`, documentation, Examples, Seeds model/data/inits | Upstream | **No. Not committed, not redistributed** | **Not covered by the ReproLab licence.** See the OpenBUGS sections below |
| The OpenBUGS tarball | Held by the user in `vendor/` (gitignored) | No | Never committed or published by this project |
| Seeds files extracted by `scripts/extract-seeds.*` | Taken by the user from their own tarball into `local-data/upstream/` (gitignored) | No | Stays on the user's machine; rights unknown |
| Debian packages in the worker image | Debian `bookworm-slim` base plus `libc6:i386`, Python 3.11 stdlib and about 110 packages | No, and the image is **never distributed** | Each package has its own licence (for example GNU C library under LGPL). Obligations would arise only if the image were distributed, which this project does not do |
| npm dependencies of `apps/web` | npm registry | Lockfile only; `node_modules` is not committed | See the dependency table |

## OpenBUGS and its components (not covered by ReproLab's licence)

**OpenBUGS 3.2.3 (Linux package)**: copyright (c) 2010-2011 OpenBUGS Project Management Group; (c) 1990-1996 Medical Research Council, UK;
(c) 1996-2010 MRC (UK) and Imperial College, UK. The tarball `COPYING` says it may be modified and redistributed under the GPL version 3.
Upstream `openbugs/trunk/Docu/OpenBUGS-License.odc` is the GPL v3 text. Source: SourceForge project `openbugs`
(https://sourceforge.net/projects/openbugs/); Subversion https://svn.code.sf.net/p/openbugs/code/ (r1018).
The package's manual page links to a GPL **v2** text (`doc/Manuals/GNU-Licence.html`) and the SourceForge project page lists GPL v2. We treat OpenBUGS as
**GPL-3.0-only** until the maintainers say otherwise.

**`lib/libOpenBUGS.so`** (the engine, prebuilt 32-bit): upstream r1018 (2014-07-09, "Clarified licence of libOpenBUGS.so", https://sourceforge.net/p/openbugs/code/1018/)
appends to `cli/trunk/COPYING` that all component sources are GPL-compatible and the library may be redistributed under GPL version 3. **Our tarball
(dated 2014-03-06) predates that clarification and does not contain it.** The Component Pascal source is in upstream SVN `openbugs/trunk`, but the revision that built our binary is unknown.

**BlackBox Component Builder** (Oberon microsystems; part of OpenBUGS per `COPYING`): licence text is
`openbugs/trunk/Docu/BB-Open-Source-License.odc`, "Copyright (c) 1994-2007 Oberon microsystems, Inc.", a BSD-style licence derived from the Sleepycat licence.
Its conditions require keeping the notice in source, reproducing the notice in documentation for binary redistributions, and accompanying any redistribution
with information on how to obtain complete source code.

**Component Pascal Source Code Beautifier (CpcBeautifier)** (credited to "Zinn"): the two files in upstream SVN carry no licence text. **Licence unknown.**

**TAUCS 2008-02-28** (sparse linear algebra): upstream SVN has `compiled/taucs20080228/btaucs.dll` (Windows DLL), not mentioned in `COPYING`. The [OpenBUGS developer tools page](https://chjackson.github.io/openbugsdoc/Developer/Tools.html) says the library version does not use TAUCS. Whether that statement describes the exact prebuilt Linux library in our tarball remains unconfirmed.

**OpenBUGS examples, GeoBUGS and Reliability material** (`doc/Examples`, `doc/GeoBUGS`, `doc/Reliability`): no file carries a licence or copyright marker, and they reproduce
third-party published datasets and figures (Seeds: Crowder 1978, Breslow and Clayton 1993). Redistribution rights **unknown**. ReproLab does not commit or publish them. The local
tool reads Seeds only from a copy the user extracts from their own tarball. The current Dockerfile excludes the upstream documentation and examples from new runtime images; older locally built images may still contain them.

**GNU build files** (`configure`, `aclocal.m4`, `Makefile.in`, `missing`, `INSTALL`): Free Software Foundation notices. `install-sh`: Copyright (C) 1994 X Consortium (X11-style). Per-file terms not analysed.

## The tarball the user must obtain

The pinned copy has SHA-256 `a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8`. It was obtained from a third-party GitHub repository
(`chjackson/openbugsdoc`, commit `27abd6d1eca1bebddedb6ee7366eab7907727c01`). That GitHub copy is a mirror whose relationship to the OpenBUGS maintainers we have **not
verified**, and we do not call it authenticated. The hash is the hash of "the copy we tested", not a value published by OpenBUGS. The build script
(`scripts/build-image.*`) checks the user's file against it and fails on mismatch. The `-FetchMirror` option downloads from the mirror and labels the result
"unauthenticated mirror copy, not upstream-verified".

## npm dependencies (apps/web)

Heading used by the notices test: **Dependency licences (apps/web)**. Counts are from the lockfile, 397 packages excluding the root project. The verdict column is our reading, not legal advice.

### Dependency licences (apps/web)

| Licence identifier | Packages | Verdict |
|---|---:|---|
| MIT | 318 | Permissive. Keep the licence notice when redistributing. `node_modules` is not committed, so the repository redistributes none of it |
| Apache-2.0 | 34 | Permissive. Same note |
| ISC | 16 | Permissive. Same note |
| BSD-2-Clause | 7 | Permissive. Same note |
| BSD-3-Clause | 2 | Permissive. Same note |
| 0BSD (`tslib`) | 1 | Permissive, no conditions |
| BlueOak-1.0.0 (`minimatch`) | 1 | Permissive |
| CC-BY-4.0 (`caniuse-lite`) | 1 | Data licence with attribution. Attribution is given here |
| CC0-1.0 (`language-subtag-registry`) | 1 | Public-domain dedication |
| Python-2.0 (`argparse`) | 1 | Permissive (PSF-style) |
| LGPL-3.0-or-later (`@img/sharp-libvips-*`, 10 packages) | 10 | Copyleft library. All are **optional, platform-specific** binaries that npm installs only on a matching platform. See the note below |
| Apache-2.0 AND LGPL-3.0-or-later (`@img/sharp-win32-*`) | 3 | Same as above (optional) |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT (`@img/sharp-wasm32`) | 1 | Same as above (optional) |
| MPL-2.0 (`axe-core`) | 1 | File-level copyleft. See the note below |
| **Total** | **397** | No package without a declared licence |

**LGPL optional `sharp` and libvips packages.** `@img/sharp-*` and `@img/sharp-libvips-*` are optional dependencies of Next.js's image tooling. The lockfile marks all of
them optional. This repository commits no binary from them. If a deployment bundle or image ever contained these binaries, the LGPL conditions (licence text, and the
ability to replace the library) would have to be checked for that bundle. We have **not** checked what a Vercel deployment includes. Verdict: not redistributed by this repository; open for any bundled deployment.

**MPL-2.0 `axe-core` (4.14.0).** `axe-core` is **not** a direct dependency of `apps/web` (`apps/web/package.json` does not list it). It is a transitive dependency:
`eslint-config-next` depends on `eslint-plugin-jsx-a11y`, which depends on `axe-core` (from `package-lock.json`). `eslint-config-next` is listed under `dependencies` in `package.json`, so
the lockfile does not mark `axe-core` as dev-only, but it is used only by the lint step and is not imported by the site source. We have not checked whether the built static output contains any of its code; the
site source never imports it. Verdict: MPL-2.0 applies per file to `axe-core` itself and not to ReproLab code; unmodified use for linting raises no obligation we know of.

`apps/local` has no dependencies and appears in no row above.

## Open items

Plainly unresolved. None of these has been settled by this project.

1. **OpenBUGS GPL v2/v3 inconsistency.** `COPYING` and upstream say GPL v3; the manual page in the package and the SourceForge project page say GPL v2. Which governs is unresolved.
2. **Unmatched tarball checksum.** The SHA-256 above has not been matched to a value from SourceForge or the maintainers, because SourceForge blocks script access. The "authentic" label is not claimed.
3. **Tarball predates r1018.** Our `COPYING` is the pre-clarification text; the clarification about `libOpenBUGS.so` exists only in upstream SVN.
4. **Unknown revision of `libOpenBUGS.so`.** The SVN revision that built the prebuilt binary is not published, so corresponding source cannot be tied to it.
5. **CpcBeautifier.** Licence unknown.
6. **TAUCS.** Whether it is linked into the Linux library is unknown.
7. **Examples, GeoBUGS and Reliability data rights.** Unknown. ReproLab does not redistribute them.
8. **BlackBox condition 3 and GPL compatibility.** Whether the BlackBox variant licence is GPL-compatible is asserted by the maintainers' r1018 note and not independently verified.
9. **Debian layers.** `/usr/share/doc/*/copyright` of the image packages were not audited. The image is not distributed.
10. **No legal review** has taken place.
11. **Copyright holder name.** `artfever` in `LICENSE` is the git author name; the legal name must be confirmed.
12. **Sharp/libvips in deployments.** Not checked for any hosted bundle.

## Required before any public distribution of the worker image

1. Complete the licence set inside the image: GPL v3 text is now included in new runtime images; the r1018 `COPYING`, the BlackBox licence text, and notices for the remaining components are still needed.
2. Provide, with the image, a written pointer or offer for the corresponding source of `libOpenBUGS.so`, tied to the actual build revision (currently unknown).
3. Resolve the open items above and in docs/release-inventory.md.
4. Meet all four gates G1 to G4 in docs/release-decision.md. Until then do not push, export or share the image.

## Kiro and reuse record

The adapter, scripts and docs in this repository were written during Kiro sessions; no code was copied from other projects. The OpenBUGS scripting manual page
(https://chjackson.github.io/openbugsdoc/Manuals/Scripts.html) was used for command names.

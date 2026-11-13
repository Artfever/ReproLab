# Third-party notices

**Status: licence review INCOMPLETE.** Nothing here clears the image for distribution; the gate is in docs/release-decision.md.

ReproLab does not own OpenBUGS, BlackBox, CpcBeautifier or the OpenBUGS examples. This file lists what the repository and the worker image
use, the licence evidence found, and what is still open. It is engineering notes, **not legal advice**. Evidence and exact paths are in
`docs/licensing-review.md` and `docs/evidence/licensing/`. A component-by-component table with actions is in `docs/release-inventory.md`.

Revised after the licensing review of 2026-11-13. Corrections to the previous version: the earlier text omitted the upstream r1018
clarification, the GPL v2 text shipped inside the package, the BlackBox licence conditions, the TAUCS item, the Examples/GeoBUGS/Reliability data,
the autotools files, and the Debian layers; it also described `libOpenBUGS.so` as simply "GPL".

## What is committed to this repository

| Item | Origin | Committed? |
|---|---|---|
| ReproLab adapter, scripts, tests, Dockerfile, docs | Written for ReproLab | Yes. **No repository licence has been chosen** (no `LICENSE` file). |
| `examples/openbugs/invalid/*` | Written for ReproLab (two invalid BUGS models) | Yes (original work) |
| `services/runner/reference/seeds_published.json` | 5 nodes x 3 numbers (mean, sd, MC error) read by eye from the results image of the OpenBUGS Seeds example page; the example credits Crowder (1978) and Breslow and Clayton (1993) | Yes, as comparison values with attribution. Facts/numbers, but the source's terms are unknown (see below) |
| Download URL and SHA-256 of the OpenBUGS tarball | `infra/openbugs/Dockerfile` | Yes (no upstream bytes) |
| Evidence files in `docs/evidence/` | Our own logs, manifests and measurements | Yes. They contain engine log lines and statistics for the Seeds run (derived output) and short excerpts needed as evidence (the r1017-to-r1018 `COPYING` diff and r1018 text in `licensing/02_*`; the first words of the GPL v2 page title in `licensing/06_*`; the README, INSTALL and manual prose that were in the original probes were removed). No upstream file is copied |
| OpenBUGS binaries, library, docs, Seeds model/data/inits | Upstream | **No.** Not committed. The Dockerfile downloads them at build time |

## Components and licence evidence

**OpenBUGS 3.2.3 (Linux package)**: copyright (c) 2010-2011 OpenBUGS Project Management Group; (c) 1990-1996 Medical Research Council, UK;
(c) 1996-2010 MRC (UK) and Imperial College, UK. Tarball `COPYING`: "may be modified and redistributed under the terms of the GPL version 3".
Upstream `openbugs/trunk/Docu/OpenBUGS-License.odc` is the GPL v3 text. Source: SourceForge project `openbugs`
(https://sourceforge.net/projects/openbugs/); Subversion https://svn.code.sf.net/p/openbugs/code/ (r1018).
Inconsistencies still open: the package's manual page links to a GPL **v2** text (`doc/Manuals/GNU-Licence.html`) and the SourceForge project page lists GPL v2.
We treat OpenBUGS as **GPL-3.0-only** until the maintainers say otherwise.

**`lib/libOpenBUGS.so`** (the engine, prebuilt 32-bit): upstream r1018 (2014-07-09, "Clarified licence of libOpenBUGS.so", https://sourceforge.net/p/openbugs/code/1018/)
appends to `cli/trunk/COPYING` that all component sources are GPL-compatible and the library may be redistributed under GPL version 3. **Our tarball
(dated 2014-03-06) predates and lacks that sentence.** The Component Pascal source is in upstream SVN `openbugs/trunk` but the revision that built our binary is unknown.

**BlackBox Component Builder** (Oberon microsystems; modified and unmodified components are part of OpenBUGS per `COPYING`): licence text is
`openbugs/trunk/Docu/BB-Open-Source-License.odc`, "Copyright (c) 1994-2007 Oberon microsystems, Inc.", a BSD-style licence derived from the Sleepycat licence.
Its conditions require retaining the notice in source, reproducing the notice in documentation for binary redistributions, and accompanying any redistribution
with information on how to obtain complete source code. Upstream location per COPYING: http://www.oberon.ch/blackbox.html (not fetched).

**Component Pascal Source Code Beautifier (CpcBeautifier)** (credited to "Zinn", http://www.zinnamturm.eu/downloadsAC.htm, not fetched): files `Cpc/Mod/Beautifier.odc` and
`BeautifierOptions.odc` in upstream SVN contain no licence text. **Licence unknown.**

**TAUCS 2008-02-28** (sparse linear algebra): upstream SVN has `compiled/taucs20080228/btaucs.dll` (Windows DLL), not mentioned in `COPYING`. No evidence that it is linked
into the Linux library (no strings, no extra shared-library dependency). Listed because a build input exists; status unknown.

**OpenBUGS examples, GeoBUGS and Reliability material** (`doc/Examples` 313 html + 240 data/model txt + 270 bmp, `doc/GeoBUGS`, `doc/Reliability`): none of these files carries a licence
or copyright marker. They reproduce third-party published datasets and figures (for example Seeds: Crowder 1978, Breslow and Clayton 1993; full bibliographic details not verified).
Redistribution rights **unknown**.

**GNU build files** (`configure`, `aclocal.m4`, `Makefile.in`, `missing`, `INSTALL`): Free Software Foundation notices. `install-sh`: Copyright (C) 1994 X Consortium (X11-style). Per-file terms not analysed.

**Base image layers** (Debian bookworm-slim, `libc6:i386`, Python 3.11 stdlib, ~110 packages): Debian packages under their own licences (for example GNU C library under LGPL). If an image
is distributed, each package's licence text and source-offer obligations apply; `/usr/share/doc/*/copyright` were not audited.

## Required before any public distribution of the image
1. Ship the complete licence set inside the image: GPL v3 text, the r1018 `COPYING`, the BlackBox licence text, and a notice for each component above.
2. Provide, with the image, a written pointer or offer for the corresponding source of `libOpenBUGS.so`, tied to the actual build revision (currently unknown).
3. Resolve the open items in docs/release-inventory.md.
4. Meet all four gates G1 to G4 in docs/release-decision.md (provenance, licence obligations, matching source, and a recorded release decision). Until then do not push, export or share the image.

## Repository licence
This is about **ReproLab''s own code only**. The licence chosen for it grants no rights over OpenBUGS, BlackBox, CpcBeautifier or the examples, and permission to redistribute those upstream components (if it is ever obtained) does not come from ReproLab''s licence.
No `LICENSE` file has been added. Constraints found so far: the code in this repository does not include OpenBUGS source, so no OpenBUGS term currently binds a choice.
If the repository later includes upstream files (the C wrapper, the wrapper script, documentation, or any Examples) those parts are GPL-3.0 (or subject to the unknown terms above).
Do not choose a licence that forbids use, modification or redistribution (the project rules require a genuine open-source licence). A permissive or GPL-3.0-compatible licence would not
conflict with the current contents; the final choice should wait for the legal review.

## Kiro and reuse record
The adapter, scripts and docs in this repository were written during Kiro sessions; no code was copied from other projects. The OpenBUGS scripting manual page
(https://chjackson.github.io/openbugsdoc/Manuals/Scripts.html) was used for command names.
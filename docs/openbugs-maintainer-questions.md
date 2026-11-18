# OpenBUGS 3.2.3 licensing and provenance questions

Draft for a maintainer or rights holder. No message has been sent. The tarball's `COPYING` permits OpenBUGS redistribution under GPL version 3, subject to its conditions. ReproLab's engine image remains **NO-GO for redistribution** while we establish compliance for the exact prebuilt library and bundled components, complete a legal review and record a release decision.

We use the OpenBUGS 3.2.3 Linux source package for local runs. The copy tested has SHA-256 `a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8`. Its prebuilt `lib/libOpenBUGS.so` has SHA-256 `3fc1b64d775030ed370975dbab677f035aeaa3c177bb65c45a74c5b8b37a11cf`. We do not distribute either file or the image. We want to establish whether a future image could be distributed with complete notices and corresponding source.

1. Is the 3.2.3 Linux tarball in `chjackson/openbugsdoc` an authorized copy of the upstream release? Is there an upstream checksum or release archive we can compare with the SHA-256 above?
2. Which Subversion revision and Component Pascal/BlackBox toolchain produced the exact `libOpenBUGS.so` above? Are the corresponding source files and build instructions still available, including any modified BlackBox components?
3. The tarball's `COPYING` grants GPL version 3; `doc/Manuals/GNU-Licence.html` contains GPL version 2, and the SourceForge project listing says GPLv2. Which terms apply to the 3.2.3 Linux executable, library and wrapper? Does the r1018 `cli/trunk/COPYING` clarification apply to the earlier 3.2.3 binary?
4. What licence applies to CpcBeautifier, and is any of its code included in this Linux library? Are any other third-party modules compiled into it?
5. The archived developer tools page says the library version does not use TAUCS. Does that hold for this exact 3.2.3 Linux `libOpenBUGS.so`?
6. Which BlackBox licence text and source-availability instructions should accompany a redistribution of the Linux library? Can you identify the BlackBox-derived files in its corresponding source?
7. Are the `doc/Examples`, `doc/GeoBUGS` and `doc/Reliability` trees cleared for redistribution, including third-party datasets? Our current runtime image excludes them, so an answer here is useful for documentation policy but not required for that reduced image.

References: [`docs/licensing-review.md`](licensing-review.md), [`docs/third-party-notices.md`](third-party-notices.md), and the [release gate](release-decision.md). Please record any answer with its source and date before changing a gate status.

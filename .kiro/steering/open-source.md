# Open-source release rules

The Kiroween submission repository is public on GitHub. Commit the Next.js app, Python worker, OpenBUGS adapter, required setup/deployment instructions, actual open-source LICENSE, root `.kiro`, and precise third-party notices. The product's source stays open; customer files, account credentials, model API keys, signing secrets and production environment values stay private.

Do not claim ownership of OpenBUGS or its examples. The root MIT `LICENSE` covers ReproLab-owned work only. OpenBUGS licence text is available in the user's tarball and upstream source, but the package's GPL v3 `COPYING` conflicts with GPL v2 text in its manual and SourceForge listing; bundled component and example rights remain unresolved. See `docs/licensing-review.md` and `docs/release-decision.md`. Do not redistribute the engine image or upstream files while the release gates remain unmet. If derivative engine changes are made, follow the applicable upstream terms. Terms of Service do not replace the repository software license.

Before submission, verify that a stranger can clone the public repository, follow the README, build the worker, and exercise the same feature shown in the demo. Record reused code and Kiro-generated changes honestly.

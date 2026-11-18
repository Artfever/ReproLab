# Open-source release rules

The Kiroween submission repository is public on GitHub. Commit the Next.js app, Python worker, OpenBUGS adapter, required setup/deployment instructions, actual open-source LICENSE, root `.kiro`, and precise third-party notices. The product's source stays open; customer files, account credentials, model API keys, signing secrets and production environment values stay private.

Do not claim ownership of OpenBUGS or its examples. The root MIT `LICENSE` covers ReproLab-authored work. OpenBUGS 3.2.3 is included in the local execution stack as the third-party inference engine; judges build the image from an archive they obtain. Keep the engine binary and upstream examples out of the Git repository, preserve third-party notices, and follow OpenBUGS' GPL terms when building or distributing the engine. See `docs/third-party-notices.md` for references. If derivative engine changes are made, follow the applicable upstream terms. Terms of Service do not replace the repository software license.

Before submission, verify that a stranger can clone the public repository, follow the README, build the worker, and exercise the same feature shown in the demo. Record reused code and Kiro-generated changes honestly.

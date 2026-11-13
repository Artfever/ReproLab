# Product direction

ReproLab helps researchers execute a supported old analysis with its original engine, see genuine logs and outputs, and download a reproducible run bundle. First target: OpenBUGS, conditional on a working Linux batch run and license review.

Focus the first release on the Seeds example and one end-to-end run. Do not fabricate results, imply a finished run is a valid scientific finding, or implement arbitrary executable upload. Next.js is the Vercel web client; Expo/React Native is a later mobile client.

ReproLab is an open-source project. All source needed to run the demonstrated web and worker application belongs in the public repository, with a root LICENSE and committed `.kiro` folder. The product can earn revenue from hosted service and support; do not design a secret core required to make the public submission work.

Before implementing a task: cite the relevant spec requirement; after implementation: give a changed-file summary, actual test result, and any remaining uncertainty. Leave task checkboxes open until verified.

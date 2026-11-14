# Files, manifest and summary

## Input files

The server stages your inputs under fixed names: model.txt, data.txt and inits1.txt up to inits4.txt. A name you upload is never used as a path. It may be recorded in the manifest only as a plain base name of at most 100 characters.

## Output files

A run produces script.txt (the OpenBUGS script ReproLab generated), log.txt (the engine's standard output), stderr.txt, and a manifest. When the engine finishes it also writes exported sample files named coda_CODAindex.txt and coda_CODAchain1.txt, with one chain file for each chain. The Results page lists each file with its size and SHA-256 and a download link. Only files in that run's own list can be downloaded.

## The log view

The page shows at most the first 2000 lines or 256 KiB of the log and says when it has been cut. Log text is shown as plain text and never as HTML.

## The manifest

manifest.json records the run id, state and reason, engine version, image tag and image id, settings, runtime, creation time, the engine argument list, the generated script, and the SHA-256 and size of every input and output file. You can download it as a record of what was run.

## Paths are removed

The manifest and every response replace host paths, such as your home folder or the repository folder, with the text <local-path>. Paths inside the container, such as /work/out, may appear.

## The summary

When a run succeeded and the sample files exist, ReproLab computes a table of mean, standard deviation and related values from the exported samples using its own runner code. The table is labelled as computed by ReproLab from the exported samples. It is not a convergence claim and not a validity claim.

## Engine version

The engine banner in the log reads OpenBUGS version 3.2.3 rev 1012. The manifest copies the version from that line when it is present.

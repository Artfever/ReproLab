# Running an analysis

## What a run does

You give ReproLab a model, a data file, one initial-values file for each chain, the names of the nodes to monitor, and some settings. ReproLab writes a short OpenBUGS script from those values, starts the original OpenBUGS command-line engine in a locked-down container, and keeps the log and the exported sample files. ReproLab does not translate the OpenBUGS language and does not change your model.

## The built-in demonstrations

The coin demonstration is a small model written for ReproLab. It has r successes out of n trials and a flat prior on p. With r = 7 and n = 10 the exact posterior is Beta(8, 4), with mean 0.6667 and standard deviation about 0.1307. A second demonstration has a deliberately broken model so you can see how an engine error is shown.

## Seeds from your own copy

The Seeds example is not stored in this repository. If you have your own OpenBUGS tarball, the extract-seeds script copies only the four Seeds files into local-data/upstream and checks each file's SHA-256. Only when all four files match does the Seeds entry appear in the demonstration list. Results from it are labelled historical.

## Using your own files

On the Run page choose one model file, one data file and one initial-values file per chain. Files are read in your browser and sent to the local server. The page shows each file name and size before you submit.

## One run at a time

The server runs a single analysis at a time. If you start a second one while the first is queued or running, the server answers with status 429 and a message that only one run at a time is supported.

## Time limits

You set an engine timeout of 1 to 300 seconds. The server also applies its own wall-clock limit of that timeout plus 30 seconds and kills the container if it is reached.

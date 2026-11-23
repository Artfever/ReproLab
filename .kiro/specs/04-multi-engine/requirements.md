# Multi-engine acceptance requirements

1. Keep one loopback app and scheduler. Give the selector all nine engine IDs, distinguish planned, setup required and probed ready, and preserve legacy OpenBUGS requests and downloads.
2. Fix runtime commands, fixtures, limits and image selection on the server. Run Linux amd64 CPU containers with no network or host secrets.
3. Verify a real success and deliberate failure, then download and validate the manifest and output bytes through the browser for each engine.
4. Separate execution and comparison. Check OpenBUGS and PyMC 2 against Beta(8,4), Caffe and Chainer against independently calculated logits, Theano against matrix and gradient references, QIIME 1 against artificial counts, TopHat2 against artificial alignment counts, Cufflinks against authored alignment and a compatible parent run, and NiftyNet against synthetic volume geometry and values.
5. Keep one active run, bound logs and artifacts, support cancellation and recover interrupted work. Export metadata and permitted files, with explicit input inclusion. Scope assistant context and require permission to send run text.
6. Record image IDs, source pins, CPU and memory measurements, actual blockers and clean checkout checks. GPU is optional and requires parity measurements on the same workload.

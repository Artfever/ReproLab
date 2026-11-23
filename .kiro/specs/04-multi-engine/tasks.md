# Verification ledger

- [x] Capture OpenBUGS success, failure, timeout, same-seed CODA hashes and artifact integrity.
- [x] Add trusted registry, adapters, selector and fixed workflow inputs.
- [x] Verify PyMC 2 CPU sampling and same-statistic comparison to OpenBUGS.
- [x] Verify Caffe CPU logits and input shape failure.
- [x] Verify Theano CPU compile, gradient and shape failure.
- [x] Verify Chainer logits, checkpoint loading and schema failure.
- [x] Verify QIIME 1 count summary and malformed table failure.
- [x] Verify TopHat2 artificial alignment and invalid fixture failure.
- [x] Verify Cufflinks independent and linked inputs and malformed alignment failure.
- [x] Verify NiftyNet synthetic volume inference, preview artifact and checkpoint failure.
- [x] Verify browser journeys, downloads, scheduler cancellation and recovery.
- [x] Rebuild all nine in a clean Git worktree and repeat all browser journeys against those image IDs.
- [ ] Verify on a second supported machine.
- [ ] Enforce a separate work volume quota, measure peak temporary disk use per engine and complete the transitive dependency inventory.
- [x] Measure optional GPU parity with a native Ollama workload.

Starting commit: bb6f17992ccd58ad6c7467cf153786fb58d3a02c on main. The owner-supplied handoff was untracked. Host: Windows 11 Pro x64, i7-11800H, 8 cores / 16 threads, 23.7 GiB visible RAM, 13.0 GiB available at initial measurement, RTX 3070 Laptop GPU (8192 MiB, driver 616.92). Docker Desktop WSL2 started from its installed D: location. Engine 29.9.2, 6 logical CPUs, 11.7 GiB RAM, Linux. Before builds Windows C: had 18.9 GiB free and D: 27.3 GiB. The Docker virtual disk reported 931.8 GiB virtual free, subject to the physical host free space. Start with one image build and at most two compiler jobs.

Per-engine commands, output checks and observed image IDs are in [verification evidence](../../../docs/evidence/multi-engine.md). A second machine was unavailable.

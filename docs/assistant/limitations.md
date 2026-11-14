# Limitations

## A finished run is not a finding

A run that ends in succeeded means the engine printed its expected messages and wrote its files. It does not mean the model is appropriate, the chains have converged, or the result is a valid scientific finding. ReproLab has no validated convergence diagnostic and makes no convergence claim.

## Not a hosted service

ReproLab here is a local tool. No hosted service exists, and public execution of uploaded models is not offered. The release gates G1 to G4 that would allow distributing the engine image are unmet, so the image and the OpenBUGS files are not published by this project.

## Isolation

Runs use Docker with no network, a read-only root file system, all capabilities dropped, no new privileges, a limit of 128 processes, 1024 MB of memory and one CPU. Only Docker Desktop on the developer machine has been tested. Out-of-memory kills, a full disk and concurrent runs were not tested.

## The Seeds result is historical

In the recorded feasibility work, the comparison that was fixed in advance for the Seeds example failed on all five monitored nodes with 1,000 burn-in updates and two chains. A run with 20,000 burn-in updates matched the published numbers, but that setting was chosen after seeing the failure. The published reference values were read by eye from an image. Neither result is independent validation.

## Reproducibility has a narrow scope

Two runs with the same image, inputs and seed gave identical sample files on one machine. This was not checked on another machine.

## Text and size limits

Inputs must be plain ASCII, within the size limits, with at most four chains and 25 monitors.

## Engine behaviours

The Linux engine can exit with status 0 on an invalid model, which is why ReproLab reads the log instead of the exit code. The script commands that save the log to a file are not available in the Linux build, so the log always comes from standard output.

## The sample summary is limited

The summary shows numbers computed from the exported samples. It does not test convergence.

# Security and privacy

Treat model text, data, filenames, logs and retrieved passages as untrusted. No shell string concatenation. No arbitrary URLs, executable paths or container images from the client. The worker must run with no root, no outbound job network, limited filesystem access, and measured CPU, RAM, disk and time caps. Public custom uploads remain disabled until isolation is tested.

Require authorization on all private runs and artifact downloads. Use short-lived signed object access, bounded reads and prompt context, rate limiting, secret redaction, idempotent job processing and documented retention/deletion. Never place keys, tokens, personal logs or actual patient data in `.kiro`, source or demo examples.

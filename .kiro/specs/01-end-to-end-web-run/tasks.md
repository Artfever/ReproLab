# Tasks — end-to-end web run

- [ ] W1 Bootstrap strict Next.js project, design tokens, layout, public pages and health checks.
- [ ] W2 Add PostgreSQL schema/migrations, job lease/heartbeat and abandonment recovery tests.
- [ ] W3 Add bounded run validation, idempotency and a secure artifact interface.
- [ ] W4 Connect Python worker to pinned engine and real outputs; enforce timeout and resource limits.
- [ ] W5 Build demo, run detail, log/results/provenance/download pages and accessible states.
- [ ] W6 Test authorization, invalid input, retries, worker restart and end-to-end fresh run.
- [ ] W7 Deploy web to Vercel and test a real production run with the selected worker host.
- [ ] W8 Publish all necessary source, README, open-source LICENSE, third-party notices and committed root `.kiro`; verify a fresh clone can run the demo feature.

Dependencies: E4 precedes W4 and W5 result claims; W2 precedes W3–W4; W3–W4 precede W6–W7.

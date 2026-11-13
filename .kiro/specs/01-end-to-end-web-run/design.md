# Design — end-to-end web run

Use Next.js App Router and route handlers for web/API, PostgreSQL for metadata and leased job claims, private object storage for inputs/artifacts, Python worker for engine and parser. A transaction uses `FOR UPDATE SKIP LOCKED` to claim a queued job and immediately commits; engine runs outside the transaction. Heartbeat and lease sweeper recover interrupted work. Artifact keys include run ID and attempt; finalization is idempotent. UI polls with backoff while active and stops at a terminal state.

For deployment, test Vercel Daemons public beta for the worker and per-job isolation. If either fails, keep web on Vercel and deploy the isolated worker to a container host. Record actual infrastructure and operational cost. The worker must not read credentials from user files.

# Requirements — end-to-end web run

## User story

As a visitor, I can start a genuine tutorial run, see its state and actual results, and download the inputs and provenance needed to rerun it.

## Acceptance criteria

1. Public demo accepts a bounded known example without account; rate limits and quota are visible.
2. Next.js handler validates request and transactionally inserts an idempotent queued run.
3. Worker claims a lease, invokes the pinned engine, heartbeats, stores private artifacts and updates state.
4. UI shows queued/running/succeeded/failed/timed_out with useful errors, and never displays fake progress.
5. Results include raw log, real samples, version, settings, hashes and a downloadable bundle.
6. Authorization prevents another user's access to private runs; guest links expire.
7. Vercel deployment and worker host are tested with a fresh real run and restart scenario.

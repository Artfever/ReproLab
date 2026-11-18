# Engineering conventions

- Use TypeScript strict mode and schema validation at every public API boundary.
- Use a Python OpenBUGS adapter with typed inputs and explicit parsing failures.
- Keep slow runs outside Vercel request handlers. The MVP uses a leased PostgreSQL job table, not an in-memory queue.
- Store run artifacts privately and reference them by opaque IDs after authorization.
- Include engine version/image digest, configuration and file hashes in a run manifest.
- Add small focused tests for changed behavior and a real end-to-end smoke path.
- Do not add a second queue system, backend framework or search index without documenting a measured need.
- Make site pages accessible and responsive; explain errors in plain English.

Use the active requirements, design and tasks in `.kiro/specs/03-local-product/` as the planning reference for the local product. Earlier hosted-app specs are historical or deferred. When implementation discovers a conflict, update the affected spec before changing scope.

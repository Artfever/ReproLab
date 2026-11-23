# Multi-engine design

Extend the existing app and runner rather than creating another service. The trusted registry owns workflow IDs, image tags, fixture declarations and probes. A built-in worker receives a fixed demo case and cannot run code supplied by the browser. The existing OpenBUGS request and CODA path remain compatible with historical records.

For each new workflow, the server selects the command and output allowlist. The worker emits a bounded numeric result plus fixture-specific artifacts. The server validates the outputs and compares with frozen reference values. Execution, comparison and runtime availability are distinct state axes.

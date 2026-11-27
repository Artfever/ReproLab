# Design direction

Applies to `apps/local/public` and `apps/web`. Full detail in `.kiro/specs/05-ui-redesign/design.md`. The direction was set with the unslop skill (unslop by Damir Sokolovsky, @heydamir, CC BY 4.0; keep this credit in copies and adaptations).

- **Product:** runs an old Bayesian analysis with its original engine in a sealed container on your machine, and keeps a record you can verify.
- **Character:** exact, candid, archival. Never "clean, modern, sleek".
- **World:** an archive room where an old machine was switched back on. Warm paper and graphite ink neutrals; the green `#245c43` is the only accent; the engine log is a dark panel in IBM Plex Mono.
- **Moments:** the run timeline and the plot of exported samples. Put colour and craft there, keep the chrome quiet.
- **Signature:** the hash tag `sha256 61cf5083…`. Use it where a file is recorded and nowhere else.

Rules:

- Honesty first. A visual shows only real data from this run or labelled recorded evidence. Never decorate a result into a claim. The words validated, converged, verified-as-correct, AI-powered and "AI assistant" stay out of the interface.
- Colours come only from the tokens in the single `:root` block; add every new token to the contrast table in `apps/local/tests/pages.test.mjs`.
- 4px spacing scale; radii 6, 8, 12, 16; weights 400 to 600; sentence case; no negative tracking on small text; `tabular-nums` on figures.
- No gradients between hues, glows, coloured shadows, emoji, pill badges, hover lift, parallax or looping motion.
- Every motion goes through `motion.js`, uses the one curve and does nothing under `prefers-reduced-motion: reduce`. Never leave text at opacity 0 waiting for a scroll.
- Self-host everything. Record new vendored files in `public/vendor/manifest.json` and `docs/third-party-notices.md`.
- Keep the element IDs, copy strings and tab order that the tests and browser scripts pin (listed in spec 05 design).

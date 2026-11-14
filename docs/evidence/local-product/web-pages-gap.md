# Public site pages gap (task 8.1, Requirement 16.3)

The How it works, Docs, Limitations, Privacy and Terms pages were not added to `apps/web`. Nothing under `apps/web` was changed.

## Why adding them is not cheap

1. **A frozen test pins the navigation.** `apps/web/tests/smoke.test.mjs`, test "navigation lists exactly Home and Sample run", asserts that the nav on every page holds exactly `Home` and `Sample run`. Pages that are not linked from the nav are unreachable, so adding them means editing that existing test and the `NAV` constant in `src/components/shell.tsx`. The task says the guard stays unchanged.
2. **The footer says Terms and Privacy are unpublished drafts.** `SiteFooter` states that "Terms of Service and Privacy Policy are drafts and are not published yet". Publishing pages with those names would contradict the footer text. Publishing legal text also needs review that this task does not cover.
3. **Page-level tests cover only three pages.** `tests/helpers/html.mjs` lists `home`, `sample` and `notFound`. The structure, forbidden-claim, no-form and 12-word-copy checks would not run on new pages unless the helper and tests are extended, so new pages would be unchecked by the existing suite.

## State of the existing site (unchanged)

- `npm.cmd run check` in `apps/web`: exit 0, 86 tests pass, 0 fail (`m2-web-check.txt`, 78 required).
- `git diff --stat -- apps/web` is empty (`m2-web-diffstat.txt`).
- `git diff -- apps/web/content apps/web/src/components/sample-run` is empty (`m2-web-sample-diff.txt`), so the failed pre-declared comparison, its post hoc labels and the NO-GO statements are unchanged.

## What a follow-up would need

Add the five routes, extend `NAV`, update the nav test and the page list in `tests/helpers/html.mjs`, remove or reword the footer draft notice for any page that is actually published, and word each page to say that ReproLab is a local tool and that no hosted service runs an engine.

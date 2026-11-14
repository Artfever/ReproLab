README checks (task 11.4). Machine paths redacted (none appeared in the outputs).
Run from the repository root after README.md was written.

### node scripts/audit-tracked.mjs
Tracked-file audit: 361 tracked files checked.
Result: PASS
exit=0

### node scripts/check-license.mjs
MIT OK
exit=0

### node --test tests/notices.test.mjs   (cwd apps/local)
(first attempt in the combined shell command produced no output, so it was rerun alone; the output below is from that rerun.
 Check marks were garbled by the console code page and are written here as "ok")
ok  notices state the MIT boundary and that it grants no rights to OpenBUGS
ok  notices keep the dependency table heading and the named licence notes
ok  notices list every open item
ok  notices do not call the GitHub mirror authenticated
tests 4
suites 0
pass 4
fail 0
cancelled 0
skipped 0
todo 0
exit=0

Note: audit-tracked checks tracked files only. README.md is new and untracked at the time of this run, so the audit did not scan it.

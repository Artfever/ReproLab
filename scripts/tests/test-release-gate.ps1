<#
Tests for scripts/release-guard.ps1 and scripts/check-publish-paths.ps1 (spec 00-engine-feasibility, task 21.2).
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/test-release-gate.ps1 [-EvidenceFile docs/evidence/release-guard-tests.txt]
Every fixture lives in a temporary directory. The real docs/release-decision.md is only READ; its SHA-256 is compared before and
after and the run fails if it changed. The "GO" fixture is synthetic, uses a made-up digest, and never touches an image.
Nothing here runs docker, git or any network command.
#>
[CmdletBinding()]
param([string]$EvidenceFile)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$guard = Join-Path $root 'scripts\release-guard.ps1'
$checker = Join-Path $root 'scripts\check-publish-paths.ps1'
$realDecision = Join-Path $root 'docs\release-decision.md'
$bt = [string][char]96
$realImage = 'sha256:f65e2244463b5899308e9fd51361589de518f9a534fbc62d758e17277e76b88f'
$synth = 'sha256:' + ('a' * 64)
$other = 'sha256:' + ('b' * 64)
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('rg-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$log = New-Object System.Collections.Generic.List[string]
$fails = 0

function Run-Script([string]$script, [string[]]$arguments) {
    $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + $arguments
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'   # the guard writes to stderr on purpose; do not turn that into a terminating error
    try { $out = & powershell.exe @all 2>&1 | ForEach-Object { "$_" }; $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previous }
    $text = ($out -join ' | ')
    $text = $text.Replace($script:tmp, '<tmp>').Replace($script:root, '<repo>')   # keep local paths out of the evidence file
    return @{ code = $code; text = $text }
}
function Assert-Case([string]$name, $result, [int]$expected, [string]$mustContain) {
    $ok = ($result.code -eq $expected)
    if ($ok -and $mustContain) { $ok = $result.text.Contains($mustContain) }
    if (-not $ok) { $script:fails++ }
    $short = $result.text; if ($short.Length -gt 170) { $short = $short.Substring(0, 170) + '...' }
    $line = '[{0}] {1} -- exit={2} expected={3} -- {4}' -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $result.code, $expected, $short
    $script:log.Add($line); [Console]::Out.WriteLine($line)
}

function New-Fixture([string]$name, [string]$gateStatus, [string[]]$rows, [bool]$withEvidence) {
    $dir = Join-Path $tmp $name
    New-Item -ItemType Directory -Path (Join-Path $dir 'docs\evidence') -Force | Out-Null
    if ($withEvidence) { foreach ($f in 'g1.txt', 'g2.txt', 'g3.txt') { [IO.File]::WriteAllText((Join-Path $dir "docs\evidence\$f"), 'synthetic test evidence') } }
    $t = "# Synthetic fixture (NOT a real decision)`n`n## Current status`nfixture`n`n## Gate conditions`n`n| Gate | Condition | Status | Evidence | Satisfy |`n|---|---|---|---|---|`n"
    foreach ($g in 'G1 Provenance', 'G2 Licence', 'G3 Source', 'G4 Decision') { $t += "| $g | c | $gateStatus | e | s |`n" }
    $t += "`n## Decision log`n`n| Date | Decision | Decider | Image digest | Evidence for G1 | G2 | G3 | Notes |`n|---|---|---|---|---|---|---|---|`n"
    foreach ($r in $rows) { $t += $r + "`n" }
    [IO.File]::WriteAllText((Join-Path $dir 'docs\release-decision.md'), $t)
    return $dir
}
function Row([string]$date, [string]$decision, [string]$decider, [string]$digestCell, [string]$g1, [string]$g2, [string]$g3) {
    return "| $date | $decision | $decider | $digestCell | $g1 | $g2 | $g3 | note |"
}
$ev1 = $bt + 'docs/evidence/g1.txt' + $bt; $ev2 = $bt + 'docs/evidence/g2.txt' + $bt; $ev3 = $bt + 'docs/evidence/g3.txt' + $bt
$d = { param($x) $bt + $x + $bt }
function Guard-Fixture([string]$dir, [string]$digest) {
    return Run-Script $guard @('-ImageDigest', $digest, '-RepoRoot', $dir, '-DecisionFile', (Join-Path $dir 'docs\release-decision.md'))
}

try {
    $before = (Get-FileHash -LiteralPath $realDecision -Algorithm SHA256).Hash
    $log.Add('# release-guard and publish-path tests, 2026-11-13 run. Real decision file SHA-256 before: ' + $before)

    # --- A. real record: must block (decision is NO-GO, no approval row, gates unmet)
    $fullReal = Run-Script $guard @('-ImageDigest', $realImage)
    $log.Add('# full guard output for the real record and the final local image digest (exit=' + $fullReal.code + '): ' + $fullReal.text)
    Assert-Case 'A1 real decision record + final local image digest -> BLOCKED' (Run-Script $guard @('-ImageDigest', $realImage)) 1 'BLOCKED'
    Assert-Case 'A2 real decision record reports unmet gates' (Run-Script $guard @('-ImageDigest', $realImage)) 1 'must be MET'
    Assert-Case 'A3 real decision record reports no row for the digest' (Run-Script $guard @('-ImageDigest', $realImage)) 1 'no Decision log row names exactly this image digest'

    # --- B. fail-closed on missing input
    Assert-Case 'B1 no -ImageDigest -> BLOCKED' (Run-Script $guard @()) 1 'no -ImageDigest'
    Assert-Case 'B2 malformed digest (short) -> BLOCKED' (Run-Script $guard @('-ImageDigest', 'sha256:abc')) 1 'not a full'
    Assert-Case 'B3 malformed digest (upper case) -> BLOCKED' (Run-Script $guard @('-ImageDigest', ('sha256:' + ('A' * 64)))) 1 'not a full'
    Assert-Case 'B4 digest given as image tag -> BLOCKED' (Run-Script $guard @('-ImageDigest', 'reprolab-openbugs:3.2.3')) 1 'not a full'
    Assert-Case 'B5 decision file missing -> BLOCKED' (Run-Script $guard @('-ImageDigest', $synth, '-DecisionFile', (Join-Path $tmp 'nope.md'))) 1 'decision record missing'
    $emptyDir = Join-Path $tmp 'empty'; New-Item -ItemType Directory -Path $emptyDir | Out-Null; [IO.File]::WriteAllText((Join-Path $emptyDir 'e.md'), '')
    Assert-Case 'B6 decision file empty -> BLOCKED' (Run-Script $guard @('-ImageDigest', $synth, '-DecisionFile', (Join-Path $emptyDir 'e.md'), '-RepoRoot', $emptyDir)) 1 'empty'
    [IO.File]::WriteAllText((Join-Path $emptyDir 'junk.md'), "hello`nno tables here")
    Assert-Case 'B7 decision file without gate table or log -> BLOCKED' (Run-Script $guard @('-ImageDigest', $synth, '-DecisionFile', (Join-Path $emptyDir 'junk.md'), '-RepoRoot', $emptyDir)) 1 'Decision log'
    Assert-Case 'B8 internal error (invalid repo root path) -> exit 2, still non-zero' (Run-Script $guard @('-ImageDigest', $synth, '-RepoRoot', '<>:|?*')) 2 'ERROR'

    # --- C. decision missing / NO-GO / wrong digest / revoked
    $fx = New-Fixture 'c1' 'MET' @() $true
    Assert-Case 'C1 gates MET but no Decision log row -> BLOCKED' (Guard-Fixture $fx $synth) 1 'no Decision log row'
    $fx = New-Fixture 'c2' 'MET' @((Row '2026-11-13' '**NO-GO**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $true
    Assert-Case 'C2 NO-GO row for the digest -> BLOCKED' (Guard-Fixture $fx $synth) 1 'not APPROVED'
    $fx = New-Fixture 'c3' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $other) $ev1 $ev2 $ev3)) $true
    Assert-Case 'C3 APPROVED row for a DIFFERENT digest -> BLOCKED' (Guard-Fixture $fx $synth) 1 'no Decision log row names exactly'
    $abbr = $bt + $synth.Substring(0, 19) + '...' + $bt
    $fx = New-Fixture 'c4' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' $abbr $ev1 $ev2 $ev3)) $true
    Assert-Case 'C4 APPROVED row with abbreviated digest -> BLOCKED' (Guard-Fixture $fx $synth) 1 'no Decision log row names exactly'
    $fx = New-Fixture 'c5' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3), (Row '2026-11-14' '**NO-GO**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $true
    Assert-Case 'C5 approval later revoked by a NO-GO row -> BLOCKED' (Guard-Fixture $fx $synth) 1 'not APPROVED'
    $fx = New-Fixture 'c6' 'MET' @((Row '2026-11-13' '**APPROVED**' 'review session' (& $d $synth) $ev1 $ev2 $ev3)) $true
    Assert-Case 'C6 APPROVED but placeholder decider -> BLOCKED' (Guard-Fixture $fx $synth) 1 'placeholder'
    $fx = New-Fixture 'c7' 'MET' @((Row '2026-11-13' 'approved-ish' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $true
    Assert-Case 'C7 decision text not exactly APPROVED -> BLOCKED' (Guard-Fixture $fx $synth) 1 'not APPROVED'

    # --- D. evidence missing
    $fx = New-Fixture 'd1' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $false
    Assert-Case 'D1 APPROVED, linked evidence files do not exist -> BLOCKED' (Guard-Fixture $fx $synth) 1 'does not exist'
    $fx = New-Fixture 'd2' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) 'partial' 'unmet' 'unmet')) $true
    Assert-Case 'D2 APPROVED, evidence cells are prose without file links -> BLOCKED' (Guard-Fixture $fx $synth) 1 'no file link'
    $fx = New-Fixture 'd3' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) $ev1 $ev2 '')) $true
    Assert-Case 'D3 APPROVED, G3 evidence cell empty -> BLOCKED' (Guard-Fixture $fx $synth) 1 'G3 evidence cell'
    $fx = New-Fixture 'd4' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $true
    [IO.File]::WriteAllText((Join-Path $fx 'docs\evidence\g2.txt'), '')
    Assert-Case 'D4 APPROVED, one evidence file is empty -> BLOCKED' (Guard-Fixture $fx $synth) 1 'is empty'
    $fx = New-Fixture 'd5' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) ($bt + '../outside.txt' + $bt) $ev2 $ev3)) $true
    Assert-Case 'D5 APPROVED, evidence link escapes the repo -> BLOCKED' (Guard-Fixture $fx $synth) 1 'repo-relative'
    $fx = New-Fixture 'd6' 'MET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) ($bt + 'C:/Windows/win.ini' + $bt) $ev2 $ev3)) $true
    Assert-Case 'D6 APPROVED, evidence link is an absolute path -> BLOCKED' (Guard-Fixture $fx $synth) 1 'repo-relative'

    # --- E. gate table not MET
    $fx = New-Fixture 'e1' 'UNMET' @((Row '2026-11-13' '**APPROVED**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $true
    Assert-Case 'E1 valid APPROVED row but gates UNMET -> BLOCKED' (Guard-Fixture $fx $synth) 1 'must be MET'

    # --- F. synthetic GO fixture: the only case that may pass. Synthetic digest, temp dir, no image, real record untouched.
    $fx = New-Fixture 'f1' 'MET' @((Row '2026-11-13' '**NO-GO**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3), (Row '2026-11-20' '**APPROVED**' 'A Person' (& $d $synth) $ev1 $ev2 $ev3)) $true
    Assert-Case 'F1 SYNTHETIC GO fixture (NO-GO then APPROVED, gates MET, evidence present) -> exit 0' (Guard-Fixture $fx $synth) 0 'APPROVED for'
    Assert-Case 'F2 same synthetic GO fixture, different digest -> BLOCKED' (Guard-Fixture $fx $other) 1 'no Decision log row names exactly'
    Assert-Case 'F3 same synthetic GO fixture asked about the real image digest -> BLOCKED' (Guard-Fixture $fx $realImage) 1 'no Decision log row names exactly'

    # --- G. publish-path checker
    $pt = Join-Path $tmp 'publish'
    function New-Tree([string]$name, [string]$file, [string]$content) {
        $dir = Join-Path $pt $name; New-Item -ItemType Directory -Path (Join-Path $dir (Split-Path $file)) -Force | Out-Null
        [IO.File]::WriteAllText((Join-Path $dir $file), $content); return $dir
    }
    $t = New-Tree 'g1' 'scripts\publish.ps1' "docker push registry.example/x:1`n"
    Assert-Case 'G1 docker push with no guard -> FAIL' (Run-Script $checker @('-Root', $t)) 1 'without an earlier release-guard'
    $t = New-Tree 'g2' 'scripts\publish.ps1' "powershell -File scripts/release-guard.ps1 -ImageDigest `$d`nif (`$LASTEXITCODE -ne 0) { exit 1 }`ndocker push registry.example/x:1`n"
    Assert-Case 'G2 guard call before docker push -> OK' (Run-Script $checker @('-Root', $t)) 0 'OK'
    $t = New-Tree 'g3' 'scripts\publish.ps1' "docker push registry.example/x:1`npowershell -File scripts/release-guard.ps1`n"
    Assert-Case 'G3 guard call AFTER docker push -> FAIL' (Run-Script $checker @('-Root', $t)) 1 'without an earlier release-guard'
    $t = New-Tree 'g4' 'scripts\publish.ps1' "# release-guard.ps1 is mentioned only in a comment`ndocker save -o img.tar x`n"
    Assert-Case 'G4 guard only mentioned in a comment -> FAIL' (Run-Script $checker @('-Root', $t)) 1 'without an earlier release-guard'
    $t = New-Tree 'g5' '.github\workflows\release.yml' "jobs:`n  p:`n    steps:`n      - uses: docker/build-push-action@v5`n        with:`n          push: true`n"
    Assert-Case 'G5 CI workflow that pushes with no guard -> FAIL' (Run-Script $checker @('-Root', $t)) 1 'without an earlier release-guard'
    $t = New-Tree 'g6' '.kiro\hooks\h.json' '{"command": "gh release create v1 image.tar"}'
    Assert-Case 'G6 Kiro hook that creates a release with no guard -> FAIL' (Run-Script $checker @('-Root', $t)) 1 'without an earlier release-guard'
    $t = New-Tree 'g7' 'scripts\build.ps1' "docker build -t reprolab-openbugs:3.2.3 .`ndocker run --rm x`ndocker cp a b`n"
    Assert-Case 'G7 build/run/cp only -> OK' (Run-Script $checker @('-Root', $t)) 0 'OK'
    $t = New-Tree 'g8' 'infra\Dockerfile' "FROM debian`nRUN echo hi`n"
    Assert-Case 'G8 Dockerfile without publish commands -> OK' (Run-Script $checker @('-Root', $t)) 0 'OK'
    Assert-Case 'G9 the real repository contains no unguarded publish path -> OK' (Run-Script $checker @()) 0 'OK'

    # --- H. the real record was only read
    $after = (Get-FileHash -LiteralPath $realDecision -Algorithm SHA256).Hash
    $same = ($before -eq $after)
    if (-not $same) { $fails++ }
    $line = '[{0}] H1 real docs/release-decision.md unchanged by the tests -- before={1} after={2}' -f $(if ($same) { 'PASS' } else { 'FAIL' }), $before, $after
    $log.Add($line); [Console]::Out.WriteLine($line)
    $realText = [IO.File]::ReadAllText($realDecision)
    $noApproval = -not ($realText -cmatch '\*\*APPROVED\*\*')
    if (-not $noApproval) { $fails++ }
    $line = '[{0}] H2 real docs/release-decision.md contains no **APPROVED** row' -f $(if ($noApproval) { 'PASS' } else { 'FAIL' })
    $log.Add($line); [Console]::Out.WriteLine($line)
}
finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
$summary = 'cases=' + (@($log | Where-Object { $_ -match '^\[(PASS|FAIL)\]' }).Count) + ' failures=' + $fails
$log.Add($summary); [Console]::Out.WriteLine($summary)
if ($EvidenceFile) { [IO.File]::WriteAllText($EvidenceFile, (($log -join "`n") + "`n")) }
exit $(if ($fails -eq 0) { 0 } else { 1 })
<#
Static check: every file that could publish, export or share a container image must call scripts/release-guard.ps1 on an
EARLIER, non-comment line (spec 00-engine-feasibility, Requirement 13.1 and 13.7).

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-publish-paths.ps1 [-Root <dir>]

Exit 0: no publish-style command found, or every one is preceded by a guard call.  Exit 1: violations printed.  Exit 2: error.
This is a text check, not a sandbox: it cannot see commands typed by hand or built at run time. It is meant to run in CI and before
every commit that adds a script, workflow or Kiro hook. Docs, specs, steering and tests are not scanned (they describe commands).
#>
[CmdletBinding()]
param([string]$Root)
$ErrorActionPreference = 'Stop'
trap {
    [Console]::Error.WriteLine('check-publish-paths: ERROR: ' + $_.Exception.Message)
    exit 2
}
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }
$Root = [IO.Path]::GetFullPath($Root)

$publish = @(
    'docker\s+(image\s+)?(push|save|export|login)\b',
    'docker\s+(image\s+)?tag\b',
    'docker\s+buildx\b.*--push\b',
    '--output[ =]+type=(registry|image)[^ ]*push=true',
    'push\s*[:=]\s*true\b',
    'docker/build-push-action',
    'skopeo\s+copy\b',
    '\bcrane\s+(push|copy|cp)\b',
    '\boras\s+push\b',
    '\bgh\s+release\b',
    '\bgh\s+.*\bupload\b',
    '\b(podman|nerdctl)\s+(push|save|login)\b'
)
$publishRe = '(?i)(' + ($publish -join '|') + ')'
$guardRe = 'release-guard\.ps1'
$skipDirs = '^(\.git|\.scratch|runs|node_modules|docs|\.kiro\\specs|\.kiro\\steering|scripts\\tests)(\\|$)'
$skipFiles = @('scripts\release-guard.ps1', 'scripts\check-publish-paths.ps1')
$extensions = '.ps1', '.psm1', '.sh', '.bash', '.cmd', '.bat', '.yml', '.yaml', '.json', '.toml', '.mk'
$namedFiles = '^(Makefile|Dockerfile.*|Jenkinsfile|justfile)$'

function Test-Comment([string]$line) {
    $t = $line.TrimStart()
    return ($t.StartsWith('#') -or $t.StartsWith('//') -or $t -match '^(?i)rem\s' -or $t.StartsWith('::'))
}

$violations = New-Object System.Collections.Generic.List[string]
$scanned = 0
foreach ($f in Get-ChildItem -LiteralPath $Root -Recurse -File -Force) {
    $rel = $f.FullName.Substring($Root.Length).TrimStart('\')
    if ($rel -match $skipDirs) { continue }
    if ($skipFiles -contains $rel) { continue }
    if (-not (($extensions -contains $f.Extension.ToLower()) -or ($f.Name -match $namedFiles))) { continue }
    $scanned++
    $lines = [IO.File]::ReadAllLines($f.FullName)
    $guardAt = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if (-not (Test-Comment $lines[$i]) -and $lines[$i] -match $guardRe) { $guardAt = $i; break }
    }
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ((Test-Comment $lines[$i])) { continue }
        if ($lines[$i] -match $publishRe) {
            if ($guardAt -lt 0 -or $guardAt -ge $i) {
                $violations.Add(($rel + ':' + ($i + 1) + ': publish-style command without an earlier release-guard.ps1 call: ' + $lines[$i].Trim()))
            }
        }
    }
}
if ($violations.Count -gt 0) {
    [Console]::Out.WriteLine('check-publish-paths: FAIL')
    foreach ($v in $violations) { [Console]::Out.WriteLine('  - ' + $v) }
    exit 1
}
[Console]::Out.WriteLine('check-publish-paths: OK - scanned ' + $scanned + ' file(s); no unguarded publish path found.')
exit 0
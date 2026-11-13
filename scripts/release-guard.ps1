<#
Fail-closed release guard for the OpenBUGS engine image (spec 00-engine-feasibility, task 21.1, Requirement 13).

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release-guard.ps1 -ImageDigest sha256:<64 hex>

Exit codes (anything other than 0 means DO NOT PUBLISH, DISTRIBUTE, EXPORT OR SHARE the image):
  0  APPROVED: docs/release-decision.md has an APPROVED Decision-log row for exactly this digest, every gate G1-G4 is
     marked MET, and the G1, G2 and G3 evidence cells link to files that exist and are not empty.
  1  BLOCKED: one or more reasons are printed.
  2  Guard error (unreadable input, bad path, unexpected exception). Treated as BLOCKED.

This script only reads files. It never runs docker, git or any network command, and it never pushes, tags, saves or exports anything.
-RepoRoot and -DecisionFile exist so tests can point the guard at a synthetic fixture. A real release must use the defaults.
#>
[CmdletBinding()]
param(
    [string]$ImageDigest,
    [string]$DecisionFile,
    [string]$RepoRoot
)
$ErrorActionPreference = 'Stop'
trap {
    [Console]::Error.WriteLine('release-guard: ERROR (treated as BLOCKED): ' + $_.Exception.Message)
    exit 2
}

if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }
$RepoRoot = [IO.Path]::GetFullPath($RepoRoot)
if (-not $DecisionFile) { $DecisionFile = Join-Path $RepoRoot 'docs\release-decision.md' }

$reasons = New-Object System.Collections.Generic.List[string]
function Block([string]$message) { $script:reasons.Add($message) }
$bt = [string][char]96

function Get-Section([string]$text, [string]$heading) {
    $lines = $text -split "`r?`n"
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].StartsWith($heading)) { $start = $i + 1; break } }
    if ($start -lt 0) { return $null }
    $out = New-Object System.Collections.Generic.List[string]
    for ($i = $start; $i -lt $lines.Count; $i++) {
        if ($lines[$i].StartsWith('## ')) { break }
        $out.Add($lines[$i])
    }
    return ,$out.ToArray()
}
function Get-Cells([string]$line) {
    $t = $line.Trim()
    if (-not ($t.StartsWith('|') -and $t.EndsWith('|') -and $t.Length -ge 2)) { return $null }
    $inner = $t.Substring(1, $t.Length - 2)
    return ,@($inner.Split('|') | ForEach-Object { $_.Trim() })
}

# 1. The digest to be released must be given and well formed (full sha256, lower case).
if ([string]::IsNullOrWhiteSpace($ImageDigest)) {
    Block 'no -ImageDigest given'
} elseif ($ImageDigest -cnotmatch '^sha256:[0-9a-f]{64}$') {
    Block "image digest is not a full lower-case sha256:<64 hex> value: '$ImageDigest'"
}

# 2. The decision record must exist and be readable.
$text = $null
if (-not (Test-Path -LiteralPath $DecisionFile -PathType Leaf)) {
    Block "decision record missing: $DecisionFile"
} else {
    $len = (Get-Item -LiteralPath $DecisionFile).Length
    if ($len -eq 0) { Block 'decision record is empty' }
    elseif ($len -gt 1048576) { Block 'decision record is larger than 1 MiB' }
    else { $text = [IO.File]::ReadAllText($DecisionFile) }
}

if ($null -ne $text) {
    # 3. Every gate G1-G4 must be marked MET in the gate table.
    $gateLines = Get-Section $text '## Gate conditions'
    if ($null -eq $gateLines) {
        Block "no '## Gate conditions' section"
    } else {
        $seen = @{}
        foreach ($l in $gateLines) {
            $c = Get-Cells $l
            if ($null -ne $c -and $c.Count -ge 3 -and $c[0] -cmatch '^G[1-4]\b') {
                $id = $c[0].Substring(0, 2)
                $status = ($c[2] -replace '[\*\s]', '')
                $seen[$id] = $true
                if ($status -cne 'MET') { Block "gate $id status is '$status', must be MET" }
            }
        }
        foreach ($g in 'G1', 'G2', 'G3', 'G4') { if (-not $seen.ContainsKey($g)) { Block "gate $g not found in the gate table" } }
    }

    # 4. The Decision log must hold an APPROVED row for exactly this digest (the latest row for that digest wins, so a later NO-GO revokes).
    $logLines = Get-Section $text '## Decision log'
    if ($null -eq $logLines) {
        Block "no '## Decision log' section"
    } else {
        $rows = New-Object System.Collections.Generic.List[object]
        foreach ($l in $logLines) {
            $c = Get-Cells $l
            if ($null -ne $c -and $c.Count -ge 1 -and $c[0] -cmatch '^\d{4}-\d{2}-\d{2}$') {
                if ($c.Count -ne 8) { Block "malformed Decision log row (expected 8 cells, found $($c.Count)): $l" }
                else { $rows.Add($c) }
            }
        }
        $match = @($rows | Where-Object { $_[3] -ceq ($bt + $ImageDigest + $bt) -or $_[3] -ceq $ImageDigest })
        if ($match.Count -eq 0) {
            Block 'no Decision log row names exactly this image digest'
        } else {
            $row = $match[$match.Count - 1]
            $decision = ($row[1] -replace '[\*\s]', '')
            if ($decision -cne 'APPROVED') { Block "latest Decision log row for this digest is '$decision', not APPROVED" }
            if ([string]::IsNullOrWhiteSpace($row[2]) -or $row[2] -cmatch '^(?i)(review session|tbd|n/a|none|-)$') { Block "decider is empty or a placeholder: '$($row[2])'" }
            $labels = @{ 4 = 'G1'; 5 = 'G2'; 6 = 'G3' }
            foreach ($idx in 4, 5, 6) {
                $label = $labels[$idx]
                $links = [regex]::Matches($row[$idx], $bt + '([^' + $bt + ']+)' + $bt)
                if ($links.Count -eq 0) { Block "$label evidence cell has no file link in backticks: '$($row[$idx])'"; continue }
                foreach ($m in $links) {
                    $rel = $m.Groups[1].Value
                    if ([IO.Path]::IsPathRooted($rel) -or $rel.Contains('..')) { Block "$label evidence link must be repo-relative without '..': $rel"; continue }
                    $full = [IO.Path]::GetFullPath((Join-Path $RepoRoot ($rel -replace '/', '\')))
                    if (-not $full.StartsWith($RepoRoot, [StringComparison]::OrdinalIgnoreCase)) { Block "$label evidence link leaves the repository: $rel"; continue }
                    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { Block "$label evidence file does not exist: $rel"; continue }
                    if ((Get-Item -LiteralPath $full).Length -eq 0) { Block "$label evidence file is empty: $rel" }
                }
            }
        }
    }
}

if ($reasons.Count -gt 0) {
    [Console]::Out.WriteLine('release-guard: BLOCKED - do not publish, distribute, export or share the image.')
    foreach ($r in $reasons) { [Console]::Out.WriteLine('  - ' + $r) }
    exit 1
}
[Console]::Out.WriteLine('release-guard: APPROVED for ' + $ImageDigest + ' by the Decision log row in ' + $DecisionFile)
exit 0
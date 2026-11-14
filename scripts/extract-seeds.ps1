<#
.SYNOPSIS
  Extract the four Seeds example files from YOUR OWN OpenBUGS tarball into local-data/upstream/.

.DESCRIPTION
  Requirement 10.1 to 10.3. Only Seedsmodel.txt, Seedsdata.txt, Seedsinits1.txt and Seedsinits2.txt
  are extracted (explicit member names found by listing the archive). Files are extracted to a
  temporary directory, checked against docs/evidence/input_hashes_upstream_examples.txt, and
  copied to the output directory only when all four match. On any mismatch or missing member the
  extracted files are deleted and the script exits 1. File contents are never printed; only
  names and hashes are.

.PARAMETER Tarball
  Path to your own OpenBUGS source tarball (.tar.gz). It is only read.

.PARAMETER OutDir
  Destination directory. Default: local-data/upstream under the repository root.

.PARAMETER HashFile
  Recorded hashes. Default: docs/evidence/input_hashes_upstream_examples.txt under the repository root.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Tarball,
  [string]$OutDir,
  [string]$HashFile
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'local-data/upstream' }
if (-not $HashFile) { $HashFile = Join-Path $RepoRoot 'docs/evidence/input_hashes_upstream_examples.txt' }
$Wanted = @('Seedsmodel.txt', 'Seedsdata.txt', 'Seedsinits1.txt', 'Seedsinits2.txt')

function Fail([string]$msg) {
  [Console]::Error.WriteLine("extract-seeds: $msg")
  exit 1
}

if (-not (Test-Path -LiteralPath $Tarball -PathType Leaf)) { Fail "tarball not found: $Tarball" }
if (-not (Test-Path -LiteralPath $HashFile -PathType Leaf)) { Fail "hash file not found: $HashFile" }
if (-not (Get-Command tar -ErrorAction SilentlyContinue)) { Fail 'the tar command is not available on this machine.' }

# Recorded hashes: "<sha256>  <name>" per line.
$expected = @{}
foreach ($line in Get-Content -LiteralPath $HashFile) {
  if ($line -match '^([0-9a-fA-F]{64})\s+\*?(\S+)\s*$') { $expected[$Matches[2]] = $Matches[1].ToLowerInvariant() }
}
foreach ($n in $Wanted) { if (-not $expected.ContainsKey($n)) { Fail "no recorded hash for $n in the hash file." } }

# Discover the exact member names by listing (names only).
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$members = & tar -tzf $Tarball 2>$null
$listExit = $LASTEXITCODE
$ErrorActionPreference = $prev
if ($listExit -ne 0 -or -not $members) { Fail 'could not read the tarball (is it a .tar.gz file?).' }

$chosen = @{}
foreach ($n in $Wanted) {
  $hits = @($members | Where-Object { -not $_.EndsWith('/') -and ($_ -eq $n -or $_.EndsWith("/$n")) })
  if ($hits.Count -eq 0) { Fail "missing member: $n" }
  if ($hits.Count -gt 1) { Fail "more than one member named $n; refusing to guess." }
  if ($hits[0].Contains('..') -or $hits[0].StartsWith('/')) { Fail "unsafe member path for $n." }
  $chosen[$n] = $hits[0]
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('reprolab-seeds-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$ok = $false
try {
  $ErrorActionPreference = 'Continue'
  & tar -xzf $Tarball -C $tmp -- @($Wanted | ForEach-Object { $chosen[$_] }) 2>$null
  $xExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($xExit -ne 0) { Fail 'extraction failed.' }

  $bad = 0
  foreach ($n in $Wanted) {
    $p = Join-Path $tmp ($chosen[$n] -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Write-Output "MISSING   $n"; $bad++; continue }
    $got = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($got -eq $expected[$n]) { Write-Output "MATCH     $got  $n" }
    else { Write-Output "MISMATCH  $got  $n  (recorded $($expected[$n]))"; $bad++ }
  }
  if ($bad -gt 0) { Write-Output 'Hash check failed. Extracted files deleted; nothing written to the output directory.' }
  else {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    foreach ($n in $Wanted) {
      $p = Join-Path $tmp ($chosen[$n] -replace '/', [IO.Path]::DirectorySeparatorChar)
      Copy-Item -LiteralPath $p -Destination (Join-Path $OutDir $n) -Force
    }
    $ok = $true
    Write-Output "OK: four Seeds files matched the recorded hashes and were written to $OutDir"
  }
}
finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
if (-not $ok) { exit 1 }
exit 0

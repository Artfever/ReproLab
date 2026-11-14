<#
Build the ReproLab OpenBUGS worker image from a locally held source tarball (spec 03-local-product, Requirements 19.2 to 19.6).

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-image.ps1 [-Tag reprolab-openbugs:3.2.3-vendored] [-FetchMirror]

Put the OpenBUGS 3.2.3 Linux source package at vendor/OpenBUGS-3.2.3.tar.gz first. The script prints its SHA-256 next to the
SHA-256 of "the copy we tested" and stops on a mismatch. That value is the hash of the copy this project tested, not a checksum
published by the OpenBUGS authors. -FetchMirror downloads an unauthenticated mirror copy into vendor/ (no upstream check).
The script never pushes, saves or exports the image.
#>
[CmdletBinding()]
param(
    [string]$Tag = 'reprolab-openbugs:3.2.3-vendored',
    [switch]$FetchMirror
)
$ErrorActionPreference = 'Stop'
$TestedSha256 = 'a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8'
$MirrorUrl = 'https://raw.githubusercontent.com/chjackson/openbugsdoc/27abd6d1eca1bebddedb6ee7366eab7907727c01/OpenBUGS-3.2.3.tar.gz'
$Root = Split-Path -Parent $PSScriptRoot
$Tarball = Join-Path $Root 'vendor/OpenBUGS-3.2.3.tar.gz'

if ($Tag -notmatch '^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$') {
    [Console]::Error.WriteLine('build-image: -Tag must look like name:version, for example reprolab-openbugs:3.2.3-vendored.')
    exit 2
}

if ($FetchMirror) {
    New-Item -ItemType Directory -Force (Split-Path -Parent $Tarball) | Out-Null
    Write-Host 'Downloading from the old pinned mirror URL into vendor/ ...'
    Invoke-WebRequest -Uri $MirrorUrl -OutFile $Tarball -UseBasicParsing
    Write-Host 'unauthenticated mirror copy, not upstream-verified'
}

if (-not (Test-Path -LiteralPath $Tarball -PathType Leaf)) {
    [Console]::Error.WriteLine('build-image: vendor/OpenBUGS-3.2.3.tar.gz is missing.')
    [Console]::Error.WriteLine('Download the OpenBUGS 3.2.3 Linux source package yourself and save it at that path, or re-run with -FetchMirror.')
    exit 1
}

$actual = (Get-FileHash -LiteralPath $Tarball -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ('SHA-256 of vendor/OpenBUGS-3.2.3.tar.gz : ' + $actual)
Write-Host ('SHA-256 of the copy we tested           : ' + $TestedSha256)
if ($actual -ne $TestedSha256) {
    [Console]::Error.WriteLine('build-image: MISMATCH. This file is not the copy we tested. Not building.')
    exit 1
}
Write-Host 'Hash check: match (the file is byte-identical to the copy we tested).'

Push-Location $Root
try {
    # Windows PowerShell 5.1 turns docker's progress output on stderr into terminating errors when redirected; judge by exit code.
    $ErrorActionPreference = 'Continue'
    & docker build --platform linux/amd64 -f infra/openbugs/Dockerfile -t $Tag .
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine('build-image: docker build failed (exit ' + $LASTEXITCODE + ').')
        exit 1
    }
}
finally { Pop-Location }
Write-Host ('Built image ' + $Tag + ' (local only; nothing was pushed or saved).')
exit 0

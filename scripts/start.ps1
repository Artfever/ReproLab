<#
.SYNOPSIS
  Checks prerequisites and starts the ReproLab local server (apps/local) on 127.0.0.1.
.PARAMETER CheckOnly
  Print the prerequisite results and exit without starting the server.
.NOTES
  Environment overrides: REPROLAB_NODE (node executable), REPROLAB_DOCKER (docker executable),
  REPROLAB_IMAGE (image tag, default reprolab-openbugs:3.2.3-vendored), REPROLAB_PORT (default 8765).
  A missing Node 24.x stops the script. Docker or image problems only warn, because the
  pages still open and each run reports the same problem in plain English.
#>
[CmdletBinding()]
param([switch]$CheckOnly)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $RepoRoot 'apps/local'
$NodeCmd = if ($env:REPROLAB_NODE) { $env:REPROLAB_NODE } else { 'node' }
$DockerCmd = if ($env:REPROLAB_DOCKER) { $env:REPROLAB_DOCKER } else { 'docker' }
$Image = if ($env:REPROLAB_IMAGE) { $env:REPROLAB_IMAGE } else { 'reprolab-openbugs:3.2.3-vendored' }
$Port = if ($env:REPROLAB_PORT) { $env:REPROLAB_PORT } else { '8765' }

function Test-Command($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host 'ReproLab local start check'
$fatal = $false

# Node 24.x (fatal)
if (-not (Test-Command $NodeCmd)) {
  Write-Host 'FAIL  Node.js: not found. Install Node 24.x from https://nodejs.org/ and open a new terminal.'
  $fatal = $true
} else {
  $nodeVersion = ((& $NodeCmd --version 2>$null) | Select-Object -First 1)
  if ($nodeVersion -match '^v24\.') {
    Write-Host "OK    Node.js: $nodeVersion"
  } else {
    Write-Host "FAIL  Node.js: found '$nodeVersion' but ReproLab needs Node 24.x. Install Node 24 from https://nodejs.org/ and open a new terminal."
    $fatal = $true
  }
}

# Docker running (warning only)
$dockerOk = $false
if (-not (Test-Command $DockerCmd)) {
  Write-Host 'WARN  Docker: not found. Install Docker Desktop (Windows, with WSL2) or Docker Engine (Linux). The pages open, but runs will report Docker as missing.'
} else {
  & $DockerCmd info *> $null
  if ($LASTEXITCODE -eq 0) {
    $dockerOk = $true
    Write-Host 'OK    Docker: running'
  } else {
    Write-Host 'WARN  Docker: installed but not running. Start Docker Desktop (or the Docker service) and wait until it says it is running. The pages open, but runs will fail until then.'
  }
}

# Image present (warning only)
if ($dockerOk) {
  & $DockerCmd image inspect $Image *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "OK    Image: $Image is present"
  } else {
    Write-Host "WARN  Image: $Image is not present. Build it with: scripts/build-image.ps1 (needs vendor/OpenBUGS-3.2.3.tar.gz, see the README). Runs will fail until it exists."
  }
} else {
  Write-Host "SKIP  Image: not checked because Docker is not available (needed: $Image)"
}

if ($fatal) {
  Write-Host 'Cannot start: fix the FAIL item above and run this script again.'
  exit 1
}

if ($CheckOnly) {
  Write-Host "Check only: nothing started. The server would listen on http://127.0.0.1:$Port/"
  exit 0
}

Write-Host "Starting ReproLab on http://127.0.0.1:$Port/ (press Ctrl+C to stop)"
Push-Location $AppDir
try {
  & $NodeCmd '--env-file-if-exists=../../.env' 'src/server.mjs'
  exit $LASTEXITCODE
} finally {
  Pop-Location
}

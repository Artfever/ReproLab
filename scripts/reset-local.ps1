<#
.SYNOPSIS
  Removes local run data and ReproLab containers. Never touches tracked files.
.DESCRIPTION
  Removes local-data/runs and local-data/tmp, and containers labelled reprolab.run.
  Leaves local-data/upstream and everything else alone. Refuses to delete a path
  that is a link or is not inside <repo>/local-data, or that holds a tracked file.
.PARAMETER DryRun
  Print what would be removed and remove nothing.
#>
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$DataDir = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot 'local-data'))
$DockerCmd = if ($env:REPROLAB_DOCKER) { $env:REPROLAB_DOCKER } else { 'docker' }
$failed = $false

foreach ($name in 'runs', 'tmp') {
  $target = [System.IO.Path]::GetFullPath((Join-Path $DataDir $name))
  if (-not (Test-Path -LiteralPath $target)) { Write-Host "Nothing to remove: local-data/$name does not exist"; continue }
  $item = Get-Item -LiteralPath $target -Force
  if (-not $item.PSIsContainer -or $item.LinkType) {
    Write-Host "SKIP  local-data/$name is a link or not a folder; remove it by hand if you want it gone."
    $failed = $true; continue
  }
  $parent = [System.IO.Path]::GetFullPath((Split-Path -Parent $target))
  if ($parent -ne $DataDir) { Write-Host "SKIP  local-data/$name resolves outside local-data."; $failed = $true; continue }
  $tracked = (& git -C $RepoRoot ls-files -- "local-data/$name" 2>$null)
  if ($tracked) { Write-Host "SKIP  local-data/$name contains tracked files; not touching it."; $failed = $true; continue }
  if ($DryRun) { Write-Host "Would remove local-data/$name"; continue }
  try {
    Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
    Write-Host "Removed local-data/$name"
  } catch {
    Write-Host "FAIL  Could not remove local-data/$name. Close anything using it and try again."
    $failed = $true
  }
}

# Containers labelled reprolab.run
if (-not (Get-Command $DockerCmd -ErrorAction SilentlyContinue)) {
  Write-Host 'Docker not found: no containers to remove.'
} else {
  $ids = @(& $DockerCmd ps -a -q --filter 'label=reprolab.run' 2>$null)
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Docker is not running, so containers were not checked. Start Docker and run this script again to remove them.'
  } else {
    $ids = @($ids | Where-Object { $_ -match '^[0-9a-f]{12,64}$' })
    if ($ids.Count -eq 0) {
      Write-Host 'No containers labelled reprolab.run.'
    } elseif ($DryRun) {
      Write-Host "Would remove $($ids.Count) container(s) labelled reprolab.run"
    } else {
      & $DockerCmd rm -f @ids *> $null
      if ($LASTEXITCODE -eq 0) { Write-Host "Removed $($ids.Count) container(s) labelled reprolab.run" }
      else { Write-Host 'FAIL  Docker could not remove some containers.'; $failed = $true }
    }
  }
}

if ($failed) { exit 1 }
exit 0

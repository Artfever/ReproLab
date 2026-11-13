<#
Runs one OpenBUGS job in the pinned worker image and copies the run directory to ./runs/<Name>.
Isolation: no network, read-only root, all capabilities dropped, non-root, pid/memory/cpu limits.
/work is a Docker volume (container-local ext4): the engine cannot seek on Windows bind mounts.
Usage: ./scripts/run-container.ps1 -Name seeds-a -RunnerArgs 'run|--model|...|--out|/work/seeds-a' [-InputsDir C:\path]
#>
param(
  [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9_-]{1,40}$')][string]$Name,
  [Parameter(Mandatory)][string]$RunnerArgs,  # runner CLI arguments joined with '|'
  [string]$InputsDir,
  [string]$Image = 'reprolab-openbugs:3.2.3',
  [int]$MemoryMb = 1024
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "runs\$Name"
if (Test-Path $dest) { throw "runs\$Name already exists; choose a new name" }
New-Item -ItemType Directory -Force (Join-Path $root 'runs') | Out-Null
$imageId = (docker image inspect $Image --format '{{.Id}}').Trim()
$cname = "rl-$Name"
$dargs = @('run','--name',$cname,'--platform','linux/amd64','--network','none','--read-only','--cap-drop','ALL',
  '--security-opt','no-new-privileges','--pids-limit','128','--memory',"${MemoryMb}m",'--cpus','1','--tmpfs','/tmp',
  '-v','/work','-e',"REPROLAB_IMAGE_DIGEST=$imageId")
if ($InputsDir) { $dargs += @('-v',"${InputsDir}:/inputs:ro") }
$dargs += @($Image,'python3','-m','reprolab_runner.cli') + ($RunnerArgs -split '\|')
$code = 1; $out = @()
try {
$sw = [Diagnostics.Stopwatch]::StartNew()
$out = & docker @dargs 2>&1
$code = $LASTEXITCODE
$sw.Stop()
$state = docker inspect $cname --format '{{json .State}}'
New-Item -ItemType Directory -Force $dest | Out-Null
docker cp "${cname}:/work/$Name/." $dest 2>&1 | Out-Null
} finally {
  docker rm -f -v $cname 2>&1 | Out-Null   # always remove container and its anonymous volume
}
$out | Out-File -Encoding ascii (Join-Path $dest 'cli_stdout.txt')
$state | Out-File -Encoding ascii (Join-Path $dest 'container_state.json')
"cli_exit=$code wall_s=$([math]::Round($sw.Elapsed.TotalSeconds,2)) image=$imageId" | Out-File -Encoding ascii (Join-Path $dest 'host_record.txt')
Write-Output $out
exit $code
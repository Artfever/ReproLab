<#
.SYNOPSIS
  Clones the PUSHED ReproLab repository to a temp directory outside the working tree and follows README.md in order
  (spec 03-local-product, task 13.1, Requirements 21.1 to 21.5).
.PARAMETER Tarball
  Locally held OpenBUGS 3.2.3 tarball, copied to vendor/OpenBUGS-3.2.3.tar.gz in the clone. This is a recorded stand-in
  for the manual SourceForge browser download, which a script cannot do.
.PARAMETER Tag
  Image tag. Default is the README default tag. If that tag already exists locally the script builds under a separate
  temporary tag instead (so an existing image is never replaced) and says so.
.PARAMETER Out
  Transcript path (default docs/evidence/local-product/clean-clone.txt in this repository). Machine paths are redacted.
.PARAMETER RepoUrl
  Repository to clone (default https://github.com/Artfever/ReproLab.git).
.NOTES
  Starts a local server and containers; removes the clone, containers and any temporary image tag in finally.
  Nothing is pushed, saved or exported. The transcript ends with RESULT: PASS or RESULT: FAIL at <step>.
#>
[CmdletBinding()]
param(
  [string]$Tarball,
  [string]$Tag,
  [string]$Out,
  [string]$RepoUrl = 'https://github.com/Artfever/ReproLab.git'
)
$ErrorActionPreference = 'Continue'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent $Here
if (-not $Tarball) { $Tarball = Join-Path $Repo '.scratch/gh.tar.gz' }
if (-not $Out) { $Out = Join-Path $Repo 'docs/evidence/local-product/clean-clone.txt' }
$DefaultTag = 'reprolab-openbugs:3.2.3-vendored'
$TestedSha = 'a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8'
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ('reprolab-clean-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$Clone = Join-Path $Tmp 'ReproLab'
$Work = Join-Path $Tmp 'logs'
$ServerPid = $null
$ImageToRemove = $null
$FailedStep = $null
$AlsoFailed = @()
$Port = '8765'

New-Item -ItemType Directory -Force (Split-Path -Parent $Out) | Out-Null
Set-Content -LiteralPath $Out -Value '' -Encoding UTF8

function Redact([string]$s) {
  if ($null -eq $s) { return '' }
  $pairs = @(
    @($Tmp, '<tmp>'), @($Repo, '<repo>'), @([IO.Path]::GetTempPath().TrimEnd('\'), '<tmp-root>'),
    @($script:TmpLong, '<tmp>'), @($env:USERPROFILE, '<home>')
  )
  foreach ($p in $pairs) {
    if (-not $p[0]) { continue }
    foreach ($form in @($p[0], ($p[0] -replace '\\', '/'), ($p[0] -replace '\\', '\\'))) {
      $s = $s.Replace($form, $p[1])
    }
  }
  return $s
}
function Log([string]$line) { Add-Content -LiteralPath $Out -Value (Redact $line) -Encoding UTF8 }
function Section([string]$name) { Log ''; Log ('=== ' + $name + ' ==='); $script:Step = $name }
function LogFile([string]$path, [int]$head = 60, [int]$tail = 140) {
  if (-not (Test-Path -LiteralPath $path)) { Log '(no output file)'; return }
  $lines = @(Get-Content -LiteralPath $path -Encoding UTF8)
  if ($lines.Count -gt ($head + $tail)) {
    $lines[0..($head - 1)] | ForEach-Object { Log $_ }
    Log ('... [' + ($lines.Count - $head - $tail) + ' lines omitted from this transcript] ...')
    $mid = $lines[$head..($lines.Count - $tail - 1)]
    $keep = @($mid | Where-Object { $_ -match 'SKIP|skipped|fail|\u2716|ERR|error' })
    if ($keep.Count -gt 0) { Log '[omitted part: lines mentioning skip, fail or error]'; $keep | Select-Object -First 40 | ForEach-Object { Log $_ } }
    $lines[($lines.Count - $tail)..($lines.Count - 1)] | ForEach-Object { Log $_ }
  } else { $lines | ForEach-Object { Log $_ } }
}
# Runs a program, waits, logs its command line and output. Returns the exit code.
function Invoke-Step([string]$label, [string]$file, [string[]]$arguments, [string]$cwd, [int]$timeoutS = 1500) {
  Log ('$ ' + $label)
  $o = Join-Path $Work (([Guid]::NewGuid().ToString('N').Substring(0, 8)) + '.out')
  $e = $o + '.err'
  $argList = @($arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } })
  $p = Start-Process -FilePath $file -ArgumentList $argList -WorkingDirectory $cwd -NoNewWindow -PassThru `
    -RedirectStandardOutput $o -RedirectStandardError $e
  $null = $p.Handle  # keep the process handle so ExitCode is readable (Windows PowerShell quirk)
  if (-not $p.WaitForExit($timeoutS * 1000)) { & taskkill.exe /T /F /PID $p.Id *> $null; Log ('TIMEOUT after ' + $timeoutS + ' s'); LogFile $o; return 124 }
  $p.WaitForExit()
  LogFile $o
  if ((Test-Path -LiteralPath $e) -and (Get-Item -LiteralPath $e).Length -gt 0) { Log '[stderr]'; LogFile $e 30 60 }
  Log ('exit=' + $p.ExitCode)
  return $p.ExitCode
}
function Require([string]$step, [int]$code) {
  if ($code -ne 0) {
    if (-not $script:FailedStep) { $script:FailedStep = $step } else { $script:AlsoFailed += $step }
  }
  return ($code -eq 0)
}
function PsFile([string]$script, [string[]]$more = @()) {
  return @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + $more
}
function StartServer([hashtable]$extraEnv) {
  $o = Join-Path $Work ('server-' + [Guid]::NewGuid().ToString('N').Substring(0, 6) + '.out')
  foreach ($k in $extraEnv.Keys) { Set-Item -Path ('Env:' + $k) -Value $extraEnv[$k] }
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList (PsFile (Join-Path $Clone 'scripts/start.ps1')) `
    -WorkingDirectory $Clone -WindowStyle Hidden -PassThru -RedirectStandardOutput $o -RedirectStandardError ($o + '.err')
  foreach ($k in $extraEnv.Keys) { Remove-Item -Path ('Env:' + $k) -ErrorAction SilentlyContinue }
  $script:ServerPid = $p.Id
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { $r = Invoke-WebRequest -Uri ("http://127.0.0.1:$Port/api/health") -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { break } } catch { }
  }
  Log '[server output so far]'; LogFile $o 20 20
}
function StopServer {
  if ($script:ServerPid) { & taskkill.exe /T /F /PID $script:ServerPid *> $null; $script:ServerPid = $null; Start-Sleep -Seconds 1 }
}
function Drive([string]$label, [string[]]$more) {
  return Invoke-Step $label 'node' (@((Join-Path $Repo 'scripts/clean-clone-drive.mjs'), "http://127.0.0.1:$Port") + $more) $Clone 600
}

try {
  New-Item -ItemType Directory -Force $Work | Out-Null
  $script:TmpLong = (Get-Item -LiteralPath $Tmp).FullName
  Log 'ReproLab clean-clone verification (spec 03-local-product task 13.1)'
  Log ('date (UTC): ' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss'))
  Log ('repository: ' + $RepoUrl)
  Log ('temp directory: ' + $Tmp)

  Section 'preflight'
  $nodeV = (& node --version) 2>&1 | Select-Object -First 1
  Log ('node: ' + $nodeV)
  Log ('powershell: ' + $PSVersionTable.PSVersion)
  & docker info *> $null; Log ('docker info exit=' + $LASTEXITCODE)
  if (-not (Test-Path -LiteralPath $Tarball -PathType Leaf)) { Log 'tarball stand-in is missing'; $FailedStep = 'preflight: tarball'; throw 'stop' }
  Log ('tarball (stand-in for the manual browser download): ' + $Tarball)
  & docker image inspect $DefaultTag *> $null
  $defaultExists = ($LASTEXITCODE -eq 0)
  if (-not $Tag) {
    if ($defaultExists) { $Tag = 'reprolab-openbugs:cleanclone-' + [Guid]::NewGuid().ToString('N').Substring(0, 6); $ImageToRemove = $Tag
      Log ('Default tag ' + $DefaultTag + ' already exists locally. Building under a separate temporary tag ' + $Tag + ' so the existing image is not replaced.') }
    else { $Tag = $DefaultTag; $ImageToRemove = $Tag; Log ('Default tag does not exist locally. Building under the default tag ' + $Tag + '.') }
  } else { if ($Tag -ne $DefaultTag) { $ImageToRemove = $Tag } Log ('Tag given on the command line: ' + $Tag) }
  $busy = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
  if ($busy) { $Port = '18765'; Log 'Port 8765 is in use on this machine; using REPROLAB_PORT=18765 (README documents REPROLAB_PORT).' }
  $left = @(& docker ps -a --filter label=reprolab.run --format '{{.ID}}')
  Log ('containers labelled reprolab.run before: ' + $left.Count)

  Section 'README: git clone'
  Log '$ git ls-remote <repo> HEAD'
  $remoteHead = ((& git ls-remote $RepoUrl HEAD) 2>&1 | Select-Object -First 1)
  Log $remoteHead
  $code = Invoke-Step 'git clone <repo> <tmp>/ReproLab' 'git' @('clone', '--quiet', $RepoUrl, $Clone) $Tmp 300
  if (-not (Require 'git clone' $code)) { throw 'stop' }
  $cloneHead = (& git -C $Clone rev-parse HEAD)
  Log ('clone HEAD: ' + $cloneHead + ' (branch ' + (& git -C $Clone rev-parse --abbrev-ref HEAD) + ')')
  Log ('clone HEAD subject: ' + (& git -C $Clone log -1 --format=%s))
  if ($remoteHead -notmatch [regex]::Escape($cloneHead)) { Log 'WARN: clone HEAD differs from ls-remote HEAD'; }
  Log ('working repo HEAD (for comparison): ' + (& git -C $Repo rev-parse HEAD))

  Section 'README: manual step stand-in (copy tarball to vendor/)'
  Log 'STAND-IN: the README says to download the tarball in a browser from SourceForge. A script cannot do that. The locally held copy is used instead.'
  New-Item -ItemType Directory -Force (Join-Path $Clone 'vendor') | Out-Null
  Copy-Item -LiteralPath $Tarball -Destination (Join-Path $Clone 'vendor/OpenBUGS-3.2.3.tar.gz')
  $sha = (Get-FileHash -LiteralPath (Join-Path $Clone 'vendor/OpenBUGS-3.2.3.tar.gz') -Algorithm SHA256).Hash.ToLowerInvariant()
  Log ('SHA-256 of vendor/OpenBUGS-3.2.3.tar.gz: ' + $sha)
  Log ('copy we tested (README): ' + $TestedSha + '  match=' + ($sha -eq $TestedSha))
  Log ('git status --short in clone (vendor/ must not be listed): [' + ((& git -C $Clone status --short) -join ' ') + ']')

  Section 'README Tests: npm ci in apps/web'
  $code = Invoke-Step 'npm.cmd ci   (cwd apps/web)' 'npm.cmd' @('ci') (Join-Path $Clone 'apps/web') 900
  if (-not (Require 'npm ci apps/web' $code)) { throw 'stop' }

  Section 'README Quick start: build-image'
  $env:BUILDKIT_PROGRESS = 'plain'
  if ($Tag -eq $DefaultTag) { $bArgs = PsFile (Join-Path $Clone 'scripts/build-image.ps1'); $bLabel = 'powershell -ExecutionPolicy Bypass -File scripts\build-image.ps1' }
  else { $bArgs = PsFile (Join-Path $Clone 'scripts/build-image.ps1') @('-Tag', $Tag); $bLabel = 'powershell -ExecutionPolicy Bypass -File scripts\build-image.ps1 -Tag ' + $Tag }
  $code = Invoke-Step $bLabel 'powershell.exe' $bArgs $Clone 1700
  if (-not (Require 'build-image' $code)) { throw 'stop' }
  $imgId = (& docker image inspect $Tag --format '{{.Id}}')
  Log ('image ' + $Tag + ' id: ' + $imgId)
  if ($defaultExists) { Log ('existing default-tag image id: ' + (& docker image inspect $DefaultTag --format '{{.Id}}')) }

  $env:REPROLAB_IMAGE = $Tag
  $env:REPROLAB_PORT = $Port

  Section 'README Quick start: start -CheckOnly'
  $code = Invoke-Step 'powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -CheckOnly' 'powershell.exe' (PsFile (Join-Path $Clone 'scripts/start.ps1') @('-CheckOnly')) $Clone 120
  Require 'start -CheckOnly' $code | Out-Null

  Section 'README Tests: npm test in apps/local (includes the journey test against the image)'
  $code = Invoke-Step 'npm.cmd test   (cwd apps/local)' 'npm.cmd' @('test') (Join-Path $Clone 'apps/local') 1500
  Require 'npm test apps/local' $code | Out-Null

  Section 'README Tests: npm run check in apps/web'
  $code = Invoke-Step 'npm.cmd run check   (cwd apps/web)' 'npm.cmd' @('run', 'check') (Join-Path $Clone 'apps/web') 1200
  Require 'npm run check apps/web' $code | Out-Null

  Section 'README Quick start: start (no assistant provider configured)'
  StartServer @{}
  Log ('Open http://127.0.0.1:' + $Port + '/')
  $code = Drive 'GET /api/health' @('health'); Require 'health' $code | Out-Null
  $code = Drive 'GET /api/demos (before extract-seeds)' @('demos'); Log ''
  $code = Drive 'GET /api/assistant/status (no provider)' @('assistant-status')

  Section 'README Sample run 1: Coin'
  $code = Drive 'run coin' @('run', 'coin'); Require 'coin run' $code | Out-Null

  Section 'README Sample run 2: Coin with a deliberate syntax error'
  $code = Drive 'run coin-invalid' @('run', 'coin-invalid'); Require 'invalid-input run' $code | Out-Null

  Section 'README Sample run 3: Seeds via extract-seeds'
  $code = Invoke-Step 'powershell -ExecutionPolicy Bypass -File scripts\extract-seeds.ps1 -Tarball vendor\OpenBUGS-3.2.3.tar.gz' 'powershell.exe' `
    (PsFile (Join-Path $Clone 'scripts/extract-seeds.ps1') @('-Tarball', 'vendor\OpenBUGS-3.2.3.tar.gz')) $Clone 300
  if (Require 'extract-seeds' $code) {
    Log ('git status --short in clone after extract-seeds: [' + ((& git -C $Clone status --short) -join ' ') + ']')
    Drive 'GET /api/demos (after extract-seeds; README says reload the Run page)' @('demos') | Out-Null
    $code = Drive 'run seeds-upstream' @('run', 'seeds-upstream'); Require 'seeds run' $code | Out-Null
  }

  Section 'README Assistant setup: honest status'
  $ollama = $null
  try { $ollama = (Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/tags' -UseBasicParsing -TimeoutSec 5).Content } catch { }
  if ($ollama -and $ollama -match 'llama3\.2:3b') {
    Log 'Ollama is reachable and llama3.2:3b is listed. Restarting the server with the README Ollama variables and asking one question.'
    StopServer
    StartServer @{ REPROLAB_LLM_BASE_URL = 'http://127.0.0.1:11434/v1'; REPROLAB_LLM_MODEL = 'llama3.2:3b' }
    Drive 'GET /api/assistant/status (Ollama configured)' @('assistant-status') | Out-Null
    Drive 'POST /api/assistant/ask: What port does the server listen on?' @('ask', 'What port does the server listen on?') | Out-Null
  } else {
    Log 'NOT EXERCISED: Ollama with llama3.2:3b is not available on this machine, so no question was asked. Status above shows disabled without a provider.'
  }
}
catch {
  if ($_.Exception.Message -ne 'stop') { Log ('unexpected error: ' + $_.Exception.Message); if (-not $FailedStep) { $FailedStep = 'script error at step ' + $script:Step } }
}
finally {
  Section 'cleanup'
  StopServer
  Remove-Item Env:REPROLAB_IMAGE, Env:REPROLAB_PORT, Env:BUILDKIT_PROGRESS -ErrorAction SilentlyContinue
  $ids = @(& docker ps -a --filter label=reprolab.run --format '{{.ID}}')
  foreach ($id in $ids) { & docker rm -f $id *> $null }
  Log ('containers removed: ' + $ids.Count)
  if ($ImageToRemove) { & docker rmi $ImageToRemove *> $null; Log ('docker rmi ' + $ImageToRemove + ' exit=' + $LASTEXITCODE) }
  else { Log 'no temporary image tag to remove (an existing tag was supplied or reused)' }
  for ($i = 0; $i -lt 5 -and (Test-Path -LiteralPath $Tmp); $i++) {
    Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $Tmp) { Start-Sleep -Seconds 2 }
  }
  Log ('Test-Path <tmp> after removal: ' + (Test-Path -LiteralPath $Tmp))
  Log ('containers labelled reprolab.run now: ' + @(& docker ps -a --filter label=reprolab.run --format '{{.ID}}').Count)
}
Log ''
if ($FailedStep) {
  if ($AlsoFailed.Count -gt 0) { Log ('Other steps that also failed: ' + ($AlsoFailed -join '; ')) }
  Log ('RESULT: FAIL at ' + $FailedStep); exit 1 } else { Log 'RESULT: PASS'; exit 0 }

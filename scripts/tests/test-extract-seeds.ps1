<#
  Negative test for scripts/extract-seeds.ps1 (and .sh when WSL is available).
  Builds a synthetic tarball whose Seeds members contain ReproLab text (wrong content), runs
  the script and expects a non-zero exit and an empty output directory. Also checks a tarball
  with a missing member. Uses a temp output directory, never local-data/upstream.
#>
# 'Continue': the scripts under test write their failure reasons to stderr, which must not abort this test.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
$Script = Join-Path $Root 'scripts/extract-seeds.ps1'
$work = Join-Path ([IO.Path]::GetTempPath()) ('reprolab-seeds-test-' + [Guid]::NewGuid().ToString('N'))
$names = 'Seedsmodel.txt', 'Seedsdata.txt', 'Seedsinits1.txt', 'Seedsinits2.txt'
$failures = 0

function Check([string]$what, [bool]$cond) {
  if ($cond) { Write-Output "PASS  $what" } else { Write-Output "FAIL  $what"; $script:failures++ }
}

function Build-Tar([string]$tarPath, [string[]]$files) {
  $src = Join-Path $work 'src'
  Remove-Item -LiteralPath $src -Recurse -Force -ErrorAction SilentlyContinue
  $dir = Join-Path $src 'Fake-1.0/doc/Examples'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  foreach ($f in $files) { Set-Content -LiteralPath (Join-Path $dir $f) -Value "ReproLab synthetic text, deliberately wrong content for $f" }
  & tar -czf $tarPath -C $src 'Fake-1.0'
  if ($LASTEXITCODE -ne 0) { throw 'could not build synthetic tarball' }
}

New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
  # Case 1: all four members present, wrong content.
  $tar1 = Join-Path $work 'wrong.tar.gz'
  Build-Tar $tar1 $names
  $out1 = Join-Path $work 'out1'
  New-Item -ItemType Directory -Path $out1 | Out-Null
  $o = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script -Tarball $tar1 -OutDir $out1 2>&1 | Out-String
  Check 'ps1 wrong content: exit code is non-zero' ($LASTEXITCODE -ne 0)
  Check 'ps1 wrong content: output directory is empty' (@(Get-ChildItem -LiteralPath $out1 -Force).Count -eq 0)
  Check 'ps1 wrong content: reports MISMATCH' ($o -match 'MISMATCH')

  # Case 2: one member missing.
  $tar2 = Join-Path $work 'partial.tar.gz'
  Build-Tar $tar2 $names[0..2]
  $out2 = Join-Path $work 'out2'
  New-Item -ItemType Directory -Path $out2 | Out-Null
  $o = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script -Tarball $tar2 -OutDir $out2 2>&1 | Out-String
  Check 'ps1 missing member: exit code is non-zero' ($LASTEXITCODE -ne 0)
  Check 'ps1 missing member: output directory is empty' (@(Get-ChildItem -LiteralPath $out2 -Force).Count -eq 0)
  Check 'ps1 missing member: names the missing file' ($o -match 'missing member: Seedsinits2\.txt')

  # Case 3: not a tarball.
  $notTar = Join-Path $work 'not.tar.gz'
  Set-Content -LiteralPath $notTar -Value 'not an archive'
  $out3 = Join-Path $work 'out3'
  New-Item -ItemType Directory -Path $out3 | Out-Null
  $null = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script -Tarball $notTar -OutDir $out3 2>&1 | Out-String
  Check 'ps1 not a tarball: exit code is non-zero' ($LASTEXITCODE -ne 0)
  Check 'ps1 not a tarball: output directory is empty' (@(Get-ChildItem -LiteralPath $out3 -Force).Count -eq 0)

  # Same cases for the shell script, if WSL with Ubuntu-24.04 is available.
  $wsl = Get-Command wsl -ErrorAction SilentlyContinue
  if ($wsl) {
    $toWsl = { param($p) (& wsl -d Ubuntu-24.04 -e wslpath -a ($p -replace '\\', '/')).Trim() }
    $sh = & $toWsl (Join-Path $Root 'scripts/extract-seeds.sh')
    if ($LASTEXITCODE -eq 0 -and $sh) {
      foreach ($case in @(@('wrong content', $tar1), @('missing member', $tar2), @('not a tarball', $notTar))) {
        $outS = Join-Path $work ('sh-' + ($case[0] -replace ' ', '-'))
        New-Item -ItemType Directory -Path $outS | Out-Null
        $null = & wsl -d Ubuntu-24.04 -e bash $sh (& $toWsl $case[1]) (& $toWsl $outS) 2>&1 | Out-String
        Check "sh $($case[0]): exit code is non-zero" ($LASTEXITCODE -ne 0)
        Check "sh $($case[0]): output directory is empty" (@(Get-ChildItem -LiteralPath $outS -Force).Count -eq 0)
      }
    } else { Write-Output 'SKIP  sh tests: WSL Ubuntu-24.04 not usable' }
  } else { Write-Output 'SKIP  sh tests: wsl not found' }
}
finally {
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}

if ($failures -gt 0) { Write-Output "RESULT: $failures check(s) failed"; exit 1 }
Write-Output 'RESULT: all checks passed'
exit 0

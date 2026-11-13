<#
One-command repeat of the OpenBUGS feasibility evidence. Requires Docker (linux/amd64 engine) and PowerShell.
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/feasibility-e2e.ps1
Deletes ./runs, rebuilds the image, runs 7 cases against the real engine, compares in the container, and asserts
the outcomes recorded in docs/engine-feasibility.md. Exit code 0 only if every check matches.
Note: the pooled burn-in-1000 comparison is EXPECTED to fail (it is the pre-declared test; see the docs).
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$runs = Join-Path $root 'runs'
if (Test-Path $runs) { Remove-Item $runs -Recurse -Force }
New-Item -ItemType Directory $runs | Out-Null
$image = 'reprolab-openbugs:3.2.3'
$ex = '/opt/openbugs/share/doc/openbugs-3.2.3/Examples'
$checks = New-Object System.Collections.Generic.List[string]
$script:fail = 0
function Check($name, $ok, $detail) { $s = if ($ok) { 'PASS' } else { $script:fail++; 'FAIL' }; $line = "[$s] $name -- $detail"; $checks.Add($line); Write-Output $line }

docker build --platform linux/amd64 -f infra/openbugs/Dockerfile -t $image . | Out-Null
Check 'image builds' ($LASTEXITCODE -eq 0) $image
$imageId = (docker image inspect $image --format '{{.Id}}').Trim()

function SeedsArgs($n, $seed, $burn, $samples, $to) {
  "run|--model|$ex/Seedsmodel.txt|--data|$ex/Seedsdata.txt|--inits|$ex/Seedsinits1.txt|$ex/Seedsinits2.txt|--monitor|alpha0|alpha1|alpha2|alpha12|sigma|--burn-in|$burn|--samples|$samples|--seed|$seed|--timeout|$to|--out|/work/$n"
}
function BadArgs($n, $model) {
  "run|--model|/inputs/$model|--data|$ex/Seedsdata.txt|--inits|$ex/Seedsinits1.txt|$ex/Seedsinits2.txt|--monitor|alpha0|--burn-in|10|--samples|10|--seed|1|--timeout|60|--out|/work/$n"
}
function Run($name, $argString, $inputs) {
  $a = @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-container.ps1'),'-Name',$name,'-RunnerArgs',$argString)
  if ($inputs) { $a += @('-InputsDir', $inputs) }
  powershell @a | Out-Null
  return $LASTEXITCODE
}
function Manifest($name) { Get-Content (Join-Path $runs "$name\manifest.json") -Raw | ConvertFrom-Json }
function CompareRun($name, $chains) {
  $extra = if ($chains) { "--chains $chains" } else { '' }
  $out = docker run --rm --platform linux/amd64 --network none -v "${runs}:/runs:ro" -v "$root\services\runner\reference:/ref:ro" $image sh -c "python3 -m reprolab_runner.cli compare --dir /runs/$name --reference /ref/seeds_published.json $extra"
  return @{ code = $LASTEXITCODE; text = ($out -join "`n") }
}

$invalid = Join-Path $root 'examples\openbugs\invalid'
$c = @{}
$c['seeds-a'] = Run 'seeds-a' (SeedsArgs 'seeds-a' 1 1000 10000 300) $null
$c['seeds-b'] = Run 'seeds-b' (SeedsArgs 'seeds-b' 1 1000 10000 300) $null
$c['seeds-c'] = Run 'seeds-c' (SeedsArgs 'seeds-c' 2 1000 10000 300) $null
$c['seeds-longburn'] = Run 'seeds-longburn' (SeedsArgs 'seeds-longburn' 1 20000 10000 300) $null
$c['bad-syntax'] = Run 'bad-syntax' (BadArgs 'bad-syntax' 'bad_syntax_model.txt') $invalid
$c['bad-undefined'] = Run 'bad-undefined' (BadArgs 'bad-undefined' 'undefined_node_model.txt') $invalid
$c['timeout-live'] = Run 'timeout-live' (SeedsArgs 'timeout-live' 1 40000 50000 3) $null

foreach ($n in 'seeds-a','seeds-b','seeds-c','seeds-longburn') {
  $m = Manifest $n; Check "$n succeeded" ($m.status -eq 'succeeded' -and $c[$n] -eq 0) "status=$($m.status) runtime_s=$($m.runtime_s) version=$($m.engine_version)"
}
$ma = Manifest 'bad-syntax'; Check 'bad-syntax failed (engine exit 0)' ($ma.status -eq 'failed' -and $ma.exit_code -eq 0) $ma.reason
$mb = Manifest 'bad-undefined'; Check 'bad-undefined failed (engine exit 0)' ($mb.status -eq 'failed' -and $mb.exit_code -eq 0) $mb.reason
$mt = Manifest 'timeout-live'; Check 'timeout-live timed_out' ($mt.status -eq 'timed_out') "runtime_s=$($mt.runtime_s)"

foreach ($f in 'coda_CODAchain1.txt','coda_CODAchain2.txt','coda_CODAindex.txt') {
  $ha = (Get-FileHash (Join-Path $runs "seeds-a\$f")).Hash; $hb = (Get-FileHash (Join-Path $runs "seeds-b\$f")).Hash; $hc = (Get-FileHash (Join-Path $runs "seeds-c\$f")).Hash
  Check "same seed identical $f" ($ha -eq $hb) $ha
  if ($f -ne 'coda_CODAindex.txt') { Check "different seed differs $f" ($ha -ne $hc) "$ha vs $hc" }
}

$cmp = New-Object System.Collections.Generic.List[string]
function Cmp($label, $name, $chains, $expectCode) {
  $r = CompareRun $name $chains
  $cmp.Add("##### $label (exit=$($r.code), expected $expectCode)"); $cmp.Add($r.text)
  Check "compare: $label" ($r.code -eq $expectCode) "exit=$($r.code) expected=$expectCode"
}
Cmp 'seeds-a pooled burn-in 1000 (pre-declared test, expected FAIL)' 'seeds-a' $null 2
Cmp 'seeds-a chain 1 only (post hoc)' 'seeds-a' '1' 0
Cmp 'seeds-a chain 2 only (post hoc, expected FAIL)' 'seeds-a' '2' 2
Cmp 'seeds-c pooled burn-in 1000 (expected FAIL)' 'seeds-c' $null 2
Cmp 'seeds-longburn pooled burn-in 20000 (post hoc setting, expected PASS)' 'seeds-longburn' $null 0
$cmp | Set-Content -Encoding ascii (Join-Path $runs 'comparisons.txt')

$left = docker ps -a --filter 'name=rl-' --format '{{.Names}}'
Check 'no leftover rl-* containers' (-not $left) ($left -join ',')
$checks | Set-Content -Encoding ascii (Join-Path $runs 'checks.txt')
"image_id=$imageId failures=$script:fail" | Set-Content -Encoding ascii (Join-Path $runs 'summary.txt')

& (Join-Path $PSScriptRoot 'evidence.ps1')
foreach ($f in 'comparisons.txt','checks.txt','summary.txt') { Copy-Item (Join-Path $runs $f) (Join-Path $root 'docs\evidence') -Force }
Write-Output "image_id=$imageId failures=$script:fail"
exit $(if ($script:fail -eq 0) { 0 } else { 1 })
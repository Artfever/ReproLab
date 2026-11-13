<#
Collects the facts for docs/engine-feasibility.md from ./runs/* into runs/EVIDENCE.txt.
Usage: powershell -ExecutionPolicy Bypass -File scripts/evidence.ps1
#>
$root = Split-Path -Parent $PSScriptRoot
$runs = Join-Path $root 'runs'
$lines = @()
foreach ($d in Get-ChildItem $runs -Directory | Sort-Object Name) {
  $m = Join-Path $d.FullName 'manifest.json'
  if (-not (Test-Path $m)) { $lines += "$($d.Name): no manifest"; continue }
  $j = Get-Content $m -Raw | ConvertFrom-Json
  $h = Get-Content (Join-Path $d.FullName 'host_record.txt') -Raw
  $lines += "{0}: status={1} engine_exit={2} runtime_s={3} version='{4}' reason='{5}'" -f $d.Name, $j.status, $j.exit_code, $j.runtime_s, $j.engine_version, $j.reason
  $lines += "    host: $($h.Trim())"
  foreach ($n in 'coda_CODAchain1.txt','coda_CODAchain2.txt','coda_CODAindex.txt','log.txt','script.txt') {
    $p = $j.files.PSObject.Properties[$n]
    if ($p) { $lines += "    $n sha256=$($p.Value.sha256) bytes=$($p.Value.bytes)" }
  }
}
$lines | Set-Content -Encoding ascii (Join-Path $runs 'EVIDENCE.txt')
# Copy the small, non-upstream evidence files into docs/evidence (CODA files and upstream inputs stay out of git).
$ev = Join-Path $root 'docs\evidence'
foreach ($d in Get-ChildItem $runs -Directory) {
  $t = Join-Path $ev $d.Name
  New-Item -ItemType Directory -Force $t | Out-Null
  foreach ($f in 'log.txt','script.txt','manifest.json','cli_stdout.txt','host_record.txt','container_state.json','stderr.txt','compare_pooled.json','compare_exit.txt','per_chain.json','pooled_summary.json') {
    $p = Join-Path $d.FullName $f
    if (Test-Path $p) { Copy-Item $p $t -Force }
  }
}
Copy-Item (Join-Path $runs 'EVIDENCE.txt') $ev -Force
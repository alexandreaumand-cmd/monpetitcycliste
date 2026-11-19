# Déploie les edge functions par lots, par ordre de priorité, et s'arrête au premier refus.
# Usage : .\deploy-functions-batches.ps1 -Needed <functions_needed.txt> -Ref <project_ref> [-BatchSize 10]
param(
  [Parameter(Mandatory)] [string] $Needed,
  [Parameter(Mandatory)] [string] $Ref,
  [int] $BatchSize = 10,
  [string] $Exclude = 'process-email-queue'   # dépend de Lovable
)
$cli = Join-Path $PSScriptRoot 'supabase.ps1'
$excluded = $Exclude -split '[,\s]+'
$list = Get-Content $Needed | Where-Object { $_ -and $_ -notin $excluded }

$p1 = @('scrape-pcs-transfers','arena-recaps','live-broadcast-auto-scrape','arena-pronostic-reminder','startlist-tracker',
        'scrape-rider-injuries','scrape-startlist-abandons','auto-open-scheduled-auctions')
$isP3 = { param($n) $n -match '^(admin-|export-|super-admin-)' -or $n -in @('import-data','reset-courses') }
$ordered = @($p1 | Where-Object { $_ -in $list }) +
           @($list | Where-Object { $_ -notin $p1 -and -not (& $isP3 $_) } | Sort-Object) +
           @($list | Where-Object { $_ -notin $p1 -and (& $isP3 $_) } | Sort-Object)

# Déjà déployées : on les saute
$json = & powershell -NoProfile -ExecutionPolicy Bypass -File $cli functions list "--remote=$Ref" --output-format json 2>$null |
        Where-Object { $_ -match '^\{' } | Select-Object -Last 1 | ConvertFrom-Json
$done = @($json.functions.slug)
$todo = @($ordered | Where-Object { $_ -notin $done })
"Déjà déployées : $($done.Count) ; à déployer : $($todo.Count)"

for ($i = 0; $i -lt $todo.Count; $i += $BatchSize) {
  $batch = $todo[$i..([math]::Min($i + $BatchSize, $todo.Count) - 1)]
  "=== Lot $([int]($i / $BatchSize) + 1) : $($batch -join ', ')"
  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $cli functions deploy @batch "--remote=$Ref" --use-api --yes 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    "ARRET : le lot a échoué (code $code)"
    $out | Where-Object { $_ -match '"_tag":"Error"' } | Select-Object -First 1 | ForEach-Object { $_.Substring(0, [math]::Min(400, $_.Length)) }
    break
  }
  "OK"
}
$json = & powershell -NoProfile -ExecutionPolicy Bypass -File $cli functions list "--remote=$Ref" --output-format json 2>$null |
        Where-Object { $_ -match '^\{' } | Select-Object -Last 1 | ConvertFrom-Json
$deployed = @($json.functions.slug)
"Déployées au total : $($deployed.Count)"
"Non déployées (parmi les nécessaires) : " + (($ordered | Where-Object { $_ -notin $deployed }) -join ', ')
"verify_jwt = false : " + ((@($json.functions) | Where-Object { -not $_.verify_jwt }).slug -join ', ')

# LECTURE SEULE : compare storage.objects de la cible au manifeste du backup (chemin, taille, type MIME).
param(
  [string] $Manifest = 'C:\LaBordure-data\storage\storage_manifest.csv',
  [string] $Buckets = 'email-assets,manager-avatars,sponsor-jerseys,startlist-route-images'   # liste séparée par des virgules
)
$bucketList = @($Buckets -split '[,\s]+' | Where-Object { $_ })
$sqlFile = Join-Path $env:TEMP 'labordure_storage_export.sql'
$csv = 'C:\LaBordure-data\target_storage_objects.csv'
@"
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
\pset tuples_only on
\o $($csv -replace '\\','/')
SELECT bucket_id, name, metadata->>'size', metadata->>'mimetype' FROM storage.objects;
\o
"@ | Set-Content $sqlFile -Encoding ascii
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'psql-target.ps1') -File $sqlFile | Out-Null

$target = @{}
Get-Content $csv -Encoding UTF8 | Where-Object { $_ } | ForEach-Object {
  $p = $_ -split "`t"; $target["$($p[0])/$($p[1])"] = @{ size = $p[2]; mime = $p[3] }
}
$expected = Import-Csv $Manifest | Where-Object { $_.bucket -in $bucketList }
$report = foreach ($b in $bucketList) {
  $exp = @($expected | Where-Object bucket -eq $b)
  $missing = 0; $badSize = 0; $badMime = 0
  foreach ($e in $exp) {
    $t = $target["$($e.bucket)/$($e.name)"]
    if (-not $t) { $missing++; continue }
    if ($e.size -and $t.size -ne $e.size) { $badSize++ }
    if ($e.mimetype -and $t.mime -ne $e.mimetype) { $badMime++ }
  }
  $extra =($target.Keys | Where-Object { $_.StartsWith("$b/") }).Count - ($exp.Count - $missing)
  [pscustomobject]@{ bucket = $b; attendus = @($exp).Count; manquants = $missing; en_trop = $extra; taille_diff = $badSize; type_diff = $badMime }
}
$report | Format-Table -AutoSize

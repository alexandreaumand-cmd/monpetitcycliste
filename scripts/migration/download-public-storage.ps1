# Télécharge (lecture seule) les fichiers des buckets PUBLICS de l'ancien projet
# via leurs URLs publiques, d'après la liste storage.objects du backup.
# Aucune clé utilisée, rien n'est modifié côté Lovable.
#
# Usage : .\download-public-storage.ps1 -DataSql <data_only.sql> -SourceUrl https://<ref>.supabase.co -Dest <dossier>
param(
  [Parameter(Mandatory)] [string] $DataSql,
  [Parameter(Mandatory)] [string] $SourceUrl,
  [Parameter(Mandatory)] [string] $Dest,
  [string[]] $Buckets = @('email-assets','manager-avatars','sponsor-jerseys','startlist-route-images')
)

# 1. Liste des objets depuis le COPY storage.objects du backup
$cols = $null; $in = $false; $objs = New-Object System.Collections.Generic.List[object]
foreach ($l in [System.IO.File]::ReadLines($DataSql)) {
  if ($in) {
    if ($l -eq '\.') { break }
    $f = $l -split "`t"
    $size = $null; $mime = $null
    $meta = $f[$cols.IndexOf('metadata')]
    if ($meta -match '"size"\s*:\s*(\d+)') { $size = [int64]$matches[1] }
    if ($meta -match '"mimetype"\s*:\s*"([^"]+)"') { $mime = $matches[1] }
    $objs.Add([pscustomobject]@{ bucket = $f[$cols.IndexOf('bucket_id')]; name = $f[$cols.IndexOf('name')]; size = $size; mimetype = $mime })
  } elseif ($l -match '^COPY storage\.objects \((.+)\) FROM') {
    $cols = [System.Collections.ArrayList]@($matches[1] -split ', '); $in = $true
  }
}
$objs | Export-Csv (Join-Path $Dest 'storage_manifest.csv') -NoTypeInformation -Encoding UTF8
$todo = $objs | Where-Object { $_.bucket -in $Buckets }
"Objets dans le backup : $($objs.Count) ; à télécharger (buckets publics) : $($todo.Count)"

# 2. Téléchargement
$ok = 0; $skip = 0; $fail = New-Object System.Collections.Generic.List[string]
foreach ($o in $todo) {
  $local = Join-Path (Join-Path $Dest $o.bucket) ($o.name -replace '/', '\')
  if ((Test-Path $local) -and $o.size -and (Get-Item $local).Length -eq $o.size) { $skip++; continue }
  $enc = ($o.name -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
  $url = "$SourceUrl/storage/v1/object/public/$($o.bucket)/$enc"
  New-Item -ItemType Directory -Force (Split-Path $local) | Out-Null
  $code = curl.exe -sS -L --fail --max-time 120 -o $local -w '%{http_code}' $url
  if ($LASTEXITCODE -eq 0 -and $code -eq '200') {
    if ($o.size -and (Get-Item $local).Length -ne $o.size) { $fail.Add("$($o.bucket)/$($o.name) : taille $((Get-Item $local).Length) au lieu de $($o.size)") } else { $ok++ }
  } else {
    $fail.Add("$($o.bucket)/$($o.name) : HTTP $code")
    Remove-Item $local -ErrorAction SilentlyContinue
  }
}
"Téléchargés : $ok ; déjà présents : $skip ; échecs : $($fail.Count)"
$fail | ForEach-Object { "  ECHEC $_" }

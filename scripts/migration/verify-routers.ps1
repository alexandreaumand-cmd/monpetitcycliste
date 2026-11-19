# LECTURE SEULE : vérifie les fonctions déployées et l'aiguillage des 4 fonctions regroupées.
# La clé "anon" (publique) du projet est lue via le CLI et n'est jamais affichée.
param([string] $Ref = 'tokvwkkhwrgncurmipjh')
$cli = Join-Path $PSScriptRoot 'supabase.ps1'
$list = & powershell -NoProfile -ExecutionPolicy Bypass -File $cli functions list "--remote=$Ref" --output-format json 2>$null |
        Where-Object { $_ -match '^\{' } | Select-Object -Last 1 | ConvertFrom-Json
$deployed = @($list.functions)
"Fonctions déployées : $($deployed.Count) / 100"

$keys = & powershell -NoProfile -ExecutionPolicy Bypass -File $cli projects api-keys "--project-ref=$Ref" --output-format json 2>$null |
        Where-Object { $_ -match '^[\[\{]' } | Select-Object -Last 1 | ConvertFrom-Json
$arr = if ($keys.keys) { @($keys.keys) } else { @($keys) }
$anon = ($arr | Where-Object { $_.name -eq 'anon' } | Select-Object -First 1).api_key
if (-not $anon) { "Clé anon introuvable : tests HTTP sautés"; return }

$base = "https://$Ref.supabase.co/functions/v1"
$tests = @(
  @{ path = 'admin-users/action-inexistante'; attendu = '404 (aiguilleur : action inconnue)' },
  @{ path = 'admin-users/list';               attendu = '401/403 (code de admin-users-list : pas admin)' },
  @{ path = 'exports/coureurs-csv';           attendu = '401/403 (code export : pas admin)' },
  @{ path = 'auction-get/teams';              attendu = '400 (code auction-get-teams : paramètres manquants)' },
  @{ path = 'league-invites/info';            attendu = '400/404 (code leagues-get-invite-info : pas de jeton d''invitation)' }
)
foreach ($t in $tests) {
  $tmp = New-TemporaryFile
  $code = curl.exe -sS -o $tmp.FullName -w '%{http_code}' -X POST "$base/$($t.path)" `
          -H "Authorization: Bearer $anon" -H "apikey: $anon" -H 'Content-Type: application/json' --data '{}'
  $body = (Get-Content $tmp.FullName -Raw -ErrorAction SilentlyContinue); Remove-Item $tmp
  if ($body) { $body = ($body -replace '\s+', ' '); $body = $body.Substring(0, [math]::Min(140, $body.Length)) }
  "{0,-32} HTTP {1}  attendu {2}`n    réponse : {3}" -f $t.path, $code, $t.attendu, $body
}
$pre = curl.exe -sS -o NUL -w '%{http_code}' -X OPTIONS "$base/auction-get/context" -H 'Origin: https://labordure.app' -H 'Access-Control-Request-Method: POST'
"OPTIONS auction-get/context        HTTP $pre  attendu 200 (CORS)"

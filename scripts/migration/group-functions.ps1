# Regroupe 22 edge functions en 4 fonctions « aiguilleurs » (supabase/functions/<groupe>/handlers/<action>.ts).
# Modifications par fichier : import de registerHandler, `serve(`/`Deno.serve(` → `registerHandler("<action>", `,
# chemins `../_shared/` → `../../_shared/`, suppression de l'import std `serve`. Rien d'autre.
$ErrorActionPreference = 'Stop'
$root = 'C:\LaBordure'
$git = 'C:\Program Files\Git\cmd\git.exe'
$groups = [ordered]@{
  'admin-users' = [ordered]@{
    'create' = 'admin-user-create'; 'delete' = 'admin-user-delete'; 'resend-confirmation' = 'admin-user-resend-confirmation'
    'reset-password' = 'admin-user-reset-password'; 'set-role' = 'admin-user-set-role'; 'list' = 'admin-users-list'
    'toggle-ban' = 'admin-user-toggle-ban' }
  'exports' = [ordered]@{
    'all-tables' = 'export-all-tables'; 'baremes-csv' = 'export-baremes-csv'; 'coureurs-csv' = 'export-coureurs-csv'
    'courses-csv' = 'export-courses-csv'; 'resultats-csv' = 'export-resultats-csv'; 'rosters-csv' = 'export-rosters-csv' }
  'auction-get' = [ordered]@{
    'context' = 'auction-get-context'; 'live-status' = 'auction-get-live-status'; 'managers-status' = 'auction-get-managers-status'
    'teams' = 'auction-get-teams'; 'validation-status' = 'auction-get-validation-status' }
  'league-invites' = [ordered]@{
    'create' = 'leagues-create-invite'; 'list' = 'leagues-list-invites'; 'revoke' = 'leagues-revoke-invite'; 'info' = 'leagues-get-invite-info' }
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
Set-Location $root
foreach ($g in $groups.Keys) {
  $gdir = "supabase/functions/$g"
  New-Item -ItemType Directory -Force "$gdir/handlers" | Out-Null
  $imports = @()
  foreach ($action in $groups[$g].Keys) {
    $old = $groups[$g][$action]
    $src = "supabase/functions/$old/index.ts"
    $dst = "$gdir/handlers/$action.ts"
    $extra = Get-ChildItem "supabase/functions/$old" -File | Where-Object Name -ne 'index.ts'
    if ($extra) { throw "$old contient d'autres fichiers : $($extra.Name -join ', ')" }
    & $git mv $src $dst
    if ($LASTEXITCODE -ne 0) { throw "git mv a échoué pour $old" }
    $t = [System.IO.File]::ReadAllText((Join-Path $root $dst), $utf8)
    $nl = if ($t.Contains("`r`n")) { "`r`n" } else { "`n" }
    $before = ([regex]::Matches($t, '(?m)^(Deno\.)?serve\(async \(req\) => \{')).Count
    if ($before -ne 1) { throw "$old : $before appels serve() trouvés (1 attendu)" }
    $t = [regex]::Replace($t, '(?m)^import \{ serve \} from "https://deno\.land/std@0\.168\.0/http/server\.ts";\r?\n', '')
    $t = [regex]::Replace($t, '(?m)^(Deno\.)?serve\(async \(req\) => \{', "registerHandler(`"$action`", async (req) => {")
    $t = $t.Replace("'../_shared/", "'../../_shared/").Replace('"../_shared/', '"../../_shared/')
    $t = "import { registerHandler } from `"../../_shared/router.ts`";$nl// Ancienne fonction : $old$nl" + $t
    [System.IO.File]::WriteAllText((Join-Path $root $dst), $t, $utf8)
    Remove-Item "supabase/functions/$old" -Recurse -Force -ErrorAction SilentlyContinue
    $imports += "import `"./handlers/$action.ts`"; // ex-$old"
  }
  $index = @(
    "// Fonction regroupée (limite de 100 fonctions par projet). Appel : supabase.functions.invoke(`"$g/<action>`", ...)"
    "// Actions : $(($groups[$g].Keys) -join ', ')"
    "import { serveRouter } from `"../_shared/router.ts`";"
  ) + $imports + @('', "serveRouter(`"$g`");", '')
  [System.IO.File]::WriteAllText((Join-Path $root "$gdir/index.ts"), ($index -join "`n"), $utf8)
  "$g : $($groups[$g].Count) actions"
}

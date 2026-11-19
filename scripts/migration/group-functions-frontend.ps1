# Met à jour les appels du front vers les fonctions regroupées.
# Ne remplace le nom QUE lorsqu'il est l'argument d'un appel supabase.functions.invoke(...)
# (y compris quand le nom est sur la ligne suivante), jamais dans une clé de cache React Query.
$ErrorActionPreference = 'Stop'
$map = [ordered]@{
  'admin-user-create' = 'admin-users/create'; 'admin-user-delete' = 'admin-users/delete'
  'admin-user-resend-confirmation' = 'admin-users/resend-confirmation'; 'admin-user-reset-password' = 'admin-users/reset-password'
  'admin-user-set-role' = 'admin-users/set-role'; 'admin-users-list' = 'admin-users/list'; 'admin-user-toggle-ban' = 'admin-users/toggle-ban'
  'export-all-tables' = 'exports/all-tables'; 'export-baremes-csv' = 'exports/baremes-csv'; 'export-coureurs-csv' = 'exports/coureurs-csv'
  'export-courses-csv' = 'exports/courses-csv'; 'export-resultats-csv' = 'exports/resultats-csv'; 'export-rosters-csv' = 'exports/rosters-csv'
  'auction-get-context' = 'auction-get/context'; 'auction-get-live-status' = 'auction-get/live-status'
  'auction-get-managers-status' = 'auction-get/managers-status'; 'auction-get-teams' = 'auction-get/teams'
  'auction-get-validation-status' = 'auction-get/validation-status'
  'leagues-create-invite' = 'league-invites/create'; 'leagues-list-invites' = 'league-invites/list'
  'leagues-revoke-invite' = 'league-invites/revoke'; 'leagues-get-invite-info' = 'league-invites/info'
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$total = 0
foreach ($file in Get-ChildItem C:\LaBordure\src -Recurse -File -Include *.ts,*.tsx) {
  $t = [System.IO.File]::ReadAllText($file.FullName, $utf8)
  $orig = $t
  foreach ($old in $map.Keys) {
    $pattern = '(functions\s*\.invoke\s*(?:<[^>]*>)?\(\s*)([''"`])' + [regex]::Escape($old) + '\2'
    $new = $map[$old]
    $t = [regex]::Replace($t, $pattern, { param($m) $m.Groups[1].Value + $m.Groups[2].Value + $new + $m.Groups[2].Value })
  }
  if ($t -ne $orig) {
    $n = 0; foreach ($old in $map.Keys) { $n += ([regex]::Matches($orig, [regex]::Escape($old))).Count - ([regex]::Matches($t, [regex]::Escape($old))).Count }
    [System.IO.File]::WriteAllText($file.FullName, $t, $utf8)
    "{0} : {1} appel(s)" -f $file.FullName.Replace('C:\LaBordure\',''), $n
    $total += $n
  }
}
"Total appels modifiés : $total"
"--- Mentions restantes des anciens noms dans src (doivent être des clés de cache ou des commentaires) :"
$pat = ($map.Keys | ForEach-Object { [regex]::Escape($_) }) -join '|'
Get-ChildItem C:\LaBordure\src -Recurse -File -Include *.ts,*.tsx | Select-String -Pattern $pat | ForEach-Object { "{0}:{1}: {2}" -f $_.Path.Replace('C:\LaBordure\',''), $_.LineNumber, $_.Line.Trim() }

# Construit la liste pg_restore (-L) pour restaurer le backup Lovable Cloud
# dans un projet Supabase neuf, sans écraser les schémas gérés par Supabase.
#
# Usage : .\build-restore-list.ps1 -Toc <toc.txt> -Out <restore.list>
#   toc.txt = sortie de `pg_restore -l <fichier.backup>`
#
# Gardé :
#   - extensions (CREATE EXTENSION IF NOT EXISTS)
#   - tout le schéma public (tables, données, vues, fonctions, RLS, policies, triggers, grants)
#   - schémas drizzle et supabase_migrations (historique des migrations, pour ne pas les rejouer)
#   - données auth.users et auth.identities (schéma auth intact, aucun INSERT manuel)
#   - données storage.buckets + policies sur storage.objects
# Exclu (géré par Supabase, impossible à écrire, ou traité à une autre étape) :
#   - structure des schémas auth / storage / realtime / vault / cron / graphql / pgbouncer / extensions
#   - auth.sessions, refresh_tokens, audit_log_entries, flow_state, one_time_tokens, mfa_amr_claims, schema_migrations
#   - storage.objects (étape 5, après l'upload des fichiers), storage.migrations
#   - cron.* (étape 7), vault.secrets (à recréer), realtime.* et publications (étape 8)
#   - pgmq.* (files d'emails, recréées plus tard), event triggers, default ACL
param(
  [Parameter(Mandatory)] [string] $Toc,
  [Parameter(Mandatory)] [string] $Out
)

$types = @(
  'MATERIALIZED VIEW DATA','MATERIALIZED VIEW','SEQUENCE OWNED BY','SEQUENCE SET','PUBLICATION TABLE',
  'FK CONSTRAINT','CHECK CONSTRAINT','ROW SECURITY','DEFAULT ACL','EVENT TRIGGER','TABLE ATTACH',
  'INDEX ATTACH','TABLE DATA','SEQUENCE','PUBLICATION','EXTENSION','CONSTRAINT','FUNCTION','TRIGGER',
  'COMMENT','DEFAULT','SCHEMA','POLICY','INDEX','TABLE','TYPE','VIEW','ACL'
)
$ownSchemas = @('public','drizzle','supabase_migrations')
$authData   = @('users','identities')

$kept = New-Object System.Collections.Generic.List[string]
$stats = @{}
foreach ($line in Get-Content $Toc) {
  if ($line -match '^\s*;' -or -not $line.Trim()) { continue }
  if ($line -notmatch '^\d+; \d+ \d+ (.+)$') { continue }
  $rest = $matches[1]
  $type = $types | Where-Object { $rest.StartsWith("$_ ") } | Select-Object -First 1
  if (-not $type) { Write-Warning "Type inconnu : $line"; continue }
  $parts = $rest.Substring($type.Length + 1) -split ' '
  $schema = $parts[0]; $name = $parts[1]

  $keep = $false
  switch ($type) {
    'EXTENSION'         { $keep = $true }
    'SCHEMA'            { $keep = $name -in @('drizzle','supabase_migrations','pgmq') }   # pgmq : schéma vide requis par CREATE EXTENSION pgmq
    'DEFAULT ACL'       { $keep = $false }
    'EVENT TRIGGER'     { $keep = $false }
    'PUBLICATION'       { $keep = $false }
    'PUBLICATION TABLE' { $keep = $false }
    'ACL'               { if ($schema -eq '-') { $keep = ($parts[1] -eq 'SCHEMA' -and $parts[2] -in @('drizzle','supabase_migrations')) } else { $keep = $schema -in $ownSchemas } }
    'COMMENT'           { $keep = $schema -in $ownSchemas }
    'TABLE DATA'        { $keep = ($schema -in $ownSchemas) -or ($schema -eq 'auth' -and $name -in $authData) -or ($schema -eq 'storage' -and $name -eq 'buckets') }
    'POLICY'            { $keep = ($schema -in $ownSchemas) -or ($schema -eq 'storage' -and $name -eq 'objects') }
    default             { $keep = $schema -in $ownSchemas }
  }
  $key = "$type | $schema"
  if (-not $stats.ContainsKey($key)) { $stats[$key] = @{kept=0; skipped=0} }
  if ($keep) { $kept.Add($line); $stats[$key].kept++ } else { $stats[$key].skipped++ }
}

$kept | Set-Content -Path $Out -Encoding ascii
"Entrées gardées : $($kept.Count)"
$stats.GetEnumerator() | Sort-Object Name | ForEach-Object {
  [pscustomobject]@{ categorie = $_.Name; gardees = $_.Value.kept; exclues = $_.Value.skipped }
} | Format-Table -AutoSize

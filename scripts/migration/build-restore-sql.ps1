# Génère le SQL de restauration à partir du backup et de la liste filtrée.
#  - pg_restore -L <liste> -f <sql> : même contenu que pg_restore direct, mais relisible
#  - retire uniquement les GRANT/REVOKE vers sandbox_exec (rôle interne Lovable, absent de la cible)
#  - ajoute SET session_replication_role = replica (chargement sans triggers ni contrôles FK, méthode Supabase)
# Le fichier produit contient des données personnelles : il reste dans C:\LaBordure-data, jamais dans git.
param(
  [Parameter(Mandatory)] [string] $Backup,
  [Parameter(Mandatory)] [string] $List,
  [Parameter(Mandatory)] [string] $Out
)
$pgRestore = Join-Path $env:USERPROFILE 'tools\pgsql\bin\pg_restore.exe'
$tmp = "$Out.raw"
& $pgRestore -L $List -f $tmp $Backup
if ($LASTEXITCODE -ne 0) { throw "pg_restore -f a échoué ($LASTEXITCODE)" }

$writer = New-Object System.IO.StreamWriter($Out, $false, (New-Object System.Text.UTF8Encoding($false)))
$inCopy = $false; $removed = 0; $injected = $false
foreach ($l in [System.IO.File]::ReadLines($tmp)) {
  if ($inCopy) { if ($l -eq '\.') { $inCopy = $false }; $writer.WriteLine($l); continue }
  if ($l -match '^COPY ') { $inCopy = $true; $writer.WriteLine($l); continue }
  if ($l -match '^(GRANT|REVOKE) .* (TO|FROM) sandbox_exec;$') { $removed++; continue }
  $writer.WriteLine($l)
  if (-not $injected -and $l -eq 'SET row_security = off;') {
    $writer.WriteLine('SET session_replication_role = replica;')
    $injected = $true
  }
}
$writer.Close()
Remove-Item $tmp
if (-not $injected) { throw "Ligne 'SET row_security = off;' introuvable : session_replication_role non injecté" }
"GRANT/REVOKE sandbox_exec retirés : $removed"
"session_replication_role injecté : $injected"
"Fichier : $Out ($([math]::Round((Get-Item $Out).Length/1MB,1)) Mo)"

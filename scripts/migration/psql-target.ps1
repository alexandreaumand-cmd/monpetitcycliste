# Lance un fichier SQL sur un projet Supabase avec psql (session pooler, eu-west-1).
# -Ref est OBLIGATOIRE : aucune commande ne part vers un projet par défaut.
#   prod     : tokvwkkhwrgncurmipjh
#   pré-prod : ltfmtbbthjvdjqosyanp
# Le mot de passe est lu par psql dans %APPDATA%\postgresql\pgpass.conf
# (rempli par le propriétaire, jamais stocké ici). -w : ne jamais demander de mot de passe.
# Usage : .\psql-target.ps1 -Ref <ref> -File <fichier.sql> [-Out <fichier résultat>] [-SingleTransaction]
param(
  [Parameter(Mandatory)] [ValidateSet('tokvwkkhwrgncurmipjh', 'ltfmtbbthjvdjqosyanp')] [string] $Ref,
  [Parameter(Mandatory)] [string] $File,
  [string] $Out,
  [switch] $SingleTransaction   # tout ou rien : la moindre erreur annule tout
)
$label = @{ 'tokvwkkhwrgncurmipjh' = 'PROD'; 'ltfmtbbthjvdjqosyanp' = 'PRE-PROD' }[$Ref]
Write-Host "=== Cible : $label ($Ref) ==="
$psql = Join-Path $env:USERPROFILE 'tools\pgsql\bin\psql.exe'
$conn = "postgresql://postgres.$Ref@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
$env:PGCLIENTENCODING = 'UTF8'
$psqlArgs = @($conn, '-w', '-v', 'ON_ERROR_STOP=1', '-v', "target_ref=$Ref", '-X', '-f', $File)
if ($SingleTransaction) { $psqlArgs += '--single-transaction' }
if ($Out) { $psqlArgs += @('-L', $Out) }
& $psql @psqlArgs
"psql exit code: $LASTEXITCODE"

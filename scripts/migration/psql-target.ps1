# Lance un fichier SQL sur le projet Supabase cible avec psql.
# Le mot de passe est lu par psql dans %APPDATA%\postgresql\pgpass.conf
# (rempli par le propriétaire, jamais stocké ici). -w : ne jamais demander de mot de passe.
# Usage : .\psql-target.ps1 -File <fichier.sql> [-Out <fichier résultat>]
param(
  [Parameter(Mandatory)] [string] $File,
  [string] $Out,
  [switch] $SingleTransaction   # tout ou rien : la moindre erreur annule tout
)
$psql = Join-Path $env:USERPROFILE 'tools\pgsql\bin\psql.exe'
$conn = 'postgresql://postgres.tokvwkkhwrgncurmipjh@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require'
$env:PGCLIENTENCODING = 'UTF8'
$psqlArgs = @($conn, '-w', '-v', 'ON_ERROR_STOP=1', '-X', '-f', $File)
if ($SingleTransaction) { $psqlArgs += '--single-transaction' }
if ($Out) { $psqlArgs += @('-L', $Out) }
& $psql @psqlArgs
"psql exit code: $LASTEXITCODE"

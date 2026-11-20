# Lance le front en local (Vite, port 8080), branché sur la copie via .env.local.
$node = Join-Path $env:USERPROFILE 'tools\node-v26.13.1-win-x64'
$env:Path = "$node;$env:Path"
Set-Location (Split-Path (Split-Path $PSScriptRoot))
if (-not (Select-String -Path .env.local -Pattern 'tokvwkkhwrgncurmipjh' -Quiet)) { throw ".env.local ne vise pas la copie" }
# Port fourni par l'aperçu (variable PORT) sinon 8080 ; --strictPort pour ne jamais glisser silencieusement.
$port = if ($env:PORT) { $env:PORT } else { '8080' }
npm run dev -- --port $port --strictPort

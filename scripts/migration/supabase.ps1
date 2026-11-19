# Lance le Supabase CLI (version figée) avec le Node portable de %USERPROFILE%\tools.
# Usage : & .\scripts\migration\supabase.ps1 <arguments du CLI>
$node = Join-Path $env:USERPROFILE 'tools\node-v26.13.1-win-x64'
$env:Path = "$node;$env:Path"
& (Join-Path $node 'npx.cmd') --yes supabase@3.2.0 @args
exit $LASTEXITCODE

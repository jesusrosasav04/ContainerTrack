# ContainerTrack - Crea la base de datos, el usuario de la API, las tablas y los datos simulados.
# Uso (desde la raiz del proyecto):
#   powershell -ExecutionPolicy Bypass -File database\setup.ps1
# Lee DB_SERVER, DB_NAME, DB_USER y DB_PASSWORD de backend\.env
# y se conecta con tu cuenta de Windows (-E), que es administradora de SQL Server.

$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root 'backend\.env'

if (-not (Test-Path $envFile)) { throw "No existe $envFile. Copia backend\.env.example a backend\.env." }
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    throw "No se encontro sqlcmd. Instalalo con: winget install Microsoft.Sqlcmd  (y abre una terminal nueva)"
}

$cfg = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $cfg[$matches[1]] = $matches[2] }
}

$server = if ($cfg['DB_INSTANCE']) { "$($cfg['DB_SERVER'])\$($cfg['DB_INSTANCE'])" } else { $cfg['DB_SERVER'] }

$scripts = @(
    'scripts\01_create_database.sql',
    'scripts\02_schema.sql',
    'seeders\03_seed.sql'
)

foreach ($s in $scripts) {
    Write-Host "==> $s" -ForegroundColor Cyan
    sqlcmd -S $server -E -C -b -f 65001 `
        -i (Join-Path $PSScriptRoot $s) `
        -v DB_NAME=$($cfg['DB_NAME']) APP_USER=$($cfg['DB_USER']) APP_PASSWORD=$($cfg['DB_PASSWORD'])
    if ($LASTEXITCODE -ne 0) { throw "Fallo $s (codigo $LASTEXITCODE)" }
}

Write-Host "`nBase de datos lista." -ForegroundColor Green

# ContainerTrack - Respaldo completo de la base de datos (SQL Server local).
# Uso:    powershell -ExecutionPolicy Bypass -File database\backup.ps1 [-Conservar 14]
# Guarda el .bak en la carpeta de respaldos de la instancia, lo verifica y
# conserva solo los ultimos N respaldos. Para hacerlo diario: database\programar-respaldo.ps1

param([int]$Conservar = 14)

$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root 'backend\.env'
$log     = Join-Path $root 'respaldos.log'

function Log($texto) {
    $linea = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto
    Write-Host $linea
    Add-Content -Path $log -Value $linea
}

try {
    if (-not (Test-Path $envFile)) { throw "No existe $envFile" }
    $cfg = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $cfg[$matches[1]] = $matches[2] }
    }
    $server = if ($cfg['DB_INSTANCE']) { "$($cfg['DB_SERVER'])\$($cfg['DB_INSTANCE'])" } else { $cfg['DB_SERVER'] }
    $db = $cfg['DB_NAME']

    # Carpeta de respaldos de la instancia: el servicio de SQL Server ya tiene permiso de escritura ahi
    $ruta = (sqlcmd -S $server -E -C -b -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(400))" | Out-String).Trim()
    if (-not $ruta) { throw 'No se pudo obtener la carpeta de respaldos de SQL Server' }

    $archivo = Join-Path $ruta ("{0}_{1}.bak" -f $db, (Get-Date -Format 'yyyyMMdd_HHmmss'))
    Log "Respaldando $db en $archivo"
    sqlcmd -S $server -E -C -b -Q "BACKUP DATABASE [$db] TO DISK = N'$archivo' WITH INIT, CHECKSUM, NAME = N'$db - respaldo completo'"
    if ($LASTEXITCODE -ne 0) { throw "Fallo el BACKUP (codigo $LASTEXITCODE)" }

    # Comprueba que el archivo se puede restaurar
    sqlcmd -S $server -E -C -b -Q "RESTORE VERIFYONLY FROM DISK = N'$archivo' WITH CHECKSUM"
    if ($LASTEXITCODE -ne 0) { throw "El respaldo no paso la verificacion (codigo $LASTEXITCODE)" }
    Log "Respaldo verificado correctamente"

    # Retencion: borra los mas antiguos
    try {
        Get-ChildItem -Path $ruta -Filter "$($db)_*.bak" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $Conservar |
            ForEach-Object { Remove-Item $_.FullName; Log "Eliminado respaldo antiguo: $($_.Name)" }
    } catch {
        Log "Aviso: no se pudieron limpiar respaldos antiguos (ejecuta como administrador): $($_.Exception.Message)"
    }
} catch {
    Log "ERROR: $($_.Exception.Message)"
    exit 1
}

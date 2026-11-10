#Requires -RunAsAdministrator
# ContainerTrack - Programa el respaldo diario con el Programador de tareas de Windows.
# SQL Server Express no incluye el Agente de SQL Server, por eso se usa Windows.
# Uso (PowerShell como administrador):
#   powershell -ExecutionPolicy Bypass -File database\programar-respaldo.ps1 [-Hora 02:00] [-Conservar 14]

param([string]$Hora = '02:00', [int]$Conservar = 14)

$script = Join-Path $PSScriptRoot 'backup.ps1'
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Conservar $Conservar"
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
# Se ejecuta con tu cuenta (administradora de SQL Server), aunque no hayas iniciado sesion
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName 'ContainerTrack - Respaldo diario' -Action $accion -Trigger $disparador `
    -Principal $principal -Settings $ajustes -Force | Out-Null

Write-Host "Respaldo diario programado a las $Hora (se conservan $Conservar)." -ForegroundColor Green
Write-Host "Para probarlo ahora: Start-ScheduledTask -TaskName 'ContainerTrack - Respaldo diario'"

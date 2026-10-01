# Obtener de forma dinámica el directorio actual donde se está ejecutando el script
$CurrentDir = $PSScriptRoot
if (-not $CurrentDir) {
    $CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Tienda POS.lnk")

# Rutas dinámicas autodetectadas
$Shortcut.TargetPath = Join-Path $CurrentDir "iniciar.vbs"
$Shortcut.WorkingDirectory = $CurrentDir
$Shortcut.IconLocation = "shell32.dll,173"
$Shortcut.Description = "Punto de Venta e Inventario Inteligente para Tiendas de Barrio"
$Shortcut.Save()

Write-Host ""
Write-Host "======================================================="
Write-Host " [OK] ACCESO DIRECTO CREADO EXITOSAMENTE"
Write-Host "======================================================="
Write-Host " - Ubicación de origen: $CurrentDir"
Write-Host " - Destino: Escritorio del Usuario"
Write-Host "======================================================="
Write-Host ""

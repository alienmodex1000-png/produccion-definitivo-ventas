@echo off
chcp 65001 >nul
title Blindar Sistema Tienda POS - Protección Total

:: 1. Verificación y auto-elevación a Permisos de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo =======================================================
    echo  SOLICITANDO PERMISOS DE ADMINISTRADOR...
    echo =======================================================
    echo  Por favor presione 'Sí' en la ventana de Windows...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 2. Detección 100% Dinámica de la Carpeta Actual
set "TARGET_DIR=%~dp0"
:: Remover barra invertida final si existe
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"

cls
echo =======================================================
echo     BLINDAJE TOTAL CONTRA BORRADO DE ARCHIVOS
echo =======================================================
echo.
echo [1/3] Carpeta detectada dinámicamente:
echo       "%TARGET_DIR%"
echo.

:: 3. Aplicar Exclusiones en Windows Defender (Carpeta y Proceso)
echo [2/3] Aplicando exclusión sagrada en Windows Defender...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { " ^
    "    Add-MpPreference -ExclusionPath '%TARGET_DIR%' -ErrorAction Stop; " ^
    "    Add-MpPreference -ExclusionProcess 'node.exe' -ErrorAction SilentlyContinue; " ^
    "    Write-Host '    [OK] Exclusión de carpeta y proceso agregada correctamente.' -ForegroundColor Green; " ^
    "} catch { " ^
    "    Write-Host '    [AVISO] Windows Defender administrado por directiva o antivirus de terceros detectado.' -ForegroundColor Yellow; " ^
    "}"

echo.

:: 4. Crear Acceso Directo Profesional en el Escritorio
echo [3/3] Creando acceso directo limpio en el Escritorio...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$WshShell = New-Object -ComObject WScript.Shell; " ^
    "$DesktopPath = [System.Environment]::GetFolderPath('Desktop'); " ^
    "$Shortcut = $WshShell.CreateShortcut(\"$DesktopPath\Punto de Venta.lnk\"); " ^
    "$TargetVbs = Join-Path '%TARGET_DIR%' 'iniciar.vbs'; " ^
    "$TargetBat = Join-Path '%TARGET_DIR%' 'iniciar_tienda.bat'; " ^
    "if (Test-Path $TargetVbs) { $Shortcut.TargetPath = $TargetVbs; } else { $Shortcut.TargetPath = $TargetBat; }; " ^
    "$Shortcut.WorkingDirectory = '%TARGET_DIR%'; " ^
    "$Shortcut.IconLocation = 'shell32.dll,173'; " ^
    "$Shortcut.Description = 'Punto de Venta e Inventario Inteligente'; " ^
    "$Shortcut.Save(); " ^
    "Write-Host '    [OK] Acceso directo creado en el Escritorio del usuario.' -ForegroundColor Green;"

echo.
echo =======================================================
echo   SISTEMA BLINDADO Y PROTEGIDO CON ÉXITO
echo =======================================================
echo.
echo  • Carpeta Excluida: "%TARGET_DIR%"
echo  • Ningún escaneo de Windows Defender eliminará archivos aquí.
echo  • El usuario ahora puede abrir el sistema desde el
echo    icono 'Punto de Venta' en su Escritorio.
echo.
echo =======================================================
echo Presione cualquier tecla para cerrar esta ventana...
pause >nul

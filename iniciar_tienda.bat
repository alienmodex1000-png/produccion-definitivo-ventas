@echo off
title Tienda POS - Servidor de Control
echo =======================================================
echo     TIENDA POS - INICIANDO PUNTO DE VENTA Y CONTROL
echo =======================================================
echo.

echo [1/2] Lanzando Servidor Backend (Puerto 3005)...
if exist "%~dp0node.exe" (
    start "Tienda POS - API Backend" cmd /k "cd /d "%~dp0backend" && "..\node.exe" server.js"
) else if exist "%~dp0produccion_definitivo\node.exe" (
    start "Tienda POS - API Backend" cmd /k "cd /d "%~dp0backend" && "..\produccion_definitivo\node.exe" server.js"
) else (
    start "Tienda POS - API Backend" cmd /k "cd /d "%~dp0backend" && node server.js"
)

:: Esperar un par de segundos para que levante el servidor e iniciar el navegador
timeout /t 3 /nobreak >nul
echo.
echo =======================================================
echo   SISTEMA INICIADO EXITOSAMENTE
echo   - Punto de Venta: http://localhost:3005 (Modo POS Nativo)
echo =======================================================
echo.

echo [2/2] Abriendo Terminal de Cobro POS...

:: Verificar preferencia de Impresión Silenciosa (Ajustes)
set "KIOSK_FLAG="
if exist "%~dp0datos_negocio\launcher_config.json" (
    findstr /i "\"kiosk_printing\": true" "%~dp0datos_negocio\launcher_config.json" >nul 2>&1
    if not errorlevel 1 set "KIOSK_FLAG=--kiosk-printing"
    findstr /i "\"kiosk_printing\":true" "%~dp0datos_negocio\launcher_config.json" >nul 2>&1
    if not errorlevel 1 set "KIOSK_FLAG=--kiosk-printing"
)

set CHROME=""
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"

set EDGE=""
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set EDGE="C:\Program Files\Microsoft\Edge\Application\msedge.exe"

set "POS_PROFILE=%LocalAppData%\TiendaPOS\pos_profile"
if not exist "%POS_PROFILE%" mkdir "%POS_PROFILE%"

if not %CHROME%=="" (
    start "" %CHROME% --app=http://localhost:3005 --user-data-dir="%POS_PROFILE%" %KIOSK_FLAG%
) else if not %EDGE%=="" (
    start "" %EDGE% --app=http://localhost:3005 --user-data-dir="%POS_PROFILE%" %KIOSK_FLAG%
) else (
    start http://localhost:3005
)

pause

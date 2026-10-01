@echo off
title Detener Tienda POS
echo =======================================================
echo     TIENDA POS - DETENIENDO PUNTO DE VENTA
echo =======================================================
echo.
echo [INFO] Cerrando el servidor de la base de datos y de ventas...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :3005') DO (
  taskkill /f /pid %%T >nul 2>&1
)
echo [OK] El servidor de Tienda POS se detuvo con éxito.
echo.
timeout /t 2 >nul

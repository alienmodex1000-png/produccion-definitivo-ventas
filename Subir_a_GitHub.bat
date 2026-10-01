@echo off
title Subir version de Produccion a GitHub
chcp 65001 >nul
cd /d "%~dp0"
echo =======================================================
echo   SUBIENDO CARPETA DE PRODUCCION A GITHUB
echo =======================================================
echo.
echo Repositorio: https://github.com/alienmodex1000-png/producion-venta-definitivo.git
echo.
git push -u origin main
echo.
echo =======================================================
echo   PROCESO TERMINADO
echo =======================================================
pause

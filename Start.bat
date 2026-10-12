@echo off
setlocal
title X4 Supply Matrix Launcher

:: Ensure we run from this script's directory
cd /d "%~dp0"

echo ==================================================================
echo    X4 Supply Matrix: Starting Companion and Web Application...
echo ==================================================================

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_x4_supply_matrix.ps1" %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Launcher encountered an error (Code %ERRORLEVEL%).
    pause
)
endlocal

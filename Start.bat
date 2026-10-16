@echo off
setlocal
title X4 Supply Matrix Launcher

REM Ensure we run from this script's directory
cd /d "%~dp0"

echo ==================================================================
echo    X4 Supply Matrix: Starting Companion and Web Application...
echo ==================================================================

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_x4_supply_matrix.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% NEQ 0 goto :error

echo.
echo ==================================================================
echo    [OK] X4 Supply Matrix completed all tasks cleanly (Exit Code 0).
echo ==================================================================
goto :end

:error
echo.
echo ==================================================================
echo    [!] Launcher encountered an error or exited abnormally (Code %EXIT_CODE%).
echo ==================================================================
pause

:end
endlocal

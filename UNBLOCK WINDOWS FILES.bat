@echo off
setlocal
title Unblock SiteShot Auditor Studio files
cd /d "%~dp0"

echo.
echo Removing Windows downloaded-file blocking from this folder...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File"
echo.
echo Done. Now run BUILD WINDOWS EXE.bat.
pause

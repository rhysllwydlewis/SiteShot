@echo off
setlocal EnableExtensions
title SiteShot Windows Installer Redirect
cd /d "%~dp0"

echo.
echo ============================================================
echo  SiteShot now uses the single-file installer build
echo ============================================================
echo.
echo The old unpacked EXE build is no longer the recommended route.
echo.
echo For website distribution, build and upload this file:
echo release\install.exe
echo.
echo Redirecting to:
echo BUILD WINDOWS INSTALLER.bat
echo.

if not exist "BUILD WINDOWS INSTALLER.bat" (
  echo ERROR: BUILD WINDOWS INSTALLER.bat was not found.
  echo Download or extract the latest repo again.
  pause
  exit /b 1
)

call "%~dp0BUILD WINDOWS INSTALLER.bat"
exit /b %errorlevel%

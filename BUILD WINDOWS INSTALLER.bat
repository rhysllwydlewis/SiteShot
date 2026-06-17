@echo off
setlocal EnableExtensions
title Build SiteShot Auditor Studio Ultra Installer
cd /d "%~dp0"

echo.
echo ============================================================
echo  Building SiteShot Auditor Studio Ultra Windows Installer
echo ============================================================
echo.
echo This creates one normal-user setup file: install.exe
echo.
echo Expected output:
echo release\install.exe
echo.

if not exist "package.json" (
  echo ERROR: package.json not found.
  echo Extract or clone the project properly first.
  pause
  exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed.
  start https://nodejs.org/
  pause
  exit /b 1
)

echo Installing/updating dependencies...
call npm.cmd install
if %errorlevel% neq 0 (
  echo.
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

echo.
echo Running full verification...
call npm.cmd run verify
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Verification failed. Fix the issue above before building the installer.
  pause
  exit /b 1
)

echo.
echo Building Windows setup installer...
echo This step downloads Playwright Chromium into the packaged browser resource folder.
call npm.cmd run dist:installer
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Installer build failed. Send a screenshot of the error above.
  pause
  exit /b 1
)

set "FOUND_INSTALLER="
if exist "release\install.exe" set "FOUND_INSTALLER=%~dp0release\install.exe"

if "%FOUND_INSTALLER%"=="" (
  echo.
  echo ERROR: Build completed but install.exe was not found.
  echo Expected:
  echo release\install.exe
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  Installer build complete
echo ============================================================
echo.
echo Installer created:
echo %FOUND_INSTALLER%
echo.
echo Opening release folder now...
start "" "%~dp0release"
echo.
echo Give users this one file:
echo release\install.exe
echo.
echo Users can run install.exe and launch SiteShot from the
echo desktop shortcut or Windows Start Menu.
echo.
pause

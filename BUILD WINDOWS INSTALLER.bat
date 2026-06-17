@echo off
setlocal EnableExtensions
title Build SiteShot Auditor Studio Ultra Installer
cd /d "%~dp0"

echo.
echo ============================================================
echo  Building SiteShot Auditor Studio Ultra Windows Installer
echo ============================================================
echo.
echo This creates the proper setup EXE for normal users.
echo.
echo Expected output:
echo release\SiteShot-Auditor-Studio-Ultra-Setup-3.2.23-x64.exe
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
echo Ensuring Playwright Chromium is installed...
call npm.cmd run install:browsers
if %errorlevel% neq 0 (
  echo.
  echo WARNING: Playwright browser install failed.
  echo The installer can still be built, but audits may fail until Chromium is installed.
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
call npm.cmd run dist:installer
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Installer build failed. Send a screenshot of the error above.
  pause
  exit /b 1
)

set "FOUND_INSTALLER="
for %%F in ("release\*Setup*.exe") do set "FOUND_INSTALLER=%%~fF"

if "%FOUND_INSTALLER%"=="" (
  echo.
  echo ERROR: Build completed but the setup installer was not found.
  echo Expected a file like:
  echo release\SiteShot-Auditor-Studio-Ultra-Setup-3.2.23-x64.exe
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
echo Users can now run the setup EXE and launch SiteShot from the
echo desktop shortcut or Windows Start Menu.
echo.
pause

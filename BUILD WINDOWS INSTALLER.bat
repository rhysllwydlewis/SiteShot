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

if not exist "playwright-browsers" (
  echo.
  echo ERROR: The bundled Playwright browser folder was not created.
  echo Expected:
  echo playwright-browsers
  pause
  exit /b 1
)

set "FOUND_BROWSER="
for /r "playwright-browsers" %%F in (chrome-headless-shell.exe) do set "FOUND_BROWSER=%%F"
if "%FOUND_BROWSER%"=="" (
  echo.
  echo ERROR: Chromium was not found inside playwright-browsers.
  echo The installer would install, but Auto/Sitemap discovery would fail.
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

for %%A in ("release\install.exe") do set "INSTALLER_SIZE=%%~zA"
if %INSTALLER_SIZE% LSS 100000000 (
  echo.
  echo ERROR: install.exe looks too small to include the bundled browser runtime.
  echo Size found: %INSTALLER_SIZE% bytes
  echo Expected at least 100 MB.
  pause
  exit /b 1
)

echo.
echo Bundled browser found:
echo %FOUND_BROWSER%
echo.
echo Installer size check passed:
echo %INSTALLER_SIZE% bytes
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

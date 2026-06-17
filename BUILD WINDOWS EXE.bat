@echo off
setlocal EnableExtensions
title Build SiteShot Auditor Studio Ultra EXE
cd /d "%~dp0"

echo.
echo ============================================================
echo  Building SiteShot Auditor Studio Ultra v3.2.23
echo ============================================================
echo.
echo This build avoids the NSIS installer stage and adds auth-gate/form-flow checks that caused:
echo spawn UNKNOWN
echo.
echo It creates a real Windows EXE in:
echo release\win-unpacked
echo.
echo It also copies the app to:
echo %%LOCALAPPDATA%%\Programs\SiteShot Auditor Studio
echo and creates Desktop / Start Menu shortcuts.
echo.

if not exist "package.json" (
  echo ERROR: package.json not found.
  echo Extract the zip properly first.
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
echo Ensuring Playwright Chromium is installed for audit/PDF output...
call npm.cmd run install:browsers
if %errorlevel% neq 0 (
  echo.
  echo WARNING: Playwright browser install failed.
  echo The build can continue, but audits may fail until Chromium is installed.
)

echo.
echo Running preflight checks...
call npm.cmd run preflight
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Preflight checks failed.
  pause
  exit /b 1
)

echo.
echo Building unpacked Windows app folder...
call npm.cmd run dist:win
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Windows EXE build failed. Send a screenshot of the error above.
  pause
  exit /b 1
)

if not exist "release\win-unpacked\SiteShot Auditor Studio.exe" (
  echo.
  echo ERROR: Build completed but the EXE was not found.
  echo Expected:
  echo release\win-unpacked\SiteShot Auditor Studio.exe
  pause
  exit /b 1
)

echo.
echo Installing/updating local app copy...
set "APP_TARGET=%LOCALAPPDATA%\Programs\SiteShot Auditor Studio"

if not exist "%LOCALAPPDATA%\Programs" mkdir "%LOCALAPPDATA%\Programs"
if exist "%APP_TARGET%" (
  echo Removing previous local app copy...
  rmdir /s /q "%APP_TARGET%"
)
mkdir "%APP_TARGET%"

robocopy "%~dp0release\win-unpacked" "%APP_TARGET%" /MIR >nul
if %errorlevel% GEQ 8 (
  echo.
  echo ERROR: Could not copy app files to:
  echo %APP_TARGET%
  pause
  exit /b 1
)

echo.
echo Creating Desktop and Start Menu shortcuts...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$target='%APP_TARGET%\SiteShot Auditor Studio.exe'; $desktop=[Environment]::GetFolderPath('Desktop'); $start=[Environment]::GetFolderPath('StartMenu') + '\Programs'; $shell=New-Object -ComObject WScript.Shell; $s=$shell.CreateShortcut($desktop + '\SiteShot Auditor Studio.lnk'); $s.TargetPath=$target; $s.WorkingDirectory='%APP_TARGET%'; $s.Save(); $s2=$shell.CreateShortcut($start + '\SiteShot Auditor Studio.lnk'); $s2.TargetPath=$target; $s2.WorkingDirectory='%APP_TARGET%'; $s2.Save();"

echo.
echo ============================================================
echo  Build complete
echo ============================================================
echo.
echo Your app EXE is here:
echo %APP_TARGET%\SiteShot Auditor Studio.exe
echo.
echo Opening the app folder now...
start "" "%APP_TARGET%"

echo.
echo You can now run SiteShot Auditor Studio from the Desktop shortcut
echo or directly from the app folder.
echo.
pause

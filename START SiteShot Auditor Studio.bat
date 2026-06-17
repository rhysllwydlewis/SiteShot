@echo off
setlocal
title SiteShot Auditor Studio Ultra
cd /d "%~dp0"

echo.
echo Starting SiteShot Auditor Studio Ultra v3.0.4...
echo.

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if %errorlevel% neq 0 pause & exit /b 1
)

echo Running preflight checks...
call npm.cmd run preflight
if %errorlevel% neq 0 pause & exit /b 1

call npm.cmd run install:browsers
call npm.cmd run desktop
pause

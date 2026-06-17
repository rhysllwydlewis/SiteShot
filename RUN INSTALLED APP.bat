@echo off
setlocal
set "APP_TARGET=%LOCALAPPDATA%\Programs\SiteShot Auditor Studio\SiteShot Auditor Studio.exe"

if not exist "%APP_TARGET%" (
  echo The installed local app copy was not found.
  echo Run BUILD WINDOWS EXE.bat first.
  pause
  exit /b 1
)

start "" "%APP_TARGET%"

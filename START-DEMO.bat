@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 atau lebih baru diperlukan.
  echo Instal Node.js, lalu jalankan kembali file ini.
  pause
  exit /b 1
)

if not defined PORT set "PORT=8080"
set "HOST=127.0.0.1"
echo Menjalankan Dapur Rini v4.0 di http://127.0.0.1:%PORT%
start "Dapur Rini Server" /min cmd /c "cd /d ""%~dp0"" && node server/server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%"
endlocal

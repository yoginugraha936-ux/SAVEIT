@echo off
echo ==========================================
echo   SaveIt Video Downloader - Setup
echo ==========================================
echo.

echo [1/3] Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js not found! Installing...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    echo Please restart this script after Node.js installation completes.
    pause
    exit /b
) else (
    echo OK - Node.js found
)

echo.
echo [2/3] Checking yt-dlp...
where yt-dlp >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo yt-dlp not found! Installing...
    pip install yt-dlp
) else (
    echo OK - yt-dlp found
)

echo.
echo [3/3] Checking ffmpeg...
where ffmpeg >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ffmpeg not found! Installing...
    winget install Gyan.FFmpeg --accept-source-agreements --accept-package-agreements --silent
    echo NOTE: You may need to restart your terminal after ffmpeg install.
) else (
    echo OK - ffmpeg found
)

echo.
echo ==========================================
echo Installing npm dependencies...
echo ==========================================
call npm install

echo.
echo ==========================================
echo   Setup complete! Run: npm start
echo   Then open: http://localhost:3000
echo ==========================================
pause

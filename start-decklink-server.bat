@echo off
:: DeckLink Server Auto-Start Handler

:: Remove the old dev shortcut from Windows Startup folder so terminal never appears
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DeckLink Server.lnk" (
    del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DeckLink Server.lnk" >nul 2>&1
)

:: Launch installed DeckLink silently in background
if exist "%LOCALAPPDATA%\decklink_server\DeckLink.exe" (
    start "" "%LOCALAPPDATA%\decklink_server\DeckLink.exe" --autostart
    exit /b 0
)

:: Fallback to out build
if exist "%~dp0out\DeckLink-win32-x64\DeckLink.exe" (
    start "" "%~dp0out\DeckLink-win32-x64\DeckLink.exe" --autostart
    exit /b 0
)

exit /b 0

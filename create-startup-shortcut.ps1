$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "DeckLink Server.lnk")
$Shortcut = $WshShell.CreateShortcut($StartupPath)
$Shortcut.TargetPath = "D:\All Projects\My_Elgato_Steam_deck\decklink-server\start-decklink-server.bat"
$Shortcut.WorkingDirectory = "D:\All Projects\My_Elgato_Steam_deck\decklink-server"
$Shortcut.WindowStyle = 7
$Shortcut.Description = "DeckLink PC Server Auto-Start"
$Shortcut.Save()
Write-Host "Startup shortcut created at: $StartupPath"

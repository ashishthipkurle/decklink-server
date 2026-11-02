param(
    [string]$Action = "enable"
)

$targetExe = Join-Path $env:LOCALAPPDATA "decklink_server\DeckLink.exe"
if (-not (Test-Path $targetExe)) {
    $apps = Get-Item (Join-Path $env:LOCALAPPDATA "decklink_server\app-*\DeckLink.exe") -ErrorAction SilentlyContinue
    if ($apps) {
        $targetExe = $apps[0].FullName
    }
}

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "DeckLink.lnk"
$vbsPath = Join-Path $startupFolder "DeckLink.vbs"

if ($Action -eq "disable") {
    Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
    Remove-Item $vbsPath -Force -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DeckLink" -Force -ErrorAction SilentlyContinue
    Write-Output "AUTOSTART_DISABLED"
    exit 0
}

try {
    $wsh = New-Object -ComObject WScript.Shell
    $sc = $wsh.CreateShortcut($shortcutPath)
    $sc.TargetPath = $targetExe
    $sc.Arguments = "--autostart"
    $sc.WorkingDirectory = (Split-Path -Path $targetExe)
    $sc.Description = "DeckLink Companion Server"
    $sc.Save()
} catch {
    Write-Output ("SHORTCUT_ERROR: " + $_.Exception.Message)
}

try {
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DeckLink" -Value "`"$targetExe`" --autostart" -Force -ErrorAction SilentlyContinue
} catch {}

Write-Output "AUTOSTART_ENABLED"


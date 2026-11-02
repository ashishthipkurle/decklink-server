param(
    [string]$Action = "register",
    [string]$ExePath = ""
)

$TaskName = "DeckLink"

if ($Action -eq "unregister") {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Output "UNREGISTER_SUCCESS"
    } catch {
        Write-Output "UNREGISTER_FAILED"
    }
    exit 0
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
    $found = Get-Item (Join-Path $env:LOCALAPPDATA "decklink_server\DeckLink.exe") -ErrorAction SilentlyContinue
    if ($found) {
        $ExePath = $found.FullName
    } else {
        $sub = Get-Item (Join-Path $env:LOCALAPPDATA "decklink_server\app-*\DeckLink.exe") -ErrorAction SilentlyContinue
        if ($sub) {
            $ExePath = $sub[0].FullName
        }
    }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
    Write-Output "EXE_NOT_FOUND"
    exit 1
}

try {
    $taskAction = New-ScheduledTaskAction -Execute $ExePath -Argument "--autostart"
    $taskTrigger = New-ScheduledTaskTrigger -AtLogOn
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Force | Out-Null
    Write-Output "REGISTER_SUCCESS"
} catch {
    # Fallback to standard privilege if Highest fails
    try {
        $taskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME
        Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Force | Out-Null
        Write-Output "REGISTER_SUCCESS_STANDARD"
    } catch {
        Write-Output ("REGISTER_FAILED: " + $_.Exception.Message)
        exit 1
    }
}


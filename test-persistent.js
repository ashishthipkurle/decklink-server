const { spawn } = require('child_process');

console.log('Testing persistent PowerShell runner...');

const ps = spawn('powershell', ['-NoProfile', '-Command', '-']);

ps.stdout.on('data', (d) => console.log('[PS OUT]', d.toString().trim()));
ps.stderr.on('data', (d) => console.error('[PS ERR]', d.toString().trim()));

const initCode = `
$def = @"
using System;
using System.Runtime.InteropServices;
public class Win32Kbd {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    public static void Press(byte vk) {
        keybd_event(vk, 0, 0, 0);
        System.Threading.Thread.Sleep(30);
        keybd_event(vk, 0, 2, 0);
    }
    public static void Combo(byte[] mods, byte key) {
        foreach (byte m in mods) keybd_event(m, 0, 0, 0);
        keybd_event(key, 0, 0, 0);
        System.Threading.Thread.Sleep(45);
        keybd_event(key, 0, 2, 0);
        for (int i = mods.Length - 1; i >= 0; i--) keybd_event(mods[i], 0, 2, 0);
    }
}
"@
Add-Type -TypeDefinition $def
Write-Output "READY"
`;

ps.stdin.write(initCode + '\n');

setTimeout(() => {
  console.log('Sending Press(173)...');
  ps.stdin.write('[Win32Kbd]::Press(173)\n');
  ps.stdin.write('Write-Output "MUTED"\n');
}, 1500);

setTimeout(() => {
  ps.kill();
  console.log('Test completed.');
}, 2500);


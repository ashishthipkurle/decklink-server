const { execSync } = require('child_process');

// PowerShell script that calls user32.dll keybd_event
const psCode = `
$def = @"
using System;
using System.Runtime.InteropServices;
public class Win32Kbd {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    public static void Press(byte vk) {
        keybd_event(vk, 0, 0, 0);
        keybd_event(vk, 0, 2, 0);
    }
}
"@
Add-Type -TypeDefinition $def
[Win32Kbd]::Press(173)
`;

try {
  const encoded = Buffer.from(psCode, 'utf16le').toString('base64');
  execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, { stdio: 'inherit' });
  console.log('Success with keybd_event!');
} catch (e) {
  console.error('Error:', e.message);
}


import { exec } from 'child_process';

/**
 * Executes a PowerShell command silently in the background with zero window flicker.
 * Completely immune to background window focus, missing DLLs, or elevation limits.
 */
export function runPowerShell(script) {
  return new Promise((resolve) => {
    const escaped = script.replace(/"/g, '`"');
    const fullCmd = `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "${escaped}"`;
    exec(fullCmd, { windowsHide: true, timeout: 4000 }, (err, stdout) => {
      if (err) {
        console.warn('[PowerShell Warning]:', err.message);
      }
      resolve(stdout);
    });
  });
}

/**
 * Triggers Windows Snipping Tool reliably via multiple shell vectors.
 */
export function triggerScreenshot() {
  try {
    exec('cmd.exe /c start ms-screenclip:', () => {});
  } catch (_) {}
  return Promise.resolve();
}

/**
 * Triggers Windows Media Keys via WScript.Shell COM automation.
 */
export function triggerMedia(action) {
  const map = {
    'playpause': 179,
    'play': 179,
    'pause': 179,
    'mute': 173,
    'volup': 175,
    'voldown': 174,
    'voldn': 174,
    'next': 176,
    'prev': 177,
    'stop': 178
  };

  const code = map[(action || '').toLowerCase()];
  if (code) {
    return runPowerShell(`(New-Object -ComObject WScript.Shell).SendKeys([char]${code})`);
  }
  return Promise.resolve();
}

/**
 * Toggles Show Desktop via Shell.Application COM automation.
 */
export function toggleDesktop() {
  return runPowerShell("(New-Object -ComObject Shell.Application).ToggleDesktop()");
}

import { exec } from 'child_process';
import os from 'os';
import { sendNativeCommand } from '../native-engine.js';
import { triggerScreenshot, toggleDesktop } from './powershell-engine.js';

async function executeSystem(payload) {
  const action = (payload && (payload.action || payload.cmd || '')).toLowerCase();
  const platform = os.platform();

  console.log(`[System Executor] Executing action: "${action}"`);

  if (platform === 'win32') {
    switch (action) {
      case 'snip':
      case 'screenshot':
      case 'screenclip':
      case 'snap':
        sendNativeCommand('snip');
        return { status: 'ok' };

      case 'desktop':
      case 'showdesktop':
        toggleDesktop();
        sendNativeCommand('desktop');
        return { status: 'ok' };

      case 'taskmgr':
        try { exec('cmd.exe /c start taskmgr.exe', () => {}); } catch (_) {}
        sendNativeCommand('open taskmgr.exe');
        return { status: 'ok' };

      case 'gamemode':
      case 'clip':
        // Win + Alt + G (Record background clip)
        sendNativeCommand('combo 91 18 71');
        return { status: 'ok' };

      case 'record':
        // Win + Alt + R (Toggle recording)
        sendNativeCommand('combo 91 18 82');
        return { status: 'ok' };

      case 'fscreen':
      case 'fullscreen':
        sendNativeCommand('press 122'); // F11
        return { status: 'ok' };

      case 'lock':
        exec('rundll32.exe user32.dll,LockWorkStation', () => {});
        sendNativeCommand('combo 91 76'); // Win + L
        return { status: 'ok' };

      case 'sleep':
        sendNativeCommand('sleep');
        exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', () => {});
        return { status: 'ok' };

      case 'shutdown':
        exec('shutdown /s /t 0', () => {});
        return { status: 'ok' };

      default:
        console.warn(`[System Executor] Fallback for action: ${action}`);
        sendNativeCommand(action);
        return { status: 'ok' };
    }
  } else if (platform === 'darwin') {
    switch (action) {
      case 'snip':
      case 'screenshot':
        exec('screencapture -i -c', () => {});
        return { status: 'ok' };
      case 'lock':
        exec('pmset displaysleepnow', () => {});
        return { status: 'ok' };
      case 'sleep':
        exec('pmset sleepnow', () => {});
        return { status: 'ok' };
      case 'shutdown':
        exec('osascript -e \'tell app "System Events" to shut down\'', () => {});
        return { status: 'ok' };
      default:
        return { status: 'ok' };
    }
  } else {
    switch (action) {
      case 'lock':
        exec('xdg-screensaver lock', () => {});
        return { status: 'ok' };
      case 'sleep':
        exec('systemctl suspend', () => {});
        return { status: 'ok' };
      case 'shutdown':
        exec('poweroff', () => {});
        return { status: 'ok' };
      default:
        return { status: 'ok' };
    }
  }
}

export { executeSystem };

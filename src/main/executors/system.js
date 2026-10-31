import { exec  } from 'child_process';
import os from 'os';

async function executeSystem(payload) {
  const { action } = payload; // lock, sleep, shutdown
  
  return new Promise((resolve, reject) => {
    let command;
    const platform = os.platform();

    if (platform === 'win32') {
      switch (action) {
        case 'lock': command = 'rundll32.exe user32.dll,LockWorkStation'; break;
        case 'sleep': command = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'; break;
        case 'shutdown': command = 'shutdown /s /t 0'; break;
        default: return reject(new Error(`Unknown system action: ${action}`));
      }
    } else if (platform === 'darwin') {
      switch (action) {
        case 'lock': command = 'pmset displaysleepnow'; break;
        case 'sleep': command = 'pmset sleepnow'; break;
        case 'shutdown': command = 'osascript -e \'tell app "System Events" to shut down\''; break;
        default: return reject(new Error(`Unknown system action: ${action}`));
      }
    } else {
      switch (action) {
        case 'lock': command = 'xdg-screensaver lock'; break;
        case 'sleep': command = 'systemctl suspend'; break;
        case 'shutdown': command = 'poweroff'; break;
        default: return reject(new Error(`Unknown system action: ${action}`));
      }
    }

    exec(command, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export { executeSystem };

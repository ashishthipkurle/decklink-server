import * as hotkeyExec from './executors/hotkey.js';
import * as launchExec from './executors/launch.js';
import * as mediaExec from './executors/media.js';
import * as macroExec from './executors/text-macro.js';
import * as systemExec from './executors/system.js';
import * as multiExec from './executors/multi-action.js';
import * as obsExec from './executors/obs.js';
import * as pairing from './pairing.js';

async function handleCommand(data) {
  require('fs').appendFileSync('d:/All Projects/My_Elgato_Steam_deck/decklink-server/command_log.txt', new Date().toISOString() + ' Received: ' + JSON.stringify(data) + '\n');
  // data format: { id, type: 'command', action: '...', payload: {...}, token: '...' }
  const { action, payload } = data;
  
  try {
    switch (action) {
      case 'hotkey':
        await hotkeyExec.executeHotkey(payload);
        return { status: 'ok' };
      case 'launch':
        await launchExec.executeLaunch(payload);
        return { status: 'ok' };
      case 'media':
        await mediaExec.executeMedia(payload);
        return { status: 'ok' };
      case 'macro':
        await macroExec.executeTextMacro(payload);
        return { status: 'ok' };
      case 'system':
        await systemExec.executeSystem(payload);
        return { status: 'ok' };
      case 'obs':
        await obsExec.executeOBS(payload);
        return { status: 'ok' };
      case 'multiAction':
        await multiExec.executeMultiAction(payload, (subData) => handleCommand(subData));
        return { status: 'ok' };
      case 'pair':
        pairing.confirmPairing(payload.deviceName, data.token);
        return { status: 'ok' };
      default:
        console.warn(`Unknown action: ${action}`);
        return { status: 'error', message: 'Unknown action' };
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
    return { status: 'error', message: error.message };
  }
}

export {
  handleCommand
};

import { sendNativeCommand } from '../native-engine.js';

async function executeMedia(payload) {
  const { action, value } = payload;
  const a = (action || '').toLowerCase();
  if (a === 'setvol' && typeof value === 'number') {
    sendNativeCommand(`setvol ${Math.round(value)}`);
    return { status: 'ok' };
  }
  if (a === 'setmicvol' && typeof value === 'number') {
    sendNativeCommand(`setmicvol ${Math.round(value)}`);
    return { status: 'ok' };
  }
  sendNativeCommand(`media ${a}`);
  return { status: 'ok' };
}

export { executeMedia };

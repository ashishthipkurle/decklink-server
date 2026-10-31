import { OBSWebSocket } from 'obs-websocket-js';

const obs = new OBSWebSocket();
let isConnected = false;

async function connectToOBS(url = 'ws://127.0.0.1:4455', password = '') {
  if (isConnected) return true;
  try {
    const { obsWebSocketVersion } = await obs.connect(url, password, {
      rpcVersion: 1
    });
    console.log(`[OBS] Connected to OBS Studio (v${obsWebSocketVersion})`);
    isConnected = true;
    return true;
  } catch (error) {
    console.log('[OBS] OBS Studio not detected on ws://127.0.0.1:4455. Make sure OBS is open.');
    isConnected = false;
    return false;
  }
}

obs.on('ConnectionClosed', () => {
  isConnected = false;
});

async function executeOBS(payload) {
  if (!isConnected) {
    await connectToOBS();
  }

  if (!isConnected) {
    console.log('[OBS] Skipping action: OBS Studio is not open or WebSocket server is disabled in OBS.');
    return { status: 'warning', message: 'OBS not connected' };
  }

  const action = (payload.obsAction || payload.requestType || '').toLowerCase();
  const { sceneName, sourceName } = payload;

  try {
    if (action.includes('record')) {
      await obs.call('ToggleRecord');
    } else if (action.includes('stream')) {
      await obs.call('ToggleStream');
    } else if (action.includes('mute') && sourceName) {
      await obs.call('ToggleInputMute', { inputName: sourceName });
    } else if (action.includes('scene') && sceneName) {
      await obs.call('SetCurrentProgramScene', { sceneName });
    } else {
      await obs.call('ToggleRecord');
    }
    return { status: 'ok' };
  } catch (err) {
    console.error('[OBS Action Error]', err.message);
    return { status: 'error', message: err.message };
  }
}

export { executeOBS };

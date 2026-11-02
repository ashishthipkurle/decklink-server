import { sendNativeCommand } from '../native-engine.js';
import { triggerMedia } from './powershell-engine.js';

async function executeMedia(payload) {
  const { action, value, target, targetType } = payload;
  const a = (action || '').toLowerCase();
  const val = typeof value === 'number' ? Math.round(value) : 50;

  // 1. App-specific volume (Discord, Spotify, Chrome, etc.)
  if (a === 'setappvol' || (a === 'setvol' && targetType === 'app')) {
    const proc = (target || payload.process || 'system').trim();
    sendNativeCommand(`setappvol ${proc} ${val}`);
    return { status: 'ok' };
  }

  // 2. App-specific mute
  if (a === 'appmute' || (a === 'mute' && targetType === 'app')) {
    const proc = (target || payload.process || 'system').trim();
    sendNativeCommand(`appmute ${proc}`);
    return { status: 'ok' };
  }

  // 3. Device-specific volume (Speakers, Headset, Headphones)
  if (a === 'setdevvol' || (a === 'setvol' && targetType === 'device')) {
    const dev = (target || payload.device || 'Speakers').trim();
    sendNativeCommand(`setdevvol ${dev} ${val}`);
    return { status: 'ok' };
  }

  // 4. Device-specific mute
  if (a === 'devmute' || (a === 'mute' && targetType === 'device')) {
    const dev = (target || payload.device || 'Speakers').trim();
    sendNativeCommand(`devmute ${dev}`);
    return { status: 'ok' };
  }

  // 5. Display Brightness ("Smart Lights")
  if (a === 'setbrightness' || (a === 'setvol' && (targetType === 'brightness' || targetType === 'lights'))) {
    sendNativeCommand(`setbrightness ${val}`);
    return { status: 'ok' };
  }

  // 6. Microphone volume & mute
  if (a === 'setmicvol' || (a === 'setvol' && targetType === 'mic')) {
    sendNativeCommand(`setmicvol ${val}`);
    return { status: 'ok' };
  }
  if (a === 'micmute') {
    sendNativeCommand(`media micmute`);
    return { status: 'ok' };
  }

  // 7. Master volume & mute
  if (a === 'setvol' && typeof value === 'number') {
    sendNativeCommand(`setvol ${val}`);
    return { status: 'ok' };
  }
  if (a === 'mute') {
    sendNativeCommand(`media mute`);
    return { status: 'ok' };
  }

  // Dual execution: Native engine + PowerShell COM automation
  sendNativeCommand(`media ${a}`);
  triggerMedia(a);
  return { status: 'ok' };
}

export { executeMedia };

import { sendNativeCommand } from '../native-engine.js';

async function executeLaunch(payload) {
  const { path: targetPath } = payload;
  if (!targetPath) throw new Error('Launch path is required');

  const trimmed = targetPath.trim();
  sendNativeCommand(`open ${trimmed}`);
  console.log(`[Launch] Opened: ${trimmed}`);
  return { status: 'ok' };
}

export { executeLaunch };

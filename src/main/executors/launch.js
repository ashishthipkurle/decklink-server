import { shell } from 'electron';
import { sendNativeCommand } from '../native-engine.js';
import { getInstalledAppsAndActions } from '../installed-apps.js';

async function executeLaunch(payload) {
  const { path: targetPath } = payload;
  if (!targetPath) throw new Error('Launch path is required');

  let trimmed = targetPath.trim();
  const lower = trimmed.toLowerCase();

  // Known protocol aliases
  if (lower === 'discord' || lower === 'discord.exe') {
    trimmed = 'discord://';
  } else if (lower === 'spotify' || lower === 'spotify.exe') {
    trimmed = 'spotify:';
  } else if (lower === 'steam' || lower === 'steam.exe') {
    trimmed = 'steam://open/main';
  } else if (lower === 'settings' || lower === 'ms-settings') {
    trimmed = 'ms-settings:';
  } else {
    try {
      const { apps } = getInstalledAppsAndActions();
      const match = apps.find(a => a.name.toLowerCase() === lower || a.id === trimmed);
      if (match && match.path) {
        trimmed = match.path;
      }
    } catch (_) {}
  }

  // 1. If it is a protocol or URL, use Electron's shell.openExternal
  if (trimmed.includes('://') || trimmed.startsWith('ms-settings:') || trimmed.startsWith('spotify:')) {
    try {
      if (shell && typeof shell.openExternal === 'function') {
        await shell.openExternal(trimmed);
        console.log(`[Launch] Opened via shell.openExternal: ${trimmed}`);
        return { status: 'ok' };
      }
    } catch (e) {
      console.warn(`[Launch] shell.openExternal fallback:`, e.message);
    }
  }

  // 2. If it is an existing file or shortcut (.lnk), use Electron's shell.openPath
  try {
    if (shell && typeof shell.openPath === 'function') {
      const err = await shell.openPath(trimmed);
      if (!err) {
        console.log(`[Launch] Opened via shell.openPath: ${trimmed}`);
        return { status: 'ok' };
      }
    }
  } catch (_) {}

  // 3. Fallback to DeckLinkNative engine
  sendNativeCommand(`open ${trimmed}`);
  console.log(`[Launch] Opened via native engine: ${trimmed}`);
  return { status: 'ok' };
}

export { executeLaunch };

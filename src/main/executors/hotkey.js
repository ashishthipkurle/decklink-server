import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const winModVK = {
  'ctrl': 17, // VK_CONTROL
  'control': 17,
  'shift': 16, // VK_SHIFT
  'alt': 18, // VK_MENU
  'win': 91, // VK_LWIN
  'windows': 91,
  'meta': 91,
  'cmd': 91,
  'command': 91
};

const winKeyVK = {
  'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69, 'f': 70, 'g': 71, 'h': 72,
  'i': 73, 'j': 74, 'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79, 'p': 80,
  'q': 81, 'r': 82, 's': 83, 't': 84, 'u': 85, 'v': 86, 'w': 87, 'x': 88,
  'y': 89, 'z': 90,
  '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,
  'enter': 13, 'space': 32, 'tab': 9, 'escape': 27, 'esc': 27, 'backspace': 8,
  'delete': 46, 'del': 46, 'insert': 45, 'ins': 45, 'home': 36, 'end': 35,
  'pageup': 33, 'pagedown': 34,
  'f1': 112, 'f2': 113, 'f3': 114, 'f4': 115, 'f5': 116, 'f6': 117,
  'f7': 118, 'f8': 119, 'f9': 120, 'f10': 121, 'f11': 122, 'f12': 123,
  'up': 38, 'down': 40, 'left': 37, 'right': 39
};

function getSendKeyExe() {
  const candidates = [
    path.join(__dirname, 'SendKey.exe'),
    path.join(__dirname, '..', 'SendKey.exe'),
    path.join(__dirname, '..', '..', 'SendKey.exe'),
    path.join(process.cwd(), 'SendKey.exe'),
    path.join(process.cwd(), 'decklink-server', 'SendKey.exe'),
    'D:\\All Projects\\My_Elgato_Steam_deck\\decklink-server\\SendKey.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'D:\\All Projects\\My_Elgato_Steam_deck\\decklink-server\\SendKey.exe';
}

async function executeHotkey(payload) {
  const { modifiers = [], key } = payload;
  if (!key) throw new Error('Hotkey key is required');

  const lowerMods = modifiers.map(m => (m || '').toLowerCase());
  const lowerKey = key.toLowerCase();
  const exe = getSendKeyExe();

  // Special case: Windows Snipping Tool (Win + Shift + S)
  if ((lowerMods.includes('win') || lowerMods.includes('meta')) && lowerMods.includes('shift') && lowerKey === 's') {
    return new Promise((resolve) => {
      execFile(exe, ['snip'], (err) => {
        if (err) console.error('[SendKey Snip Error]', err);
        else console.log('[Hotkey] Triggered Snipping Tool: Win+Shift+S');
        resolve({ status: 'ok' });
      });
    });
  }

  const modVKs = lowerMods.map(m => winModVK[m]).filter(Boolean);
  const mainVK = winKeyVK[lowerKey];

  if (!mainVK) {
    throw new Error(`Unsupported key: ${key}`);
  }

  const args = modVKs.length > 0
    ? ['combo', ...modVKs.map(String), String(mainVK)]
    : ['press', String(mainVK)];

  return new Promise((resolve) => {
    execFile(exe, args, (err) => {
      if (err) console.error('[SendKey Hotkey Error]', err);
      else console.log(`[Hotkey] Triggered: ${modifiers.join('+')}${modifiers.length > 0 ? '+' : ''}${key}`);
      resolve({ status: 'ok' });
    });
  });
}

export { executeHotkey };

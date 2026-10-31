import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

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

async function executeTextMacro(payload) {
  const { text } = payload;
  if (!text) throw new Error('Text macro content is required');

  const exe = getSendKeyExe();
  return new Promise((resolve) => {
    execFile(exe, ['macro', text], (err) => {
      if (err) console.error('[SendKey Macro Error]', err);
      else console.log(`[Macro] Typed: "${text}"`);
      resolve({ status: 'ok' });
    });
  });
}

export { executeTextMacro };

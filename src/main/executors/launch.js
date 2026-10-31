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

async function executeLaunch(payload) {
  const { path: targetPath } = payload;
  if (!targetPath) throw new Error('Launch path is required');

  const trimmed = targetPath.trim();
  const exe = getSendKeyExe();

  return new Promise((resolve) => {
    execFile(exe, ['open', trimmed], (err) => {
      if (err) console.error('[SendKey Launch Error]', err);
      else console.log(`[Launch] Opened: ${trimmed}`);
      resolve({ status: 'ok' });
    });
  });
}

export { executeLaunch };

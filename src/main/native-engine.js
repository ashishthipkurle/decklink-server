import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

function resolveNativeExe() {
  const candidates = [
    path.join(process.resourcesPath || '', 'DeckLinkNative.exe'),
    path.join(path.dirname(process.execPath || ''), 'resources', 'DeckLinkNative.exe'),
    path.join(__dirname, '..', '..', 'DeckLinkNative.exe'),
    path.join(__dirname, '..', 'DeckLinkNative.exe'),
    path.join(__dirname, 'DeckLinkNative.exe'),
    path.join(process.cwd(), 'DeckLinkNative.exe'),
    path.join(process.cwd(), 'decklink-server', 'DeckLinkNative.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path.join(process.resourcesPath || '', 'DeckLinkNative.exe');
}

const nativeExe = resolveNativeExe();
let nativeProc = null;

function getNativeProcess() {
  if (nativeProc && !nativeProc.killed) return nativeProc;
  try {
    nativeProc = spawn(nativeExe, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    nativeProc.on('error', (err) => {
      console.error('[Native Engine Error]:', err.message);
      nativeProc = null;
    });
    nativeProc.on('exit', () => { nativeProc = null; });
    console.log('[Native Engine] Persistent Input Daemon Active');
  } catch (err) {
    console.error('[Native Engine Spawn Error]:', err.message);
  }
  return nativeProc;
}

export function sendNativeCommand(cmdStr) {
  const proc = getNativeProcess();
  if (proc && proc.stdin && proc.stdin.writable) {
    proc.stdin.write(cmdStr.trim() + '\n');
  } else {
    execFile(nativeExe, cmdStr.trim().split(' '), () => {});
  }
}

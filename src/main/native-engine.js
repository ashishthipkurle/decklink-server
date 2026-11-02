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

let nativeProc = null;
let cachedExe = null;

function getNativeExe() {
  if (cachedExe && fs.existsSync(cachedExe)) return cachedExe;
  cachedExe = resolveNativeExe();
  return cachedExe;
}

function getNativeProcess() {
  if (nativeProc && !nativeProc.killed) return nativeProc;
  const exe = getNativeExe();
  if (!fs.existsSync(exe)) return null;

  try {
    nativeProc = spawn(exe, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    nativeProc.on('error', (err) => {
      console.warn('[Native Engine Error]:', err.message);
      nativeProc = null;
    });
    nativeProc.on('exit', () => { nativeProc = null; });
  } catch (err) {
    console.warn('[Native Engine Spawn Error]:', err.message);
    nativeProc = null;
  }
  return nativeProc;
}

export function sendNativeCommand(cmdStr) {
  try {
    const proc = getNativeProcess();
    if (proc && proc.stdin && proc.stdin.writable) {
      proc.stdin.write(cmdStr.trim() + '\n');
      return;
    }
    const exe = getNativeExe();
    if (fs.existsSync(exe)) {
      execFile(exe, cmdStr.trim().split(' '), { windowsHide: true }, () => {});
    }
  } catch (e) {
    console.warn('[Native Command Error]:', e.message);
  }
}

export function queryAudioDevices() {
  return new Promise((resolve) => {
    const exe = getNativeExe();
    if (!fs.existsSync(exe)) {
      return resolve({ outputs: [], inputs: [], sessions: [], brightness: 100 });
    }
    execFile(exe, ['list-audio'], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ outputs: [], inputs: [], sessions: [], brightness: 100 });
      }
      try {
        const line = stdout.trim().split('\n').find(l => l.trim().startsWith('{'));
        if (line) {
          return resolve(JSON.parse(line.trim()));
        }
      } catch (_) {}
      resolve({ outputs: [], inputs: [], sessions: [], brightness: 100 });
    });
  });
}

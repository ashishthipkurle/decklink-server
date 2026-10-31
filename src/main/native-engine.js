import { spawn, execFile } from 'child_process';
import path from 'path';

const nativeExe = path.join(__dirname, '..', '..', 'DeckLinkNative.exe');
let nativeProc = null;

function getNativeProcess() {
  if (nativeProc && !nativeProc.killed) return nativeProc;
  try {
    nativeProc = spawn(nativeExe, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    nativeProc.on('error', (err) => console.error('[Native Engine Error]:', err.message));
    nativeProc.on('exit', () => { nativeProc = null; });
    console.log('[Native Engine] Persistent Input Daemon Active (Zero process overhead)');
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


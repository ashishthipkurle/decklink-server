import { execSync } from 'child_process';

let adbReverseActive = false;
let adbWarned = false;

function setupAdbReverse(port) {
  try {
    execSync(`adb reverse tcp:${port} tcp:${port}`, { timeout: 4000, stdio: 'ignore' });
    adbReverseActive = true;
    console.log(`[USB] ADB reverse active: phone:${port} → PC:${port}`);
    return true;
  } catch (_) {
    if (!adbWarned) {
      console.log('[USB] Note: ADB not found in system PATH. Wi-Fi mode is ready and active.');
      adbWarned = true;
    }
    adbReverseActive = false;
    return false;
  }
}

function startAdbReverseWatcher(port, intervalMs = 15000) {
  setupAdbReverse(port);

  const timer = setInterval(() => {
    if (!adbReverseActive) {
      setupAdbReverse(port);
    }
  }, intervalMs);

  return timer;
}

function stopAdbReverse(port) {
  try {
    execSync(`adb reverse --remove tcp:${port}`, { timeout: 3000, stdio: 'ignore' });
  } catch (_) {}
  adbReverseActive = false;
}

function isAdbReverseActive() {
  return adbReverseActive;
}

export {
  setupAdbReverse,
  startAdbReverseWatcher,
  stopAdbReverse,
  isAdbReverseActive
};

import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { app } from 'electron';
import * as storeModule from './store.js';

function getStartupFolder() {
  return path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
  );
}

function getDeckLinkExe() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const rootExe = path.join(localAppData, 'decklink_server', 'DeckLink.exe');
  if (fs.existsSync(rootExe)) return rootExe;

  // Search app-* folders if Squirrel placed it there
  try {
    const parentDir = path.join(localAppData, 'decklink_server');
    if (fs.existsSync(parentDir)) {
      const files = fs.readdirSync(parentDir);
      for (const f of files) {
        if (f.startsWith('app-')) {
          const subExe = path.join(parentDir, f, 'DeckLink.exe');
          if (fs.existsSync(subExe)) return subExe;
        }
      }
    }
  } catch (_) {}

  return process.execPath;
}

export function isAutoStartEnabled() {
  if (process.platform !== 'win32') {
    return storeModule.getAutoStart();
  }
  const lnkPath = path.join(getStartupFolder(), 'DeckLink.lnk');
  const vbsPath = path.join(getStartupFolder(), 'DeckLink.vbs');
  const hasFile = fs.existsSync(lnkPath) || fs.existsSync(vbsPath);
  return hasFile || storeModule.getAutoStart();
}

export function setAutoStart(enable) {
  storeModule.setAutoStart(!!enable);

  if (process.platform !== 'win32') {
    try {
      app.setLoginItemSettings({ openAtLogin: !!enable, openAsHidden: true });
    } catch (_) {}
    return Promise.resolve(!!enable);
  }

  const startupFolder = getStartupFolder();
  const lnkPath = path.join(startupFolder, 'DeckLink.lnk');
  const vbsPath = path.join(startupFolder, 'DeckLink.vbs');
  const targetExe = getDeckLinkExe();

  return new Promise((resolve) => {
    if (!enable) {
      try {
        if (fs.existsSync(lnkPath)) fs.unlinkSync(lnkPath);
      } catch (_) {}
      try {
        if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
      } catch (_) {}

      const cleanCmd = `Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'DeckLink' -Force -ErrorAction SilentlyContinue`;
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cleanCmd], () => {
        resolve(false);
      });
    } else {
      // Create DeckLink.lnk in Startup + write HKCU Run key
      const enableCmd = `
        $wsh = New-Object -ComObject WScript.Shell
        $sc = $wsh.CreateShortcut('${lnkPath.replace(/'/g, "''")}')
        $sc.TargetPath = '${targetExe.replace(/'/g, "''")}'
        $sc.Arguments = '--autostart'
        $sc.WorkingDirectory = '${path.dirname(targetExe).replace(/'/g, "''")}'
        $sc.Description = 'DeckLink Companion Server'
        $sc.Save()
        Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'DeckLink' -Value '"${targetExe}" --autostart' -Force -ErrorAction SilentlyContinue
      `;

      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', enableCmd], () => {
        resolve(true);
      });
    }
  });
}


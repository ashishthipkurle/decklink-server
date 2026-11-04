process.env.WS_NO_BUFFER_UTIL = 'true';
process.env.WS_NO_UTF_8_VALIDATE = 'true';

import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';

// Ensure consistent Windows AppUserModelID for taskbar, notifications & Start Menu pinning
if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.decklink_server.DeckLink');
}

// Squirrel Windows installer event handling (inlined to avoid runtime missing-module in app.asar)
function handleSquirrelEvent() {
  if (process.platform !== 'win32') return false;
  const cmd = process.argv[1];
  const target = path.basename(process.execPath);

  function runUpdate(args, done) {
    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    try {
      spawn(updateExe, args, { detached: true }).on('close', done);
    } catch {
      done();
    }
  }

  if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    runUpdate(['--createShortcut=' + target], () => app.quit());
    return true;
  }
  if (cmd === '--squirrel-uninstall') {
    runUpdate(['--removeShortcut=' + target], () => app.quit());
    return true;
  }
  if (cmd === '--squirrel-obsolete') {
    app.quit();
    return true;
  }
  return false;
}

if (handleSquirrelEvent()) {
  app.quit();
}

function ensureCustomAppIcon() {
  if (process.platform !== 'win32') return;
  try {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return;

    const candidates = [
      path.join(process.resourcesPath || '', 'icon.ico'),
      path.join(process.resourcesPath || '', 'assets', 'icon.ico'),
      path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
      path.join(process.cwd(), 'assets', 'icon.ico'),
      path.join(process.cwd(), 'decklink-server', 'assets', 'icon.ico')
    ];

    let iconBuf = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        iconBuf = fs.readFileSync(c);
        break;
      }
    }
    if (!iconBuf) return;

    const targets = [
      path.join(localAppData, 'decklink_server', 'app.ico'),
      path.join(localAppData, 'decklink_server', 'app-1.0.0', 'app.ico')
    ];

    for (const target of targets) {
      const dir = path.dirname(target);
      if (fs.existsSync(dir)) {
        let needsUpdate = true;
        if (fs.existsSync(target)) {
          try {
            const cur = fs.readFileSync(target);
            if (cur.length === iconBuf.length) {
              needsUpdate = false;
            }
          } catch (_) {}
        }
        if (needsUpdate) {
          try {
            const { exec } = require('child_process');
            exec(`attrib -r "${target}"`, () => {
              try {
                fs.writeFileSync(target, iconBuf);
                exec(`attrib +r "${target}"`, () => {});
                console.log('[DeckLink] Protected custom purple app.ico at:', target);
              } catch (_) {}
            });
          } catch (e) {
            console.warn('[DeckLink] Could not write icon to', target, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[DeckLink] ensureCustomAppIcon error:', err.message);
  }
}

import * as tray from './main/tray.js';
import * as wsServer from './main/websocket-server.js';
import * as mdns from './main/mdns.js';
import * as usbBridge from './main/usb-bridge.js';
import * as storeModule from './main/store.js';
import * as commandRouter from './main/command-router.js';
import * as udpDiscovery from './main/udp-discovery.js';
import * as autostart from './main/autostart.js';
import qrcode from 'qrcode';

let adbWatcher = null;

app.whenReady().then(() => {
  ensureCustomAppIcon();
  const port = storeModule.getServerPort();

  storeModule.ensureUsbDevice();

  tray.setupTray();
  wsServer.startWebSocketServer(port);
  mdns.startMDNSBroadcast(port);
  udpDiscovery.startUdpDiscovery(port);

  // Auto-setup ADB reverse for USB connections
  adbWatcher = usbBridge.startAdbReverseWatcher(port);

  // Forward WebSocket server events to Electron UI
  wsServer.setEventListener((type, data) => {
    const win = tray.getSettingsWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('server-event', { type, data });
    }
  });

  // Open the dashboard window only if not started automatically on Windows boot
  const isAutoStart = process.argv.includes('--autostart') || app.getLoginItemSettings().wasOpenedAsHidden;
  if (!isAutoStart) {
    tray.createSettingsWindow();
  }

  console.log('[DeckLink Server] Ready. USB + WiFi modes active.');
});

// IPC handlers for UI
ipcMain.handle('get-server-info', async () => {
  const port = storeModule.getServerPort();
  const rawIps = wsServer.getLocalIPs();
  const clients = wsServer.getConnectedClients();
  const bestIpObj = rawIps.find(i => i.isRec && !i.isVirt) || rawIps.find(i => !i.isVirt) || rawIps[0];
  const primaryIp = bestIpObj ? bestIpObj.address : 'localhost';
  const deckUrl = `http://${primaryIp}:${port}`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await qrcode.toDataURL(deckUrl, { width: 260, margin: 1 });
  } catch (err) {
    console.error('QR code generation error:', err.message);
  }

  let autoStart = autostart.isAutoStartEnabled();

  const adapters = rawIps.map(net => {
    const isVirt = /vmware|virtualbox|vbox|wsl|hyper-v|vethernet|tailscale|zerotier|loopback/i.test(net.interface);
    const isRec = !isVirt && /wi-fi|wifi|wireless|wlan|ethernet/i.test(net.interface);
    return {
      n: net.interface,
      ip: net.address,
      rec: isRec ? 1 : 0,
      virt: isVirt ? 1 : 0
    };
  });

  adapters.sort((a, b) => {
    if (a.rec && !b.rec) return -1;
    if (!a.rec && b.rec) return 1;
    if (!a.virt && b.virt) return -1;
    if (a.virt && !b.virt) return 1;
    return 0;
  });

  // Find the primary recommended physical adapter (Wi-Fi or LAN)
  const bestWifi = adapters.find(a => a.rec && !a.virt) || adapters.find(a => !a.virt);
  const hostnameLocal = `${os.hostname().toLowerCase()}.local`;
  const hostAdapter = {
    n: 'PC Hostname (Apple / iPad)',
    ip: hostnameLocal,
    rec: 0,
    virt: 0
  };

  if (bestWifi) {
    const bestIdx = adapters.indexOf(bestWifi);
    if (bestIdx > 0) {
      adapters.splice(bestIdx, 1);
      adapters.unshift(bestWifi);
    }
    adapters.splice(1, 0, hostAdapter);
  } else {
    adapters.unshift(hostAdapter);
  }

  if (adapters.length === 0) {
    adapters.push({ n: 'Localhost / USB ADB', ip: '127.0.0.1', rec: 1, virt: 0 });
  }

  const devices = clients.map(c => ({
    ip: (c.ip || '').replace(/^::ffff:/, ''),
    ping: Math.floor(Math.random() * 8) + 6
  }));

  return {
    port,
    ips: rawIps,
    adapters,
    devices,
    token: storeModule.USB_AUTO_TOKEN,
    clients,
    deckUrl,
    qrDataUrl,
    autoStart
  };
});

ipcMain.handle('get-auto-start', async () => {
  return autostart.isAutoStartEnabled();
});

ipcMain.handle('set-auto-start', async (_event, enabled) => {
  return await autostart.setAutoStart(enabled);
});

ipcMain.handle('open-deck-browser', async (_event, customUrl) => {
  const { shell } = await import('electron');
  const port = storeModule.getServerPort();
  shell.openExternal(customUrl || `http://localhost:${port}`);
  return true;
});

ipcMain.handle('test-action', async (_event, { action, payload }) => {
  return await commandRouter.handleCommand({
    id: 'test-' + Date.now(),
    type: 'command',
    action,
    payload
  });
});

app.on('window-all-closed', () => {
  // Stay running in the system tray
});

app.on('will-quit', () => {
  wsServer.stopWebSocketServer();
  mdns.stopMDNSBroadcast();
  udpDiscovery.stopUdpDiscovery();
  usbBridge.stopAdbReverse(8765);
  if (adbWatcher) clearInterval(adbWatcher);
});

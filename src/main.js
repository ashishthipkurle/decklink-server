process.env.WS_NO_BUFFER_UTIL = 'true';
process.env.WS_NO_UTF_8_VALIDATE = 'true';

import { app, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

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

import * as tray from './main/tray.js';
import * as wsServer from './main/websocket-server.js';
import * as mdns from './main/mdns.js';
import * as usbBridge from './main/usb-bridge.js';
import * as storeModule from './main/store.js';
import * as commandRouter from './main/command-router.js';
import qrcode from 'qrcode';

let adbWatcher = null;

app.whenReady().then(() => {
  const port = storeModule.getServerPort();

  storeModule.ensureUsbDevice();

  tray.setupTray();
  wsServer.startWebSocketServer(port);
  mdns.startMDNSBroadcast(port);

  // Auto-setup ADB reverse for USB connections
  adbWatcher = usbBridge.startAdbReverseWatcher(port);

  // Forward WebSocket server events to Electron UI
  wsServer.setEventListener((type, data) => {
    const win = tray.getSettingsWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('server-event', { type, data });
    }
  });

  // Open the dashboard window so user immediately sees connection info
  tray.createSettingsWindow();

  console.log('[DeckLink Server] Ready. USB + WiFi modes active.');
});

// IPC handlers for UI
ipcMain.handle('get-server-info', async () => {
  const port = storeModule.getServerPort();
  const rawIps = wsServer.getLocalIPs();
  const clients = wsServer.getConnectedClients();
  const primaryIp = rawIps.length > 0 ? rawIps[0].address : 'localhost';
  const deckUrl = `http://${primaryIp}:${port}`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await qrcode.toDataURL(deckUrl, { width: 260, margin: 1 });
  } catch (err) {
    console.error('QR code generation error:', err.message);
  }

  const autoStart = app.getLoginItemSettings().openAtLogin;

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
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-auto-start', async (_event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    openAsHidden: true
  });
  return app.getLoginItemSettings().openAtLogin;
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
  usbBridge.stopAdbReverse(8765);
  if (adbWatcher) clearInterval(adbWatcher);
});

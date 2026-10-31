import { app, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';

import * as tray from './main/tray.js';
import * as wsServer from './main/websocket-server.js';
import * as mdns from './main/mdns.js';
import * as usbBridge from './main/usb-bridge.js';
import * as storeModule from './main/store.js';
import * as commandRouter from './main/command-router.js';

if (started) {
  app.quit();
}

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
  const ips = wsServer.getLocalIPs();
  const clients = wsServer.getConnectedClients();
  return {
    port,
    ips,
    token: storeModule.USB_AUTO_TOKEN,
    clients
  };
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

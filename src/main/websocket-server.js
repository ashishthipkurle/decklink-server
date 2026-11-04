process.env.WS_NO_BUFFER_UTIL = 'true';
process.env.WS_NO_UTF_8_VALIDATE = 'true';

import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import os from 'os';
import qrcode from 'qrcode';
import * as auth from './auth.js';
import * as storeModule from './store.js';
import * as commandRouter from './command-router.js';
import { queryAudioDevices } from './native-engine.js';
import { getInstalledAppsAndActions } from './installed-apps.js';

let httpServer = null;
let wss = null;
let pingInterval = null;
const activeClients = new Map(); // ws -> { id, ip, token, connectedAt }
let onEventCallback = null;

function setEventListener(cb) {
  onEventCallback = cb;
}

function notifyEvent(type, payload) {
  if (typeof onEventCallback === 'function') {
    try {
      onEventCallback(type, payload);
    } catch (e) {
      console.error('Error notifying event:', e);
    }
  }
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const isVirt = /vmware|virtualbox|vbox|wsl|hyper-v|vethernet|tailscale|zerotier|loopback/i.test(name);
        const isRec = !isVirt && /wi-fi|wifi|wireless|wlan|ethernet/i.test(name);
        ips.push({ interface: name, address: net.address, isRec, isVirt });
      }
    }
  }
  ips.sort((a, b) => {
    if (a.isRec && !b.isRec) return -1;
    if (!a.isRec && b.isRec) return 1;
    if (!a.isVirt && b.isVirt) return -1;
    if (a.isVirt && !b.isVirt) return 1;
    return 0;
  });
  return ips;
}

const FALLBACK_TOUCH_ICON_BASE64 = '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';
let cachedFallbackIconBuffer = null;
function getFallbackTouchIconBuffer() {
  if (!cachedFallbackIconBuffer) {
    cachedFallbackIconBuffer = Buffer.from(FALLBACK_TOUCH_ICON_BASE64, 'base64');
  }
  return cachedFallbackIconBuffer;
}

function resolveWebAsset(filename) {
  const candidates = [
    path.join(__dirname, '..', 'web', filename),
    path.join(__dirname, '..', '..', 'src', 'web', filename),
    path.join(__dirname, '..', '..', 'assets', filename),
    path.join(process.cwd(), 'src', 'web', filename),
    path.join(process.cwd(), 'decklink-server', 'src', 'web', filename),
    path.join(process.cwd(), 'assets', filename),
    path.join(process.resourcesPath || '', filename),
    path.join(process.resourcesPath || '', 'src', 'web', filename),
    path.join(process.resourcesPath || '', 'assets', filename)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    } catch (_) {}
  }
  if (/apple-touch-icon/i.test(filename) || filename === 'icon.png') {
    return getFallbackTouchIconBuffer();
  }
  return null;
}

function broadcastDeckProfile(profile, senderId) {
  if (!wss) return;
  const payload = JSON.stringify({
    type: 'deck-profile-updated',
    profile,
    senderId
  });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      const info = activeClients.get(client);
      if (!senderId || !info || info.id !== senderId) {
        try { client.send(payload); } catch (_) {}
      }
    }
  });
}

function startWebSocketServer(customPort) {
  const port = customPort || storeModule.getServerPort();

  // Create HTTP server that serves the mobile web app for phone browsers & iPads!
  httpServer = http.createServer((req, res) => {
    const reqUrl = req.url || '/';

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    if (reqUrl.startsWith('/manifest.json')) {
      const buf = resolveWebAsset('manifest.json');
      if (buf) {
        res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(buf);
        return;
      }
    }

    // Touch icons and app icons (Safari on iPad / iOS requests /apple-touch-icon.png, /apple-touch-icon-180x180.png, /apple-touch-icon-precomposed.png, etc.)
    if (/apple-touch-icon/i.test(reqUrl)) {
      const buf = resolveWebAsset('apple-touch-icon.png') || resolveWebAsset('icon.png') || resolveWebAsset('icon-512.png');
      if (buf) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buf);
        return;
      }
    }

    if (/^\/(favicon.*|icon-.*\.png)$/i.test(reqUrl)) {
      const filename = path.basename(reqUrl);
      const buf = resolveWebAsset(filename) || resolveWebAsset('icon.png') || resolveWebAsset('apple-touch-icon.png');
      if (buf) {
        const contentType = filename.endsWith('.ico') ? 'image/x-icon' : 'image/png';
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' });
        res.end(buf);
        return;
      }
    }

    // Centralized Deck Profile API (Syncs format, layout, dials, buttons everywhere)
    if (reqUrl.startsWith('/api/deck-profile')) {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const profile = JSON.parse(body);
            const saved = storeModule.saveDeckProfile(profile);
            broadcastDeckProfile(saved, 'http');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ status: 'ok', profile: saved }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      } else {
        const profile = storeModule.getDeckProfile() || {};
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(profile));
        return;
      }
    }

    if (reqUrl.startsWith('/api/info')) {
      const localIps = getLocalIPs();
      const bestIpObj = localIps.find(i => i.isRec && !i.isVirt) || localIps.find(i => !i.isVirt) || localIps[0];
      const primaryIp = bestIpObj ? bestIpObj.address : 'localhost';
      const deckUrl = `http://${primaryIp}:${port}`;
      const hostname = `${os.hostname().toLowerCase()}.local`;
      const hostnameUrl = `http://${hostname}:${port}`;

      qrcode.toDataURL(deckUrl, { width: 260, margin: 1 }, (err, qrDataUrl) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          ips: localIps,
          port,
          token: storeModule.USB_AUTO_TOKEN,
          deckUrl,
          hostname,
          hostnameUrl,
          qrDataUrl: qrDataUrl || ''
        }));
      });
      return;
    }

    if (reqUrl.startsWith('/api/audio-devices')) {
      queryAudioDevices().then((devices) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(devices));
      }).catch((e) => {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message, outputs: [], inputs: [], sessions: [], brightness: 100 }));
      });
      return;
    }

    if (reqUrl.startsWith('/api/installed-apps')) {
      try {
        const appsData = getInstalledAppsAndActions();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(appsData));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message, apps: [], appActions: [] }));
      }
      return;
    }

    try {
      const candidates = [
        path.join(__dirname, '..', 'web', 'mobile-deck.html'),
        path.join(process.cwd(), 'src', 'web', 'mobile-deck.html'),
        path.join(__dirname, 'mobile-deck.html'),
        path.join(process.resourcesPath || '', 'mobile-deck.html'),
        path.join(process.resourcesPath || '', 'src', 'web', 'mobile-deck.html')
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.end(content);
          return;
        }
      }
    } catch (e) {
      console.error('Error serving mobile web deck:', e);
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>DeckLink Server Active</h1><p>Open in mobile browser or connect from DeckLink App.</p>');
  });

  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    const localIps = getLocalIPs();
    console.log(`\n========================================`);
    console.log(`[DeckLink Server] Listening on port ${port}`);
    console.log(`Mobile Web Deck & WebSocket available at:`);
    localIps.forEach(ip => console.log(`  -> http://${ip.address}:${port}`));
    console.log(`Default Token: ${storeModule.USB_AUTO_TOKEN}`);
    console.log(`========================================\n`);
  });

  httpServer.on('error', (err) => {
    console.error(`[DeckLink Server] HTTP Server error:`, err);
  });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    let token = storeModule.USB_AUTO_TOKEN;

    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      token = parsedUrl.searchParams.get('token') || storeModule.USB_AUTO_TOKEN;
    } catch (_) {
      const match = req.url.match(/token=([^&]+)/);
      if (match) token = match[1];
    }

    if (!auth.authenticate(req)) {
      console.warn(`[DeckLink] Unauthorized connection attempt from ${clientIp}`);
      ws.close(1008, 'Unauthorized');
      return;
    }

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const clientInfo = {
      id: Math.random().toString(36).substring(2, 9),
      ip: clientIp,
      token,
      connectedAt: Date.now()
    };
    activeClients.set(ws, clientInfo);

    console.log(`[DeckLink] Device connected (${clientInfo.id}) from ${clientIp}`);
    storeModule.updateDeviceLastConnected(token);

    // Send immediate welcome handshake with installed apps and master deck profile
    const appsInfo = getInstalledAppsAndActions();
    const welcomePayload = {
      type: 'welcome',
      server: 'DeckLink PC Server',
      version: '1.0.0',
      token,
      clientId: clientInfo.id,
      timestamp: Date.now(),
      installedApps: appsInfo.apps,
      appActions: appsInfo.appActions,
      detected: appsInfo.detected,
      deckProfile: storeModule.getDeckProfile()
    };
    ws.send(JSON.stringify(welcomePayload));

    notifyEvent('client-connected', {
      ...clientInfo,
      activeCount: activeClients.size
    });

    ws.on('message', async (message) => {
      try {
        const rawStr = message.toString();
        const data = JSON.parse(rawStr);

        // Ping / Heartbeat
        if (data.type === 'ping' || data.type === 'handshake') {
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          return;
        }

        // Query Connected Audio Devices & Active Audio Sessions
        if (data.type === 'get-audio-devices') {
          const audioData = await queryAudioDevices();
          ws.send(JSON.stringify({
            id: data.id,
            type: 'audio-devices',
            data: audioData
          }));
          return;
        }

        // Query Installed Apps and App-Specific Actions
        if (data.type === 'get-installed-apps') {
          const appsData = getInstalledAppsAndActions(data.forceRefresh || false);
          ws.send(JSON.stringify({
            id: data.id,
            type: 'installed-apps',
            data: appsData
          }));
          return;
        }

        // Deck Profile synchronization (Format, dials, keys, theme)
        if (data.type === 'get-deck-profile') {
          const profile = storeModule.getDeckProfile();
          ws.send(JSON.stringify({
            id: data.id,
            type: 'deck-profile',
            profile
          }));
          return;
        }

        if (data.type === 'save-deck-profile') {
          const saved = storeModule.saveDeckProfile(data.profile);
          broadcastDeckProfile(saved, clientInfo.id);
          ws.send(JSON.stringify({
            id: data.id,
            type: 'deck-profile-saved',
            profile: saved
          }));
          return;
        }

        // Action Command
        if (data.type === 'command') {
          console.log(`[DeckLink] Executing command: ${data.action}`, data.payload);
          const response = await commandRouter.handleCommand(data);

          notifyEvent('command-executed', {
            action: data.action,
            payload: data.payload,
            status: response.status,
            client: clientInfo
          });

          ws.send(JSON.stringify({
            id: data.id,
            type: 'response',
            status: response.status,
            message: response.message
          }));
        }
      } catch (err) {
        console.error('[DeckLink] Error handling message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[DeckLink] Device disconnected (${clientInfo.id})`);
      activeClients.delete(ws);
      notifyEvent('client-disconnected', {
        ...clientInfo,
        activeCount: activeClients.size
      });
    });

    ws.on('error', (err) => {
      console.error(`[DeckLink] Client socket error:`, err);
      activeClients.delete(ws);
    });
  });

  // Keep-alive heartbeat interval every 25 seconds
  pingInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        activeClients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (_) {}
    });
  }, 25000);
}

function stopWebSocketServer() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  activeClients.clear();
}

function getConnectedClients() {
  return Array.from(activeClients.values());
}

export {
  startWebSocketServer,
  stopWebSocketServer,
  getConnectedClients,
  getLocalIPs,
  setEventListener
};

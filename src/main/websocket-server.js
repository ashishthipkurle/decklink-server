import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import os from 'os';
import * as auth from './auth.js';
import * as storeModule from './store.js';
import * as commandRouter from './command-router.js';

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
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  return ips;
}

function startWebSocketServer(customPort) {
  const port = customPort || storeModule.getServerPort();

  // Create HTTP server that serves the mobile web app for phone browsers!
  httpServer = http.createServer((req, res) => {
    try {
      const candidates = [
        path.join(__dirname, '..', 'web', 'mobile-deck.html'),
        path.join(process.cwd(), 'src', 'web', 'mobile-deck.html'),
        path.join(__dirname, 'mobile-deck.html')
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

    // Send immediate welcome handshake
    const welcomePayload = {
      type: 'welcome',
      server: 'DeckLink PC Server',
      version: '1.0.0',
      token,
      clientId: clientInfo.id,
      timestamp: Date.now()
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

/**
 * DeckLink Standalone Server
 * 
 * High-performance Node.js HTTP + WebSocket server for DeckLink companion.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { exec, execFile } = require('child_process');
const os = require('os');
const url = require('url');

// Native in-process keyboard injection for hotkeys
const { keyboard, Key } = require('@nut-tree-fork/nut-js');
keyboard.config.autoDelayMs = 25;

const PORT = 8765;
const VALID_TOKEN = 'decklink-usb-auto';

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

const nativeExe = path.join(__dirname, 'DeckLinkNative.exe');

function sendNativeArgs(args) {
  execFile(nativeExe, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
    if (err) console.error('  [Native Error]:', err.message);
    if (stdout && stdout.trim()) console.log('  [Native Out]:', stdout.trim());
  });
}

function sendNativeCommand(cmdStr) {
  const args = cmdStr.trim().split(/\s+/);
  sendNativeArgs(args);
}

// nut-js Key map
const nutKeyMap = {
  'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E, 'f': Key.F, 'g': Key.G,
  'h': Key.H, 'i': Key.I, 'j': Key.J, 'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N,
  'o': Key.O, 'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T, 'u': Key.U,
  'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y, 'z': Key.Z,
  '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3, '4': Key.Num4,
  '5': Key.Num5, '6': Key.Num6, '7': Key.Num7, '8': Key.Num8, '9': Key.Num9,
  'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4, 'f5': Key.F5, 'f6': Key.F6,
  'f7': Key.F7, 'f8': Key.F8, 'f9': Key.F9, 'f10': Key.F10, 'f11': Key.F11, 'f12': Key.F12,
  'escape': Key.Escape, 'esc': Key.Escape, 'tab': Key.Tab, 'space': Key.Space,
  'enter': Key.Return, 'return': Key.Return, 'backspace': Key.Backspace, 'delete': Key.Delete, 'del': Key.Delete,
  'up': Key.Up, 'down': Key.Down, 'left': Key.Left, 'right': Key.Right,
  'home': Key.Home, 'end': Key.End, 'pageup': Key.PageUp, 'pagedown': Key.PageDown,
  'insert': Key.Insert, 'printscreen': Key.Print, 'prntscrn': Key.Print
};

const nutModMap = {
  'ctrl': Key.LeftControl,
  'control': Key.LeftControl,
  'shift': Key.LeftShift,
  'alt': Key.LeftAlt,
  'win': Key.LeftWin,
  'windows': Key.LeftWin,
  'meta': Key.LeftWin
};

// Media Executor
async function executeMedia(payload) {
  const { action, value } = payload;
  const a = (action || '').toLowerCase();
  if (a === 'setvol' && typeof value === 'number') {
    sendNativeCommand(`setvol ${Math.round(value)}`);
    console.log(`  -> [Volume Set]: ${Math.round(value)}%`);
    return;
  }
  if (a === 'setmicvol' && typeof value === 'number') {
    sendNativeCommand(`setmicvol ${Math.round(value)}`);
    console.log(`  -> [Mic Volume Set]: ${Math.round(value)}%`);
    return;
  }
  sendNativeCommand(`media ${a}`);
  console.log('  -> [Media]: ' + a);
}

// Hotkey Executor
async function executeHotkey(payload) {
  const { modifiers = [], key: keyName = '' } = payload;
  const lowerMods = modifiers.map(m => (m || '').toLowerCase());
  const lowerKey = keyName.toLowerCase();

  // Mic Mute / Discord Mute: Ctrl + Shift + M
  if (lowerKey === 'm' && lowerMods.includes('ctrl') && lowerMods.includes('shift')) {
    sendNativeCommand('media micmute');
    console.log('  -> [Mic Mute]: Hardware Mic Muted');
    return;
  }

  // Snip Tool: Win + Shift + S
  if (lowerKey === 's' && (lowerMods.includes('win') || lowerMods.includes('meta')) && lowerMods.includes('shift')) {
    try {
      await keyboard.pressKey(Key.LeftWin, Key.LeftShift, Key.S);
      await keyboard.releaseKey(Key.LeftWin, Key.LeftShift, Key.S);
    } catch {}
    sendNativeCommand('snip');
    console.log('  -> [Hotkey] Snip Tool');
    return;
  }

  // Toggle Desktop
  if (lowerKey === 'd' && (lowerMods.includes('win') || lowerMods.includes('meta') || lowerMods.includes('windows'))) {
    sendNativeCommand('desktop');
    console.log('  -> [Hotkey] Toggle Desktop');
    return;
  }

  // Settings
  if (lowerKey === 'i' && (lowerMods.includes('win') || lowerMods.includes('meta') || lowerMods.includes('windows'))) {
    sendNativeCommand('open settings');
    console.log('  -> [Hotkey] Settings');
    return;
  }

  // File Explorer
  if (lowerKey === 'e' && (lowerMods.includes('win') || lowerMods.includes('meta') || lowerMods.includes('windows'))) {
    sendNativeCommand('open explorer.exe');
    console.log('  -> [Hotkey] File Explorer');
    return;
  }

  // Task Manager
  if ((lowerKey === 'escape' || lowerKey === 'esc') && lowerMods.includes('ctrl') && lowerMods.includes('shift')) {
    sendNativeCommand('open taskmgr.exe');
    console.log('  -> [Hotkey] Task Manager');
    return;
  }

  // Standard editor hotkeys via in-process nut-js
  const modKeys = lowerMods.map(m => nutModMap[m]).filter(Boolean);
  const mainKey = nutKeyMap[lowerKey];

  if (mainKey !== undefined) {
    try {
      for (const m of modKeys) await keyboard.pressKey(m);
      await keyboard.pressKey(mainKey);
      await keyboard.releaseKey(mainKey);
      for (const m of modKeys.slice().reverse()) await keyboard.releaseKey(m);
      console.log('  -> [Hotkey In-Process]: ' + [...modifiers, keyName].join('+'));
      return;
    } catch (err) {
      console.error('  [nut-js error]:', err.message);
    }
  }

  // Fallback
  const modVKMap = { 'ctrl': 17, 'control': 17, 'shift': 16, 'alt': 18, 'win': 91, 'windows': 91, 'meta': 91 };
  const keyVKMap = {
    'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69, 'f': 70, 'g': 71, 'h': 72, 'i': 73, 'j': 74,
    'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79, 'p': 80, 'q': 81, 'r': 82, 's': 83, 't': 84,
    'u': 85, 'v': 86, 'w': 87, 'x': 88, 'y': 89, 'z': 90,
    '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,
    'f1': 112, 'f2': 113, 'f3': 114, 'f4': 115, 'f5': 116, 'f6': 117, 'f7': 118, 'f8': 119, 'f9': 120, 'f10': 121, 'f11': 122, 'f12': 123,
    'enter': 13, 'return': 13, 'space': 32, 'tab': 9, 'escape': 27, 'esc': 27, 'backspace': 8, 'delete': 46, 'del': 46,
    'up': 38, 'down': 40, 'left': 37, 'right': 39,
    'home': 36, 'end': 35, 'pageup': 33, 'pagedown': 34, 'insert': 45, 'printscreen': 44, 'prntscrn': 44
  };
  const modVKs = lowerMods.map(m => modVKMap[m]).filter(Boolean);
  const mainVK = keyVKMap[lowerKey];
  if (mainVK) {
    const cmd = modVKs.length > 0 ? `combo ${modVKs.join(' ')} ${mainVK}` : `press ${mainVK}`;
    sendNativeCommand(cmd);
    console.log('  -> [Hotkey Native]: ' + [...modifiers, keyName].join('+'));
  }
}

// Launch Executor (Apps & URLs via DeckLinkNative)
function executeLaunch(payload) {
  const { path: appPath } = payload;
  if (!appPath) return;
  const trimmed = appPath.trim();
  sendNativeArgs(['open', trimmed]);
  console.log('  -> [Launched]: ' + trimmed);
}

// Text Macro Executor
async function executeMacro(payload) {
  const { text, pressEnter } = payload;
  if (!text) return;
  try {
    await keyboard.type(text);
    if (pressEnter) {
      await keyboard.pressKey(Key.Return);
      await keyboard.releaseKey(Key.Return);
    }
    console.log('  -> [Macro Typed]: "' + text.substring(0, 30) + '..."' + (pressEnter ? ' + Enter' : ''));
  } catch (err) {
    sendNativeArgs(['macro', text]);
    if (pressEnter) {
      sendNativeCommand('press 13');
    }
  }
}

// System Executor
function executeSystem(payload) {
  const { action } = payload;
  if (action === 'desktop') {
    sendNativeCommand('desktop');
    console.log('  -> [System]: Toggle Desktop');
    return;
  }
  if (action === 'snip') {
    sendNativeCommand('snip');
    console.log('  -> [System]: Snip Tool');
    return;
  }
  if (action === 'taskmgr') {
    sendNativeCommand('open taskmgr.exe');
    console.log('  -> [System]: Task Manager');
    return;
  }
  if (action === 'sleep') {
    sendNativeCommand('sleep');
    exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"');
    console.log('  -> [System]: Sleep PC');
    return;
  }
  const commands = {
    lock: 'rundll32.exe user32.dll,LockWorkStation',
    shutdown: 'shutdown /s /t 0',
  };
  const cmd = commands[action];
  if (!cmd) return;
  exec(cmd, (err) => {
    if (err) console.error('  -> [System Error]:', err.message);
    else console.log('  -> [System]: ' + action);
  });
}

// Command Router
async function handleCommand(data) {
  const { action, payload = {} } = data;
  console.log(`[CMD] action="${action}", payload=`, JSON.stringify(payload));
  switch (action) {
    case 'desktop': sendNativeCommand('desktop'); return { status: 'ok' };
    case 'snip': sendNativeCommand('snip'); return { status: 'ok' };
    case 'media': await executeMedia(payload); return { status: 'ok' };
    case 'hotkey': await executeHotkey(payload); return { status: 'ok' };
    case 'launch': executeLaunch(payload); return { status: 'ok' };
    case 'macro': await executeMacro(payload); return { status: 'ok' };
    case 'system': executeSystem(payload); return { status: 'ok' };
    case 'run':
      if (payload.command) {
        exec(payload.command, (err) => {
          if (err) console.error('  -> [Run Error]:', err.message);
          else console.log('  -> [Run]:', payload.command);
        });
      }
      return { status: 'ok' };
    case 'obs': return { status: 'warning', message: 'OBS not configured in standalone mode' };
    default:
      console.warn('  -> Unknown action: ' + action);
      return { status: 'error', message: 'Unknown action: ' + action };
  }
}

// HTTP Server: Serves the mobile web UI and API info
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/manifest.json') {
    const manifestPath = path.join(__dirname, 'src', 'web', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
      res.end(fs.readFileSync(manifestPath));
      return;
    }
  }

  if (parsed.pathname === '/api/info') {
    const localIps = getLocalIPs();
    const primaryIp = localIps.length > 0 ? localIps[0].address : 'localhost';
    const deckUrl = `http://${primaryIp}:${PORT}`;
    
    let qrcodeModule = null;
    try { qrcodeModule = require('qrcode'); } catch (_) {}

    if (qrcodeModule) {
      qrcodeModule.toDataURL(deckUrl, { width: 260, margin: 1 }, (err, qrDataUrl) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          ips: localIps,
          port: PORT,
          token: VALID_TOKEN,
          deckUrl,
          qrDataUrl: qrDataUrl || ''
        }));
      });
      return;
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        ips: localIps,
        port: PORT,
        token: VALID_TOKEN,
        deckUrl,
        qrDataUrl: ''
      }));
      return;
    }
  }

  try {
    const htmlPath = path.join(__dirname, 'src', 'web', 'mobile-deck.html');
    if (fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(content);
      return;
    }
  } catch (err) {
    console.error('Error reading mobile-deck.html:', err.message);
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>DeckLink Server Active</h1><p>Open on phone or launch DeckLink app.</p>');
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  let token = VALID_TOKEN;

  try {
    const parsedUrl = url.parse(req.url, true);
    token = parsedUrl.query.token || VALID_TOKEN;
  } catch (_) {}

  console.log(`\n[CONNECTED] Phone connected from ${clientIp}!`);
  
  ws.send(JSON.stringify({
    type: 'welcome',
    server: 'DeckLink Standalone Server',
    version: '2.0.0',
    status: 'connected',
    token: token,
    timestamp: Date.now()
  }));

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'ping' || data.type === 'handshake') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      if (data.type === 'command') {
        const response = await handleCommand(data);
        ws.send(JSON.stringify({
          id: data.id,
          type: 'response',
          status: response.status,
          message: response.message || 'ok',
        }));
      }
    } catch (err) {
      console.error('[ERROR] Failed to handle message:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('[DISCONNECTED] Phone disconnected');
  });

  ws.on('error', (err) => {
    console.error('[SOCKET ERROR]', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIPs();
  console.log('');
  console.log('====================================================');
  console.log('       🔥 DeckLink PC Companion is READY! 🔥        ');
  console.log('====================================================');
  console.log(`Port:        ${PORT}`);
  console.log(`Auth Token:  ${VALID_TOKEN}`);
  console.log('');
  console.log('📱 OPEN THIS LINK ON YOUR PHONE (No install needed!):');
  localIps.forEach(net => {
    console.log(`   👉 http://${net.address}:${PORT}`);
  });
  console.log('');
  console.log('Waiting for phone to connect (WiFi or USB)...');
  console.log('====================================================\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${PORT} is already in use!`);
  } else {
    console.error('[ERROR] Server error:', err.message);
  }
});

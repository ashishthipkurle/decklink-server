import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

// A hardcoded USB token that both the server and app know.
// This removes the need for manual pairing over USB.
const USB_AUTO_TOKEN = 'decklink-usb-auto';

const defaultData = {
  server: {
    port: 8765
  },
  pairing: {
    devices: [
      {
        id: 'usb-auto-device',
        name: 'USB Direct',
        token: USB_AUTO_TOKEN,
        pairedAt: Date.now(),
        lastConnectedAt: null
      }
    ]
  },
  obs: {
    host: 'localhost',
    port: 4455,
    password: ''
  }
};

let configPath = null;
function getConfigPath() {
  if (!configPath) {
    try {
      configPath = path.join(app.getPath('userData'), 'decklink-config.json');
    } catch {
      configPath = path.join(process.cwd(), 'decklink-config.json');
    }
  }
  return configPath;
}

let cache = null;
function loadConfig() {
  if (cache) return cache;
  const p = getConfigPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      cache = JSON.parse(raw);
    } else {
      cache = JSON.parse(JSON.stringify(defaultData));
      saveConfig();
    }
  } catch (err) {
    console.error('[Store] Failed to read config:', err);
    cache = JSON.parse(JSON.stringify(defaultData));
  }
  return cache;
}

function saveConfig() {
  if (!cache) return;
  const p = getConfigPath();
  try {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save config:', err);
  }
}

const store = {
  get(keyPath, defaultValue) {
    const data = loadConfig();
    const parts = keyPath.split('.');
    let cur = data;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object') return defaultValue;
      cur = cur[part];
    }
    return cur !== undefined ? cur : defaultValue;
  },
  set(keyPath, value) {
    const data = loadConfig();
    const parts = keyPath.split('.');
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (cur[part] == null || typeof cur[part] !== 'object') {
        cur[part] = {};
      }
      cur = cur[part];
    }
    cur[parts[parts.length - 1]] = value;
    saveConfig();
  }
};

// Ensure the USB auto device always exists
function ensureUsbDevice() {
  const devices = store.get('pairing.devices', []);
  const hasUsb = devices.some(d => d.token === USB_AUTO_TOKEN);
  if (!hasUsb) {
    devices.push({
      id: 'usb-auto-device',
      name: 'USB Direct',
      token: USB_AUTO_TOKEN,
      pairedAt: Date.now(),
      lastConnectedAt: null
    });
    store.set('pairing.devices', devices);
  }
}

function getPairedDevices() {
  return store.get('pairing.devices', []);
}

function addPairedDevice(name, token) {
  const devices = getPairedDevices();
  const newDevice = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    name,
    token,
    pairedAt: Date.now(),
    lastConnectedAt: null
  };
  devices.push(newDevice);
  store.set('pairing.devices', devices);
  return newDevice;
}

function removePairedDevice(id) {
  const devices = getPairedDevices();
  const updated = devices.filter(d => d.id !== id);
  store.set('pairing.devices', updated);
}

function updateDeviceLastConnected(token) {
  const devices = getPairedDevices();
  const device = devices.find(d => d.token === token);
  if (device) {
    device.lastConnectedAt = Date.now();
    store.set('pairing.devices', devices);
  }
}

function isTokenValid(token) {
  const devices = getPairedDevices();
  return devices.some(d => d.token === token);
}

function getServerPort() {
  return store.get('server.port', 8765);
}

function getAutoStart() {
  return Boolean(store.get('server.autoStart', false));
}

function setAutoStart(val) {
  store.set('server.autoStart', Boolean(val));
  return Boolean(val);
}

function getDeckProfile() {
  return store.get('deckProfile', null);
}

function saveDeckProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const current = store.get('deckProfile', {}) || {};
  const merged = {
    ...current,
    ...profile,
    updatedAt: Date.now()
  };
  store.set('deckProfile', merged);
  console.log('[Store] Deck profile saved. Keys count:', Object.keys(merged.keys || {}).length);
  return merged;
}

export {
  store,
  USB_AUTO_TOKEN,
  ensureUsbDevice,
  getPairedDevices,
  addPairedDevice,
  removePairedDevice,
  updateDeviceLastConnected,
  isTokenValid,
  getServerPort,
  getAutoStart,
  setAutoStart,
  getDeckProfile,
  saveDeckProfile
};

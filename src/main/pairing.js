import qrcode from 'qrcode';
import crypto from 'crypto';
import os from 'os';
import * as storeModule from './store.js';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function startPairingSession() {
  const pin = generatePin();
  const token = generateToken();
  const ip = getLocalIp();
  const port = storeModule.getServerPort();
  
  // URL to connect to the WebSocket server directly with token
  const wsUrl = `ws://${ip}:${port}/?token=${token}`;
  
  try {
    const qrDataUrl = await qrcode.toDataURL(wsUrl);
    return {
      pin,
      token,
      wsUrl,
      qrDataUrl
    };
  } catch (err) {
    console.error('Failed to generate QR code', err);
    throw err;
  }
}

function confirmPairing(deviceName, token) {
  storeModule.addPairedDevice(deviceName, token);
}

export {
  startPairingSession,
  confirmPairing
};

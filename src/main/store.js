import StoreModule from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const Store = StoreModule.default || StoreModule;

// A hardcoded USB token that both the server and app know.
// This removes the need for manual pairing over USB.
const USB_AUTO_TOKEN = 'decklink-usb-auto';

const store = new Store({
  projectName: 'decklink-server',
  name: 'decklink-config',
  cwd: path.resolve(__dirname, '..', '..', '.config'),
  defaults: {
    server: {
      port: 8765
    },
    pairing: {
      devices: [
        // Pre-register the USB auto-connect device
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
  }
});

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
    id: uuidv4(),
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

export {
  store,
  USB_AUTO_TOKEN,
  ensureUsbDevice,
  getPairedDevices,
  addPairedDevice,
  removePairedDevice,
  updateDeviceLastConnected,
  isTokenValid,
  getServerPort
};

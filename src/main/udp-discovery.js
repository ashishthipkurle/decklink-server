import dgram from 'dgram';
import os from 'os';
import * as storeModule from './store.js';

let udpSocket = null;

export function startUdpDiscovery(httpPort = 8765, discoveryPort = 8766) {
  try {
    udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    udpSocket.on('error', (err) => {
      console.warn('[UDP Discovery] Socket warning:', err.message);
    });

    udpSocket.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (text.includes('decklink_discover') || text.includes('ping')) {
        const payload = JSON.stringify({
          service: 'decklink',
          name: os.hostname(),
          hostname: `${os.hostname().toLowerCase()}.local`,
          port: httpPort,
          token: storeModule.USB_AUTO_TOKEN,
          timestamp: Date.now()
        });

        const buf = Buffer.from(payload);
        udpSocket.send(buf, 0, buf.length, rinfo.port, rinfo.address, (err) => {
          if (err) console.warn('[UDP Discovery] Send error:', err.message);
        });
      }
    });

    udpSocket.bind(discoveryPort, () => {
      try {
        udpSocket.setBroadcast(true);
      } catch (_) {}
      console.log(`[UDP Discovery] Listening on UDP port ${discoveryPort} for auto-discovery beacons`);
    });
  } catch (err) {
    console.warn('[UDP Discovery] Could not start UDP discovery:', err.message);
  }
}

export function stopUdpDiscovery() {
  if (udpSocket) {
    try {
      udpSocket.close();
    } catch (_) {}
    udpSocket = null;
  }
}


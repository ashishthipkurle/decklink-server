import dgram from 'dgram';
import os from 'os';
import * as storeModule from './store.js';
import { getLocalIPs } from './websocket-server.js';

let udpSocket = null;
let beaconTimer = null;

function getBestIp() {
  try {
    const ips = getLocalIPs();
    const best = ips.find(i => i.isRec && !i.isVirt) || ips.find(i => !i.isVirt) || ips[0];
    return best ? best.address : '';
  } catch (_) {
    return '';
  }
}

export function startUdpDiscovery(httpPort = 8765, discoveryPort = 8766) {
  try {
    udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    udpSocket.on('error', (err) => {
      console.warn('[UDP Discovery] Socket warning:', err.message);
    });

    udpSocket.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (text.includes('decklink_discover') || text.includes('ping')) {
        const currentIp = getBestIp();
        const payload = JSON.stringify({
          service: 'decklink',
          name: os.hostname(),
          hostname: `${os.hostname().toLowerCase()}.local`,
          ip: currentIp,
          port: httpPort,
          token: storeModule.USB_AUTO_TOKEN,
          timestamp: Date.now()
        });

        const buf = Buffer.from(payload);
        udpSocket.send(buf, 0, buf.length, rinfo.port, rinfo.address, (err) => {
          if (err) console.warn('[UDP Discovery] Send response error:', err.message);
        });
      }
    });

    udpSocket.bind(discoveryPort, () => {
      try {
        udpSocket.setBroadcast(true);
      } catch (_) {}
      console.log(`[UDP Discovery] Listening on UDP port ${discoveryPort} for auto-discovery beacons`);

      // Active Heartbeat Beacon: Broadcasts PC IP every 2.5 seconds so mobile hotspot phone connects immediately!
      function sendHeartbeat() {
        if (!udpSocket) return;
        const currentIp = getBestIp();
        if (!currentIp) return;

        const payload = JSON.stringify({
          service: 'decklink',
          name: os.hostname(),
          hostname: `${os.hostname().toLowerCase()}.local`,
          ip: currentIp,
          port: httpPort,
          token: storeModule.USB_AUTO_TOKEN,
          timestamp: Date.now()
        });
        const buf = Buffer.from(payload);

        // 1. General broadcast
        try {
          udpSocket.send(buf, 0, buf.length, discoveryPort, '255.255.255.255');
        } catch (_) {}

        // 2. Specific subnet broadcast (e.g. 10.197.31.255, 192.168.43.255)
        try {
          const ips = getLocalIPs();
          for (const net of ips) {
            if (!net.isVirt && net.address && net.address.includes('.')) {
              const parts = net.address.split('.');
              if (parts.length === 4) {
                const subBcast = `${parts[0]}.${parts[1]}.${parts[2]}.255`;
                udpSocket.send(buf, 0, buf.length, discoveryPort, subBcast);
              }
            }
          }
        } catch (_) {}
      }

      beaconTimer = setInterval(sendHeartbeat, 2500);
      sendHeartbeat();
    });
  } catch (err) {
    console.warn('[UDP Discovery] Could not start UDP discovery:', err.message);
  }
}

export function stopUdpDiscovery() {
  if (beaconTimer) {
    clearInterval(beaconTimer);
    beaconTimer = null;
  }
  if (udpSocket) {
    try {
      udpSocket.close();
    } catch (_) {}
    udpSocket = null;
  }
}

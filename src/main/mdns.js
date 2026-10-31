import { Bonjour } from 'bonjour-service';
import os from 'os';

const bonjour = new Bonjour();
let publishedService = null;

function startMDNSBroadcast(port) {
  const hostname = os.hostname();
  
  publishedService = bonjour.publish({ 
    name: `DeckLink Server (${hostname})`, 
    type: 'decklink', 
    port: port,
    txt: { 
      device: hostname,
      os: os.platform()
    } 
  });
  
  console.log(`mDNS broadcast started: DeckLink Server on port ${port}`);
}

function stopMDNSBroadcast() {
  if (publishedService) {
    publishedService.stop();
    publishedService = null;
    console.log('mDNS broadcast stopped');
  }
}

export {
  startMDNSBroadcast,
  stopMDNSBroadcast
};

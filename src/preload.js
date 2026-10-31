const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('decklinkApi', {
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  testAction: (action, payload) => ipcRenderer.invoke('test-action', { action, payload }),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  openDeckBrowser: (url) => ipcRenderer.invoke('open-deck-browser', url),
  onServerEvent: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('server-event', handler);
    return () => ipcRenderer.removeListener('server-event', handler);
  }
});

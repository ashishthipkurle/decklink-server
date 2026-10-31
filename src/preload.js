const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('decklinkApi', {
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  testAction: (action, payload) => ipcRenderer.invoke('test-action', { action, payload }),
  onServerEvent: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('server-event', handler);
    return () => ipcRenderer.removeListener('server-event', handler);
  }
});

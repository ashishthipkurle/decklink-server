const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
import * as pairing from './pairing.js';

let tray = null;
let settingsWindow = null;

function getPreloadPath() {
  const candidates = [
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, '..', 'preload.js'),
    path.join(__dirname, 'build', 'preload.js')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, 'preload.js');
}

function createSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 620,
    minHeight: 560,
    title: 'DeckLink PC Server',
    backgroundColor: '#f6f5fb',
    webPreferences: {
      preload: getPreloadPath()
    },
    autoHideMenuBar: true
  });

  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else if (typeof MAIN_WINDOW_VITE_NAME !== 'undefined') {
    settingsWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  } else {
    settingsWindow.loadFile(path.join(__dirname, '..', '..', 'index.html'));
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

function getSettingsWindow() {
  return settingsWindow;
}

function setupTray() {
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'tray-icon.ico'));
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'DeckLink Server (Running)', enabled: false },
    { type: 'separator' },
    { 
      label: 'Open Dashboard', 
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit DeckLink', 
      click: () => { app.quit(); } 
    }
  ]);

  tray.setToolTip('DeckLink Server - Stream Deck Companion');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    createSettingsWindow();
  });
  tray.on('double-click', () => {
    createSettingsWindow();
  });
}

export {
  setupTray,
  createSettingsWindow,
  getSettingsWindow
};

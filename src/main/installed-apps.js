import fs from 'fs';
import path from 'path';

// Helper to recursively find .lnk files safely
function findLnkFiles(dir, maxDepth = 4, curDepth = 0) {
  if (curDepth > maxDepth) return [];
  const results = [];
  try {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        results.push(...findLnkFiles(full, maxDepth, curDepth + 1));
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.lnk')) {
        results.push(full);
      }
    }
  } catch (_) {}
  return results;
}

// Map app names to icons & categories
function mapAppMetadata(name) {
  const n = name.toLowerCase();

  // Browsers
  if (/chrome/i.test(n)) return { category: 'Web', icon: 'globe', color: ['#ff5370', '#ff869a'] };
  if (/brave/i.test(n)) return { category: 'Web', icon: 'globe', color: ['#ff6a00', '#ee0979'] };
  if (/edge/i.test(n)) return { category: 'Web', icon: 'globe', color: ['#0078d7', '#00b4d8'] };
  if (/firefox/i.test(n)) return { category: 'Web', icon: 'globe', color: ['#ff9472', '#f2709c'] };

  // Chat & Social
  if (/discord/i.test(n)) return { category: 'Chat and social', icon: 'chat', color: ['#5865F2', '#8c52ff'], uri: 'discord://' };
  if (/whatsapp/i.test(n)) return { category: 'Chat and social', icon: 'chat', color: ['#25D366', '#128C7E'] };
  if (/telegram/i.test(n)) return { category: 'Chat and social', icon: 'chat', color: ['#0088cc', '#00b4d8'] };
  if (/slack/i.test(n)) return { category: 'Chat and social', icon: 'chat', color: ['#4A154B', '#611f69'] };
  if (/teams/i.test(n)) return { category: 'Chat and social', icon: 'chat', color: ['#6264A7', '#464775'] };
  if (/zoom/i.test(n)) return { category: 'Chat and social', icon: 'cam', color: ['#2D8CFF', '#0E71EB'] };

  // Streaming & Video
  if (/obs studio/i.test(n) || n === 'obs') return { category: 'Streaming', icon: 'live', color: ['#302b63', '#24243e'] };
  if (/vlc/i.test(n)) return { category: 'Media', icon: 'play', color: ['#ff7700', '#ffaa00'] };
  if (/spotify/i.test(n)) return { category: 'Media', icon: 'wave', color: ['#1DB954', '#191414'], uri: 'spotify:' };

  // Gaming
  if (/steam/i.test(n)) return { category: 'Apps', icon: 'game', color: ['#171a21', '#66c0f4'], uri: 'steam://open/main' };
  if (/epic games/i.test(n)) return { category: 'Apps', icon: 'game', color: ['#313131', '#0078f2'] };
  if (/fall guys/i.test(n)) return { category: 'Apps', icon: 'game', color: ['#ff2a85', '#ffbe0b'] };
  if (/rocket league/i.test(n)) return { category: 'Apps', icon: 'game', color: ['#0088ff', '#ffaa00'] };
  if (/pubg/i.test(n)) return { category: 'Apps', icon: 'game', color: ['#f39c12', '#d35400'] };

  // Dev & Productivity
  if (/code|vs code|visual studio code/i.test(n)) return { category: 'Developer', icon: 'term', color: ['#007acc', '#0062a3'] };
  if (/android studio/i.test(n)) return { category: 'Developer', icon: 'term', color: ['#3ddc84', '#073042'] };
  if (/antigravity/i.test(n)) return { category: 'Developer', icon: 'star', color: ['#8a2be2', '#4b0082'] };
  if (/terminal|powershell|command prompt/i.test(n)) return { category: 'System', icon: 'term', color: ['#434343', '#000000'] };
  if (/word/i.test(n)) return { category: 'Apps', icon: 'doc', color: ['#2b579a', '#124078'] };
  if (/excel/i.test(n)) return { category: 'Apps', icon: 'doc', color: ['#217346', '#105230'] };
  if (/powerpoint/i.test(n)) return { category: 'Apps', icon: 'screen', color: ['#d24726', '#b0351b'] };
  if (/onenote/i.test(n)) return { category: 'Apps', icon: 'doc', color: ['#80397b', '#60245a'] };
  if (/calculator/i.test(n)) return { category: 'System', icon: 'calc', color: ['#0078d7', '#005a9e'] };
  if (/notepad/i.test(n)) return { category: 'System', icon: 'doc', color: ['#0078d7', '#005a9e'] };
  if (/settings/i.test(n)) return { category: 'System', icon: 'bulb', color: ['#6875f5', '#4f46e5'] };
  if (/paint/i.test(n)) return { category: 'Apps', icon: 'star', color: ['#ff7700', '#ff0077'] };

  return { category: 'Apps', icon: 'folder', color: ['#6a8bff', '#8c52ff'] };
}

let cachedScan = null;
let lastScanTime = 0;

export function getInstalledAppsAndActions(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedScan && (now - lastScanTime < 60000)) {
    return cachedScan;
  }

  const appMap = new Map(); // key -> appObj

  // 1. Built-in standard Windows apps that are always available
  const builtIns = [
    { name: 'Calculator', path: 'calc.exe', category: 'System', icon: 'calc', color: ['#0078d7', '#005a9e'] },
    { name: 'Notepad', path: 'notepad.exe', category: 'System', icon: 'doc', color: ['#0078d7', '#005a9e'] },
    { name: 'File Explorer', path: 'explorer.exe', category: 'System', icon: 'folder', color: ['#f39c12', '#e67e22'] },
    { name: 'Task Manager', path: 'taskmgr.exe', category: 'System', icon: 'screen', color: ['#2ecc71', '#27ae60'] },
    { name: 'Settings', path: 'ms-settings:', category: 'System', icon: 'bulb', color: ['#6875f5', '#4f46e5'] },
    { name: 'Terminal', path: 'wt.exe', category: 'System', icon: 'term', color: ['#434343', '#000000'] },
    { name: 'Snipping Tool', path: 'snippingtool.exe', category: 'System', icon: 'cam', color: ['#9b59b6', '#8e44ad'] },
    { name: 'Paint', path: 'mspaint.exe', category: 'Apps', icon: 'star', color: ['#e91e63', '#c2185b'] }
  ];

  for (const b of builtIns) {
    appMap.set(b.name.toLowerCase(), {
      id: `builtin:${b.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: b.name,
      path: b.path,
      category: b.category,
      icon: b.icon,
      color: b.color,
      isBuiltIn: true
    });
  }

  // 2. Scan Start Menu Shortcuts (.lnk)
  const junkRegex = /uninstall|remove|readme|help|manual|documentation|license|website|web link|troubleshoot|diagnost|setup|install additional|filter console|test \(win\)|check for update|about |reset preferences|release notes|gpl|license|\.pdf|\.txt|\.hlp|\.chm/i;

  const searchDirs = [
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.ProgramData || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ];

  for (const dir of searchDirs) {
    const lnks = findLnkFiles(dir);
    for (const lnk of lnks) {
      const base = path.basename(lnk, '.lnk');
      if (junkRegex.test(base)) continue;

      const norm = base.trim();
      const key = norm.toLowerCase();

      // Don't overwrite if already detected with higher priority
      if (appMap.has(key)) continue;

      const meta = mapAppMetadata(norm);
      appMap.set(key, {
        id: `lnk:${key.replace(/[^a-z0-9]+/g, '-')}`,
        name: norm,
        path: meta.uri || lnk,
        actualPath: lnk,
        category: meta.category,
        icon: meta.icon,
        color: meta.color
      });
    }
  }

  // 3. Scan Epic Games Manifests (Fall Guys, Rocket League, PUBG, etc.)
  try {
    const epicManifestDir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
    if (fs.existsSync(epicManifestDir)) {
      const items = fs.readdirSync(epicManifestDir).filter(f => f.endsWith('.item'));
      for (const itemFile of items) {
        try {
          const raw = fs.readFileSync(path.join(epicManifestDir, itemFile), 'utf8');
          const data = JSON.parse(raw);
          if (data.DisplayName && data.AppName) {
            const gameName = data.DisplayName.replace(/®|™/g, '').trim();
            const gameKey = gameName.toLowerCase();
            const launchUri = `com.epicgames.launcher://apps/${data.AppName}?action=launch&silent=true`;
            let exePath = '';
            if (data.InstallLocation && data.LaunchExecutable) {
              exePath = path.join(data.InstallLocation, data.LaunchExecutable);
            }
            appMap.set(gameKey, {
              id: `epic:${data.AppName}`,
              name: gameName,
              path: launchUri,
              actualPath: exePath || launchUri,
              category: 'Apps',
              icon: 'game',
              color: ['#ff2a85', '#ffbe0b']
            });
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // 4. Scan Steam Games
  try {
    const steamDirs = [
      'C:\\Program Files (x86)\\Steam\\steamapps',
      'C:\\Program Files\\Steam\\steamapps',
      'D:\\SteamLibrary\\steamapps',
      'I:\\SteamLibrary\\steamapps'
    ];
    for (const sDir of steamDirs) {
      if (fs.existsSync(sDir)) {
        const manifests = fs.readdirSync(sDir).filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));
        for (const m of manifests) {
          try {
            const content = fs.readFileSync(path.join(sDir, m), 'utf8');
            const nameMatch = content.match(/"name"\s+"([^"]+)"/);
            const appidMatch = content.match(/"appid"\s+"([^"]+)"/);
            if (nameMatch && appidMatch) {
              const gameName = nameMatch[1].trim();
              const appId = appidMatch[1];
              const gameKey = gameName.toLowerCase();
              appMap.set(gameKey, {
                id: `steam:${appId}`,
                name: gameName,
                path: `steam://run/${appId}`,
                actualPath: `steam://run/${appId}`,
                category: 'Apps',
                icon: 'game',
                color: ['#171a21', '#66c0f4']
              });
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  // 5. Special direct checks for Discord, OBS, Spotify, Steam if not caught
  if (!appMap.has('discord')) {
    const discordLocal = path.join(process.env.LOCALAPPDATA || '', 'Discord');
    if (fs.existsSync(discordLocal)) {
      appMap.set('discord', {
        id: 'lnk:discord',
        name: 'Discord',
        path: 'discord://',
        actualPath: 'discord://',
        category: 'Chat and social',
        icon: 'chat',
        color: ['#5865F2', '#8c52ff']
      });
    }
  }

  if (!appMap.has('obs studio') && !appMap.has('obs')) {
    const obsExe = 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe';
    if (fs.existsSync(obsExe)) {
      appMap.set('obs studio', {
        id: 'lnk:obs-studio',
        name: 'OBS Studio',
        path: obsExe,
        actualPath: obsExe,
        category: 'Streaming',
        icon: 'live',
        color: ['#302b63', '#24243e']
      });
    }
  }

  // Convert map to sorted list
  const appsList = Array.from(appMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // 6. Detect which app-specific actions should be exposed based on installed apps!
  const hasOBS = appsList.some(a => /obs/i.test(a.name));
  const hasDiscord = appsList.some(a => /discord/i.test(a.name));
  const hasSpotify = appsList.some(a => /spotify/i.test(a.name));
  const hasSteam = appsList.some(a => /steam/i.test(a.name));
  const hasBrowser = appsList.some(a => /chrome|brave|edge|firefox/i.test(a.name));
  const hasVLC = appsList.some(a => /vlc/i.test(a.name));

  const appActions = [];

  // OBS actions (only if OBS is installed)
  if (hasOBS) {
    appActions.push(
      { id: 'Streaming:OBS: Start streaming', n: 'OBS: Start streaming', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'live' },
      { id: 'Streaming:OBS: Stop streaming', n: 'OBS: Stop streaming', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'live' },
      { id: 'Streaming:OBS: Start recording', n: 'OBS: Start recording', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'film' },
      { id: 'Streaming:OBS: Stop recording', n: 'OBS: Stop recording', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'film' },
      { id: 'Streaming:OBS: Pause or resume recording', n: 'OBS: Pause or resume recording', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'pause' },
      { id: 'Streaming:OBS: Switch scene', n: 'OBS: Switch scene', c: 'Streaming', ph: 'Scene name', app: 'OBS Studio', icon: 'folder' },
      { id: 'Streaming:OBS: Show or hide source', n: 'OBS: Show or hide source', c: 'Streaming', ph: 'Source name', app: 'OBS Studio', icon: 'screen' },
      { id: 'Streaming:OBS: Mute or unmute source', n: 'OBS: Mute or unmute source', c: 'Streaming', ph: 'Source name', app: 'OBS Studio', icon: 'mic' },
      { id: 'Streaming:OBS: Set source volume', n: 'OBS: Set source volume', c: 'Streaming', ph: 'Source name and percent', app: 'OBS Studio', icon: 'wave' },
      { id: 'Streaming:OBS: Start replay buffer', n: 'OBS: Start replay buffer', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'play' },
      { id: 'Streaming:OBS: Save replay', n: 'OBS: Save replay', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'star' },
      { id: 'Streaming:OBS: Toggle studio mode', n: 'OBS: Toggle studio mode', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'screen' },
      { id: 'Streaming:OBS: Start virtual camera', n: 'OBS: Start virtual camera', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'cam' },
      { id: 'Streaming:OBS: Stop virtual camera', n: 'OBS: Stop virtual camera', c: 'Streaming', ph: null, app: 'OBS Studio', icon: 'cam' }
    );
  }

  // Discord actions (only if Discord is installed)
  if (hasDiscord) {
    appActions.push(
      { id: 'Chat and social:Discord: Toggle mute', n: 'Discord: Toggle mute', c: 'Chat and social', ph: null, app: 'Discord', icon: 'mic' },
      { id: 'Chat and social:Discord: Toggle deafen', n: 'Discord: Toggle deafen', c: 'Chat and social', ph: null, app: 'Discord', icon: 'head' },
      { id: 'Chat and social:Discord: Push to talk', n: 'Discord: Push to talk', c: 'Chat and social', ph: null, app: 'Discord', icon: 'mic' },
      { id: 'Chat and social:Discord: Join voice channel', n: 'Discord: Join voice channel', c: 'Chat and social', ph: 'Channel link or name', app: 'Discord', icon: 'chat' },
      { id: 'Chat and social:Discord: Leave voice channel', n: 'Discord: Leave voice channel', c: 'Chat and social', ph: null, app: 'Discord', icon: 'chat' },
      { id: 'Chat and social:Discord: Send message', n: 'Discord: Send message', c: 'Chat and social', ph: 'Message to send', app: 'Discord', icon: 'chat' },
      { id: 'Chat and social:Discord: Toggle overlay', n: 'Discord: Toggle overlay', c: 'Chat and social', ph: null, app: 'Discord', icon: 'screen' }
    );
  }

  // Spotify actions (only if Spotify is installed)
  if (hasSpotify) {
    appActions.push(
      { id: 'Media:Spotify: Play or pause', n: 'Spotify: Play or pause', c: 'Media', ph: null, app: 'Spotify', icon: 'play' },
      { id: 'Media:Spotify: Next track', n: 'Spotify: Next track', c: 'Media', ph: null, app: 'Spotify', icon: 'step' },
      { id: 'Media:Spotify: Previous track', n: 'Spotify: Previous track', c: 'Media', ph: null, app: 'Spotify', icon: 'step' }
    );
  }

  // Steam actions (only if Steam is installed)
  if (hasSteam) {
    appActions.push(
      { id: 'Games:Steam: Launch game', n: 'Steam: Launch game', c: 'Apps', ph: 'App ID or name', app: 'Steam', icon: 'game' },
      { id: 'Games:Steam: Open Friends', n: 'Steam: Open Friends', c: 'Apps', ph: null, app: 'Steam', icon: 'chat' },
      { id: 'Games:Steam: Big Picture mode', n: 'Steam: Big Picture mode', c: 'Apps', ph: null, app: 'Steam', icon: 'screen' }
    );
  }

  // Browser actions (if Chrome, Brave, Edge, etc. installed)
  if (hasBrowser) {
    appActions.push(
      { id: 'Web:Browser: New tab', n: 'Browser: New tab', c: 'Web', ph: null, app: 'Browser', icon: 'globe' },
      { id: 'Web:Browser: Close tab', n: 'Browser: Close tab', c: 'Web', ph: null, app: 'Browser', icon: 'x' },
      { id: 'Web:Browser: Next tab', n: 'Browser: Next tab', c: 'Web', ph: null, app: 'Browser', icon: 'step' },
      { id: 'Web:Browser: Reopen closed tab', n: 'Browser: Reopen closed tab', c: 'Web', ph: null, app: 'Browser', icon: 'clock' },
      { id: 'Web:Browser: Incognito window', n: 'Browser: Incognito window', c: 'Web', ph: null, app: 'Browser', icon: 'screen' }
    );
  }

  // VLC actions (if VLC installed)
  if (hasVLC) {
    appActions.push(
      { id: 'Media:VLC: Play or pause', n: 'VLC: Play or pause', c: 'Media', ph: null, app: 'VLC', icon: 'play' },
      { id: 'Media:VLC: Fullscreen', n: 'VLC: Fullscreen', c: 'Media', ph: null, app: 'VLC', icon: 'screen' },
      { id: 'Media:VLC: Mute', n: 'VLC: Mute', c: 'Media', ph: null, app: 'VLC', icon: 'wave' }
    );
  }

  cachedScan = {
    apps: appsList,
    appActions,
    detected: {
      hasOBS,
      hasDiscord,
      hasSpotify,
      hasSteam,
      hasBrowser,
      hasVLC
    },
    count: appsList.length,
    timestamp: now
  };
  lastScanTime = now;

  return cachedScan;
}


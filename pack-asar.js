const asar = require('@electron/asar');
const fs = require('fs');
const path = require('path');

async function pack() {
  const root = __dirname;
  const stage = path.join(root, '.asar-stage');
  if (fs.existsSync(stage)) {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  fs.mkdirSync(stage, { recursive: true });

  // 1. Copy package.json
  fs.copyFileSync(path.join(root, 'package.json'), path.join(stage, 'package.json'));

  // 2. Copy .vite recursively
  fs.cpSync(path.join(root, '.vite'), path.join(stage, '.vite'), { recursive: true });

  // 3. Copy src/web and assets into stage so they are available inside app.asar
  if (fs.existsSync(path.join(root, 'src', 'web'))) {
    fs.cpSync(path.join(root, 'src', 'web'), path.join(stage, 'src', 'web'), { recursive: true });
  }
  if (fs.existsSync(path.join(root, 'assets'))) {
    fs.cpSync(path.join(root, 'assets'), path.join(stage, 'assets'), { recursive: true });
  }

  // 4. Create app.asar in out/DeckLink-win32-x64/resources/app.asar
  const destDir = path.join(root, 'out', 'DeckLink-win32-x64', 'resources');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const dest = path.join(destDir, 'app.asar');
  await asar.createPackage(stage, dest);
  console.log('[Asar] Successfully packed app.asar to:', dest);

  // 5. Also copy loose resources into out/DeckLink-win32-x64/resources
  const looseFiles = [
    'DeckLinkNative.exe',
    'src/web/mobile-deck.html',
    'src/web/manifest.json',
    'src/web/apple-touch-icon.png',
    'src/web/icon-192.png',
    'src/web/icon-512.png',
    'src/web/favicon.ico',
    'assets/icon.ico',
    'assets/icon.png',
    'assets/tray-icon.ico'
  ];
  for (const rel of looseFiles) {
    const src = path.join(root, rel);
    if (fs.existsSync(src)) {
      const target = path.join(destDir, path.basename(rel));
      fs.copyFileSync(src, target);
      console.log('[Resources] Copied loose asset:', path.basename(rel));
    }
  }

  // Clean up stage
  fs.rmSync(stage, { recursive: true, force: true });
}

pack().catch(console.error);


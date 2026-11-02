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

  // 3. Create app.asar in out/DeckLink-win32-x64/resources/app.asar
  const destDir = path.join(root, 'out', 'DeckLink-win32-x64', 'resources');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const dest = path.join(destDir, 'app.asar');
  await asar.createPackage(stage, dest);
  console.log('[Asar] Successfully packed app.asar to:', dest);

  // Clean up stage
  fs.rmSync(stage, { recursive: true, force: true });
}

pack().catch(console.error);


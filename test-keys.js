const { exec, execSync } = require('child_process');

console.log('Testing SendKeys...');
try {
  const res = execSync('powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', { encoding: 'utf-8' });
  console.log('Sync result:', res);
} catch (e) {
  console.error('Sync error:', e.message);
}


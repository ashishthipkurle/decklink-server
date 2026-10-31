const { exec } = require('child_process');
exec('start chrome "https://youtube.com"', (err, stdout, stderr) => {
  console.log('err:', err ? err.message : null);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
});


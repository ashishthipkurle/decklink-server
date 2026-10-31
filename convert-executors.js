const fs = require('fs');
const path = require('path');
const dir = './src/main/executors';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const f of files) {
  let p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  
  // replace const { x } = require('y') with import { x } from 'y'
  c = c.replace(/const\s+\{\s*([^\}]+)\s*\}\s*=\s*require\(['"](.*?)['"]\);/g, 'import { $1 } from \'$2\';');
  
  // replace const x = require('y') with import x from 'y'
  c = c.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"](.*?)['"]\);/g, 'import $1 from \'$2\';');
  
  fs.writeFileSync(p, c);
}
console.log('Done');

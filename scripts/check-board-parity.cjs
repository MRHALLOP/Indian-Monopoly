const fs = require('fs');
const path = require('path');
const vm = require('vm');

const serverBoard = require('../server/constants').CITIES;
const clientFile = fs.readFileSync(path.join(__dirname, '../client/src/constants.js'), 'utf8');
const transformed = clientFile.replace('export const CITIES =', 'globalThis.CITIES =');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(transformed, sandbox);
const clientBoard = JSON.parse(JSON.stringify(sandbox.CITIES));

if (JSON.stringify(serverBoard) !== JSON.stringify(clientBoard)) {
  console.error('Client/server board constants differ.');
  process.exit(1);
}
if (serverBoard.length !== 40 || serverBoard.some((tile, index) => tile.id !== index)) {
  console.error('Board must contain exactly IDs 0-39 in order.');
  process.exit(1);
}
console.log('Board parity OK: 40 matching tiles.');

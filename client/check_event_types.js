import fs from 'fs';

const content = fs.readFileSync('./client/src/host/VisualEvents.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('event.type ===') || line.includes('data.type ===')) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
});

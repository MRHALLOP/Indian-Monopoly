import fs from 'fs';

const filepath = './client/src/host/BoardComponent.jsx';
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

// Let's print out lines around the loop mapping CITIES.
lines.forEach((line, idx) => {
  if (line.includes('CITIES.map') || (idx > 490 && idx < 530)) {
    console.log(`Line ${idx+1}: ${line}`);
  }
});

const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'src', 'components', 'TaxAnalysis.jsx');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
let openAt = -1, closeAt = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{files.length > 0 && (')) openAt = i + 1;
  if (openAt > 0 && lines[i].trim() === ')}' && closeAt === -1) {
    if (i > 0 && lines[i-1].includes('</button>')) closeAt = i;
  }
}
lines.splice(closeAt, 0, '            </>');
lines.splice(openAt, 0, '            <>');
fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log('✅ Repariert!');

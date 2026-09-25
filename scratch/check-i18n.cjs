const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const vi = JSON.parse(fs.readFileSync('src/i18n/locales/vi.json', 'utf8'));

function hasKey(key) {
  const parts = key.split('.');
  let cur = vi;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      return false;
    }
  }
  return typeof cur === 'string' || Array.isArray(cur);
}

const files = walk('src');
const missingReport = {};

files.forEach(f => {
  if (f.includes('i18n')) return;
  const content = fs.readFileSync(f, 'utf8');
  const matches = [...content.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  matches.forEach(k => {
    if (!hasKey(k)) {
      if (!missingReport[f]) missingReport[f] = [];
      if (!missingReport[f].includes(k)) missingReport[f].push(k);
    }
  });
});

console.log(JSON.stringify(missingReport, null, 2));

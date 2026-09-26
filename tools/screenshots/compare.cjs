// Compares two screenshot runs made by shoot.cjs, screen by screen.
//
//   node tools/screenshots/compare.cjs <runA> <runB>
//
// Exits with an error if any screen differs, is missing, failed, or logged a page error.
const fs = require('fs');
const path = require('path');

const [dirA, dirB] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error('Usage: node tools/screenshots/compare.cjs <runA> <runB>');
  process.exit(2);
}
const load = (dir) => new Map(JSON.parse(fs.readFileSync(path.join(dir, 'hashes.json'), 'utf8')).map((r) => [r.name, r]));
const a = load(dirA);
const b = load(dirB);
const names = [...new Set([...a.keys(), ...b.keys()])];
let problems = 0;
for (const name of names) {
  const ra = a.get(name);
  const rb = b.get(name);
  let status = 'same';
  if (!ra || !rb) status = 'missing in one run';
  else if (ra.hash === 'FAILED' || rb.hash === 'FAILED') status = 'failed';
  else if (!fs.readFileSync(path.join(dirA, `${name}.png`)).equals(fs.readFileSync(path.join(dirB, `${name}.png`)))) status = 'DIFFERENT';
  const errors = [...(ra?.errors || []), ...(rb?.errors || [])];
  if (status === 'same' && errors.length) status = 'page error';
  if (status !== 'same') problems += 1;
  console.log(`${status.padEnd(18)} ${name}${errors.length ? `  (${errors.join(' | ')})` : ''}`);
}
console.log(`\n${names.length} screens compared, ${names.length - problems} identical, ${problems} with problems.`);
process.exit(problems ? 1 : 0);

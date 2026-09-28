// Screen density: per screen, count interesting tiles and markers in the area rows.
import fs from 'node:fs';
const base = process.argv[2];
for (const f of ['slice.js', 'd1.js', 'crypt.js', 'overworld.js']) {
  const src = fs.readFileSync(`${base}/src/world/areas/${f}`, 'utf8');
  // split into screen blocks by 'X,Y': { name: "..."
  const re = /'(\d+,\d+)':\s*\{\s*\n?\s*name:\s*["'`]([^"'`]+)["'`]/g;
  let m;
  const idx = [];
  while ((m = re.exec(src))) idx.push({ key: m[1], name: m[2], at: m.index });
  // area ids
  const areaRe = /registerArea\(\{\s*\n\s*id:\s*'([^']+)'/g;
  const areas = [];
  while ((m = areaRe.exec(src))) areas.push({ id: m[1], at: m.index });
  console.log(`\n=== ${f} (${idx.length} screens)`);
  for (let i = 0; i < idx.length; i++) {
    const s = idx[i];
    const end = i + 1 < idx.length ? idx[i + 1].at : src.length;
    const block = src.slice(s.at, end);
    const area = areas.filter((a) => a.at < s.at).pop()?.id ?? '?';
    const rowsM = block.match(/rows:\s*\[([\s\S]*?)\]/);
    const rows = rowsM ? [...rowsM[1].matchAll(/'([^']*)'/g)].map((r) => r[1]).join('') : '';
    const c = (ch) => rows.split(ch).length - 1;
    const npcs = (block.match(/type:\s*'npc[^']*'/g) || []).length;
    const spawnsEmpty = /spawns:\s*\{\s*\}/.test(block);
    const other = (block.match(/type:\s*'([a-z0-9-]+)'/g) || []).map((x) => x.replace(/type:\s*'|'/g, '')).filter((t) => !t.startsWith('npc'));
    console.log(`${area.padEnd(8)} ${s.key.padEnd(5)} ${s.name.padEnd(24)} G=${c('G')} B=${c('B')} v=${c('v')} C=${c('C')} D=${c('D')} i=${c('i')} npc=${npcs}${spawnsEmpty ? ' (no spawns)' : ''} ${other.length ? 'ents=' + other.join(',') : ''}`);
  }
}

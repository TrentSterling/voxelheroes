// Inspect launch options without opening a browser or changing the game's sound.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseSync } from 'rolldown/utils';

const unknown = Symbol('unknown');
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(item => walk(item, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
function parsed(file, source) {
  const result = parseSync(file, source);
  assert.equal(result.errors.length, 0, `Cannot inspect ${file}: ${JSON.stringify(result.errors)}`);
  return result.program;
}
// Enumerate both sides of conditions. Unknown non-audio options can be ignored;
// an unknown spread may override the mute setting, so it fails closed.
function variants(node, chromiumArgs) {
  if (!node) return [unknown];
  switch (node.type) {
    case 'Literal': return [node.value];
    case 'ParenthesizedExpression': return variants(node.expression, chromiumArgs);
    case 'Identifier': return node.name === 'CHROMIUM_ARGS' ? [chromiumArgs] : [unknown];
    case 'ConditionalExpression': return [...variants(node.consequent, chromiumArgs), ...variants(node.alternate, chromiumArgs)];
    case 'ArrayExpression': {
      let rows = [[]];
      for (const item of node.elements) {
        const spread = item?.type === 'SpreadElement';
        const next = variants(spread ? item.argument : item, chromiumArgs);
        rows = rows.flatMap(row => next.map(value => spread
          ? (Array.isArray(value) ? [...row, ...value] : unknown)
          : (Array.isArray(row) ? [...row, value] : unknown)));
      }
      return rows;
    }
    case 'ObjectExpression': {
      let rows = [{}];
      for (const prop of node.properties) {
        const spread = prop.type === 'SpreadElement';
        const next = variants(spread ? prop.argument : prop.value, chromiumArgs);
        const key = prop.key?.name ?? prop.key?.value;
        rows = rows.flatMap(row => next.map(value => {
          if (row === unknown) return unknown;
          if (spread) return value && typeof value === 'object' && !Array.isArray(value) ? { ...row, ...value } : unknown;
          return prop.computed ? unknown : { ...row, [key]: value };
        }));
      }
      return rows;
    }
    default: return [unknown];
  }
}
function inspect(file, source, chromiumArgs) {
  const launches = [];
  walk(parsed(file, source), node => {
    const callee = node.callee;
    if (node.type !== 'CallExpression' || callee?.type !== 'MemberExpression') return;
    const method = callee.property.name ?? callee.property.value;
    if (!['launch', 'launchPersistentContext'].includes(method)) return;
    const engine = callee.object.name;
    const options = node.arguments[method === 'launchPersistentContext' ? 1 : 0];
    const branches = variants(options, chromiumArgs);
    assert.ok(branches.length > 0);
    for (const option of branches) {
      const chrome = Array.isArray(option?.args) && option.args.includes('--mute-audio');
      const firefox = typeof option?.firefoxUserPrefs?.['media.volume_scale'] === 'string'
        && Number(option.firefoxUserPrefs['media.volume_scale']) === 0;
      const muted = engine === 'chromium' ? chrome : engine === 'firefox' ? firefox : chrome || firefox;
      assert.ok(muted, `${file}:${source.slice(0, node.start).split('\n').length}: ${engine}.${method} has an unmuted or unverifiable launch branch`);
    }
    launches.push({ engine, line: source.slice(0, node.start).split('\n').length, branches: branches.length });
  });
  return launches;
}
let chromiumArgs;
walk(parsed('scripts/playtest.mjs', readFileSync('scripts/playtest.mjs', 'utf8')), node => {
  if (node.type === 'VariableDeclarator' && node.id?.name === 'CHROMIUM_ARGS') chromiumArgs = variants(node.init, [])[0];
});
assert.ok(chromiumArgs?.includes('--mute-audio'), 'Shared Chromium options must mute output');

// Catch omissions in a single conditional branch, and later option overrides.
const good = [
  "chromium.launch({args:CHROMIUM_ARGS})",
  "firefox.launch({firefoxUserPrefs:{'media.volume_scale':'0.0'}})",
  "engine.launch({...(name==='chromium'?{args:CHROMIUM_ARGS}:{firefoxUserPrefs:{'media.volume_scale':'0.0'}})})",
  "chromium.launchPersistentContext(profile,{args:['--mute-audio']})",
];
const bad = [
  'chromium.launch({headless:true})',
  "firefox.launch({firefoxUserPrefs:{'media.volume_scale':'1.0'}})",
  "engine.launch({...(name==='chromium'?{args:CHROMIUM_ARGS}:{})})",
  "chromium.launch({args:CHROMIUM_ARGS,...{args:[]}})",
  'chromium.launch({args:CHROMIUM_ARGS,...unverified})',
];
for (const source of good) assert.equal(inspect('fixture.mjs', source, chromiumArgs).length, 1);
for (const source of bad) assert.throws(() => inspect('fixture.mjs', source, chromiumArgs));
const files = [];
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.name.endsWith('.mjs')) files.push(full);
  }
}
scan('scripts');
const launches = files.flatMap(file => inspect(file, readFileSync(file, 'utf8'), chromiumArgs).map(row => ({ file: relative('.', file).replaceAll('\\', '/'), ...row })));
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'playtest-out/test-audio-policy';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'result.json'), JSON.stringify({ at: new Date().toISOString(), ok: true, browsersLaunched: 0, scripts: files.length, launches, regressionFixtures: good.length + bad.length, limitation: 'Checks source configuration; does not measure speaker output.' }, null, 2));
console.log(`PASS silent launch policy: ${launches.length} launch sites across ${files.length} scripts; ${good.length + bad.length} regression fixtures; no browsers launched.`);

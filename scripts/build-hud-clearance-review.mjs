import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const out = 'playtest-out/hud-clearance-review', delivery = 'playtest-out/hud-clearance-release-20261002';
const folders = {
  before: 'forest-hud-before-confirmed-20261002', layout: 'forest-hud-isolated-final-20261002',
  regression: 'forest-hud-isolated-regression-20261002', guard: 'forest-hud-native-output-isolation-20261002',
  guardContracts: 'forest-hud-silent-output-final-contract-20261002',
  retakes: 'hud-clearance-retakes-touch-20261002',
  offline: 'hud-clearance-offline-20261002',
};
const results = Object.fromEntries(Object.entries(folders).map(([key, folder]) => [key, read(`playtest-out/${folder}/result.json`)]));
const sourceSha256 = results.layout.sourceSha256;
assert.equal(results.layout.ok, true); assert.equal(results.layout.sourceUnchanged, true);
assert.equal(results.layout.checks.length, 310); assert.equal(results.layout.captures.length, 60);
assert.equal(results.regression.status, 'passed'); assert.equal(results.regression.failed, 0);
assert.equal(results.regression.source.sha256, sourceSha256); assert.equal(results.regression.integrity.sourceUnchanged, true);
assert.deepEqual(results.regression.integrity.changedTests, []);
assert.equal(results.guard.ok, true); assert.equal(results.guardContracts.ok, true);
assert.equal(results.retakes.ok, true); assert.equal(results.retakes.sourceSha256, sourceSha256);
assert.equal(results.offline.status, 'passed'); assert.equal(results.offline.source.sha256, sourceSha256);
const packet = read(`${delivery}/package.json`); assert.equal(packet.ok, true);
assert.equal(packet.artifact.sha256, results.offline.artifact.sha256);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const entries = new Map(packet.sourceFiles.map(e => [e.file, e])), fp = createHash('sha256');
for (const file of [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort()) {
  const name = file.replaceAll('\\', '/'), bytes = readFileSync(file);
  assert.equal(entries.get(name)?.sha256, hash(bytes), `Packaged source ${name}`);
  fp.update(name + '\0'); fp.update(bytes);
}
assert.equal(fp.digest('hex'), sourceSha256);
const after = `playtest-out/${folders.retakes}/`, before = `playtest-out/${folders.before}/`;
const rows = [
  ['Before: a button covered the objective', before + 'chromium-landscape-large-early-forest.png', 'The 568x320 forest HUD wrapped its direction across Play with friends. The retained before run reproduces the same overlap for all three objectives in both text settings. This image belongs to the previous game source.', results.before.sourceSha256],
  ['A clear lane for the forest direction', after + 'chromium-landscape-large-early-forest.png', 'The objective now stays inside the free horizontal span. The HUD reserves the actual Party and Journal target bounds and measures again when wrapping adds a line. This is an isolated layout fixture; it does not replace the native adventure receipts.'],
  ['Rootglass keeps its map direction clear', after + 'firefox-landscape-large-hive-map.png', 'At Rootglass Mouth, the live map objective fits without covering side widgets or shortcut targets. Actual touch still opens Journal. The complete matrix passes 310 checks with 60 captures across Chromium and Firefox.'],
  ['The small phone still has its shortcuts', after + 'firefox-phone-large-early-forest.png', 'At 320x568, the centre stack remains below the side controls. Every rendered text run fits the canvas, and the visible Journal shortcut responds to physical touch. Normal and large text are both checked.'],
  ['A wider screen retains breathing room', after + 'chromium-wide-landscape-normal-hive-bombs.png', 'The layout uses each widget’s real vertical range instead of a fixed shortcut exclusion row. The current bomb-cache direction, time and side controls remain separate at 840x360. Progress flags, equipment and room placement are disclosed fixtures.'],
  ['Desktop follows the same geometry', after + 'firefox-desktop-large-hive-bombs.png', 'Desktop and touch share the same HUD bounds used by party camera composition. The existing text, camera and combat regression cases are recorded separately. The prior 14-slide native Rootglass review and its source packet remain intact.'],
];
const slides = rows.map(([title, file, caption, source]) => ({ title, file, caption, sourceSha256: source ?? sourceSha256,
  sha256: hash(readFileSync(file)), image: `data:image/png;base64,${readFileSync(file).toString('base64')}` }));
const receipts = Object.fromEntries(Object.entries(folders).map(([key, folder]) => {
  const file = `playtest-out/${folder}/result.json`; return [key, { file, sha256: hash(readFileSync(file)) }];
}));
receipts.package = { file: `${delivery}/package.json`, sha256: hash(readFileSync(`${delivery}/package.json`)) };
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.json`, JSON.stringify({ utc: new Date().toISOString(), sourceSha256, artifactSha256: packet.artifact.sha256,
  layoutChecks: 310, layoutCaptures: 60, regressionAssertions: results.regression.assertions, regressionCases: results.regression.passed,
  nativeOutputGuardChecks: results.guard.checks.length, outputGuardContracts: results.guardContracts.checks.length, receipts,
  limitations: ['Layout uses disclosed story, equipment, teleport and unrelated-hostile-removal fixtures.',
    'Output guards are verified without assessing audible voice quality. Scenario and HUD test output stays disconnected.',
    'The prior native journey ends at the bomb cache; Queen, later adventure and forest art/story remain separate work.'],
  slides: slides.map(({ image, ...slide }) => slide) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Clearer HUD</title><style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style><header><h1 id="title"></h1><nav><a href="../hud-clearance-release-20261002/index.html">Build and source</a><a href="manifest.json">Receipts</a><a href="../nursery-controls-review/static.html">Native adventure</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><span id="count"></span></footer><script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`;
writeFileSync(`${out}/static.html`, html); writeFileSync(`${out}/index.html`, html);
console.log(`PASS ${slides.length} image-only HUD slides, exact packaged source and passing receipt fingerprints.`);

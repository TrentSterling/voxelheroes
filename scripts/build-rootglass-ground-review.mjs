import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const out = 'playtest-out/rootglass-ground-review', delivery = 'playtest-out/rootglass-ground-release-20261002';
const folders = {
  regression: 'rootglass-ground-publication-20261002', offline: 'rootglass-ground-offline-publication-20261002',
  layout: 'rootglass-hud-prompt-clearance-20261002', coop: 'rootglass-ground-coop-publication-20261002',
  syntax: 'rootglass-ground-publication-syntax-20261002', voices: 'rootglass-ground-voice-bank-20261002',
  woods: 'rootglass-woods-publication-retakes-20261002', before: 'rootglass-hud-final-20261002',
  mechanical: 'rootglass-ground-final-20261002',
};
const results = Object.fromEntries(Object.entries(folders).map(([key, folder]) => [key, read(`playtest-out/${folder}/result.json`)]));
const sourceSha256 = results.layout.sourceSha256;
assert.equal(sourceSha256, 'b3580c8787fcc3ed6584cf330210573d66ab69ebd826897fedc7173f3f970916');
for (const key of ['regression', 'offline']) {
  assert.equal(results[key].status, 'passed'); assert.equal(results[key].failed, 0);
  assert.equal(results[key].source.sha256, sourceSha256);
  assert.equal(results[key].integrity.sourceUnchanged, true);
  assert.deepEqual(results[key].integrity.changedTests, []);
}
assert.equal(results.regression.assertions, 2334); assert.equal(results.offline.assertions, 172);
assert.equal(results.offline.integrity.artifactUnchanged, true);
for (const key of ['layout', 'woods']) {
  assert.equal(results[key].ok, true); assert.equal(results[key].sourceUnchanged, true);
  assert.equal(results[key].sourceSha256, sourceSha256);
}
assert.equal(results.layout.checks.length, 1016); assert.equal(results.layout.captures.length, 144);
assert.equal(results.coop.ok, true); assert.equal(results.coop.checks.length, 21);
assert.equal(results.coop.sourceSha256, sourceSha256);
assert.equal(results.syntax.ok, true); assert.equal(results.syntax.files, 317);
assert.equal(results.syntax.sourceSha256, sourceSha256);
assert.equal(results.voices.ok, true); assert.equal(results.voices.lines, 1490);
assert.equal(results.voices.bytes, 21488008);
assert.equal(results.mechanical.assertions, 6998);
assert.notEqual(results.before.sourceSha256, sourceSha256);
const packet = read(`${delivery}/package.json`); assert.equal(packet.ok, true);
assert.equal(packet.artifact.sha256, results.offline.artifact.sha256);
assert.equal(hash(readFileSync(`${delivery}/${packet.artifact.file}`)), packet.artifact.sha256);
assert.equal(packet.artifact.embeddedClipsVerified, 1490);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const entries = new Map(packet.sourceFiles.map(e => [e.file, e])), fp = createHash('sha256');
for (const file of [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort()) {
  const name = file.replaceAll('\\', '/'), bytes = readFileSync(file);
  assert.equal(entries.get(name)?.sha256, hash(bytes), `Packaged source ${name}`);
  fp.update(name + '\0'); fp.update(bytes);
}
assert.equal(fp.digest('hex'), sourceSha256);
const woods = `playtest-out/${folders.woods}/`, layout = `playtest-out/${folders.layout}/`;
const native = `playtest-out/${folders.regression}/firefox-17-nursery-victory/`;
const rows = [
  ['Northwood: leaves and worn stones', woods + 'northwood.png', 'Four small voxel ground builders give the woodland road fallen leaves, old stones, copper routes and amber seedbeds. This arranged scenic view uses story, gear, placement and enemy-removal fixtures; terrain construction and arrival settle normally.'],
  ['Mothwater: copper through the green', woods + 'mothwater.png', 'The old route has patina and copper marks while the clearing keeps its grass. Ground-only changes preserve actors, chests, passages and collision against the published map; this image is an arranged scenic fixture.'],
  ['Carved Stone: a trace of amber', woods + 'carved-stone.png', 'Each screen mixes its own ground pattern instead of reusing one green carpet. The northern terrain backdrop is explicitly inherited by the new kit; no bitmap or model download was added. Arranged scenic fixture.'],
  ['Split Root: the crossed road', woods + 'split-root.png', 'Copper follows the actual road directions through this maze junction. Native adventure runs solve the maze separately; this settled photograph removes unrelated enemies and arranges the viewpoint.'],
  ['Golden Leaves: the seedbed', woods + 'golden-leaves.png', 'Amber motifs pick out this woodland room. Eight ground maps are compared with the earlier published source, including their unchanged actor homes, loot and warp destinations. Arranged scenic fixture.'],
  ['The first light comes home', native + '30-native-first-orb-home.png', 'The final-source Firefox journey starts at the title, completes the first temple and returns with the actual first orb. Subsequent screenshots continue this earned run. No gear, health or immunity grants or teleports are used. The starter equipment has a native save roundtrip; later diagnostic checkpoints are never loaded. Earlier movement helpers settle within two ordinary movement steps.'],
  ['Earned powder opens the seam', native + '40-native-first-breach.png', 'The player selects earned bombs, plants them through normal item input and retreats from the real fuse. Both Rootglass seams open through their actual puzzle path. This is a native adventure receipt.'],
  ['The nursery tells you what remains', native + '41-native-pressure-nursery.png', 'Room directions now follow real seal flags instead of repeating an entrance hint. The player breaks all three brass seals through normal inputs, then fights the remaining wardens. Native adventure receipt.'],
  ['A quiet nursery yields its key', native + '43-native-quiet-nursery.png', 'The shared pressure puzzle finishes through seal destruction and normal sword and boomerang combat. The physical key is picked up in the same run; earned checkpoints are saved for diagnosis and never loaded.'],
  ['The amber chest opens', native + '44-native-amber-key.png', 'The room objective points to the actual gallery reward. The amber chest opens through normal interaction, continuing the earned two-temple route. Native adventure receipt.'],
  ['Three watchers and a real way back', native + '45-native-three-watchers.png', 'Three actual boomerang throws solve the watchers before real key locks and the entrance shortcut. The route also collects the authored bomb supply for the crown fight. Native adventure receipt.'],
  ['The Queen can be overturned', native + '51-native-queen-overturned.png', 'Earned bombs overturn the crown and ordinary sword attacks finish the Queen. The controller guards, cuts nearby drones, waits for landing and retreats from its fuse; it never changes damage, boss AI, player health or immunity. Native adventure receipt.'],
  ['The second light is earned', native + '54-native-second-orb.png', 'The Queen dies with normal combat, awards the permanent heart and opens the actual second-orb chest. The journey then leaves by the authored southern stairs. Final-source Chromium, Firefox and portable Firefox each complete this fresh two-temple route.'],
  ['Before: the phase label hit the prompts', 'playtest-out/' + folders.before + '/firefox-landscape-normal-queen-flipped.png', 'Manual inspection caught the older two-line Queen status crossing the touch prompt row at 568x320. This photograph belongs to the earlier source, whose broad three-seed mechanical run passed 6,998 assertions; it is retained as a before receipt.', results.before.sourceSha256],
  ['A compact crown status clears touch', layout + 'firefox-landscape-large-queen-flipped.png', 'The published Queen status uses one measured line with shorter phase labels in tight spaces. The final matrix checks the actual action-prompt rectangles, side controls and text bounds. Phase, health, gear and room placement are disclosed UI fixtures; touch selects its real device labels.'],
  ['The phone keeps room for the fight', layout + 'firefox-phone-large-queen-flipped.png', 'Nine Rootglass states across four sizes, two browsers and both text settings pass 1,016 checks with 144 captures, including actual Journal taps. Large Text changes dialogue layout rather than scaling HUD fonts. Phase and progression are disclosed UI fixtures.'],
  ['The same second light, offline in Firefox', 'playtest-out/' + folders.offline + '/firefox-17-nursery-victory/54-native-second-orb.png', 'The exact portable HTML passes a fresh native two-temple Firefox run from a local file, earning the real second orb. All 1,490 compressed voice clips are embedded and verified without playback. The build and source packet are linked above.'],
];
const slides = rows.map(([title, file, caption, source]) => ({ title, file, caption, sourceSha256: source ?? sourceSha256,
  sha256: hash(readFileSync(file)), image: `data:image/png;base64,${readFileSync(file).toString('base64')}` }));
assert.equal(slides.length, 17);
const receipts = Object.fromEntries(Object.entries(folders).map(([key, folder]) => {
  const file = `playtest-out/${folder}/result.json`; return [key, { file, sha256: hash(readFileSync(file)) }];
}));
receipts.package = { file: `${delivery}/package.json`, sha256: hash(readFileSync(`${delivery}/package.json`)) };
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.json`, JSON.stringify({ utc: new Date().toISOString(), gitHead: packet.gitHead,
  sourceSha256, artifactSha256: packet.artifact.sha256, regressionAssertions: 2334, offlineAssertions: 172,
  layoutChecks: 1016, layoutCaptures: 144, localCoopChecks: 21, parsedModules: 317, voiceClips: 1490,
  earlierMechanicalAssertions: 6998, earlierMechanicalSourceSha256: results.mechanical.source.sha256,
  receipts, limitations: [
    'Woodland scenic views arrange story, equipment and placement and remove unrelated hostiles.',
    'UI views arrange phase, health and progression. Native adventure screenshots are separate earned runs.',
    'The earlier 6,998-assertion mechanical checkpoint used the two-line status. Final-source acceptance is recorded separately.',
    'Local co-op uses disclosed equipment, placement, invulnerability and direct guard-defeat fixtures. Public signaling and separate-network ICE remain untested.',
    'Tests disconnect speaker output. Static voice-byte checks do not assess audible voice quality.',
    'Later temples, broader story content and a user-directed Boxel polish pass remain further work.',
  ], slides: slides.map(({ image, ...slide }) => slide) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: The woodland road and the second light</title><style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style><header><h1 id="title"></h1><nav><a href="../rootglass-ground-release-20261002/index.html">Build and source</a><a href="manifest.json">Receipts</a><a href="../nursery-controls-review/static.html">Native adventure</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><span id="count"></span></footer><script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`;
writeFileSync(`${out}/static.html`, html); writeFileSync(`${out}/index.html`, html);
console.log(`PASS ${slides.length} image-only woodland and crown slides, exact packaged source and passing receipt fingerprints.`);

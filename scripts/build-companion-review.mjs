// Package inspected gameplay screenshots without playing or embedding audio.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const regression = 'playtest-out/companion-regression-20260930';
const coop = 'playtest-out/companion-coop-final-20260930';
const ui = 'playtest-out/companion-ui-release-20260930';
const delivery = 'playtest-out/companion-delivery-20260930';
const out = process.argv[2] ?? 'playtest-out/companion-review';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = file => ({ file, sha256: hash(readFileSync(file)), result: JSON.parse(readFileSync(file, 'utf8')) });
const receipts = {
  regression: receipt(`${regression}/result.json`),
  coop: receipt(`${coop}/result.json`),
  ui: receipt(`${ui}/result.json`),
  voices: receipt('playtest-out/companion-voice-assets-final-20260930/result.json'),
  silence: receipt('playtest-out/companion-audio-policy-release-20260930/result.json'),
  package: receipt(`${delivery}/package.json`),
};
assert.equal(receipts.regression.result.status, 'passed');
assert.equal(receipts.regression.result.failed, 0);
for (const name of ['coop', 'ui', 'voices', 'silence', 'package']) assert.equal(receipts[name].result.ok, true);
assert.equal(receipts.ui.result.checks.length, 11);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const sources = [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort();
const fingerprint = createHash('sha256');
for (const file of sources) { fingerprint.update(file.replaceAll('\\', '/') + '\0'); fingerprint.update(readFileSync(file)); }
const source = { sha256: fingerprint.digest('hex'), files: sources.length };
const rows = [
  ['Mira joins the adventure', `${regression}/chromium-1-companion/01-mira-joins.png`, 'The real conversation choice recruits Mira. One travelling character replaces her town presentation and collider; Wait in town restores the resident. Test positioning is a fixture.'],
  ['Clockwork Cross', `${regression}/chromium-1-companion/04-clockwork-cross.png`, 'Actual held sword input, then release: Mira combines her wrench with the charged spin. Copper Memory unlocks it; each use costs 2 magic, deals 6 spin damage and recharges for 4 seconds. The stationary target and prior reward are fixtures.'],
  ['A friend can use the combination', `${coop}/guest/02-guest-clockwork-cross.png`, 'Actual Firefox guest and Chromium leader over local Trystero RTC. The guest spent its own magic; the room owner resolved exactly one six-point hit. Neither player lost health. This capture shows the recharge state after the pulse.'],
  ['One Mira follows the party leader', `${coop}/host/03-mira-in-the-past.png`, 'The leader enters the First Bloom while the other hero visits the future. Mira remains with the leader. Room placement and earlier quest flags are fixtures; RTC sharing is real.'],
  ['Friends can still explore separately', `${coop}/guest/04-friend-alone-in-the-future.png`, 'The guest is in the Rusted Rails, three hundred years away. Mira is absent and the guest cannot activate a combination from another era. Local signaling only; separate-network ICE has not been tested.'],
  ['A companion survives host departure', `${coop}/guest/05-mira-after-host-migration.png`, 'The host leaves through the actual party API. Exactly one Mira safely follows the surviving hero, without duplicated support or companion actors.'],
  ['Technique help on a phone', `${ui}/phone-ready.png`, 'Real touch browser at 320 by 568, including an actual touch gesture. Text is measured inside the panel and viewport; the panel clears health, prompts, shortcuts and touch controls. Audio is disabled for the fixture.'],
  ['A clear landscape interface', `${ui}/landscape-ready.png`, 'Real touch browser at 568 by 320. The compact technique hint replaces the redundant Sword label and yields to arrival titles or item prompts. All 11 UI states pass; earlier failed layout receipts are preserved.'],
];
const slides = rows.map(([title, file, caption]) => { const bytes = readFileSync(file); return { title, file, caption, sha256: hash(bytes), image: `data:image/png;base64,${bytes.toString('base64')}` }; });
mkdirSync(out, { recursive: true });
const limitations = [
  'Focused regression: 173 assertions across nine gameplay scenarios plus the silent-launch policy, not a newly completed full campaign gauntlet.',
  'The regression and co-op receipts precede the final touch-only hint placement/priority change. The 11-state UI receipt verifies that later change.',
  'All new browser checks are muted. No voice playback or decoding was repeated; the asset-only audit covers all 1,449 current authored recordings.',
  'The public site has not been updated. Additional companions, deeper dungeon encounters and broader story work remain.',
];
writeFileSync(`${out}/manifest.json`, JSON.stringify({ builtUtc: new Date().toISOString(), source, receipts, limitations, slides: slides.map(({ image, ...s }) => s) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Mira and Clockwork Cross</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../companion-delivery-20260930/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../workshop-review/index.html">Workshop slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} companion slides with inspected photographs, receipt hashes and explicit coverage limits.`);

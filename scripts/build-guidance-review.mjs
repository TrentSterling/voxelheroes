// A silent review built from current, hashed game screenshots and receipts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out = process.argv[2] ?? 'playtest-out/guidance-review';
const delivery = 'playtest-out/guidance-delivery-20261001';
const hash = b => createHash('sha256').update(b).digest('hex');
const receipt = file => ({ file, sha256: hash(readFileSync(file)), result: JSON.parse(readFileSync(file)) });
const receipts = {
  broad: receipt('playtest-out/guidance-regression-release3-20261001/result.json'),
  final: receipt('playtest-out/guidance-final-source-release3-20261001/result.json'),
  transition: receipt('playtest-out/guidance-join-guard/transition.json'),
  ui: receipt('playtest-out/guidance-ui-release3-20261001/result.json'),
  coop: receipt('playtest-out/guidance-coop-release3-20261001/result.json'),
  portable: receipt('playtest-out/guidance-portable-release3-20261001/result.json'),
  package: receipt(`${delivery}/package.json`),
};
for (const key of ['broad', 'final']) { assert.equal(receipts[key].result.status, 'passed'); assert.equal(receipts[key].result.failed, 0); }
for (const key of ['ui', 'coop', 'portable', 'package']) assert.equal(receipts[key].result.ok, true);
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort(), fp = createHash('sha256');
for (const file of files) { fp.update(file.replaceAll('\\', '/') + '\0'); fp.update(readFileSync(file)); }
const source = { sha256: fp.digest('hex'), files: files.length };
for (const key of ['final']) assert.equal(source.sha256, receipts[key].result.source.sha256);
for (const key of ['ui', 'coop']) assert.equal(source.sha256, receipts[key].result.sourceSha256);
assert.equal(receipts.transition.result.beforeSha256, receipts.broad.result.source.sha256);
assert.equal(receipts.transition.result.afterSha256, source.sha256);
assert.deepEqual(receipts.transition.result.changed.map(r => r.file), ['src/game/party.js']);
assert.equal(receipts.portable.result.artifactSha256, receipts.package.result.artifact.sha256);
for (const row of receipts.package.result.sourceFiles) assert.equal(hash(readFileSync(row.file)), row.sha256, `Source ZIP matches ${row.file}`);
const solo = 'playtest-out/guidance-final-source-release3-20261001/chromium-1-guidance';
const ui = 'playtest-out/guidance-ui-release3-20261001', coop = 'playtest-out/guidance-coop-release3-20261001';
const rows = [
  ['Choose the adventure you want', `${solo}/02-track-homecoming.png`, 'The journal can Track any unfinished era story, barrow memory or village errand. The chosen step stays on the HUD when you enter another area. Track does not accept an offered errand or complete it for you.'],
  ['Phone titles and rewards stay readable', `${ui}/phone-tracked.png`, 'The selected task gets a short Tracking this task heading. Its full title and reward wrap, rather than being cut off. The real touch checks reach every paragraph through Read and keep controls separate from the reward.'],
  ['The phone HUD keeps the useful step', `${ui}/phone-quest-hud.png`, 'A pinned instruction can use two rows in portrait. Actual HUD touch opens that task in the journal. The full instruction remains available there; longer descriptions use paragraph pages.'],
  ['Tracking fits a short landscape screen', `${ui}/landscape-tracked.png`, 'Track, Untrack and Auto have their own footer row. Navigation, Read and Close remain below them. Actual coarse touch input checks these actions, all text bounds and control collisions on a 568 by 320 screen.'],
  ['Your inventory advances the task', `${solo}/03-flowers-ready.png`, 'Finding a third wildflower changes the pinned errand to Return to Hettie. Sorting the ready task higher in the journal preserves its selected id. Inventory counts are arranged fixtures; the next check uses her actual conversation and consumes the flowers.'],
  ['A turn-in restores the next adventure', `${solo}/04-campaign-after-turn-in.png`, 'Completing Hettie\'s real turn-in releases the completed pin and restores the unfinished campaign goal. New games reset the choice; saves retain valid choices and default safely when an older save has no pin.'],
  ['Friends can follow different quests', `${coop}/guest/02-future-changed-by-friend.png`, 'A local Chromium host follows Tomorrow\'s Bell while the Firefox guest follows Voices in Copper. Joining preserves each personal choice. The actual past engine interaction changes the future and the relevant instructions without replacing either choice.'],
  ['A remote repair advances your chosen step', `${coop}/guest/04-archive-powered-from-past.png`, 'The friend tunes the actual workshop valve in the past. The guest remains in the future archive, sees its floor light, and receives the next instruction to recover the memory. The actual chest shares its reward and advances the guest toward Tern.'],
  ['Shared completion releases only the finished pin', `${coop}/guest/05-completed-future-guidance.png`, 'Tern\'s choir turn-in releases the archive pin while the garden remains tracked for the other hero. Mira\'s later homecoming clears that pin too. The guest still in the future is directed to the hourgate home instead of repeating either turn-in.'],
  ['Completed rooms lead you home', `${solo}/01-completed-archive-exit.png`, 'All six past and future rooms are checked after both homecomings. None asks for the completed reward or repair again. Returning to present-day Mossbrook restores campaign guidance. Both homecoming orders remain valid.'],
];
const slides = rows.map(([title, file, caption]) => { const b = readFileSync(file); return { title, file, caption, sha256: hash(b), image: `data:image/png;base64,${b.toString('base64')}` }; });
const limitations = [
  `The broader focused run passes ${receipts.broad.result.assertions} assertions, including both real era routes, hero combat, companions, barrow memory, save checks and the six-viewport text audit. Nine passing scenarios on identical game source are reused from release2; its interrupted text audit reruns against a stable production preview. It is not a full campaign or external-network gauntlet.`,
  `The only later game change normalizes the guest's completed quest pin when joining a fresh adventure. Exact source hashes prove that single-line boundary. The final-source run passes ${receipts.final.result.assertions} assertions; mouse/touch, co-op and portable results match the final packaged source. These assertion totals overlap.`,
  'Story-state, equipment, arranged positions and enemy-clear APIs are disclosed fixtures. Actual combat and quest actions are exercised by the era scenarios; local co-op isolates replication using patrol damage APIs. These checks do not measure enjoyment.',
  'The new tracking choice is personal. Shared flags and quest progress remain shared. Local RTC uses Chromium/Firefox with public signaling and external ICE disabled.',
  'All browser output is muted. NPC voice generation, decoding and playback were not repeated; no authored NPC voice text changed. The portable packet verifies compressed voice bytes without playing them.',
  'The public site is unchanged. The larger temple and era story rewrite, more town adventures and further tile variety remain active work. Earlier failed or superseded receipts remain in their original folders.',
];
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.json`, JSON.stringify({ builtUtc: new Date().toISOString(), source, receipts, limitations, slides: slides.map(({ image, ...row }) => row) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Follow Your Adventure</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../guidance-delivery-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../tern-review/index.html">Tern slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} guidance slides with verified source, packet and receipt hashes.`);

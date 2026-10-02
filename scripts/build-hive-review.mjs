// Fresh silent screenshots, source fingerprints and package receipts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out=process.argv[2]??'playtest-out/hive-review';
const delivery='playtest-out/hive-delivery-20261001';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file))});
const receipts={
 broad:receipt('playtest-out/hive-regression-release4-20261001/result.json'),
 firefox:receipt('playtest-out/hive-firefox-release3-20261001/result.json'),
 coop:receipt('playtest-out/hive-coop-release3-20261001/result.json'),
 layout:receipt('playtest-out/hive-layout-release3-20261001/result.json'),
 portable:receipt('playtest-out/hive-portable-release3-20261001/result.json'),
 package:receipt(`${delivery}/package.json`),
};
for(const key of['broad','firefox']){assert.equal(receipts[key].result.status,'passed');assert.equal(receipts[key].result.failed,0);}
for(const key of['coop','layout','portable','package'])assert.equal(receipts[key].result.ok,true);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fp=createHash('sha256');
for(const file of files){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
const source={sha256:fp.digest('hex'),files:files.length};
for(const key of['broad','firefox'])assert.equal(source.sha256,receipts[key].result.source.sha256);
for(const key of['coop','layout'])assert.equal(source.sha256,receipts[key].result.sourceSha256);
assert.equal(receipts.portable.result.artifactSha256,receipts.package.result.artifact.sha256);
for(const row of receipts.package.result.sourceFiles)assert.equal(hash(readFileSync(row.file)),row.sha256,`Source ZIP matches ${row.file}`);
const solo='playtest-out/hive-regression-release4-20261001/chromium-1-hive-pressure';
const floors='playtest-out/hive-regression-release4-20261001/chromium-1-hive-floors';
const route='playtest-out/hive-regression-release4-20261001/chromium-1-d2';
const coop='playtest-out/hive-coop-release3-20261001',ui='playtest-out/hive-layout-release3-20261001';
const rows=[
 ['A greenhouse swallowed by roots',`${floors}/01-rootglass-mouth.png`,'All fifteen Rootglass rooms now share their own original voxel kit: root cobble, amber glass, grates, irrigation channels, leaf mosaics and cracked stone. Their doors and treasure graph remain playable. These are quick placeholder materials for a later Boxel polish pass.'],
 ['The town left something waiting',`${ui}/phone-normal-tablet-0.png`,'The municipal nursery still reserves seedlings for Mossbrook\'s children. Collection is 300 years overdue. Its original story connects the hive to the era adventure. The tablet uses real sword interaction and complete mouse/touch paragraph paging.'],
 ['Read the channel, then move',`${solo}/01-pressure-warning.png`,'The nursery replaces two passive turrets and a bat with three guards and a pressure machine. Each lane gets a 1.25-second warning before a 0.85-second burst. Actual movement out of this lane avoids damage; killing every guard alone does not release the key.'],
 ['Pressure is a personal hazard',`${solo}/02-pressure-burst.png`,'Staying on an active lane costs one half-heart through ordinary hero damage. A full shield does not block pressure underfoot. Normal hit immunity prevents repeated damage during one burst. The screenshot and dodge checks run the real machine clock.'],
 ['A guest can change the fight',`${coop}/guest/03-guest-breaks-first-seal.png`,'Real Firefox guest bomb input spends ammunition, waits for its fuse and sends the blast to the room owner. Opening a brass seal cancels its lane and removes that lane from later cycles. Both players see the same opened tile and saved flag.'],
 ['Quiet the machinery, clear the guards',`${solo}/05-quiet-nursery.png`,'All three seals and all guards are required for one mandatory key. Either order works. Partial saves keep broken seals and defeated guards; loading before pickup keeps exactly one waiting key. Older earned keys remain earned without a new lock.'],
 ['A friend inherits the unfinished room',`${coop}/guest/04-guest-owns-nursery.png`,'The host leaves during the remaining lane cycle. The guest takes room ownership with two seals already broken, one machine and the current cycle intact. The final bomb and actual key pickup then share the reward with the friend exploring another era.'],
 ['The future remembers the nursery',`${coop}/host/05-future-garden-changed-by-friend.png`,'Once the main water engine is restored, venting the nursery grows four more garden tiles in the Silent Year. This friend is already in the future when the guest opens the final seal. The main water flag is an arranged fixture; the vent comes from actual bombs.'],
 ['Old puzzles still move on new floors',`${floors}/04-root-counterweight.png`,'The full route caught the old push-block rule rejecting decorative floor glyphs. Blocks and statues now accept explicitly marked decorative flooring and restore its original material when moved onward. Real input checks all six variants, the counterweight plate, pits and closed machinery.'],
 ['The crown keeps its real-time counter',`${route}/10-queen-bomb-counter.png`,'The queen arena uses amber glass and leaf mosaics from the new kit. The existing bomb flip and sword counter remain part of the complete dungeon route. This pass adds the nursery encounter; it does not claim a new queen AI or boss design.'],
 ['Every word stays reachable on a phone',`${ui}/phone-large-tablet-1.png`,'Normal and large text fit the portrait and short landscape panels. Actual touch advances every segment of all three authored paragraphs without dropping words. Twenty-eight measured layout captures have no out-of-bounds text or panels and no objective/control overlaps.'],
 ['Friends can reunite after the work',`${coop}/guest/06-quiet-shared-nursery.png`,'The completed room stays quiet when the friends return. One shared key is collected, guards stay defeated, and a saved co-op adventure loads alone with the same progress. The packet retains the current portable HTML, source ZIP and these hashed receipts.'],
];
const slides=rows.map(([title,file,caption])=>{const b=readFileSync(file);return{title,file,caption,sha256:hash(b),image:`data:image/png;base64,${b.toString('base64')}`};});
const limitations=[
 `${receipts.broad.result.assertions} Chromium assertions and ${receipts.firefox.result.assertions} Firefox assertions pass on the packaged game source. The Chromium receipt reuses sixteen passing cases on identical game source and unchanged tests from release3; its expanded floor scenario reruns. Firefox uses two seeds. This is a focused regression, not a full campaign audit.`,
 `${receipts.coop.result.checks.length} local RTC checks and ${receipts.layout.result.checks.length} mouse/touch checks pass. Local signaling uses an isolated relay and empty ICE servers; public signaling and separate-network connectivity remain untested.`,
 'Position, story, equipment, terrain and enemy-damage fixtures are disclosed in the scenarios. Machine clocks, bomb input/fuses, movement, key pickup and tablet paging use actual gameplay. These checks do not measure enjoyment.',
 'All browsers remain muted. Existing NPC recordings were not generated, decoded or played again. Packaging verifies compressed voice bytes; machine tablets do not add NPC voice lines.',
 'The public site is unchanged. The other temples and more town/era adventures still need work. Earlier failed and superseded receipts remain preserved in their original folders.',
];
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.json`, JSON.stringify({ builtUtc: new Date().toISOString(), source, receipts, limitations, slides: slides.map(({ image, ...row }) => row) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Rootglass Nursery</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../hive-delivery-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../guidance-review/index.html">Quest tracking slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} Rootglass slides with verified source, packet and receipt hashes.`);

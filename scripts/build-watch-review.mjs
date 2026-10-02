// Fresh silent screenshots, source fingerprints and package receipts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out=process.argv[2]??'playtest-out/watch-review';
const delivery='playtest-out/watch-delivery-20261001';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file))});
const receipts={
 broad:receipt('playtest-out/watch-regression-release1-20261001/result.json'),
 terrain:receipt('playtest-out/watch-terrain-release1-20261001/result.json'),
 firefox:receipt('playtest-out/watch-firefox-release1-20261001/result.json'),
 coop:receipt('playtest-out/watch-coop-release1-20261001/result.json'),
 layout:receipt('playtest-out/watch-layout-release2-20261001/result.json'),
 portable:receipt('playtest-out/watch-portable-release1-20261001/result.json'),
 package:receipt(`${delivery}/package.json`),
};
for(const key of['broad','firefox','terrain']){assert.equal(receipts[key].result.status,'passed');assert.equal(receipts[key].result.failed,0);}
for(const key of['coop','layout','portable','package'])assert.equal(receipts[key].result.ok,true);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fp=createHash('sha256');
for(const file of files){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
const source={sha256:fp.digest('hex'),files:files.length};
for(const key of['broad','firefox','terrain'])assert.equal(source.sha256,receipts[key].result.source.sha256);
for(const key of['coop','layout'])assert.equal(source.sha256,receipts[key].result.sourceSha256);
assert.equal(receipts.portable.result.artifactSha256,receipts.package.result.artifact.sha256);
for(const row of receipts.package.result.sourceFiles)assert.equal(hash(readFileSync(row.file)),row.sha256,`Source ZIP matches ${row.file}`);
const solo='playtest-out/watch-regression-release1-20261001/chromium-1-watch-combat';
const floors='playtest-out/watch-regression-release1-20261001/chromium-1-watch-route';
const route='playtest-out/watch-regression-release1-20261001/chromium-1-d3';
const coop='playtest-out/watch-coop-release1-20261001',ui='playtest-out/watch-layout-release2-20261001';
const rows=[
 ['The clock stopped after the last train',`${floors}/04-watchkeeper-vestibule.png`,'The Buried Watch becomes a drowned observatory and transit station. Original tablets describe a keeper still guarding empty platforms after the town evacuated. Both floors retain their campaign route, with quick original voxel materials ready for later polish.'],
 ['Salt stone, blue glass and brass rails',`${floors}/22-crossing-arsenal.png`,'Six local dungeon floors cover all 22 rooms and the Colossus Court. Sunreach adds four sparse paving and rail materials. The Crossing Arsenal now holds two active brass sentries on separate banks, with cover, throwable pots, hook posts and shutters earned through the fight.'],
 ['Closed shutters ask for a different approach',`${solo}/01-brass-shutters.png`,'A Meridian Sentry blocks sword and arrow hits from its front. A flank still works. Its 18 HP gives the starting sword and full-health beam more than one exposed strike. Actual input checks frontal blocking and rear damage.'],
 ['Pull the armor open',`${solo}/02-hook-opens-lens.png`,'The grapple does zero damage and retracts the brass shutters for four seconds. Its hit cancels a pending attack and exposes the cyan lens for a sword punish. Physical pottery is another interruption; fighting after the volley or flanking also works.'],
 ['Three lines, one committed volley',`${solo}/04-three-lane-warning.png`,'The sentry marks its aimed volley for 0.9 seconds. Moving sideways evades the three slow bolts. An ordinary tier-two shield can block them. After firing, the sentry exposes itself for a 1.25-second recovery, then closes its armor and approaches again.'],
 ['The optional guard has a real reward',`${solo}/07-sun-dial-prize.png`,'Hook and Guard now reveals the Sun Dial cache after its two guards fall. Actual hook-and-sword input clears the sentry and physical chest interaction earns a permanent passive extender. Saved guards and the opened cache cannot repeat the reward.'],
 ['The chain reaches a forgotten platform',`${floors}/02-eight-tile-crossing.png`,'Sunken Meridian is a new route south of Quiet Dunes. The ordinary six-tile chain misses its far post; the Sun Dial extends new hooks to eight tiles. Actual traversal reaches safe dry floor, a one-time heart fragment, and a working return post.'],
 ['A guest can open the same armor',`${coop}/guest/01-guest-opens-shared-armor.png`,'Muted Chromium and Firefox connect through local Trystero RTC. A real Firefox guest hook opens the same living sentry on both browsers without damage. Its natural warning is replicated, and an owner-fired bolt applies personal damage on the guest replica.'],
 ['The unfinished fight survives an owner leaving',`${coop}/guest/02-owner-transfer-keeps-opening.png`,'The host leaves during the armor opening. The guest inherits one exposed living sentry with its HP and remaining window intact, then finishes it through actual sword input. The physical cache shares the extender with the friend exploring another era.'],
 ['The other friend can use the reward immediately',`${coop}/host/04-friend-crosses-sunken-meridian.png`,'The shared passive changes the remote friend?s next hook to eight tiles. That friend crosses the new basin and opens its platform chest; the permanent heart fragment reaches the friend still in the Watch. Reuniting and loading the guest save keep both rewards and the cleared cache.'],
 ['Treasure text stays clear of touch controls',`${ui}/landscape-large-sun-dial-prize.png`,'Visual inspection caught the new prize text hiding behind touch buttons despite fitting the canvas. Reward captions now hide the pad while the treasure pose already holds actions. The test measures caption overlap with visible DOM controls, plus complete tablet paging at both text sizes.'],
 ['The crown still leads to the Colossus',`${route}/10-colossus-feet.png`,'The complete two-floor route still earns both keys, both grapple caches, the crown, Colossus weak-point victory and the third orb. The standalone HTML runs real armor-hook and extended-traversal checks in both browsers. The delivery retains source, portable build and hashed receipts.'],
];
const slides=rows.map(([title,file,caption])=>{const b=readFileSync(file);return{title,file,caption,sha256:hash(b),image:`data:image/png;base64,${b.toString('base64')}`};});
const limitations=[
 `${receipts.broad.result.assertions} Chromium assertions and ${receipts.firefox.result.assertions} Firefox assertions pass on the packaged game source. The broad run covers the four dungeons, tower, combat, saves, terrain, era adventures, companions and UI; Firefox runs two seeds. Every case runs afresh.`,
 `${receipts.coop.result.checks.length} local RTC checks and ${receipts.layout.result.checks.length} mouse/touch checks pass. Local signaling uses an isolated relay and empty ICE servers; public signaling and separate-network connectivity remain untested.`,
 'Story, positions, equipment, stationary AI, unrelated pickups and some guard kills use disclosed fixtures. Sword, hook, pottery, timed volley, dodge, shield, chest interaction, long traversal and tablet paging use actual gameplay. Automated checks do not measure enjoyment.',
 'Every browser is muted. Existing NPC recordings were not generated, decoded or played again. Packaging verifies compressed voice bytes; machine tablets do not add NPC voice lines.',
 'The public site is unchanged. More town and era adventures, temple encounters and broader visual polish remain future work. Earlier failed development receipts are preserved.',
];
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.json`, JSON.stringify({ builtUtc: new Date().toISOString(), source, receipts, limitations, slides: slides.map(({ image, ...row }) => row) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Sunreach and the Buried Watch</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../watch-delivery-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../hive-review/index.html">Previous Rootglass slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} Buried Watch slides with verified source, packet and receipt hashes.`);

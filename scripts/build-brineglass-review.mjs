// Fresh silent screenshots, source fingerprints and package receipts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out=process.argv[2]??'playtest-out/brineglass-review';
const delivery='playtest-out/brineglass-delivery-20261001';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file))});
const receipts={
 broad:receipt('playtest-out/brineglass-regression-release1-20261001/result.json'),
 terrain:receipt('playtest-out/brineglass-terrain-release2-20261001/result.json'),
 firefox:receipt('playtest-out/brineglass-firefox-release1-20261001/result.json'),
 coop:receipt('playtest-out/brineglass-coop-release2-20261001/result.json'),
 layout:receipt('playtest-out/brineglass-layout-release1-20261001/result.json'),
 portable:receipt('playtest-out/brineglass-portable-release1-20261001/result.json'),
 multiplayer:receipt('playtest-out/brineglass-multiplayer-release1-20261001/result.json'),
 syntax:receipt('playtest-out/brineglass-static-20261001/syntax.json'),
 package:receipt(`${delivery}/package.json`),
};
for(const key of['broad','firefox','terrain']){assert.equal(receipts[key].result.status,'passed');assert.equal(receipts[key].result.failed,0);}
for(const key of['coop','layout','portable','package','syntax'])assert.equal(receipts[key].result.ok,true);
assert.equal(receipts.multiplayer.result.failed,0);
assert.equal(receipts.multiplayer.result.passed,69);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fp=createHash('sha256');
for(const file of files){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
const source={sha256:fp.digest('hex'),files:files.length};
for(const key of['broad','firefox','terrain'])assert.equal(source.sha256,receipts[key].result.source.sha256);
for(const key of['coop','layout'])assert.equal(source.sha256,receipts[key].result.sourceSha256);
assert.equal(receipts.portable.result.artifactSha256,receipts.package.result.artifact.sha256);
for(const row of receipts.package.result.sourceFiles)assert.equal(hash(readFileSync(row.file)),row.sha256,`Source ZIP matches ${row.file}`);
const solo='playtest-out/brineglass-regression-release1-20261001/chromium-1-brineglass-combat';
const floors='playtest-out/brineglass-regression-release1-20261001/chromium-1-brineglass-route';
const route='playtest-out/brineglass-regression-release1-20261001/chromium-1-d4';
const coop='playtest-out/brineglass-coop-release2-20261001',ui='playtest-out/brineglass-layout-release1-20261001';
const rows=[
 ['A keeper left one light for tomorrow',`${floors}/07-brineglass-vestibule.png`,'Brineglass gains an optional original adventure about a shore keeper whose last lamp never reached its destination. The temple retains its real-time campaign and two-floor route while its new kiln connects a useful item to a future town memorial.'],
 ['Sea glass, salt stone and copper heat pipes',`${floors}/18-pressure-patrol.png`,'Six quick native floor types cover all 26 temple rooms and Undertow Court. Four coastal paths add jetty boards, shell roads, tidal glass and copper conduits. The original Pressure Patrol key now waits behind two sliding Tideglass Skaters. Actual blocks push over all six temple surfaces.'],
 ['Read the line before the skater moves',`${solo}/04-marked-slide.png`,'An ice shell stops swords, full-health beams and arrows from every angle. The skater marks its aimed lane for 0.85 seconds, then commits to a fast straight slide. Its tell and pose are replicated; stepping sideways avoids the attack.'],
 ['Fire opens the shell',`${solo}/02-fire-opens-shell.png`,'A real wand bolt deals six damage, breaks the shell open for five seconds and cancels a pending charge. Physical pots provide a shorter opening. The grapple interrupts for zero damage while leaving the ice closed, giving it a different role from the Watch sentry fight.'],
 ['A missed charge is also an opening',`${solo}/06-crash-opening.png`,'After a miss or wall collision the skater exposes a 1.8-second recovery. Actual sword input punishes that opening without fire. The optional kiln holds two one-time skaters; real fire-and-sword kills reveal its Ember Lens chest, and partial reload keeps a defeated guard defeated.'],
 ['The kiln reward changes your next shot',`${ui}/desktop-normal-ember-lens-prize.png`,'The permanent shared Ember Lens lets each newly fired bolt melt two consecutive ice blocks instead of one. It remains passive, and walls, bowls and enemies still stop the bolt. A bolt already in flight keeps its original budget. The physical cache and opened state survive reload without repeating the reward.'],
 ['One bolt clears a double ice seal',`${floors}/02-two-block-thaw.png`,'The route check compares an actual base-wand shot with an upgraded shot on the same ice lane. It also verifies wall and bowl boundaries. In co-op, one guest shot requests both melts from the room owner while ignoring only its accepted first ice footprint during the reply.'],
 ['Bring the fire back to the shore',`${floors}/04-warm-shore-beacon.png`,'The Last Shore Light is a new screen south of Hookshore Landing and west of Pilgrim Strand. The base wand cannot restore its cracked beacon. An Ember Lens and actual fire wake the saved machine, whose old copper line carries warmth toward Mossbrook. Both coast exits are walked in the test.'],
 ['Friends share the fight and its new tool',`${coop}/guest/03-open-shell-owner-transfer.png`,'Muted Chromium and Firefox use local Trystero RTC. A guest takes real contact damage, opens the same skater with fire, and inherits its HP and remaining opening after the owner leaves. Actual guest swords finish the fight, and the physical lens chest shares its upgrade with the friend exploring the future.'],
 ['The light reaches a friend already in tomorrow',`${coop}/host/06-friend-sees-future-light.png`,'Lighting the coast changes the memorial while the other friend stays in the Silent Year. A physical vault beside it grants one permanent magic gem to both heroes. Reuniting, reopening and loading the guest save preserve the memory without duplicating it. The original seed vault still requires its separate water repair.'],
 ['The adventure remains readable on a phone',`${ui}/phone-large-journal-offer.png`,'A Light for Tomorrow can be tracked through kiln, shore, hourgate and memorial stages. Seven complete native conversations, four journal states, both visible reward captions and the warning HUD are checked at three viewports and both text sizes. Real mouse and touch paging expose every paragraph; controls return after captions expire.'],
 ['The fourth light still leads onward',`${route}/12-nacre-surface.png`,'The full temple route still earns four keys, the wand, shield, tide crown, Nacre victory, fourth orb and Freeze before the Fourfold Tower. The broad gauntlet checks all four temples, tower, combat, saves, companions and UI. The source ZIP, standalone HTML and every slide are matched to saved hash receipts.'],
];
const slides=rows.map(([title,file,caption])=>{const b=readFileSync(file);return{title,file,caption,sha256:hash(b),image:`data:image/png;base64,${b.toString('base64')}`};});
const limitations=[
 `${receipts.broad.result.cases.reduce((n,c)=>n+c.assertions,0)} Chromium gameplay assertions and ${receipts.firefox.result.cases.reduce((n,c)=>n+c.assertions,0)} Firefox gameplay assertions pass on the packaged game source. The broad run covers the four dungeons, tower, combat, saves, terrain, era adventures, companions and UI; Firefox runs two seeds. Every case runs afresh. Additional terrain and retry checks run in both engines; ${receipts.syntax.result.files} game JavaScript files parse. Counts exclude the launch-policy stage.`,
 `${receipts.coop.result.checks.length} local RTC checks and ${receipts.layout.result.checks.length} mouse/touch checks pass. The existing multiplayer suite also passes ${receipts.multiplayer.result.passed} checks, including physical friend contact and harmless sword bonks. Local signaling uses an isolated relay and empty ICE servers; public signaling and separate-network connectivity remain untested.`,
 'Story, positions, equipment, stationary AI, unrelated pickups and some guard kills use disclosed fixtures. Sword, hook, fire, pottery, timed charge, dodge, guest contact, ice melt, physical chests, beacon and complete dialogue paging use actual gameplay. Automated checks do not measure enjoyment.',
 'Every browser is muted. Existing NPC recordings were not generated, decoded or played again. Packaging verifies compressed voice bytes; machine tablets do not add NPC voice lines.',
 'The public site is unchanged. More town and era adventures, temple encounters and broader visual polish remain future work. Earlier failed development receipts are preserved.',
];
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/manifest.json`, JSON.stringify({ builtUtc: new Date().toISOString(), source, receipts, limitations, slides: slides.map(({ image, ...row }) => row) }, null, 2));
const data = JSON.stringify(slides).replaceAll('<', '\\u003c');
writeFileSync(`${out}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Brineglass and a Light for Tomorrow</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../brineglass-delivery-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../watch-review/index.html">Previous Watch slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} Brineglass slides with verified source, packet and receipt hashes.`);

// Twelve fresh silent receipts; reject mismatched tested, packaged or pictured source.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out=process.argv[2]??'playtest-out/mara-review',delivery='playtest-out/mara-delivery-final-20261001';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file))});
const receipts={
 broad:receipt('playtest-out/mara-regression-release1-20261001/result.json'),
 firefox:receipt('playtest-out/mara-firefox-release1-20261001/result.json'),
 interaction:receipt('playtest-out/mara-interaction-release2-20261001/result.json'),
 coop:receipt('playtest-out/mara-coop-release1-20261001/result.json'),
 tern:receipt('playtest-out/mara-tern-coop-release1-20261001/result.json'),
 layout:receipt('playtest-out/mara-layout-release2-20261001/result.json'),
 multiplayer:receipt('playtest-out/mara-multiplayer-release2-20261001/result.json'),
 portable:receipt('playtest-out/mara-portable-release1-20261001/result.json'),
 visual:receipt('playtest-out/mara-visual-retakes-20261001/result.json'),
 voices:receipt('playtest-out/mara-voice-assets-20261001/result.json'),
 bake:receipt('playtest-out/mara-voice-bake-20261001/result.json'),
 syntax:receipt('playtest-out/mara-static-20261001/syntax.json'),
 package:receipt(`${delivery}/package.json`),
};
for(const key of['broad','firefox','interaction']){assert.equal(receipts[key].result.status,'passed');assert.equal(receipts[key].result.failed,0);}
for(const key of['coop','tern','layout','portable','visual','syntax','package'])assert.equal(receipts[key].result.ok,true);
assert.equal(receipts.voices.result.ok,true);assert.equal(receipts.voices.result.scope,'assets-only');
assert.equal(receipts.multiplayer.result.failed,0);assert.equal(receipts.multiplayer.result.passed,69);
assert.equal(receipts.bake.result.status,'passed');assert.equal(receipts.bake.result.shipped.lines,1445);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fp=createHash('sha256');
for(const file of files){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
const source={sha256:fp.digest('hex'),files:files.length};
for(const key of['broad','firefox','interaction'])assert.equal(source.sha256,receipts[key].result.source.sha256);
for(const key of['coop','tern','layout','visual'])assert.equal(source.sha256,receipts[key].result.sourceSha256);
assert.equal(receipts.portable.result.artifactSha256,receipts.package.result.artifact.sha256);
assert.equal(receipts.visual.result.artifactSha256,receipts.package.result.artifact.sha256);
for(const row of receipts.package.result.sourceFiles)assert.equal(hash(readFileSync(row.file)),row.sha256,`Source ZIP matches ${row.file}`);
const solo='playtest-out/mara-regression-release1-20261001/chromium-1-mara',coop='playtest-out/mara-coop-release1-20261001',ui='playtest-out/mara-layout-release2-20261001';
const rows=[
 ['A keeper waiting for a light',`${ui}/desktop-normal-unlit-2.png`,'Keeper Mara now has an original story behind her shore tutorial. Her father kept a lamp for boats that had not been built yet. She stays at Hookshore Landing until the missing Ember Lens brings its warmth home. Her native keeper rig has a plum coat, pale braid, paddle and lantern.'],
 ['The shore adventure earns a companion',`${solo}/02-light-for-tomorrow.png`,'The scenario actually fires through the double ice seal and lights the beacon. An unlit shore cannot recruit Mara through either dialogue or the recruitment API. The restored light unlocks her choice; visiting its future memorial also changes her conversation.'],
 ['Mara can finally take her paddle somewhere new',`${ui}/desktop-normal-lit-choices.png`,'Travel with Mara brings the keeper along. Keep the shore returns her to her post. The native recruitment dialogue links her personal story to Mira and explains their fire technique. Her resident model and collider disappear while she travels; rejoining never repeats the beacon reward.'],
 ['Three companions, three silhouettes',`${solo}/04-three-companions.png`,'Mira, caretaker Tern and keeper Mara follow actual hero walking. There is one of each, with free-ground placement, different trail spacing and shared leader poses. Mara is quick native voxel art for later Boxel polish; she carries her own paddle rather than another wrench.'],
 ['Fire and water make a Steamwheel',`${solo}/05-steamwheel-opens-two-shells.png`,'With Mira and Mara nearby, select the Fire Wand and press Guard + Item. Three personal magic gems buy an eight-damage fire pulse against nearby foes. The actual combination opens both ice shells through the normal damage pipeline, consumes Item and shows expanding fire-and-steam rings.'],
 ['A technique with useful limits',`${ui}/desktop-steam-empty.png`,'Steamwheel needs three magic gems, recharges for six seconds and requires both companions in unobstructed range. It respects action locks, knockback, stalls, pottery, active sword attacks, grapple pulls, item selection and item locks. Actual casts do not burn through walls or reach distant foes; idle followers do not farm the room.'],
 ['A keeper steps into the First Bloom',`${solo}/07-keeper-in-the-first-bloom.png`,'Mara follows the real eastward room edge into the Singing Workshop. Save/load preserves all three recruitments while clearing temporary combat effects. Dismissal and rejoining use actual conversations, and a fresh adventure clears every follower. Facing a crowded group now favors the person directly in front.'],
 ['A guest can turn the wheel too',`${coop}/guest/03-guest-opens-shared-shells.png`,'Muted Chromium and Firefox connect over local Trystero RTC. A guest casts beside the shared companions inside the other hero room. The owner applies eight damage once to each skater and shares the fire opening; each browser receives one cue. Only the guest spends magic, and neither friendly hero loses life.'],
 ['Friends can still explore different years',`${coop}/host/04-leader-in-the-first-bloom.png`,'All three companions stay with their leader when the other hero explores another era. Leaving the kiln transfers both living skaters and their remaining fire openings to the guest. A distant hero cannot borrow the companions; reunion restores the combination, and dismissal synchronizes across the party.'],
 ['The party carries on after departure',`${coop}/guest/05-surviving-keeper-party.png`,'When the host leaves, Mira, Tern and Mara transfer safely to the surviving hero without duplication. The new leader casts Steamwheel and saves the shared recruitments. Actual friendly sword input still bonks the other hero without damage. Tern shelter and Mira charged-spin regressions also pass.'],
 ['Every paragraph remains readable on a phone',`${ui}/phone-normal-lit-choices.png`,'All four-paragraph keeper conversations, including the future-memory variant, are paged completely through real mouse and touch at three viewports and both text sizes. Text, panels and touch controls are measured. Real two-finger Guard + Item casts once; short landscape feedback and active shelter no longer collide with the Fire Wand prompt. Seven new Kokoro lines bring the current voice bank to about 20.06 MB.'],
 ['A playable packet with receipts',`playtest-out/mara-visual-retakes-20261001/01-portable-keeper-party.png`,'The standalone HTML performs the same real Steamwheel cast in Chromium and Firefox and reloads its recruitment correctly. A fresh muted capture checks both eight-damage fire openings before showing the party clearly. The broad regression includes all four temples, the tower, combat, saves, quests, eras and companions. This review, the source ZIP, recordings and portable build are linked by saved hashes.'],
];
const slides=rows.map(([title,file,caption])=>{const b=readFileSync(file);return{title,file,caption,sha256:hash(b),image:`data:image/png;base64,${b.toString('base64')}`};});
const gameplay=['broad','firefox','interaction'].reduce((n,key)=>n+receipts[key].result.cases.reduce((a,c)=>a+c.assertions,0),0);
const limitations=[
 `${gameplay} gameplay assertions pass on the packaged source. Counts exclude launch-policy stages; Firefox runs two seeds. ${receipts.layout.result.checks.length} layout and input checks cover ${receipts.layout.result.captures.length} measured captures. ${receipts.syntax.result.files} game JavaScript files parse.`,
 `${receipts.coop.result.checks.length} Mara and ${receipts.tern.result.checks.length} existing Tern RTC checks pass, alongside the existing ${receipts.multiplayer.result.passed}-check multiplayer suite. Public signaling and separate-network ICE remain untested.`,
 'Positions, stationary combat AI, archive progression, lens ownership, magic capacity and some terrain use disclosed fixtures. Beacon fire, conversations, choices, walking, technique controls, guest damage, friendly bonks, pointer paging, touch combinations, saving and migration use actual gameplay. Tests do not measure enjoyment.',
 'Every browser forces output mute. Only seven missing Mara recordings were generated; the old bank was not played or decoded again. Compressed asset and portable embedding checks do not establish perceptual voice quality. No Kokoro model ships in the game.',
 'Local delivery only. The public site remains unchanged. Earlier failed development receipts are preserved. Further town and era adventures, encounter variety and visual polish remain ongoing work.',
];
mkdirSync(out,{recursive:true});writeFileSync(`${out}/manifest.json`,JSON.stringify({builtUtc:new Date().toISOString(),source,receipts,limitations,slides:slides.map(({image,...row})=>row)},null,2));
const data=JSON.stringify(slides).replaceAll('<','\\u003c');
writeFileSync(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Keeper Mara and Steamwheel</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../mara-delivery-final-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../brineglass-review/index.html">Previous Brineglass slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} Mara slides with verified source, packet and receipt hashes.`);

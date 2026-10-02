// Twelve native before/after slides. Enforce tested, packaged and pictured hashes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const out=process.argv[2]??'playtest-out/party-review',delivery='playtest-out/party-delivery-20261001';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file))});
const receipts={
 broad:receipt('playtest-out/party-regression-release2-20261001/result.json'),
 firefox:receipt('playtest-out/party-firefox-release2-20261001/result.json'),
 portable:receipt('playtest-out/party-portable-release2-20261001/result.json'),
 coop:receipt('playtest-out/party-coop-release2-20261001/result.json'),
 layout:receipt('playtest-out/party-layout-release1-20261001/result.json'),
 audit:receipt('playtest-out/party-audit-release1-20261001/result.json'),
 retakes:receipt('playtest-out/party-retakes-release2-20261001/result.json'),
 syntax:receipt('playtest-out/party-syntax-20261001/result.json'),
 package:receipt(`${delivery}/package.json`),
 baseline:receipt('playtest-out/party-baseline-20261001/result.json'),
};
for(const key of['broad','firefox','portable'])assert.equal(receipts[key].result.status,'passed');
for(const key of['coop','layout','audit','retakes','syntax','package'])assert.equal(receipts[key].result.ok,true);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fp=createHash('sha256');
for(const file of files){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
const source={sha256:fp.digest('hex'),files:files.length};
for(const key of['broad','firefox','portable'])assert.equal(source.sha256,receipts[key].result.source.sha256);
for(const key of['coop','layout','audit','retakes','syntax'])assert.equal(source.sha256,receipts[key].result.sourceSha256);
assert.equal(receipts.retakes.result.artifactSha256,receipts.package.result.artifact.sha256);
for(const row of receipts.package.result.sourceFiles)assert.equal(hash(readFileSync(row.file)),row.sha256,`Source ZIP matches ${row.file}`);
const base='playtest-out/party-baseline-20261001/chromium',after='playtest-out/party-audit-release1-20261001/chromium';
const solo='playtest-out/party-regression-release2-20261001/chromium-17-party-travel';
const rows=[
 ['Before: the opening disappeared in white',`${base}/04-flash-0.15.png`,'This preserved baseline actually casts Steamwheel. Both shells lose eight HP and enter the open pose, but full-white emission hides their colours for the entire 0.3-second hit clock. The timer itself expires correctly. This slide intentionally shows the previous game source; its audit and hash are retained.'],
 ['After: the shell and its opening stay readable',`${after}/04-flash-0.15.png`,'The same native kiln fixture and real Guard + Item cast now produce a limited warm glow that fades during the stagger. At this point the creatures still have a positive stun timer, but their open poses and colours are visible. The cast still costs three personal magic and deals eight fire damage to each shell.'],
 ['Before: a wall separated the keeper from the party',`${base}/02-after-corner.png`,'The hero walked around this actual collision wall with stick input. Mara stopped on its opposite side because the old follower used straight-line distance to the hero. Her nearby technique check failed. Terrain, recruitment and the empty room are disclosed fixtures; positions were not manually moved during the course.'],
 ['After: everyone reconnects around the wall',`${after}/02-after-corner.png`,'Followers measure their route around terrain, reconnect on clear ground and repair a locally blocked route. The same course now ends with all three companions in unobstructed technique range and every walking pose settled. The camera still frames the hero; rear models can overlap scenery or the HUD in some orientations.'],
 ['Distinct silhouettes when the party stops',`${solo}/05-repaired-trail.png`,'Mira, Tern and Mara use wider trail spacing and a terrain-safe separation when settled. Their quick native rigs remain distinct. Actual straight travel, both wall turns, reversals and a changed tile are measured every tick. Moving companions can pass one another when the hero turns back; heroes are never blocked by followers.'],
 ['Single file through a one-tile course',`${solo}/04-one-tile-corridor.png`,'The obstacle fixture contains three consecutive right-angle bends in a one-tile corridor. All three companions remain visible, stay on safe ground and move continuously. They return to unobstructed combination range, separate after settling and stop walking in place. A stationary party also remains settled for eight more seconds.'],
 ['Combat timing stays intact',`playtest-out/party-regression-release2-20261001/chromium-17-hit-feedback/01-wand-hit-readable.png`,'A real Fire Wand bolt deals six and opens an ice shell while its hit glow fades. The acceptance checks also cover a slowed long stun, repeated accepted hits, guarded swords and the original boss hit-immunity window. Flash timers clamp cleanly to zero, and reloads leave no stale enemy glow.'],
 ['A guest shares the opening and the hit cue',`playtest-out/party-coop-release2-20261001/host/02-host-sees-guest-steamwheel.png`,'Muted Chromium and Firefox connect over local Trystero RTC. The guest pays three personal magic; the room owner applies one eight-damage pulse to both shells. Both peers receive the warm hit appearance and one technique cue. Independent eras, reunion, dismissal, leader transfer and harmless friendly sword knockback also pass. These are local-network tests.'],
 ['Trails survive a real outdoor room edge',`${solo}/06-native-workshop-party.png`,'The hero actually walks east into the Singing Workshop in the First Bloom. Continuous outdoor room edges preserve the travelled route; warps, teleports and reloads replace stale trails. Arrival and new-leader placement check free ground, hazards, warp tiles and solid entities. Save/load keeps exactly one of each recruited follower.'],
 ['A fresh mobile combat frame',`playtest-out/party-portable-release2-20261001/chromium-17-hit-feedback/05-readable-combat-320.png`,'The standalone HTML performs the same real cast on a 320-pixel viewport. Manual captures now wait for canvas resize before drawing, which prevents the blank test image found during visual inspection. The mobile HUD retains the technique cost, recharge and cast feedback; portrait framing still crops creatures at the sides.'],
 ['The keeper conversation still fits',`playtest-out/party-layout-release1-20261001/phone-normal-lit-choices.png`,'The keeper conversation remains complete through real pointer paging and recruitment choices. The updated build passes 117 input and layout checks across 126 measured captures: desktop, portrait, landscape and both text sizes. Real two-finger Guard + Item casts once, and Guard + Sword still casts Tern shelter with all three companions.'],
 ['A portable party ready for the next adventure',`playtest-out/party-retakes-release2-20261001/03-portable-open-shells.png`,'This fresh standalone capture follows an actual three-magic Steamwheel and checks both eight-damage openings. The party faces the camera so the native silhouettes are clear. The source ZIP, portable HTML, images and runtime receipts are linked by hashes. All current compressed Kokoro lines remain embedded; no model download or audio playback was added.'],
];
const slides=rows.map(([title,file,caption],index)=>{const b=readFileSync(file);return{title,file,caption,sha256:hash(b),sourceSha256:[0,2].includes(index)?receipts.baseline.result.sourceSha256:source.sha256,image:`data:image/png;base64,${b.toString('base64')}`};});
const gameplay=['broad','firefox','portable'].reduce((n,key)=>n+receipts[key].result.cases.reduce((a,c)=>a+c.assertions,0),0);
const limitations=[
 `${gameplay} gameplay assertions, ${receipts.coop.result.checks.length} local RTC checks, ${receipts.layout.result.checks.length} UI checks and ${receipts.audit.result.checks.length} raw-audit checks pass on this game source. Launch-policy stages are separate.`,
 'Tests use disclosed terrain, progression, positions and stationary AI. Controls, moving routes, casts, guest damage, harmless bonks, migration, saving and pointer paging run through actual gameplay. Tests do not establish enjoyment or public separate-network connectivity.',
 'Followers stay non-solid while moving. The camera currently frames the hero; rear followers can be obscured by hedges or HUD panels and portrait frames crop peripheral foes. Group composition remains future work.',
 'Two slides intentionally show the preserved previous-source baseline. Other slides use the tested current game. Passing regression cases reused identical source and unchanged executed helpers; changed scenarios were rerun. Failed development receipts remain intact.',
 'All browser output is muted. Existing voice recordings were not replayed or decoded. The packet verifies their compressed bytes without shipping Kokoro weights. Local delivery only; Trent publishes the public site.',
];
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/manifest.json`,JSON.stringify({builtUtc:new Date().toISOString(),source,receipts,gameplayAssertions:gameplay,limitations,slides:slides.map(({image,...row})=>row)},null,2));
const data=JSON.stringify(slides).replaceAll('<','\\u003c');
writeFileSync(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: party travel and readable hits</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../party-delivery-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../mara-review/index.html">Previous keeper slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`PASS built ${slides.length} party slides with verified tested source, package and image hashes; ${gameplay} gameplay assertions.`);

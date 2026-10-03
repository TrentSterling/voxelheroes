import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const out='playtest-out/fourfold-crown-review',delivery='playtest-out/fourfold-crown-release-20261003';
const folders={native:'fourfold-crown-accepted-20261003',coop:'fourfold-crown-coop-final-20261003',offline:'fourfold-crown-offline-20261003'};
const read=f=>JSON.parse(readFileSync(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const results=Object.fromEntries(Object.entries(folders).map(([k,f])=>[k,read(`playtest-out/${f}/result.json`)]));
const sourceSha256=results.native.source.sha256;
for(const key of['native','offline']){assert.equal(results[key].status,'passed');assert.equal(results[key].failed,0);assert.equal(results[key].source.sha256,sourceSha256);assert.equal(results[key].integrity.sourceUnchanged,true);assert.deepEqual(results[key].integrity.changedTests,[]);}
for(const key of['coop']){assert.equal(results[key].ok,true);assert.equal(results[key].sourceUnchanged,true);assert.equal(results[key].sourceSha256,sourceSha256);}
const packet=read(`${delivery}/package.json`);assert.equal(packet.ok,true);assert.equal(packet.artifact.embeddedClipsVerified,1490);
assert.equal(packet.artifact.sha256,results.offline.artifact.sha256);assert.equal(hash(readFileSync(`${delivery}/${packet.artifact.file}`)),packet.artifact.sha256);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),entries=new Map(packet.sourceFiles.map(e=>[e.file,e])),fp=createHash('sha256');
for(const file of[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){const name=file.replaceAll('\\','/'),bytes=readFileSync(file);assert.equal(entries.get(name)?.sha256,hash(bytes));fp.update(name+'\0');fp.update(bytes);}
assert.equal(fp.digest('hex'),sourceSha256);
for(const key of ['native','offline','coop'])for(const [file,sha]of Object.entries(results[key].testSources??{}))assert.equal(entries.get(file)?.sha256,sha,`Packaged executed test source: ${key}/${file}`);
assert.equal(results.coop.testsUnchanged,true);
const native=`playtest-out/${folders.native}/firefox-17-tower-victory/`,architecture=`playtest-out/${folders.native}/firefox-17-tower-architecture/`,recovery=`playtest-out/${folders.native}/firefox-17-tower-recovery/`,coop=`playtest-out/${folders.coop}/guest/`;
const rows=[
  [
    "Before: a plain memory floor",
    "playtest-out/fourfold-earned-baseline-20261003/149-native-resting-light.png",
    "Retained previous-source diagnostic continuation of an earned four-orb campaign. The old Resting Light floor repeated rounded tiles. This before image is not current acceptance."
  ],
  [
    "The city clock holds four borrowed hours",
    "N142-native-first-reflection-intro.png",
    "Fresh-title earned four-temple route. Actual coast travel, fire-cleared doorway and ordinary tower entrance introduce the four tool anchors. No health edits, grants, immunity, teleports, direct damage or forced AI."
  ],
  [
    "A returning blade frees Return",
    "N143-native-return-anchor.png",
    "The earned boomerang hits the physical western winding. The pedestal blocks native enemy shots. Ancestor movement endpoint settling and the starter save roundtrip are disclosed."
  ],
  [
    "A placed bomb frees Break",
    "N144-native-break-anchor.png",
    "Native powder-supply interaction and an actual placed bomb free the brass winding. The hero walks away from the real blast."
  ],
  [
    "A real grapple frees Draw",
    "N145-native-draw-anchor.png",
    "The earned grapple hits the physical anchor and pulls the same hero. The clock encounter continues on its ordinary attack timers."
  ],
  [
    "Four tools set the hands moving",
    "N146-native-clock-unwound.png",
    "An actual Fire Wand shot frees Kindle. Four real tool collisions clear the reflections and unlock the northern memory stair, without another permanent heart."
  ],
  [
    "Iona teaches a spell that can be cast",
    "N148a-native-first-spell-cast.png",
    "Actual Iona conversation teaches the first Truesight spell. Ordinary item input spends the earned reserve and activates sight, even though optional earlier sages were skipped."
  ],
  [
    "The amber rest room has its own floor",
    "N149-native-resting-light.png",
    "Native chest interaction gives the amber map. The actual well restores personal life and magic. Mosaic, stone lanes and brass edges distinguish rest from patrol rooms."
  ],
  [
    "Amber mechanisms use service grates",
    "N150-native-amber-windings.png",
    "Actual returning throws wake both windows within their ordinary seven-second interval. The mechanism floor uses quiet slate, grates and a clear central route."
  ],
  [
    "Ceremonial stone surrounds the crown",
    "N151-native-amber-crown.png",
    "The native shutter opens the western vault. Ordinary chest interaction grants this floor's separate crown key. The floor carries one large borrowed-hour seal."
  ],
  [
    "The queen must actually be overturned",
    "N154-native-queen-overturned.png",
    "Native rematch using real bombs, movement, guard and sword. The queen is overturned by actual collisions; her phase and health are never set by the controller."
  ],
  [
    "The Bastion Shield is earned",
    "N156-native-bastion-shield.png",
    "Actual queen victory unlocks the reward stair. The physical chest grants and equips Bastion, which guards tier-six crown storms. Rematches do not add permanent hearts."
  ],
  [
    "Sand memory rests on warm masonry",
    "N160-native-sand-rest.png",
    "Native sand patrol gives its independent key. The actual west map chest and physical well prepare the hero; its floor uses the warm sand palette."
  ],
  [
    "The real counterweight opens the vault",
    "N161-native-sand-counterweight.png",
    "Normal directional movement pushes the actual block onto its plate. New decorative floor markings remain walkable and accept native pushes."
  ],
  [
    "The multipart colossus falls again",
    "N165-native-colossus-result.png",
    "Actual feet, arms and core are defeated with ordinary earned inputs. The complete rematch runs without damage APIs, forced boss windows, health edits or immunity."
  ],
  [
    "Dawn is selected through Equipment",
    "N166-native-dawn-equipment.png",
    "The sand reward grants Dawn Blade. Actual Tab, quick-cycle and Enter input equip it through the normal Equipment screen; subsequent battles use that chosen blade."
  ],
  [
    "Tide memory has cool slate and mosaics",
    "N170-native-tide-rest.png",
    "Native patrol, separate key, map and personal rest continue the earned campaign. The tide palette and room-specific floor plan remain original code-built boxels."
  ],
  [
    "The quiet tide court keeps its channel",
    "N173-native-nacre-rematch-intro.png",
    "Actual crown entry introduces the Nacre rematch. Quiet banks retain the authored four-column water channel and four physical grapple posts."
  ],
  [
    "Nacre falls through earned crossings",
    "N175-native-tide-memory-result.png",
    "Native fire, grapple, shield and Dawn attacks clear the full live rematch. The controller reads banks and attack clocks and writes only ordinary input."
  ],
  [
    "The tide treasury pays once",
    "N176-native-tide-treasury.png",
    "Actual reward-stair travel and physical chest opening grant a thousand coins once. A normal floor well then prepares the hero for the last ascent."
  ],
  [
    "Ash stone marks the crown stair",
    "N180-native-crown-stair.png",
    "Native memory completion reaches the Fourfold Crown. The ash palette, large hour seal and brass border give the final floor its own architecture."
  ],
  [
    "The true keeper enters the throne",
    "N183-native-veyl-intro.png",
    "Fresh earned route through all four temples and all three rematches. The crown guard, physical last key, normal well and actual final door lead to Veyl."
  ],
  [
    "Only the real reflection has a shadow",
    "N184-native-veyl-band-2.png",
    "Native Truesight, live clones, magic wisps and sword inputs. No shadows, phases, boss health or hero capacity are edited. One violet wisp supplies a full normal spell charge."
  ],
  [
    "The real mask breaks",
    "N185-native-mask-result.png",
    "The earned hero survives actual Veyl combat. His normal defeat persists the broken mask and introduces Caldrin; no diagnostic checkpoint is loaded by this acceptance case."
  ],
  [
    "A surviving hero can return to the last well",
    "N186a-native-between-boss-rest.png",
    "Actual southern stairs return directly to The Last Door. Normal interaction restores personal vitals between the two bosses. Returning preserves the broken mask and starts one Caldrin."
  ],
  [
    "Gold marks an attack opening",
    "N187-native-crown-recover.png",
    "Native Caldrin attack recovery opens a gold ring for up to three actual hits. The crown guards during stalking and windups. Recovery gives time to attack, then raise the shield."
  ],
  [
    "Lightning marks are left with real movement",
    "N187-native-crown-lightning.png",
    "Actual final-boss lightning follows its normal timer. The earned controller leaves marked squares, guards incoming storms and attacks the visible recovery openings."
  ],
  [
    "The earned campaign defeats Caldrin",
    "N188-native-crown-result.png",
    "The live 140-HP Hollow Crown is defeated with normal Dawn, Bastion and movement. The full fresh-title route contains no gear grants, immunity, health edits, teleports, direct damage or forced AI."
  ],
  [
    "Tomorrow belongs to the story",
    "N189-native-ending-1.png",
    "The actual earned completion opens the authored three-page ending. Ordinary confirmation advances the complete borrowed-hour story."
  ],
  [
    "The ending fits a phone",
    "N189a-native-ending-phone.png",
    "The same earned ending at 390 by 844. The full authored paragraph and button fit the viewport. This is browser layout coverage, not mobile hardware performance."
  ],
  [
    "The hero actually returns home",
    "N190-native-homecoming.png",
    "Normal ending confirmation physically returns the earned hero to Mossbrook. A diagnostic save records the completed state for later investigation."
  ],
  [
    "A real defeat can still happen",
    "R191-native-crown-defeat.png",
    "Separate fresh-title recovery case. The earned hero waits for actual Caldrin attacks to cause damage and death. No health or damage APIs are used."
  ],
  [
    "Try Again keeps the broken mask",
    "R193-native-single-crown-retry.png",
    "Actual Try Again retains Dawn, Bastion, the first spell, spent memory keys and Veyl victory. Native guard combat and physical doors return to exactly one Caldrin."
  ],
  [
    "A friend casts their own sight",
    "C01-personal-first-truesight.png",
    "Actual local Chromium/Firefox Trystero. Normal host Iona talk shares the usable first lesson. Guest item input spends only guest magic and keeps its shadow effect personal. Room positions, immunity and stationary enemies are fixtures."
  ],
  [
    "The last well heals one friend at a time",
    "C02-personal-last-well.png",
    "Local RTC position and low-vitals fixtures isolate actual guest rest. Its ordinary sword interaction restores that hero while the friend keeps their own life and magic."
  ],
  [
    "Both friends see the same opening",
    "C03-shared-crown-opening.png",
    "Local RTC controlled recovery and gear fixtures. Both peers share the crown actor and gold opening. Actual sword hits consume the three-hit budget and replicate identical boss health."
  ],
  [
    "The charged line clears the floor",
    "C04-shared-committed-charge.png",
    "Local RTC committed-charge fixture. Actual warning vertices clear the floor and follow the committed direction on owner and replica while the body interpolates. This is isolated cue coverage, not a fresh native charged-shot victory."
  ],
  [
    "One friend retreats; the other keeps the fight",
    "C05-crown-owner-transfer.png",
    "Actual independent southern retreat leaves a friend in the throne. The same shared crown and pending native attack clock continue under the remaining room owner. Campaign, gear, phase and immunity fixtures are disclosed. Public signaling and separate-network ICE are untested."
  ]
];
for(const row of rows){const base={N:native,A:architecture,R:recovery,C:coop}[row[1][0]];if(base)row[1]=base+row[1].slice(1);}
for(const row of rows)if(row[1].includes('/guest/')){try{readFileSync(row[1]);}catch{row[1]=row[1].replace('/guest/','/host/');}}
const slides=rows.map(([title,file,caption])=>({title,image:'../'+file.slice('playtest-out/'.length),caption,source:file,sha256:hash(readFileSync(file))}));
const manifest={createdUtc:new Date().toISOString(),sourceSha256,slides,results:folders,package:`../fourfold-crown-release-20261003/package.json`,scope:'Image-only silent review. Native campaign, isolated phase/layout fixtures and local RTC scopes are identified in each caption. The campaign continues beyond this checkpoint.'};
mkdirSync(out,{recursive:true});writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
const data=JSON.stringify(slides).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Fourfold Memories and the Hollow Crown</title><style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style><header><h1 id="title"></h1><nav><a href="../fourfold-crown-release-20261003/index.html">Build and source</a><a href="manifest.json">Receipts</a><a href="../nacre-tidewell-review/static.html">Earlier Nacre slides</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><span id="count"></span></footer><script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`;
writeFileSync(`${out}/static.html`,html);writeFileSync(`${out}/index.html`,html);
console.log(`PASS ${slides.length} image-only Fourfold memories and crown slides with exact source and receipt fingerprints.`);

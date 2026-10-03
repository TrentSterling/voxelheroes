import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const out='playtest-out/nacre-tidewell-review',delivery='playtest-out/nacre-tidewell-release-20261003';
const folders={native:'nacre-tidewell-native-20261003',coop:'nacre-tidewell-coop-20261003',offline:'nacre-tidewell-offline-20261003'};
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
const native=`playtest-out/${folders.native}/firefox-17-brineglass-victory/`,architecture=`playtest-out/${folders.native}/firefox-17-brineglass-architecture/`,recovery=`playtest-out/${folders.native}/firefox-17-brineglass-recovery/`,coop=`playtest-out/${folders.coop}/guest/`;
const rows=[
  [
    "Before: the same scattered floor everywhere",
    "playtest-out/undertow-equipment-acceptance-20261003/firefox-17-brineglass-crown-journey/92-native-brineglass-vestibule.png",
    "Frozen previous checkpoint, earned campaign entrance. The same six-motif scatter covered nearly every room. This is the retained before image."
  ],
  [
    "The vestibule has a clear center lane",
    "N92-native-brineglass-vestibule.png",
    "Fresh title through three earned victories and actual coast travel. Salt courses quiet the gallery; copper rails and four sparse weathered accents give it structure. Props, passages and collision remain authored."
  ],
  [
    "Charts carry a large tide compass",
    "A120-charts-architecture.png",
    "Arranged room and hero placement, enemies stationary and harmless. The actual fine-floor mesh combines chart checker, brass border, glass sides and one large compass. Vertex and interior-clearance checks use the real renderer and collision."
  ],
  [
    "The sluice has drained stone and grates",
    "A120-sluice-architecture.png",
    "Arranged geometry inspection. Drained slate, salt edges and wet grates distinguish the water works. The full campaign separately pushes the real counterweight; twelve floor types also accept actual pushes in the route contract."
  ],
  [
    "Fired clay belongs in the kiln",
    "A120-kiln-architecture.png",
    "Arranged room geometry with stationary harmless skaters. Fired clay, perimeter ventilation and a copper heat lane give the kiln its own use and color. Fire/sword shell fights remain actual gameplay in the earned route."
  ],
  [
    "Cold halls keep a pale glass path",
    "A120-ice-architecture.png",
    "Arranged geometry inspection. Salt courses, glass guidance and weathered edges mark the cooled hall. Authored ice bands still block movement until actual fire melts a path."
  ],
  [
    "The crown has ceremonial stone",
    "A120-sanctum-architecture.png",
    "Arranged geometry inspection. Quiet stone, brass borders, side shell mosaics and a central compass distinguish ceremonial vaults. The native route earns and opens the actual crown chest."
  ],
  [
    "Undertow has quiet banks",
    "A121-quiet-undertow-court.png",
    "Arranged arena view, intro skipped and enemies stationary and harmless. Slate removes the old scattered clutter. The four-column water channel and four grapple posts retain their physical coordinates."
  ],
  [
    "The map sits in the chart room",
    "N94-native-tide-charts.png",
    "Native earned campaign. Actual lantern combat gives a key and normal interaction opens the map chest. This view combines the new floor plan with the real progression reward."
  ],
  [
    "The wand comes from a warm cache",
    "N96-native-fire-wand.png",
    "Native earned campaign. The physical cache opens after normal guard combat and grants the Fire Wand. No gear grants, direct damage, artificial health, immunity, teleport or AI fixtures are used."
  ],
  [
    "Warden is earned and equipped",
    "N101-native-warden-equipment.png",
    "The actual optional vault grants Warden. Tab, item-cycle and Enter select it through the normal Equipment screen; the battle uses the selected blade."
  ],
  [
    "The lens is earned in the kiln",
    "N104-native-ember-lens.png",
    "Native earned campaign. Fire, shield and sword clear the real ice-shell guards and expose the lens chest. The passive upgrade later melts two consecutive ice blocks with one newly fired bolt."
  ],
  [
    "A physical tidewell prepares the hero",
    "N109-native-tidewell-rest.png",
    "Normal walking and interaction with the keeper cup restore personal hearts and magic before Nacre. This is gameplay healing. The fresh case never sets health directly or loads diagnostic checkpoints."
  ],
  [
    "The fourth keeper wakes",
    "N110-native-nacre-intro.png",
    "Fresh title through the earned four-key crown, actual tidewell rest and physical boss door. The intro is played normally. Ancestor endpoint settling and the earned starter save roundtrip are disclosed in the case description."
  ],
  [
    "Fire and shield make a crossing",
    "N111-native-nacre-band-3.png",
    "Native fight. The controller reads live banks and attack clocks and writes normal movement, guard, sword, item cycling and tool use. Nearby tentacles are burned and incoming ink is guarded; no boss phases or HP are edited."
  ],
  [
    "The next bank is reached with the grapple",
    "N111-native-nacre-band-2.png",
    "Native fight. Actual grapple latches carry the earned hero across the authored channel. One sword hit drives Nacre under, so the next ripple is followed rather than held in an artificial damage phase."
  ],
  [
    "The last openings are earned",
    "N111-native-nacre-band-1.png",
    "Native fight, real remaining boss HP. Regrowing tentacles and magic ink keep their ordinary clocks. The full source and controller are retained with the receipt hashes."
  ],
  [
    "Nacre falls through real combat",
    "N112-native-nacre-result.png",
    "The fresh earned hero defeats the real 105-HP fourth keeper alive. The actual defeat event, bank crossings and permanent-heart drop are checked. No immunity, teleport, granted gear or direct damage is used."
  ],
  [
    "The real permanent heart is reachable",
    "N113-native-fourth-heart.png",
    "Native earned reward. Walking to Nacre's real heart increases capacity by exactly one permanent heart. Its floor position comes from the production safe-reward placement."
  ],
  [
    "Fourth Light is claimed physically",
    "N114-native-fourth-orb.png",
    "The cleared arena's actual north exit leads to Fourth Light. Normal chest interaction grants the fourth orb and records chapter completion."
  ],
  [
    "The reward stairs return to the coast",
    "N115-native-nacre-homecoming.png",
    "The actual fourth-light stairs return to the coast with four earned keeper victories. The tower remains future work; this slide does not claim its completion."
  ],
  [
    "A real defeat remains recoverable",
    "R130-native-undertow-defeat.png",
    "Separate fresh-title recovery case. The earned hero waits while actual Nacre attacks cause real damage and death. No health or damage APIs, forced phases or artificial immunity are used."
  ],
  [
    "Try Again keeps the shortcut and gear",
    "R131-native-undertow-retry-shortcut.png",
    "Actual Try Again restores health at the entrance. Earned Warden, magic shield, lens, crown and spent-key state remain; ordinary walking through the unlocked shortcut returns directly to the antechamber."
  ],
  [
    "The open crown door permits another attempt",
    "R132-native-undertow-retry.png",
    "Native recovery case. The player walks back through the real open boss door. Exactly one fresh Nacre body is present, with the same earned hero capacity. This case checks recovery, not a second boss victory."
  ],
  [
    "The guest rests without healing their friend",
    "C04-guest-personal-tidewell.png",
    "Actual local Chromium/Firefox Trystero RTC. Room positions and low personal vitals are disclosed fixtures. Normal guest interaction heals only that hero; the friend independently uses the same cup. Public signaling and separate networks are outside scope."
  ],
  [
    "Both friends see the committed lanes",
    "C02-shared-undertow-tells.png",
    "Local RTC campaign, arena, phase and immunity fixtures isolate the multipart boss. Shared body and limb IDs, warning height and committed physical directions are checked while replica bodies interpolate."
  ],
  [
    "The remaining friend inherits the attack clocks",
    "C03-undertow-owner-transfer.png",
    "The room owner changes era with a ripple and four tentacle tells pending. The remaining friend inherits and advances those live clocks. This is local RTC fixture coverage, not a full native co-op campaign."
  ]
];
for(const row of rows){const base={N:native,A:architecture,R:recovery,C:coop}[row[1][0]];if(base)row[1]=base+row[1].slice(1);}
for(const row of rows)if(row[1].includes('/guest/03-')||row[1].includes('/guest/02-')){try{readFileSync(row[1]);}catch{row[1]=row[1].replace('/guest/','/host/');}}
const slides=rows.map(([title,file,caption])=>({title,image:'../'+file.slice('playtest-out/'.length),caption,source:file,sha256:hash(readFileSync(file))}));
const manifest={createdUtc:new Date().toISOString(),sourceSha256,slides,results:folders,package:`../nacre-tidewell-release-20261003/package.json`,scope:'Image-only silent review. Native campaign, isolated phase/layout fixtures and local RTC scopes are identified in each caption. The campaign continues beyond this checkpoint.'};
mkdirSync(out,{recursive:true});writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
const data=JSON.stringify(slides).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: Nacre, Tidewell and Room Architecture</title><style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style><header><h1 id="title"></h1><nav><a href="../nacre-tidewell-release-20261003/index.html">Build and source</a><a href="manifest.json">Receipts</a><a href="../undertow-equipment-review/static.html">Earlier equipment slides</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><span id="count"></span></footer><script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`;
writeFileSync(`${out}/static.html`,html);writeFileSync(`${out}/index.html`,html);
console.log(`PASS ${slides.length} image-only Nacre, tidewell and architecture slides with exact source and receipt fingerprints.`);

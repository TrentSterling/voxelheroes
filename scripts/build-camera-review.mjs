import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const out=process.argv[2]??'playtest-out/camera-review',delivery='playtest-out/camera-delivery-20261001';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file))});
const receipts={
 safety:receipt('playtest-out/camera-safety-final4-20261001/result.json'),
 regression:receipt('playtest-out/camera-regression-final2-20261001/result.json'),
 firefox:receipt('playtest-out/camera-firefox-final2-20261001/result.json'),
 portable:receipt('playtest-out/camera-portable-final2-20261001/result.json'),
 coop:receipt('playtest-out/camera-coop-final2-20261001/result.json'),
 touch:receipt('playtest-out/camera-touch-final4-20261001/result.json'),
 layout:receipt('playtest-out/camera-layout-final2-20261001/result.json'),
 cutaway:receipt('playtest-out/camera-cutaway-final-20261001/result.json'),
 audit:receipt('playtest-out/camera-audit-final2-20261001/result.json'),
 retakes:receipt('playtest-out/camera-retakes-final-20261001/result.json'),
 syntax:receipt('playtest-out/camera-syntax-final2-20261001/result.json'),
 watcher:receipt('playtest-out/camera-watcher-final2-20261001/result.json'),
 package:receipt(`${delivery}/package.json`),
 baseline:receipt('playtest-out/camera-baseline2-20261001/result.json'),
};
for(const key of['safety','regression','firefox','portable'])assert.equal(receipts[key].result.status,'passed',key);
for(const key of['coop','touch','layout','cutaway','audit','retakes','syntax','watcher','package'])assert.equal(receipts[key].result.ok,true,key);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const source={sha256:fp.digest('hex')};
for(const key of['safety','regression','firefox','portable'])assert.equal(receipts[key].result.source.sha256,source.sha256,key);
for(const key of['coop','touch','layout','cutaway','audit','retakes','syntax'])assert.equal(receipts[key].result.sourceSha256,source.sha256,key);
for(const row of receipts.package.result.sourceFiles)assert.equal(hash(readFileSync(row.file)),row.sha256,`ZIP matches ${row.file}`);
assert.equal(receipts.package.result.artifact.sha256,receipts.retakes.result.artifactSha256);
const before='playtest-out/camera-baseline2-20261001/chromium',after='playtest-out/camera-audit-final2-20261001/chromium';
const solo='playtest-out/camera-safety-final4-20261001/chromium-17-party-camera';
const rows=[
 ['Before: a hedge swallowed the travelling party',`${before}/desktop-workshop-edge.png`,'The hero actually crosses the native First Bloom workshop edge. The old camera follows only the hero and only one body receives a scenery dissolve ray. Recruitment, invulnerability and arrival position are fixtures. This is an explicitly preserved previous-source baseline.'],
 ['After: four figures on the same adventure',`${after}/desktop-workshop-edge.png`,'The same native crossing now frames nearby companions and clears foreground foliage around each body. Stable bounds cover every character pose; separate blades, shadows and expanding technique rings cannot pull the camera out. No terrain or collision was replaced for this capture.'],
 ['Before: two companions outside the portrait view',`${before}/phone-workshop-edge.png`,'Native vertex projection confirms that Tern and Mara extend beyond the old portrait frame. This second baseline intentionally uses the previous game source and retains its original image hash.'],
 ['After: the party fits a portrait screen',`${after}/phone-workshop-edge.png`,'The camera pans and expands around nearby figures while the selected field of view remains intact. The free rectangle comes from the actual HUD, shortcuts and technique slot. Real stick travel is measured every tick, including the outdoor room boundary.'],
 ['Before: the technique panel covered the rear ranks',`${before}/desktop-rear-kiln.png`,'The kiln arrival faces north, with companions nearer the camera. Their actual native bounds overlap the old Clockwork Cross panel. Terrain, enemy models and companion poses are native; facing and invulnerability are disclosed fixtures.'],
 ['After: the whole party clears the technique panel',`${after}/desktop-rear-kiln.png`,'Desktop help sits closer to the bottom prompts. Group composition keeps nearby figures clear of it, while solo room centres, slide thresholds and reward headroom retain their rules. This test measures native vertices instead of assuming a character outline.'],
 ['Equipped items and touch controls leave room to play','playtest-out/camera-touch-final4-20261001/landscape-normal-workshop.png','This uses a real coarse-pointer layout with nine magic and an equipped Fire Wand. Compact technique help fits between current HUD columns. The camera avoids the actual stick, action buttons and menu group. Tiny landscape screens still devote substantial space to controls.'],
 ['A guest sees the same nearby cast','playtest-out/camera-coop-final2-20261001/guest/03-guest-opens-shared-shells.png','Muted Chromium and Firefox connect over local Trystero RTC. A portrait guest frames both heroes and all three companions, pays only their own three magic, and opens the shared shells once. Split eras, reunion, harmless sword knockback and surviving-leader framing are also checked.'],
 ['Native clay still lifts and throws',`${solo}/04-party-pot.png`,'Actual A input lifts the native Barrow pot with the full party, and the next A throws it. The capture waits for the normal arrival announcement to fade. Every carried-pot vertex remains inside the portrait frame. A real east doorway slide also measures native party visibility throughout the transition.'],
 ['A reward has room beside the full party',`${solo}/05-party-reward.png`,'The party fit includes the current prize model, so its wide rotating silhouette cannot be cropped at the side of a portrait frame. A real grant, native geometry, measured HUD clearance and all four character bounds are checked. Solo prize checks run independently.'],
 ['Foreground reveal survives the simpler look','playtest-out/camera-cutaway-final-20261001/firefox/low-native-reveal.png','Identical raw renderer frames compare hero-only and full-party probes inside the actual companion silhouettes. Native fragment changes confirm foreground reveal in high, low and flat quality on both engines. Character and backdrop materials remain outside the terrain dissolve; the floor keeps its existing height guard.'],
 ['The portable party is ready for the next chapter','playtest-out/camera-retakes-final-20261001/03-portable-open-shells.png','The freshly built standalone HTML performs a real Steamwheel, charges three magic and opens both native shells for eight damage each. The ZIP, portable file, compressed NPC recordings, screenshots and acceptance receipts are linked by hashes. Adventure content remains the next priority.'],
];
const slides=rows.map(([title,file,caption],i)=>({title,file,caption,sha256:hash(readFileSync(file)),sourceSha256:[0,2,4].includes(i)?receipts.baseline.result.sourceSha256:source.sha256,image:`data:image/png;base64,${readFileSync(file).toString('base64')}`}));
const gameplay=['safety','regression','firefox','portable'].reduce((n,key)=>n+receipts[key].result.cases.reduce((a,c)=>a+c.assertions,0),0);
const limitations=[`${gameplay} gameplay assertions pass on this game source. Launch policy is counted separately.`,
 'Flags, invulnerability, initial positions and some stationary AI are fixtures. Actual controls, travel, combat, pots, rewards, touch paging, friendly bonks and migration are exercised. Enjoyment and public separate-network connectivity are not measured.',
 'Three slides deliberately retain the previous game source. All other selected images use the current tested game. Development failures remain intact. Source-identical passing cases can be reused only with unchanged executed test helpers.',
 'At most eight nearby friendly subjects within six tiles participate, with companions first. Distant players and enemies have no composition priority. Nearby figures can overlap one another; composition does not separate their silhouettes. Very short touch layouts still make figures small. Native reveal is checked in the workshop, not behind every possible obstacle.',
 'All browser output is muted. Existing recordings are neither replayed nor decoded. The portable build embeds their compressed bytes; no Kokoro model ships. Local delivery only; the public site is unchanged.'];
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/manifest.json`,JSON.stringify({builtUtc:new Date().toISOString(),source,receipts,gameplayAssertions:gameplay,limitations,slides:slides.map(({image,...s})=>s)},null,2));
const data=JSON.stringify(slides).replaceAll('<','\\u003c');
writeFileSync(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: the party in view</title><style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style><header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../camera-delivery-20261001/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../party-review/index.html">Previous travel slides</a><span id="count"></span></footer><script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`PASS built twelve camera slides with verified source, receipt, image and package hashes; ${gameplay} gameplay assertions.`);

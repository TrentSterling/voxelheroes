// Build a silent review from actual game captures and verified result manifests.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const regression='playtest-out/barrow-regression-release-20261001';
const coop='playtest-out/barrow-coop-release2-20261001';
const delivery='playtest-out/barrow-delivery-20261001-v2';
const out=process.argv[2]??'playtest-out/barrow-review';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=file=>({file,sha256:hash(readFileSync(file)),result:JSON.parse(readFileSync(file,'utf8'))});
const receipts={regression:receipt(`${regression}/result.json`),inputRegression:receipt('playtest-out/barrow-final-input-regression-release-20261001/result.json'),input:receipt('playtest-out/barrow-journal-input-final2-20261001/result.json'),menu:receipt('playtest-out/barrow-menu-final-20261001/result.json'),transition:receipt('playtest-out/barrow-input-guard/delivery-transition.json'),coop:receipt(`${coop}/result.json`),portable:receipt('playtest-out/barrow-portable-release2-20261001/result.json'),voices:receipt('playtest-out/barrow-voice-assets-20261001/result.json'),silence:receipt('playtest-out/barrow-audio-policy-delivery-20261001/result.json'),package:receipt(`${delivery}/package.json`)};
assert.equal(receipts.regression.result.status,'passed');assert.equal(receipts.regression.result.failed,0);
assert.equal(receipts.inputRegression.result.status,'passed');assert.equal(receipts.inputRegression.result.failed,0);
for(const name of['input','menu','coop','portable','voices','silence','package'])assert.equal(receipts[name].result.ok,true);
assert.equal(receipts.portable.result.artifactSha256,receipts.package.result.artifact.sha256);
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fingerprint=createHash('sha256');
for(const file of files){fingerprint.update(file.replaceAll('\\','/')+'\0');fingerprint.update(readFileSync(file));}
const source={sha256:fingerprint.digest('hex'),files:files.length};
assert.equal(source.sha256,receipts.menu.result.sourceSha256,'The review must use the final tested menu source');
assert.equal(source.sha256,receipts.inputRegression.result.source.sha256);
assert.equal(receipts.transition.result.beforeSha256,receipts.regression.result.source.sha256);
assert.equal(receipts.transition.result.afterSha256,source.sha256);
assert.deepEqual(receipts.transition.result.changed.map(row=>row.file),['src/core/input.js','src/core/modes.js','src/style.css','src/ui/overlay.js','src/ui/screens/party.js']);
const solo='playtest-out/barrow-final-input-regression-release-20261001/chromium-1-barrow-echo',retry='playtest-out/barrow-final-input-regression-release-20261001/chromium-1-barrow-retry';
const rows=[
 ['The bell warns before it strikes',`${solo}/01-bell-warning.png`,'Crossed Bones has an original copper bell and a visible 1.1-second warning. It commits its aim before firing, so movement can evade the volley. Position and stationary opening guards are fixtures; the timer, warning and movement input are real.'],
 ['Four slow projectiles to read',`${solo}/02-bell-volley.png`,'The actual bell volley creates four slow, shieldable shots. The test sidesteps with real movement and takes no damage, with invulnerability disabled for that check.'],
 ['A guest can quiet the bell',`${coop}/guest/01-guest-quiets-shared-bell.png`,'A Firefox guest lifts and throws a physical pot. The Chromium room owner receives the tile hit, cancels its warning and shares four seconds of quiet. Both browsers are muted; signaling and RTC stay local.'],
 ['A second wave changes the encounter',`${coop}/guest/02-guest-owns-second-wave.png`,'A shielded warden and ranged gazer replace the skeleton/bat opening after a 1.5-second pause. During that pause the host leaves this room and the guest takes ownership. Exactly one reinforcement wave appears; wave kills use the damage API.'],
 ['Copper and stone in the barrow',`${coop}/host/03-host-explores-separately.png`,'Six rooms gain local cobble, copper rosettes, cracked slabs, repair channels, clock rubble and bell plinths. The host explores Barrow Mouth while the guest continues the fight. These are quick native voxel variations, with room doors and puzzle routes retained.'],
 ['A note from tomorrow',`${solo}/06-echo-memory.png`,'Defeat both waves and quiet the bell to reveal the eastern Echo Memory chest. Opening it through actual movement grants one permanent magic gem and records The Note Beneath. The key and shutters cannot clear between waves.'],
 ['The memory can be recovered later',`${retry}/01-late-memory-reward.png`,'This separate test completes both waves without touching the bell, then saves before collecting its fourth key. After loading, the key still waits and no guards restart. Actual pottery reveals the optional chest after combat, so missing every earlier throw does not lose the reward.'],
 ['The journal keeps the whole note',`${solo}/07-note-journal.png`,'The journal reserves room for progress, reward and navigation, then pages its descriptions using Read or confirm. The final text audit checks all tasks and each barrow quest state at six viewports, including complete paragraph character coverage.'],
 ['Readable on a small phone',`${solo}/08-note-journal-320.png`,'320 by 568. Small portrait screens place Close and Read in a second footer row. The reward and task controls occupy separate rows; labels are fitted to their available width.'],
 ['Landscape gets proper Read pages',`${solo}/08-note-journal-568.png`,'568 by 320. The longer note uses two Read pages instead of running into the footer. The audit measures actual canvas text and controls, checks bounds and overlap, and verifies that every character survives pagination.'],
 ['The saved title stays clear',`playtest-out/barrow-menu-final-20261001/landscape-saved-title.png`,'568 by 320. The complete introduction, Continue, New adventure and party control fit inside the screen. The party button has its own place beside the secondary action; the About badge no longer covers the story on narrow or short screens. Real text/DOM intersection and touch navigation checks pass.'],
 ['A party menu that fits',`playtest-out/barrow-menu-final-20261001/landscape-party-entry.png`,'The compact entry panel keeps Create party, code input, Join and Back visible in short landscape. The gameplay pad hides behind canvas menus. The test opens this menu through actual touch input and returns to the title through Back.'],
 ['Both temple floors remain visible',`${regression}/chromium-1-text-layout/short-landscape-temple-map.png`,'Measured floor bands can sit side by side whenever their widths fit. The two-floor Brineglass Temple map, boss marker, hint and Close button stay inside 568 by 320. The map geometry and text passed the full bounds audit.'],
 ['Friends can reunite after the fight',`${coop}/host/05-friends-reunited-after-the-bell.png`,'The host returns to one finished, inert bell with no restarted guards. Both friends receive exactly one permanent magic gem and the same completed journal entry. A repeated grant leaves both capacities unchanged.'],
];
const slides=rows.map(([title,file,caption])=>{const bytes=readFileSync(file);return {title,file,caption,sha256:hash(bytes),image:`data:image/png;base64,${bytes.toString('base64')}`};});
const limitations=[
 'This pass redesigns one encounter and adds variety to six barrow rooms. The remaining old dungeon encounters and larger era story still need work.',
 'The broad focused run passes 851 assertions across eleven scenarios and the mute-policy stage, including the entire D1 route and 215 bounds captures. This is not a new complete campaign gauntlet.',
 'The 851-assertion run precedes final touch pointerdown guards, touch-pad menu visibility and title-only party/About placement. Exact source fingerprints audit those five changed input/menu files. A final nine-scenario report plus nine real journal-input and nine title/party checks cover those later fixes. Eight passing cases are reused on identical game source and unchanged scenario scripts; D1 reruns after its earlier bot approach stopped short of the heart pickup. The rerun waits for the final swing and reports route failures explicitly. Final source matches both the final regression and title/party test fingerprints.',
 'Local Firefox/Chromium RTC only; public signaling and separate-network ICE are not verified here.',
 'Position fixtures and damage-API wave kills isolate encounter, ownership and reward behavior; they do not measure player enjoyment.',
 'All new browser tests are muted. Voice coverage is checked from assets and compressed bytes, without playback or decode.',
 'The source is uncommitted and the public site has not been updated. Earlier failed receipts remain in their original folders.',
];
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/manifest.json`,JSON.stringify({builtUtc:new Date().toISOString(),source,receipts,limitations,slides:slides.map(({image,...s})=>s)},null,2));
const data=JSON.stringify(slides).replaceAll('<','\\u003c');
writeFileSync(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes: The Note Beneath</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162137;color:#eee0c5;font:16px system-ui;height:100dvh;display:flex;flex-direction:column}header,footer{display:flex;gap:14px;align-items:center;padding:14px 24px;background:#202c44;flex:none;flex-wrap:wrap}h1{font-size:22px;margin:0;overflow-wrap:anywhere}a{color:#a1d9cf}header nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}main{padding:12px 24px;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;overflow:auto}img{width:100%;min-height:140px;flex:1;object-fit:contain}p{max-width:1050px;line-height:1.45;margin:12px 0;flex:none;overflow-wrap:anywhere}button{font:inherit;color:inherit;background:#34435f;border:1px solid #ad8b59;border-radius:4px;padding:8px 14px;cursor:pointer}#count{margin-left:auto}@media(max-width:500px){header,footer{padding:10px;gap:10px}header nav{margin-left:0;font-size:13px}h1{font-size:18px}main{padding:8px 10px}p{font-size:13px}button{padding:6px 12px}}@media(max-height:520px){body{height:auto;min-height:100dvh}main{flex:none;overflow:visible}img{flex:none;aspect-ratio:16/9;min-height:140px}header,footer{padding:10px}}</style>
<header><h1 id="title"></h1><nav><a href="http://127.0.0.1:5173/">Play locally</a><a href="../barrow-delivery-20261001-v2/index.html">Build and source</a><a href="manifest.json">Receipts</a></nav></header><main><img id="photo" alt=""><p id="caption"></p></main><footer><button id="prev">Previous</button><button id="next">Next</button><a href="../companion-review/index.html">Mira slides</a><span id="count"></span></footer>
<script>const slides=${data};let index=0;function show(n){index=(n+slides.length)%slides.length;const s=slides[index];document.getElementById('title').textContent=s.title;photo.src=s.image;photo.alt=s.title;caption.textContent=s.caption;count.textContent=(index+1)+' / '+slides.length}prev.onclick=()=>show(index-1);next.onclick=()=>show(index+1);addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(index+1);if(e.key==='ArrowLeft')show(index-1)});show(0);</script></html>`);
console.log(`Built ${slides.length} barrow slides from actual photographs, with source and receipt hashes.`);

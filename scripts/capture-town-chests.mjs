import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3),out=arg('out')??'playtest-out/town-chests-retakes',url=arg('url')??'http://127.0.0.1:5173/';
mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={utc:new Date().toISOString(),sourceSha256:fp.digest('hex'),cases:[],scope:'Native Firefox retakes from the exact standalone HTML. Browser volume is zero and game sound muted. Hero positions, prerequisite flags, invulnerability and direct sentry damage isolate available chest input. Actual A opens each vault. Capture waits for native arrival/reward titles and old feedback to fade; no image editing.'};
const browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}}),t=await launch({url,out,browser});
try {
 const vaults=[{id:'seed',screen:'mossbrook-future:0,0',x:7,z:3,ready:'era:water-restored',reward:'era:dawn-seed'},{id:'archive',screen:'mossbrook-future:2,0',x:7,z:3,ready:'era:archive-powered',reward:'era:copper-memory'},{id:'departure',screen:'mossbrook-future:1,1',x:11,z:12,ready:'era:departure-powered',reward:'era:departure-tag'},{id:'keeper',screen:'mossbrook-future:0,0',x:13,z:12,ready:'coast:beacon-lit',reward:'coast:beacon-memory'}];
 for(const v of vaults) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
  await t.teleport(v.screen,v.x+.5,v.z+1.5);await t.eval(v=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.player.invT=999;},v);
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  await t.tap('sword');await t.page.waitForTimeout(250);await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(`${v.id}-locked`);
  await t.eval(async v=>{const h=window.__voxelHeroes;h.game.state.setFlag(v.ready);for(const e of h.entities)if(e.kind==='enemy'&&!e.removed)e.hurt({damage:999,knockback:0,source:'chest-retake-fixture'});await h.step(.2);},v);
  await t.tap('sword');await t.step(.1);
  const data=await t.eval(v=>{const h=window.__voxelHeroes,s=h.screen();return{id:v.id,reward:h.state.flags.has(v.reward),opened:h.state.flags.has(`chest:${s.x0+v.x},${s.z0+v.z}`),maxHp:h.state.maxHp,maxMagic:h.state.maxMagic};},v);
  assert.ok(data.reward&&data.opened,`${v.id} actual A claim`);result.cases.push(data);
  await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<900&&h.state.mode!=='play';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
  await t.page.waitForFunction(()=>{const h=window.__voxelHeroes;return !h.game.banner.bannerView().visible&&!h.game.toast.toastView().visible;});
  await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(`${v.id}-opened`);
 }
 assert.deepEqual(t.errors,[]);result.ok=true;console.log('PASS four native standalone Firefox chest retakes, eight images, all audio muted');
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;throw error;}
finally{result.captures=t.shots;writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));await t.close();await browser.close();}

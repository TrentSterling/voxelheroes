import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3),out=arg('out')??'playtest-out/opening-retakes';
const artifact='dist-artifact/voxel-heroes.html',url=pathToFileURL(resolve(artifact)).href,hash=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),artifactSha256:hash(readFileSync(artifact)),checks:[],captures:[],scope:'Muted offline Firefox. Actual title and physical southward travel while unarmed, then the real King Aldric conversation. No teleport, grants, enemy removal, health edits or invulnerability. The walking helper settles an exact destination within two movement steps. Native opening completion and combat are tested separately.'};
const browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});let t;
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try {
  t=await launch({url,out,seed:17,browser});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.settings.setSetting('muted',true);h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
  await t.press('Enter');await t.step(2);
  check(await t.eval(()=>!window.__voxelHeroes.state.swords.equipped&&window.__voxelHeroes.player.invT===0),'The offline native title begins an unarmed adventure without test invulnerability');
  for(const[key,name,x,z]of[['v1:1,2','01-riverstone-lane',8.5,7.5],['ow-4-3:1,0','02-limestone-castle-road',8.5,8.5],['ow-4-3:1,1','03-royal-runner-and-mosaic',7.5,9.5]]){
    await t.exit('south');check((await t.state()).key===key,`Actual walking reaches ${key}`);
    await t.walkTo(x,z);await t.step(4);await t.shot(name);const file=`${out}/${name}.png`;result.captures.push({file,sha256:hash(readFileSync(file)),snapshot:await t.state()});
  }
  check((await t.state()).hp===6,'The unarmed route keeps all six native life units');
  await t.walkTo(7.5,6.6);await t.stick(0,-1,1/60);await t.tap('sword');
  check(await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView()?.speaker==='King Aldric'),'Actual A starts the native king conversation');
  let pictured=false;
  for(let n=0;n<160&&(await t.state()).mode==='dialog';n++){
    if(!pictured&&await t.eval(()=>window.__voxelHeroes.state.swords.equipped==='blade-start')){await t.step(2);await t.shot('04-native-king-blade');const file=`${out}/04-native-king-blade.png`;result.captures.push({file,sha256:hash(readFileSync(file)),snapshot:await t.state()});pictured=true;}
    await t.tap('confirm');
  }
  check(pictured&&await t.eval(()=>window.__voxelHeroes.state.gear.shield===1),'The real king visibly grants the blade and completes the starter kit');
  assert.deepEqual(t.errors,[]);check(true,'Offline Firefox reports no game exceptions');
  check(result.artifactSha256===hash(readFileSync(artifact)),'The portable file remains unchanged throughout the retakes');result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};if(t)await t.shot('FAILED').catch(()=>{});process.exitCode=1;console.error(e.stack);}
finally{await t?.close();await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}

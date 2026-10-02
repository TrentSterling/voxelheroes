// Native fragment evidence: identical world, camera and time, hero-only versus
// full-party probes. GL readback measures changes inside companion silhouettes.
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium,firefox } from 'playwright';
import { launch,CHROMIUM_ARGS } from './playtest.mjs';
import { recruitParty,measurePartyFrame } from './lib/party-frame.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/party-cutaway',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const report={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),muted:true,checks:[],views:[],limitations:['Native First Bloom terrain and four native figures; recruitment, invulnerability and arrival facing are fixtures. Identical world, camera, time and raw renderer frames compare hero-only and party uniforms. Pixel changes show foreground reveal, not general terrain occlusion coverage.']};
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label);};
for(const engine of(arg('engines')??'chromium,firefox').split(',')){
 const browser=engine==='firefox'?await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}}):await chromium.launch({headless:true,args:CHROMIUM_ARGS});
 const t=await launch({browser,url,out:join(out,engine),seed:17});
 try{
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});await t.press('Enter');await t.step(1.1);await recruitParty(t);
  await t.teleport('mossbrook-past:1,0',13.5,9.5);await t.step(.2);await t.hold('ArrowRight',.9);await t.step(1.3);
  for(const quality of['high','low','flat']){
   await t.eval(q=>window.__voxelHeroes.look.set(q),quality);const frame=await t.eval(measurePartyFrame);
   const pixels=await t.eval(frame=>{
    const h=window.__voxelHeroes,{renderer,scene,camera}=h.gfx,gl=renderer.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
    const read=()=>{renderer.setRenderTarget(null);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(scene,camera);const bytes=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
    const full=read(),uniforms=h.game.materials.cutawayView(),Vector=renderer.domElement?camera.position.constructor:null;
    h.game.materials.setCutaway(new Vector(...uniforms.targets[0]),new Vector(...uniforms.camera),uniforms.floor);const solo=read();
    const differences=frame.actors.slice(1).map(a=>{let changed=0,total=0;for(let y=Math.max(0,Math.floor((1-a.bottom)*H));y<Math.min(H,Math.ceil((1-a.top)*H));y++)for(let x=Math.max(0,Math.floor(a.left*W));x<Math.min(W,Math.ceil(a.right*W));x++){const i=(y*W+x)*4;total++;if(Math.max(...[0,1,2].map(k=>Math.abs(full[i+k]-solo[i+k])))>8)changed++;}return{name:a.name,changed,total};});
    const character=h.game.materials.getMaterial('character'),backdrop=h.game.materials.getMaterial('backdrop');
    h.game.partyCamera.renderPartyCutaway();
    return{differences,width:W,height:H,glError:gl.getError(),characterCuts:character.cutaway,backdropCuts:backdrop.cutaway,probes:uniforms.targets.length,floor:uniforms.floor};
   },frame);
   check(pixels.differences.some(r=>r.changed>100),`${engine} ${quality}: party cutaway changes actual foreground pixels inside a companion silhouette`);
   check(pixels.glError===0&&pixels.probes===4,`${engine} ${quality}: four native probes render without a GL error`);
   check(!pixels.characterCuts&&!pixels.backdropCuts&&pixels.floor===.125,`${engine} ${quality}: characters and backdrop remain outside the terrain dissolve`);
   const file=await t.shot(`${quality}-native-reveal`);report.views.push({engine,quality,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),frame,pixels});
  }
  check(t.errors.length===0,engine+' has no browser errors');
 }finally{await t.close();await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
}
report.ok=true;report.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));

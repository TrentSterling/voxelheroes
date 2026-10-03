import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch } from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3),out=arg('out')??'playtest-out/equipment-gamepad';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh output folder.');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),checks:[],scope:'Silent Firefox with a standard Gamepad API source fixture and owned Warden fixture. Native polling drives Y entry, d-pad selection, A confirm, Y close and A sword in play. Wall-clock feedback hitstop is allowed to settle before and during each held input. This is not physical controller hardware testing.'};
let browser,t;
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);};
try{
  browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  t=await launch({url:arg('url')??'http://127.0.0.1:5173/',out,browser});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);h.game.swords.giveSword('blade-warden');window.__equipmentPad=[];h.input.setPadSource(()=>[{connected:true,mapping:'standard',buttons:Array.from({length:17},(_,i)=>({pressed:window.__equipmentPad.includes(i),value:window.__equipmentPad.includes(i)?1:0})),axes:[0,0]}]);});await t.step(1.5);
  const button=async i=>{await t.page.waitForTimeout(100);await t.eval(i=>window.__equipmentPad=[i],i);await t.step(.1);await t.page.waitForTimeout(100);await t.step(1/60);await t.eval(()=>window.__equipmentPad=[]);await t.step(1/60);};
  await button(3);check((await t.state()).mode==='inventory','Standard gamepad Y opens equipment through native polling');
  await button(13);check(await t.eval(()=>window.__voxelHeroes.game.equipment.equipmentView().selectedId==='blade-warden'),'Standard d-pad selects the owned Warden blade');
  await button(0);check(await t.eval(()=>window.__voxelHeroes.game.swords.equippedId()==='blade-warden'&&window.__voxelHeroes.state.mode==='inventory'),'Standard A equips the selection while remaining in the menu');
  await button(3);check((await t.state()).mode==='play'&&await t.eval(()=>window.__voxelHeroes.player.attackT<=0),'Standard Y returns to play without a latched sword attack');
  await button(0);check(await t.eval(()=>window.__voxelHeroes.player.attackT>0),'A fresh standard A press still attacks in play');
  await t.shot('01-gamepad-warden-swing');check(!t.errors.length,'The gamepad path reports no page errors');result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();result.sourceUnchanged=fingerprint()===result.sourceSha256;if(!result.sourceUnchanged){result.ok=false;result.error={message:'Game source changed during the controller check.'};process.exitCode=1;}writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));await t?.close();await browser?.close();console.log(JSON.stringify({ok:result.ok,checks:result.checks.length,error:result.error?.message}));}

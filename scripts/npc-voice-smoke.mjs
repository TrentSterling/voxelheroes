// Actual native speech callbacks, separate from deterministic speech fixtures.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium, firefox } from 'playwright';

const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/npc-native-voices';
const base=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5173/';
mkdirSync(out,{recursive:true});
const result={at:new Date().toISOString(),url:base,modelDownloads:0,note:'Native browser callbacks confirm playback scheduling. This does not record audible output or measure voice quality.',browsers:[]};
for(const [name,engine] of Object.entries({firefox,chromium})){
  const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
    const url=new URL(base);url.searchParams.set('manual','1');
    await page.goto(url.href);await page.waitForFunction(()=>window.__voxelHeroes?.version>=1);
    await page.keyboard.press('Enter');
    await page.evaluate(async()=>{const h=window.__voxelHeroes;await h.step(1.2);h.teleport('v1:1,1',10.5,10.4);await h.step(.5);});
    try{await page.waitForFunction(()=>window.__voxelHeroes.game.npcVoices.npcVoiceView().localVoices.length>0,null,{timeout:5000});}catch{}
    await page.evaluate(()=>{
      window.__nativeSpeechEvents=[];
      const s=window.speechSynthesis;if(!s)return;
      const speak=s.speak.bind(s);
      s.speak=u=>{
        for(const type of ['start','end','error'])u.addEventListener(type,e=>window.__nativeSpeechEvents.push({type,at:Date.now(),error:e.error??null,voice:u.voice?.name,text:u.text}));
        speak(u);
      };
      window.__voxelHeroes.game.dialog.showDialog('Welcome to Mossbrook.',{speaker:'Hettie'});
    });
    const initial=await page.evaluate(()=>window.__voxelHeroes.game.npcVoices.npcVoiceView());
    if(initial.localVoices.length)try{await page.waitForFunction(()=>window.__nativeSpeechEvents.some(e=>e.type==='end'||e.type==='error'),null,{timeout:12000});}catch{}
    const receipt=await page.evaluate(()=>({view:window.__voxelHeroes.game.npcVoices.npcVoiceView(),events:window.__nativeSpeechEvents}));
    assert.deepEqual(errors,[]);
    const delivered=receipt.events.some(e=>e.type==='start')&&receipt.events.some(e=>e.type==='end');
    result.browsers.push({name,...receipt,errors,delivered});
    await page.evaluate(async()=>{await window.__voxelHeroes.step(.7);window.__voxelHeroes.render();});
    await page.screenshot({path:`${out}/${name}-npc-voice.png`});
    console.log(`${delivered?'PASS':'LIMITATION'} ${name}: ${receipt.view.localVoices.length} local English voices; native events ${receipt.events.map(e=>e.type).join(',')||'none'}`);
    await page.evaluate(()=>window.__voxelHeroes.setMode('play'));
  }finally{await browser.close();}
}
writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));

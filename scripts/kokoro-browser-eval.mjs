// Optional networked research run, separate from the offline game gauntlet.
// Downloads the public Apache-2.0 q8 model in a browser worker, never into dist.
import { chromium } from 'playwright';
import { mkdirSync,writeFileSync } from 'node:fs';
import { CHROMIUM_ARGS } from './playtest.mjs';
if(!process.argv.includes('--download-model'))throw Error('Use --download-model to run the optional 92.4 MB model evaluation.');
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/kokoro-eval';
const device=process.argv.find(a=>a.startsWith('--device='))?.slice(9)??'wasm',dtype=device==='webgpu'?'fp32':'q8';
const channel=process.argv.find(a=>a.startsWith('--channel='))?.slice(10);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(channel?{channel}:{}),args:device==='webgpu'?['--mute-audio','--enable-unsafe-webgpu','--use-angle=d3d11']:CHROMIUM_ARGS}),page=await browser.newPage();
const result={startedUtc:new Date().toISOString(),library:'kokoro-js 1.2.1',model:'onnx-community/Kokoro-82M-v1.0-ONNX',device,dtype,worker:true,integratedInGame:false,notes:['Headless Chromium; timings are measured on this machine only.','Public original NPC lines only; audio is generated locally.','Generated WAV files allow human listening; callback timing does not measure voice quality.']};
try{
 await page.goto('http://127.0.0.1:5173/?manual=1');await page.waitForFunction(()=>window.__voxelHeroes?.version>=1);
 result.browser=await browser.version();result.channel=channel??'playwright-chromium';
 if(device==='webgpu')result.adapter=await page.evaluate(async()=>{const adapter=await navigator.gpu?.requestAdapter();return adapter?{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,description:adapter.info?.description}:null;});
 await page.keyboard.press('Enter');await page.evaluate(()=>window.__voxelHeroes.step(1.2));
 const workerCode=`import {KokoroTTS,TextSplitterStream} from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
let tts;self.onmessage=async({data})=>{try{
 if(data.type==='load'){const start=performance.now();tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{device:data.device,dtype:data.dtype});postMessage({type:'ready',ms:performance.now()-start});}
 if(data.type==='speak'){const start=performance.now(),splitter=new TextSplitterStream();splitter.push(data.text);splitter.close();let i=0;
 for await(const {text,audio}of tts.stream(splitter,{voice:data.voice,speed:data.speed??1})){const samples=audio.audio;postMessage({type:'chunk',index:i++,ms:performance.now()-start,text,rate:audio.sampling_rate,samples},[samples.buffer]);}
 postMessage({type:'done',ms:performance.now()-start});}
 }catch(error){postMessage({type:'error',message:error.message,stack:error.stack});}};`;
 await page.evaluate(code=>{
  window.__kokoro={events:[],pending:null,beats:0};setInterval(()=>window.__kokoro.beats++,16);
  const worker=new Worker(URL.createObjectURL(new Blob([code],{type:'text/javascript'})),{type:'module'});window.__kokoro.worker=worker;
  worker.onmessage=({data})=>{window.__kokoro.events.push(data);if(data.type==='ready'||data.type==='done'||data.type==='error')window.__kokoro.pending?.(data);};
  worker.onerror=e=>{window.__kokoro.events.push({type:'error',message:e.message});window.__kokoro.pending?.({type:'error',message:e.message});};
 },workerCode);
 const invoke=data=>page.evaluate(data=>new Promise(resolve=>{window.__kokoro.pending=resolve;window.__kokoro.worker.postMessage(data);}),data);
 console.log('Loading Kokoro '+dtype+' on '+device+' in a browser worker; the game bundle is unchanged.');
 result.load=await invoke({type:'load',device,dtype});if(result.load.type==='error')throw Error(result.load.message);
 console.log(`Model loaded in ${(result.load.ms/1000).toFixed(1)} seconds.`);result.lines=[];
 for(const [name,voice,text]of[
  ['mira','af_heart','The town bell rang thirteen times this morning. We only hung twelve bells.'],
  ['tern','bm_george','I practiced saying thank you for two hundred years. I thought I had forgotten how.'],
 ]){
  await page.evaluate(()=>{window.__kokoro.events=[];window.__kokoro.beats=0;});
  const done=await invoke({type:'speak',voice,text});if(done.type==='error')throw Error(done.message);
  const data=await page.evaluate(()=>({beats:window.__kokoro.beats,chunks:window.__kokoro.events.filter(e=>e.type==='chunk').map(e=>{
   const bytes=new Uint8Array(e.samples.buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {index:e.index,ms:e.ms,text:e.text,rate:e.rate,samples:e.samples.length,base64:btoa(binary)};
  })}));
  const rows=[];
  for(const chunk of data.chunks){
   const raw=Buffer.from(chunk.base64,'base64'),samples=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4),wav=Buffer.alloc(44+samples.length*2);
   wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(chunk.rate,24);wav.writeUInt32LE(chunk.rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
   let peak=0;for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);}
   const file=`${name}-${chunk.index}.wav`;writeFileSync(`${out}/${file}`,wav);rows.push({file,firstAudioMs:chunk.ms,durationSeconds:samples.length/chunk.rate,peak});
  }
  const audioSeconds=rows.reduce((n,c)=>n+c.durationSeconds,0);
  result.lines.push({name,voice,text,totalMs:done.ms,mainThreadTimerBeats:data.beats,audioSeconds,realTimeFactor:done.ms/1000/audioSeconds,chunks:rows});
  console.log(`PASS ${name}: ${rows.length} streaming chunks, first audio ${rows[0]?.firstAudioMs.toFixed(0)} ms, ${audioSeconds.toFixed(1)} s audio generated in ${(done.ms/1000).toFixed(1)} s.`);
 }
 await page.screenshot({path:`${out}/game-during-kokoro-evaluation.png`});result.ok=result.lines.every(l=>l.chunks.length>0&&l.chunks.every(c=>Number.isFinite(c.peak)&&c.peak>0));
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};console.error('KOKORO EVAL FAILED: '+error.message);process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));await browser.close();}

// Development-only Kokoro worker. Ships compressed clips, never weights/runtime.
// npm run voices:bake -- --download-model [--batch=town] [--limit=5]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { inventory } from './voice-inventory.mjs';

const args = process.argv.slice(2), value = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!args.includes('--download-model')) throw Error('Use --download-model to authorize the development-only Kokoro download.');
const out = value('out') ?? 'playtest-out/voice-bake', requested = value('batch'), limit = Number(value('limit') ?? Infinity);
const catalog = inventory();
mkdirSync('assets/voices', { recursive: true }); mkdirSync(out, { recursive: true });
writeFileSync('assets/voices/inventory.json', JSON.stringify(catalog, null, 2) + '\n');
const receiptFile = `${out}/result.json`;
const result = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : { schema: 1, startedUtc: new Date().toISOString(), engine: catalog.engine, model: catalog.model, device: 'webgpu', dtype: 'fp32', codec: catalog.codec, lines: [], attempts: [], modelInGame: false, notes: ['Generated locally in installed Chrome on this machine.', 'Signal/decode checks do not establish perceptual quality. Full cast listening review provided.'] };
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
// A new chapter keeps already shipped takes instead of resynthesizing the cast.
// Import only current ids/cast settings with verified compressed asset hashes.
if (args.includes('--reuse-bank') && existsSync('src/game/voice-bank.json')) {
  const bank = JSON.parse(readFileSync('src/game/voice-bank.json', 'utf8'));
  if (bank.engine !== catalog.engine || bank.modelInGame !== false) throw Error('Reuse requires the current offline Kokoro bank.');
  let reused = 0;
  for (const row of catalog.lines) {
    if (result.lines.some(r => r.id === row.id && r.ok)) continue;
    const clip = bank.lines.find(r => r.id === row.id && r.key === row.key && r.voice === row.voice && r.batch === row.batch);
    if (!clip || clip.path !== `voices/${row.batch}/${row.id}.opus`) continue;
    const file = `public/${clip.path}`;
    if (!existsSync(file) || statSync(file).size !== clip.bytes || hash(file) !== clip.sha256) continue;
    result.lines.push({ ...clip, ok: true, reusedFromCurrentBank: true }); reused++;
  }
  result.importedBank = { sha256: hash('src/game/voice-bank.json'), reused, rule: 'Exact current ids, speaker keys, cast voice, batch, byte count and asset SHA256; no decode or playback.' };
}
// Moving a character into an earlier regional batch does not require resynthesis.
for (const row of catalog.lines) {
  const rec = result.lines.find(r => r.id === row.id);
  if (!rec?.ok || rec.batch === row.batch) continue;
  const old = `public/voices/${rec.batch}/${row.id}.opus`, next = `public/voices/${row.batch}/${row.id}.opus`;
  if (existsSync(old) && hash(old) === rec.sha256) { mkdirSync(`public/voices/${row.batch}`, { recursive: true }); copyFileSync(old, next); rec.batch = row.batch; }
}
function completed(row) {
  const rec = result.lines.find(r => r.id === row.id), file = `public/voices/${row.batch}/${row.id}.opus`;
  return rec?.ok && existsSync(file) && hash(file) === rec.sha256;
}
function checkpoint() {
  result.updatedUtc = new Date().toISOString();
  result.coverage = catalog.batches.map(b => ({ ...b, complete: catalog.lines.filter(r => r.batch === b.batch && completed(r)).length }));
  writeFileSync(receiptFile, JSON.stringify(result, null, 2) + '\n');
  const lines = catalog.lines.filter(completed).map(row => {
    const r = result.lines.find(r => r.id === row.id);
    return { id: row.id, key: row.key, speaker: row.speaker, text: row.text, voice: row.voice, batch: row.batch, kind: row.kind, path: `voices/${row.batch}/${row.id}.opus`, duration: r.duration, bytes: r.bytes, sha256: r.sha256 };
  });
  result.shipped = { lines: lines.length, characters: new Set(lines.map(r => r.speaker)).size, bytes: lines.reduce((n, r) => n + r.bytes, 0), seconds: lines.reduce((n, r) => n + r.duration, 0) };
  writeFileSync(receiptFile, JSON.stringify(result, null, 2) + '\n');
  writeFileSync('src/game/voice-bank.json', JSON.stringify({ schema: 1, engine: catalog.engine, modelInGame: false, codec: catalog.codec, lines }, null, 2) + '\n');
}
const pending = catalog.lines.filter(r => (!requested || r.batch === requested) && !completed(r)).slice(0, limit);
if (!pending.length) { checkpoint(); console.log('Voice recordings are already current.'); process.exit(0); }
result.status = 'running'; delete result.completedUtc; delete result.error; checkpoint();
execFileSync('ffmpeg', ['-version'], { windowsHide: true, stdio: 'ignore' });
const server = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>Local Kokoro recording worker</title>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--enable-unsafe-webgpu', '--use-angle=d3d11'] });
  const page = await browser.newPage(); page.setDefaultTimeout(180000);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const workerCode = `import {KokoroTTS} from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
let tts;self.onmessage=async({data})=>{try{
if(data.type==='load'){tts=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{device:'webgpu',dtype:'fp32'});postMessage({type:'ready'});}
else{const start=performance.now(),audio=await tts.generate(data.text,{voice:data.voice,speed:data.speed});const samples=audio.audio;postMessage({type:'audio',ms:performance.now()-start,rate:audio.sampling_rate,samples},[samples.buffer]);}
}catch(e){postMessage({type:'error',message:e.message,stack:e.stack});}};`;
  await page.evaluate(code => {
    window.__recorder = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })), { type: 'module' });
    window.__invoke = data => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Kokoro worker exceeded three minutes')), 180000);
      window.__recorder.onmessage = ({ data }) => { clearTimeout(timeout); resolve(data); };
      window.__recorder.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
      window.__recorder.postMessage(data);
    });
  }, workerCode);
  console.log(`Loading development-only Kokoro model; ${pending.length} missing recordings; town first.`);
  const started = Date.now(), load = await page.evaluate(() => window.__invoke({ type: 'load' }));
  if (load.type === 'error') throw Error(load.message);
  result.attempts.push({ at: new Date().toISOString(), browser: await browser.version(), loadMs: Date.now() - started, requested: requested ?? 'all', pending: pending.length });
  checkpoint();
  let batch = null;
  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    if (row.batch !== batch) { checkpoint(); batch = row.batch; console.log(`BATCH ${batch}: ${catalog.lines.filter(r => r.batch === batch).length} authored lines`); }
    const audio = await page.evaluate(async row => {
      const data = await window.__invoke({ type: 'speak', text: row.spoken, voice: row.voice, speed: row.speed });
      if (data.type === 'error') throw Error(data.message);
      const bytes = new Uint8Array(data.samples.buffer); let binary = '';
      for (let j = 0; j < bytes.length; j += 32768) binary += String.fromCharCode(...bytes.subarray(j, j + 32768));
      return { ms: data.ms, rate: data.rate, samples: data.samples.length, base64: btoa(binary) };
    }, row);
    const raw = Buffer.from(audio.base64, 'base64'), samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(audio.rate, 24); wav.writeUInt32LE(audio.rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
    let peak = 0, sum = 0;
    for (let j = 0; j < samples.length; j++) { const s = samples[j]; if (!Number.isFinite(s)) throw Error(`Nonfinite audio: ${row.id}`); peak = Math.max(peak, Math.abs(s)); sum += s * s; wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + j * 2); }
    if (peak < .01 || samples.length < audio.rate * .1) throw Error(`Silent/empty audio: ${row.id}`);
    const rawPath = `${out}/${row.id}.wav`, directory = `public/voices/${row.batch}`, file = `${directory}/${row.id}.opus`;
    mkdirSync(directory, { recursive: true }); writeFileSync(rawPath, wav);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', rawPath, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=9', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'voip', file], { windowsHide: true });
    const rec = { id: row.id, speaker: row.speaker, batch: row.batch, voice: row.voice, text: row.text, ok: true, duration: samples.length / audio.rate, generationMs: audio.ms, peak, rms: Math.sqrt(sum / samples.length), bytes: statSync(file).size, sha256: hash(file) };
    result.lines = result.lines.filter(r => r.id !== row.id); result.lines.push(rec);
    if ((i + 1) % 10 === 0 || i === pending.length - 1) { checkpoint(); console.log(`PASS ${batch}: ${i + 1}/${pending.length} generated; ${row.speaker}, ${rec.duration.toFixed(1)} s -> ${rec.bytes} bytes`); }
  }
  result.status = 'passed'; result.completedUtc = new Date().toISOString(); checkpoint();
  console.log(`VOICE BAKE PASS: ${result.shipped.lines} current clips; ${(result.shipped.bytes / 1e6).toFixed(2)} MB (${result.lines.length} historical takes retained locally)`);
} catch (e) { result.status = 'failed'; result.error = { message: e.message, stack: e.stack }; checkpoint(); console.error(e.stack); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }

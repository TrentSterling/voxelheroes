import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const out = 'playtest-out/voice-artifact-playback-20260930'; mkdirSync(out, { recursive: true });
const html = readFileSync('dist-artifact/voxel-heroes.html'), requests = [];
const server = createServer((req, res) => {
  requests.push(req.url);
  if (req.url.split('?')[0] !== '/') { res.writeHead(404); return res.end('No external voice assets provided'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, ['scripts/npc-voice-smoke.mjs', `--url=${url}`, `--out=${out}`], { windowsHide: true, stdio: 'inherit' });
    child.on('close', resolve); child.on('error', e => { console.error(e.stack); resolve(1); });
  });
  assert.equal(code, 0); assert.ok(!requests.some(r => r.includes('/voices/')));
  writeFileSync(`${out}/standalone.json`, JSON.stringify({ at: new Date().toISOString(), ok: true, bytes: html.length, separateAudioFilesAvailable: false, requests }, null, 2));
  console.log('PASS standalone artifact: both browsers played embedded speech without separate audio files');
} finally { await new Promise(resolve => server.close(resolve)); }

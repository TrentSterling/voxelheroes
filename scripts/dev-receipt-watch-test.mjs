import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launch } from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/dev-receipt-watch';
mkdirSync(out,{recursive:true});
const t=await launch({url:'http://127.0.0.1:5173/',out});let navigations=0;const logs=[];
try{
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.game.state.setFlag('receipt:watcher-fixture');});await t.step(.3);
 t.page.on('framenavigated',f=>{if(f===t.page.mainFrame())navigations++;});t.page.on('console',m=>logs.push(m.text()));
 const before=await t.state();
 writeFileSync(`${out}/watcher-probe.html`,'<!doctype html><title>Generated receipt fixture</title><p>First local write.</p>');await t.page.waitForTimeout(1500);
 writeFileSync(`${out}/watcher-probe.html`,'<!doctype html><title>Generated receipt fixture</title><p>Updated local receipt.</p>');await t.page.waitForTimeout(1500);
 const after=await t.state(),flag=await t.eval(()=>window.__voxelHeroes.state.flags.has('receipt:watcher-fixture'));
 assert.equal(navigations,0);assert.ok(flag);assert.equal(after.mode,'play');assert.equal(after.time,before.time);assert.equal(after.key,before.key);assert.deepEqual(t.errors,[]);
 writeFileSync(`${out}/result.json`,JSON.stringify({ok:true,utc:new Date().toISOString(),muted:true,navigations,before,after,flag,logs,viteConfigSha256:createHash('sha256').update(readFileSync('vite.config.js')).digest('hex'),checks:['Creating and updating generated receipt HTML cause no navigation.','Manual game time, room, play mode and a fixture flag survive both writes.','No browser errors.'],limitations:['This directly verifies receipt writes on the current dev server; it does not establish the cause of earlier reloads.']},null,2));
 console.log('PASS generated HTML receipt creation and updates preserve the running development game; zero navigations and browser errors.');
}finally{await t.close();}

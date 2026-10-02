import { launch } from './playtest.mjs';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const out = 'playtest-out/voice-cast-20260930';
const t = await launch({ url: 'http://127.0.0.1:5173/', out });
const scenes = [
  ['Mira','v1:1,1',10.5,12],['Old Tobin','v1:1,1',13,10],['Hettie','v1:1,1',10,12],
  ['Brannoc','v1:1,1',10,5.8],['Mags','v1:1,1',5,5.8],['Tinker Wyll','v1:1,1',13,6.8],
  ['King Aldric','ow-4-3:1,1',7,7],['Tern','mossbrook-future:0,0',5,10],
];
const rows = [];
try {
  await t.press('Enter'); await t.step(1);
  for (const [speaker, area, x, z] of scenes) {
    await t.eval(() => window.__voxelHeroes.setMode('play')); await t.teleport(area, x, z); await t.step(.4);
    await t.eval(speaker => { const h = window.__voxelHeroes; const npc = h.entities.find(e => e.name === speaker); if (!npc) throw Error('Missing ' + speaker); npc.onInteract(h.player); }, speaker);
    await t.step(5);
    const file = speaker.toLowerCase().replaceAll(' ', '-') + '.png'; await t.shot(file.slice(0,-4));
    const view = await t.eval(() => ({ dialog: window.__voxelHeroes.game.dialog.dialogView(), voice: window.__voxelHeroes.game.npcVoices.npcVoiceView().last }));
    if (!view.voice?.id || view.voice.engine !== 'recorded-kokoro') throw Error('Unrecorded dialogue: ' + speaker);
    rows.push({ speaker, file, sha256: createHash('sha256').update(readFileSync(`${out}/${file}`)).digest('hex'), ...view });
  }
  await t.eval(() => window.__voxelHeroes.setMode('play'));
  await t.page.setViewportSize({ width: 320, height: 568 }); await t.page.waitForTimeout(250);
  await t.teleport('v1:1,1',10.5,12); await t.step(.4);
  await t.eval(() => { const h = window.__voxelHeroes; h.entities.find(e => e.name === 'Mira').onInteract(h.player); }); await t.step(5); await t.shot('phone-mira');
  writeFileSync(`${out}/manifest.json`, JSON.stringify({ at: new Date().toISOString(), fixture: 'Camera positioning via teleport only; actual NPC.onInteract conversations and recorded audio, no enemy removal or quest flags.', rows }, null, 2));
  console.log(`Captured ${rows.length} cast conversations plus phone Mira.`);
} finally { await t.close(); }

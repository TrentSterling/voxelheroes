import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { installSilentOutput } from './lib/silent-output.mjs';

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url') ?? 'http://127.0.0.1:5173/';
const out = arg('out') ?? 'playtest-out/forest-hud-layout';
assert.ok(!existsSync(`${out}/result.json`), 'Choose a fresh output folder to preserve receipts.');
mkdirSync(out, { recursive: true });
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const fingerprint = () => {
  const h = createHash('sha256');
  for (const file of [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort()) {
    h.update(file.replaceAll('\\', '/') + '\0'); h.update(readFileSync(file));
  }
  return h.digest('hex');
};
const profiles = [
  ['phone', 320, 568, true], ['landscape', 568, 320, true],
  ['small-tablet', 700, 360, true], ['wide-landscape', 840, 360, true],
  ['desktop', 1280, 720, false],
].filter(([name]) => !arg('profiles') || arg('profiles').split(',').includes(name));
const result = {
  startedUtc: new Date().toISOString(), sourceSha256: fingerprint(), checks: [], captures: [], layouts: [],
  scope: 'Muted Chromium and Firefox, normal/large text, five screen sizes. Equipment, story flags, teleport and removal of unrelated hostiles isolate HUD geometry. Actual mouse/touch opens the Journal. No native adventure or audible voice claim.',
};
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const check = (pass, label, detail) => { result.checks.push({ pass, label, ...(detail ? { detail } : {}) }); console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); };
try {
  for (const engine of (arg('engines') ?? 'chromium,firefox').split(',')) {
    const browser = await ({ chromium, firefox }[engine]).launch({
      headless: true,
      ...(engine === 'chromium' ? { args: CHROMIUM_ARGS } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }),
    });
    try {
      for (const [name, width, height, touch] of profiles) {
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: engine === 'chromium' && touch });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        try {
          await installSilentOutput(page);
          await page.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
          await page.goto(new URL('?manual=1&seed=17', url).href);
          await page.waitForFunction(() => window.__voxelHeroes?.game?.ui);
          assert.equal(await page.evaluate(() => window.__testAudioOutputGuard?.version), 1, 'Output guard must be installed before inputs.');
          await page.evaluate(() => {
            const h = window.__voxelHeroes, g = h.game.ui.g, text = g.text;
            h.game.audio.setMuted(true); h.game.audio.setVolumes({ master: 0 }); h.game.settings.setSetting('npcVoices', false);
            window.__forestText = [];
            g.text = function (value, x, y, o = {}) {
              const w = g.measure(String(value), o.size ?? 1, o.tracking ?? 0);
              window.__forestText.push({ text: String(value), x: o.align === 'center' ? Math.round(x - w / 2) : o.align === 'right' ? x - w : x, y, w, h: g.cap * (o.size ?? 1) });
              return text.call(this, value, x, y, o);
            };
          });
          for (const large of [false, true]) for (const stage of ['early-forest', 'hive-map', 'hive-bombs']) {
            const label = `${engine}-${name}-${large ? 'large' : 'normal'}-${stage}`;
            await page.evaluate(async ({ large, stage }) => {
              const h = window.__voxelHeroes;
              h.game.progress.startNewGame({ prologue: false });
              h.game.audio.setMuted(true); h.game.audio.setVolumes({ master: 0 }); h.game.settings.setSetting('npcVoices', false);
              h.game.settings.setSetting('largeText', large);
              h.give({ grant: 'blade-start', fanfare: false }); h.give({ grant: 'shield-1', fanfare: false });
              if (stage !== 'early-forest') {
                h.game.state.setFlag('overworld:talked:king'); h.game.state.setFlag('dungeon:d1:entered');
                h.game.dungeons.giveBossKey('d1');
                h.game.dungeons.defeatBoss('d1'); h.game.dungeons.completeDungeon('d1');
                if (stage === 'hive-bombs') h.game.dungeons.giveMap('d2');
              }
              h.game.objective.trackQuest(null); h.teleport(stage === 'early-forest' ? 'forest:1,2' : 'd2:2,4', 8, 8);
              for (const e of [...h.entities]) if (e.kind === 'enemy') e.remove();
              await h.step(.25);
            }, { large, stage });
            await page.waitForFunction(() => !window.__voxelHeroes.game.banner.bannerView().visible);
            await page.waitForTimeout(300);
            const data = await page.evaluate(() => {
              const h = window.__voxelHeroes; window.__forestText = []; h.game.ui.requestUi(); h.render();
              return { ...h.game.ui.uiView(), hud: h.game.hud.hudView(), runs: window.__forestText, goal: h.game.objective.objectiveHudText(), objectiveId: h.game.objective.objectiveId() };
            });
            const centers = data.hud.widgets.filter(r => r.region === 'center');
            const obstacles = [...data.hud.widgets.filter(r => r.region !== 'center'), ...data.hits.filter(r => ['party-open', 'journal-open'].includes(r.id))];
            const collisions = centers.flatMap(a => obstacles.filter(b => overlaps(a, b)).map(b => [a.id, b.id]));
            const escapes = data.runs.filter(r => r.x < 0 || r.y < 0 || r.x + r.w > data.w || r.y + r.h > data.h);
            result.layouts.push({ label, ...data, collisions, escapes });
            const file = `${out}/${label}.png`; await page.screenshot({ path: file }); result.captures.push(file);
            check(centers.some(r => r.id === 'objective'), `${label}: objective is visible`);
            check(collisions.length === 0, `${label}: center HUD clears side widgets and shortcut targets`, collisions);
            check(escapes.length === 0, `${label}: every rendered text run fits the canvas`, escapes);
            check(stage === 'early-forest' || data.objectiveId === (stage === 'hive-map' ? 'hive-map' : 'hive-bombs'), `${label}: actual route objective is active`, data.objectiveId);
            const target = data.hits.find(r => r.id === 'journal-open'); assert.ok(target, 'Journal shortcut is available');
            const p = { x: (target.x + target.w / 2) * data.scale, y: (target.y + target.h / 2) * data.scale };
            if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
            await page.evaluate(() => window.__voxelHeroes.tick());
            check(await page.evaluate(() => window.__voxelHeroes.state.mode === 'journal'), `${label}: actual ${touch ? 'touch' : 'mouse'} opens Journal`);
            await page.evaluate(async () => { const h = window.__voxelHeroes; h.input.tap('cancel'); await h.tick(); });
          }
          check(errors.length === 0, `${engine}-${name}: no browser errors`, errors);
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  result.sourceUnchanged = result.sourceSha256 === fingerprint();
  assert.ok(result.sourceUnchanged, 'Game source changed during layout checks.');
  result.ok = result.checks.every(c => c.pass);
  if (!result.ok) process.exitCode = 1;
} catch (e) { result.ok = false; result.error = { message: e.message, stack: e.stack }; process.exitCode = 1; console.error(e.stack); }
finally {
  result.completedUtc = new Date().toISOString();
  writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.checks.filter(c => c.pass).length}/${result.checks.length} silent HUD checks; ${result.captures.length} images.`);
}

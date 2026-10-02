import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { installSilentOutput } from './lib/silent-output.mjs';
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = arg('out') ?? 'playtest-out/hud-clearance-retakes', url = arg('url') ?? 'http://127.0.0.1:5173/';
mkdirSync(out, { recursive: true });
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const fp = createHash('sha256');
for (const f of [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort()) { fp.update(f.replaceAll('\\', '/') + '\0'); fp.update(readFileSync(f)); }
const result = { startedUtc: new Date().toISOString(), sourceSha256: fp.digest('hex'), checks: [], captures: [],
  scope: 'Same disclosed HUD fixtures, with native arrival/invulnerability allowed to expire through two seconds of ordinary simulation before each image. No forced hero visibility or health edits. Output guard installed before navigation; native mute label is also set off.' };
const rows = [
  ['chromium', 'landscape-large-early-forest', 568, 320, true, true, 'early-forest'],
  ['chromium', 'wide-landscape-normal-hive-bombs', 840, 360, true, false, 'hive-bombs'],
  ['firefox', 'landscape-large-hive-map', 568, 320, true, true, 'hive-map'],
  ['firefox', 'phone-large-early-forest', 320, 568, true, true, 'early-forest'],
  ['firefox', 'desktop-large-hive-bombs', 1280, 720, false, true, 'hive-bombs'],
];
try {
  for (const engine of ['chromium', 'firefox']) {
    const browser = await ({ chromium, firefox }[engine]).launch({ headless: true,
      ...(engine === 'chromium' ? { args: CHROMIUM_ARGS } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }) });
    try {
      for (const [, name, width, height, touch, large, stage] of rows.filter(r => r[0] === engine)) {
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: engine === 'chromium' && touch });
        try {
          await installSilentOutput(page);
          await page.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
          await page.goto(new URL('?manual=1&seed=17', url).href); await page.waitForFunction(() => window.__voxelHeroes?.game?.ui);
          await page.evaluate(async ({ large, stage }) => {
            const h = window.__voxelHeroes; h.game.progress.startNewGame({ prologue: false });
            h.game.settings.setSetting('muted', true); h.game.audio.setVolumes({ master: 0 });
            h.game.settings.setSetting('npcVoices', false); h.game.settings.setSetting('largeText', large);
            h.give({ grant: 'blade-start', fanfare: false }); h.give({ grant: 'shield-1', fanfare: false });
            if (stage !== 'early-forest') {
              h.game.state.setFlag('overworld:talked:king'); h.game.state.setFlag('dungeon:d1:entered');
              h.game.dungeons.giveBossKey('d1'); h.game.dungeons.defeatBoss('d1'); h.game.dungeons.completeDungeon('d1');
              if (stage === 'hive-bombs') h.game.dungeons.giveMap('d2');
            }
            h.game.objective.trackQuest(null); h.teleport(stage === 'early-forest' ? 'forest:1,2' : 'd2:2,4', 8, 8);
            for (const e of [...h.entities]) if (e.kind === 'enemy') e.remove();
            await h.step(2);
          }, { large, stage });
          await page.waitForFunction(() => !window.__voxelHeroes.game.banner.bannerView().visible);
          if (touch) {
            const button = await page.locator('#btn-guard').boundingBox(); assert.ok(button);
            await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
            await page.evaluate(() => window.__voxelHeroes.step(.15));
          }
          const data = await page.evaluate(() => {
            const h = window.__voxelHeroes; h.game.ui.requestUi(); h.render();
            return { ...h.game.ui.uiView(), hud: h.game.hud.hudView(), heroVisible: h.player.hero.root.visible,
              invT: h.player.invT, device: h.input.lastDevice(), mute: h.game.hud.muteLabel(), guard: window.__testAudioOutputGuard?.version };
          });
          assert.ok(data.heroVisible && data.invT <= 0, `${name}: native arrival blink has expired`);
          assert.ok(data.guard === 1 && data.mute === 'Sound off', `${name}: output guard and native mute agree`);
          if (touch) assert.equal(data.device, 'touch', `${name}: real touch selects the native touch labels`);
          const obstacles = [...data.hud.widgets.filter(r => r.region !== 'center'), ...data.hits.filter(r => ['party-open', 'journal-open'].includes(r.id))];
          assert.ok(data.hud.widgets.filter(r => r.region === 'center').every(a => obstacles.every(b => !(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y))), `${name}: HUD still clears shortcuts`);
          const file = `${out}/${engine}-${name}.png`; await page.screenshot({ path: file }); result.captures.push(file);
          result.checks.push({ label: `${engine}-${name}`, ...data });
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  result.ok = true;
} catch (e) { result.ok = false; result.error = { message: e.message, stack: e.stack }; process.exitCode = 1; console.error(e.stack); }
finally { result.completedUtc = new Date().toISOString(); writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.checks.length} settled native HUD photographs with disconnected audio output.`); }

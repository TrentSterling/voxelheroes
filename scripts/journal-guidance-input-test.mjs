import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'playtest-out/journal-guidance-input';
const url = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:5173/';
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const fp = createHash('sha256');
for (const f of [...walk('src'), ...walk('public/voices'), 'index.html', 'package.json', 'package-lock.json'].sort()) { fp.update(f.replaceAll('\\', '/') + '\0'); fp.update(readFileSync(f)); }
mkdirSync(out, { recursive: true });
const report = { utc: new Date().toISOString(), ok: false, sourceSha256: fp.digest('hex'), checks: [], captures: [], fixture: 'Muted Chromium; arranged story and inventory state. Actual mouse and coarse touch select Track/Auto, HUD journal entry, paragraph pages and Close. No voice playback.' };
const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
try {
  for (const [name, width, height, touch] of [['desktop', 1280, 720, false], ['phone', 320, 568, true], ['landscape', 568, 320, true]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    try {
      await page.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
      await page.goto(new URL('?manual=1', url).href); await page.waitForFunction(() => window.__voxelHeroes?.game?.journal);
      await page.evaluate(() => {
        const h = window.__voxelHeroes, g = h.game.ui.g, text = g.text, panel = g.panel;
        h.game.progress.startNewGame({ prologue: false }); h.game.audio.setMuted(true); h.game.audio.setVolumes({ master: 0 }); h.game.settings.setSetting('npcVoices', false);
        h.state.errands.Hettie = { status: 'active', found: false }; h.state.forage.wildflower = 2;
        window.__journalCapture = { runs: [], parent: null };
        g.panel = function(x, y, w, height, options) { if (options?.accent) window.__journalCapture.parent = { x, y, w, h: height }; return panel.call(this, x, y, w, height, options); };
        g.text = function(value, x, y, o = {}) { const c = window.__journalCapture, w = g.measure(String(value), o.size ?? 1, o.tracking ?? 0); c.runs.push({ text: String(value), x: o.align === 'center' ? Math.round(x - w / 2) : o.align === 'right' ? x - w : x, y, w, h: g.cap * (o.size ?? 1), parent: c.parent }); return text.call(this, value, x, y, o); };
        h.game.journal.openJournal('errand:Hettie'); h.render();
      });
      const check = (pass, label) => { assert.ok(pass, name + ': ' + label); report.checks.push(name + ': ' + label); };
      const journal = () => page.evaluate(() => window.__voxelHeroes.game.journal.journalView());
      const click = async id => {
        const p = await page.evaluate(id => { const h = window.__voxelHeroes; h.render(); const v = h.game.ui.uiView(), r = v.hits.find(r => r.id === id); return r ? { x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h / 2) * v.scale } : null; }, id);
        assert.ok(p, name + ': ' + id + ' exists');
        if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
        await page.evaluate(() => window.__voxelHeroes.render());
      };
      const capture = async label => {
        const data = await page.evaluate(() => { const h = window.__voxelHeroes, c = window.__journalCapture; c.runs = []; c.parent = null; h.game.ui.requestUi(); h.render(); return { ...h.game.ui.uiView(), mode: h.state.mode, runs: c.runs, hud: h.game.hud.hudView(), touchDisplay: getComputedStyle(document.getElementById('touch')).display }; });
        const controls = data.hits.filter(r => r.id.startsWith('journal-') && !['journal-panel', 'journal-scrim'].includes(r.id));
        const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        const violations = data.runs.filter(r => r.x < 0 || r.y < 0 || r.x + r.w > data.w || r.y + r.h > data.h || r.parent && (r.x < r.parent.x + 2 || r.x + r.w > r.parent.x + r.parent.w - 2 || r.y < r.parent.y || r.y + r.h > r.parent.y + r.parent.h));
        const collisions = controls.flatMap((a, i) => controls.slice(i + 1).filter(b => overlap(a, b)).map(b => [a.id, b.id]));
        const text = data.runs.filter(r => r.parent);
        for (let i = 0; i < text.length; i++) for (const other of text.slice(i + 1)) if (overlap(text[i], other)) collisions.push([text[i].text, other.text]);
        for (const r of data.runs.filter(r => r.text.startsWith('Reward:'))) for (const c of controls) if (overlap(r, c)) collisions.push([r.text, c.id]);
        if (data.mode === 'play') {
          const objective = data.hud.widgets.find(r => r.id === 'objective');
          for (const other of [...data.hud.widgets.filter(r => r.id !== 'objective'), ...data.hits.filter(r => ['party-open', 'journal-open'].includes(r.id))]) if (overlap(objective, other)) collisions.push(['objective', other.id]);
        }
        report.captures.push({ label: name + '-' + label, width: data.w, height: data.h, violations, collisions });
        assert.deepEqual(violations, [], name + ': text and panel bounds'); assert.deepEqual(collisions, [], name + ': journal controls avoid each other and rewards');
        if (touch && data.mode === 'journal') assert.equal(data.touchDisplay, 'none');
        await page.screenshot({ path: `${out}/${name}-${label}.png` });
      };
      await capture('before-track');
      await click('journal-track'); check((await journal()).trackedId === 'errand:Hettie', 'actual Track input pins the selected task');
      await capture('tracked');
      await click('journal-close');
      await capture('quest-hud');
      await click('objective-open'); check((await journal()).open && (await journal()).selectedId === 'errand:Hettie', 'actual HUD tap opens the chosen task');
      await page.evaluate(() => { window.__voxelHeroes.state.forage.wildflower = 3; window.__voxelHeroes.render(); });
      let j = await journal(); check(j.selectedId === 'errand:Hettie' && j.entries[j.selected].status === 'ready', 'ready progress keeps the intended selected task');
      await capture('ready');
      await click('journal-auto'); check((await journal()).trackedId === null && (await journal()).entries[(await journal()).selected].status === 'ready', 'actual Auto input removes the pin and preserves progress');
      await click('journal-track'); await click('journal-track'); check((await journal()).trackedId === null, 'actual Track and Untrack inputs toggle the same task');
      await page.evaluate(() => { const h = window.__voxelHeroes; h.game.journal.closeJournal(); h.game.journal.openJournal('era-archive'); h.render(); });
      const original = (await journal()).entries[(await journal()).selected].detail;
      const pages = (await journal()).detailPages; let paragraph = '';
      for (let p = 0; p < pages; p++) { paragraph += ' ' + (await journal()).shownDetail; await capture('archive-page-' + p); if (pages > 1) await click('journal-detail-next'); }
      check(paragraph.replace(/\s/g, '') === original.replace(/\s/g, ''), 'actual Read controls preserve the entire archive paragraph');
      await click('journal-track');
      await page.evaluate(() => { window.__voxelHeroes.game.state.setFlag('era:voices-returned'); window.__voxelHeroes.render(); });
      j = await journal();
      check(j.selectedId === 'era-archive' && j.entries[j.selected].status === 'done' && j.trackedId === null, 'shared completion releases tracking without selecting a different entry');
      check(!await page.evaluate(() => window.__voxelHeroes.game.ui.uiView().hits.some(r => r.id === 'journal-track')), 'a completed task has no Track action');
      await capture('completed');
      await click('journal-close'); check(await page.evaluate(() => window.__voxelHeroes.state.mode) === 'play', 'actual Close input returns to play');
      // Each unfinished task also exercises the portrait HUD and its full
      // journal footer. State selection is a fixture; interaction above is real.
      const ids = await page.evaluate(() => window.__voxelHeroes.game.objective.questEntries().filter(e => e.status !== 'done').map(e => e.id));
      for (const id of ids) {
        await page.evaluate(id => { const h = window.__voxelHeroes; h.game.objective.trackQuest(id); h.game.journal.openJournal(id); h.render(); }, id);
        await capture('all-tasks-' + id.replaceAll(/[^a-z0-9]/gi, '-'));
        await page.evaluate(() => { window.__voxelHeroes.game.journal.closeJournal(); window.__voxelHeroes.render(); });
        await capture('all-hud-' + id.replaceAll(/[^a-z0-9]/gi, '-'));
      }
      check(true, 'every unfinished task keeps its journal text, reward, footer and HUD clear');
    } finally { await page.close(); }
  }
  report.ok = true; console.log('PASS ' + report.checks.length + ' guidance mouse/touch checks; ' + report.captures.length + ' layout captures');
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; console.error(error.stack); }
finally { await browser.close(); writeFileSync(`${out}/result.json`, JSON.stringify(report, null, 2)); }

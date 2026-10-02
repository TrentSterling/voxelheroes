import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { installSilentOutput } from './lib/silent-output.mjs';

const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'playtest-out/verify-silent-browser';
mkdirSync(out, { recursive: true });
const result = { startedUtc: new Date().toISOString(), checks: [],
  scope: 'Blank headless documents only. Native real-time destination connection is blocked, internal buses remain usable, media mute is forced and speech is suppressed. No game, oscillator, clip or audio recording is played.' };
try {
  for (const engine of ['chromium', 'firefox']) {
    const browser = await ({ chromium, firefox }[engine]).launch({ headless: true,
      ...(engine === 'chromium' ? { args: CHROMIUM_ARGS } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }) });
    try {
      const context = await browser.newContext(); await installSilentOutput(context);
      const page = await context.newPage(); await page.goto('data:text/html,<title>Output isolation check</title>');
      const native = await page.evaluate(async () => {
        const ctx = new AudioContext(), master = ctx.createGain(), bus = ctx.createGain();
        const destination = master.connect(ctx.destination) === ctx.destination;
        const internal = master.connect(bus) === bus;
        const media = document.createElement('audio'); media.muted = false;
        speechSynthesis.speak(new SpeechSynthesisUtterance('Suppressed by test output isolation.'));
        await ctx.close();
        return { guard: window.__testAudioOutputGuard, destination, internal, muted: media.muted, closed: ctx.state === 'closed' };
      });
      for (const [pass, label] of [
        [native.guard?.version === 1, 'injection installed before any input'],
        [native.destination && native.guard.blockedDestinations === 1, 'native speaker destination connection blocked'],
        [native.internal, 'native internal bus connection preserved'],
        [native.muted, 'native media player cannot be unmuted'],
        [native.guard.suppressedSpeech === 1, 'OS speech dispatch suppressed'],
        [native.closed, 'native context closed without a sound source'],
      ]) { assert.ok(pass, `${engine}: ${label}`); result.checks.push(`${engine}: ${label}`); }
    } finally { await browser.close(); }
  }
  result.ok = true;
} catch (e) { result.ok = false; result.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally { result.completedUtc = new Date().toISOString(); writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.checks.length} native output isolation checks. No game or sound source played.`); if (result.error) console.error(result.error.stack); }

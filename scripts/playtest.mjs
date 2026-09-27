#!/usr/bin/env node
// Voxel Heroes play-test harness: a small library and a CLI.
//
// It builds the game (vite build), serves dist/ with vite preview on a free
// port, opens it in headless Chromium with ?manual=1 (the page keeps
// rendering but the simulation only moves when a test steps it) and drives
// it through window.__voxelHeroes (src/debug/testhook.js). Swiftshader draws
// only a few frames a second, so every wait is in simulated time: step(),
// hold() and the bot helpers advance the game by fixed 1/60 s ticks.
//
// CLI
//   npm run playtest                            default scenario, shots in playtest-out/
//   node scripts/playtest.mjs --out <dir>       screenshots go to <dir>
//   node scripts/playtest.mjs --scenario all    every scenario (one sub-folder each)
//   node scripts/playtest.mjs --scenario <name> one file from scripts/scenarios/
//   node scripts/playtest.mjs --list            list the scenarios
//   --no-build  serve the existing dist/     --seed <n>  gameplay seed (default 1)
//   --headed    show the browser             --url <u>   test a running server
// Exit code 0 when every scenario passes, 1 otherwise.
//
// Library
//   import { launch } from './playtest.mjs';
//   const t = await launch({ out: 'shots' });   // builds and serves unless given a url
//   await t.press('Enter');                     // title -> play
//   await t.hold('ArrowRight', 2);              // hold a key for 2 simulated seconds
//   t.expect((await t.state()).screenName === 'Rattlestone Hollow', 'walked east');
//   await t.shot('hollow');                     // <out>/hollow.png
//   await t.close();
//
// Scenarios are files in scripts/scenarios/ that export
//   export const description = 'one line';
//   export default async function (t) { ... }   // throw (or t.expect) to fail
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS = join(ROOT, 'scripts', 'scenarios');
const BOT = join(ROOT, 'scripts', 'lib', 'bot.js');
const GLOBAL_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';
export const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
export const DT = 1 / 60;

// Console warnings every run prints: three.js r186 swaps the renderer's
// PCFSoftShadowMap for PCFShadowMap (kept so shadows match the prototype).
const KNOWN_WARNINGS = [/PCFSoftShadowMap has been removed/];

// Google Fonts is the page's only external host. Tests block it so they never
// depend on the network; the HUD falls back to the monospace font.
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

export class PlaytestError extends Error {}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    if (existsSync(GLOBAL_PLAYWRIGHT)) return import(pathToFileURL(GLOBAL_PLAYWRIGHT).href);
    throw new Error('Playwright not found: npm install (it is a devDependency) or set up a global playwright');
  }
}

function freePort() {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
  });
}

// vite build, quietly. Throws on a build error.
export async function buildGame() {
  const { build } = await import('vite');
  await build({ root: ROOT, logLevel: 'warn' });
}

// vite preview of dist/ on a free port: { url, close() }.
export async function startServer() {
  const { preview } = await import('vite');
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await freePort();
    try {
      const server = await preview({
        root: ROOT,
        logLevel: 'warn',
        preview: { host: '127.0.0.1', port, strictPort: true, open: false },
      });
      return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

// Keep only JSON-friendly bits of an event payload (entities -> type, screens -> name).
const PAYLOAD_SUMMARY = `(p) => {
  const out = {};
  for (const [k, v] of Object.entries(p ?? {})) {
    if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) out[k] = v;
    else if (typeof v === 'object' && typeof v.name === 'string') out[k] = v.name;
    else if (typeof v === 'object' && typeof v.type === 'string') out[k] = v.type;
  }
  return out;
}`;

// Open the game in a fresh browser page and return a test session.
// Options: url (skip build and server), out (screenshot folder), seed,
// build (default true), headed, viewport, browser (reuse a launched one).
export async function launch({
  url = null,
  out = join(ROOT, 'playtest-out'),
  seed = 1,
  build = true,
  headed = false,
  viewport = { width: 1280, height: 720 },
  browser: sharedBrowser = null,
} = {}) {
  let server = null;
  if (!url) {
    if (build) await buildGame();
    server = await startServer();
    url = server.url;
  }
  const { chromium } = sharedBrowser ? {} : await loadPlaywright();
  const browser = sharedBrowser ?? (await chromium.launch({ headless: !headed, args: CHROMIUM_ARGS }));
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.route(FONT_HOSTS, (route) => route.abort());
  const page = await context.newPage();

  const errors = [];
  const warnings = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (msg) => {
    const where = msg.location()?.url ?? '';
    if (FONT_HOSTS.test(where) || /fonts\.(googleapis|gstatic)\.com/.test(msg.text())) return;
    if (msg.type() === 'error') errors.push(`console error: ${msg.text()}`);
    else if (msg.type() === 'warning' && !KNOWN_WARNINGS.some((re) => re.test(msg.text()))) warnings.push(msg.text());
  });

  const pageUrl = new URL(url);
  pageUrl.searchParams.set('manual', '1');
  pageUrl.searchParams.set('seed', String(seed));
  await page.goto(pageUrl.href);
  await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
  await page.addScriptTag({ content: readFileSync(BOT, 'utf8') });

  mkdirSync(out, { recursive: true });
  const shots = [];
  const log = [];

  const bot = async (name, args, soft) => {
    const r = await page.evaluate(([n, a]) => window.__vhBot[n](...a), [name, args]);
    if (!r.ok && !soft) throw new PlaytestError(`${name}(${args.filter((a) => typeof a !== 'object').join(', ')}) failed: ${r.reason}`);
    return r;
  };
  const splitSoft = (opts = {}) => {
    const { soft = false, ...rest } = opts;
    return [rest, soft];
  };

  const t = {
    page,
    browser,
    context,
    url: pageUrl.href,
    out,
    errors,
    warnings,
    shots,
    log,

    // Run a function in the page (Playwright page.evaluate).
    eval: (fn, arg) => page.evaluate(fn, arg),

    // Advance the simulation by `seconds` in 1/60 s ticks. Returns ticks run.
    step: (seconds = DT) => page.evaluate((s) => window.__voxelHeroes.step(s), seconds),

    // Hold a keyboard key (Playwright key name: 'ArrowUp', 'Space', 'KeyK',
    // 'Enter', ...) for `seconds` of game time, then release it.
    async hold(key, seconds) {
      await page.keyboard.down(key);
      try {
        await t.step(seconds);
      } finally {
        await page.keyboard.up(key);
      }
    },

    // Press and release a key: one tick held, one tick after the release.
    async press(key) {
      await t.hold(key, DT);
      await t.step(DT);
    },

    // Press an input action directly ('sword', 'item', 'menu', ...), one tick.
    async tap(action) {
      await page.evaluate((a) => window.__voxelHeroes.input.tap(a), action);
      await t.step(DT);
    },

    // Point the virtual stick (x, z in -1..1) for `seconds`, then centre it.
    async stick(x, z, seconds) {
      await page.evaluate(([sx, sz]) => window.__voxelHeroes.input.setStick(sx, sz), [x, z]);
      try {
        await t.step(seconds);
      } finally {
        await page.evaluate(() => window.__voxelHeroes.input.setStick(0, 0));
      }
    },

    teleport: (target, x, z, opts) => page.evaluate(([a, b, c, d]) => window.__voxelHeroes.teleport(a, b, c, d), [target, x, z, opts]),
    give: (id, amount = 1) => page.evaluate(([i, n]) => window.__voxelHeroes.give(i, n), [id, amount]),
    setHp: (n) => page.evaluate((v) => window.__voxelHeroes.setHp(v), n),
    save: () => page.evaluate(() => window.__voxelHeroes.save()),
    load: (data) => page.evaluate((d) => window.__voxelHeroes.load(d), data),

    // window.__voxelHeroes.snapshot(): mode, area, screen, hp, keys, flags, ...
    state: () => page.evaluate(() => window.__voxelHeroes.snapshot()),

    // Draw a frame and save <out>/<name>.png.
    async shot(name) {
      await page.evaluate(
        () =>
          new Promise((done) => {
            window.__voxelHeroes.render();
            requestAnimationFrame(() => requestAnimationFrame(done));
          })
      );
      await page.waitForTimeout(250);
      const file = join(out, `${name}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      return file;
    },

    // Bot helpers (scripts/lib/bot.js), all in local tile coordinates of the
    // current screen. They throw on failure unless given { soft: true }.
    walkTo(x, z, opts) {
      const [o, soft] = splitSoft(opts);
      return bot('walkTo', [x, z, o], soft);
    },
    exit(dir, opts) {
      const [o, soft] = splitSoft(opts);
      return bot('exit', [dir, o], soft);
    },
    fight(opts) {
      const [o, soft] = splitSoft(opts);
      return bot('fight', [o], soft);
    },
    // predicate: (snapshot) => boolean, sent to the page as source text.
    waitFor(predicate, opts) {
      const [o, soft] = splitSoft(opts);
      return bot('waitFor', [predicate.toString(), o], soft);
    },

    // Count game events from now on: await t.track('room-cleared'), then
    // await t.events('room-cleared') -> [{ ...payload summary, time }].
    track: (...names) =>
      page.evaluate(
        ([list, summarize]) => {
          const g = window.__voxelHeroes;
          const sum = new Function(`return ${summarize}`)();
          window.__vhEvents ??= {};
          for (const n of list) {
            if (window.__vhEvents[n]) continue;
            window.__vhEvents[n] = [];
            g.events.on(n, (p) => window.__vhEvents[n].push({ ...sum(p), time: +g.state.time.toFixed(3) }));
          }
        },
        [names, PAYLOAD_SUMMARY]
      ),
    events: (name) => page.evaluate((n) => window.__vhEvents?.[n] ?? [], name),

    // Assert. A failed scenario prints the game state and saves FAILED.png.
    expect(cond, message) {
      if (!cond) throw new PlaytestError(message);
      log.push(`ok   ${message}`);
    },
    note(message) {
      log.push(`     ${message}`);
    },

    async close() {
      await context.close().catch(() => {});
      if (!sharedBrowser) await browser.close().catch(() => {});
      if (server) await server.close().catch(() => {});
    },
  };
  return t;
}

// ---------------------------------------------------------------- scenarios
export function listScenarios() {
  if (!existsSync(SCENARIOS)) return [];
  return readdirSync(SCENARIOS)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => basename(f, '.mjs'))
    .sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)));
}

async function loadScenario(name) {
  const file = join(SCENARIOS, `${name}.mjs`);
  if (!existsSync(file)) throw new Error(`No scenario "${name}" (looked for ${file})`);
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.default !== 'function') throw new Error(`Scenario ${name} must export a default async function`);
  return { name, run: mod.default, description: mod.description ?? '' };
}

// Run one scenario in a fresh page. Resolves to { name, ok, error, shots, log, errors, seconds }.
export async function runScenario(name, { out, url, seed = 1, browser, headed = false } = {}) {
  const scenario = await loadScenario(name);
  if (out) rmSync(join(out, 'FAILED.png'), { force: true }); // left by an earlier failed run
  const started = Date.now();
  const t = await launch({ url, out, seed, browser, headed, build: false });
  let error = null;
  try {
    await scenario.run(t);
    if (t.errors.length) throw new PlaytestError(`the page reported errors:\n  ${t.errors.join('\n  ')}`);
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
    try {
      const s = await t.state();
      error.snapshot = { ...s, entities: s.entities.map((e2) => `${e2.type}@${e2.x},${e2.z}`) };
      await t.shot('FAILED');
    } catch {
      // the page may be gone
    }
  } finally {
    await t.close();
  }
  return {
    name,
    ok: !error,
    error,
    shots: t.shots,
    log: t.log,
    errors: t.errors,
    warnings: t.warnings,
    seconds: (Date.now() - started) / 1000,
  };
}

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const args = { out: join(ROOT, 'playtest-out'), scenario: 'default', build: true, seed: 1, headed: false, list: false, url: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--out') args.out = resolve(value());
    else if (a === '--scenario') args.scenario = value();
    else if (a === '--seed') args.seed = Number(value()) >>> 0;
    else if (a === '--url') args.url = value();
    else if (a === '--no-build') args.build = false;
    else if (a === '--headed') args.headed = true;
    else if (a === '--list') args.list = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown option ${a} (try --help)`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(9, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  const all = listScenarios();
  if (args.list) {
    for (const name of all) console.log(`${name.padEnd(16)} ${(await loadScenario(name)).description}`);
    return 0;
  }
  const names = args.scenario === 'all' ? all : args.scenario.split(',');

  let server = null;
  let url = args.url;
  if (!url) {
    if (args.build) {
      console.log('building...');
      await buildGame();
    }
    server = await startServer();
    url = server.url;
  }
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: !args.headed, args: CHROMIUM_ARGS });
  const results = [];
  try {
    for (const name of names) {
      const out = names.length > 1 ? join(args.out, name) : args.out;
      console.log(`\nscenario ${name} -> ${out}`);
      const r = await runScenario(name, { out, url, seed: args.seed, browser });
      for (const line of r.log) console.log(`  ${line}`);
      for (const w of r.warnings) console.log(`  warning from the page: ${w}`);
      if (r.ok) console.log(`PASS ${name} (${r.shots.length} screenshots, ${r.seconds.toFixed(1)} s)`);
      else {
        console.log(`FAIL ${name}: ${r.error.message}`);
        if (!(r.error instanceof PlaytestError)) console.log(r.error.stack);
        if (r.error.snapshot) console.log(`  state: ${JSON.stringify(r.error.snapshot)}`);
      }
      results.push(r);
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.stack ?? e);
      process.exit(1);
    }
  );
}

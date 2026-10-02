import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox } from 'playwright';
import { startRelay } from './lib/nostr-relay.mjs';
import { buildGame, startServer, CHROMIUM_ARGS } from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/multiplayer';

const providedUrl = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6);
const startedUtc=new Date().toISOString();
if (!providedUrl && !process.argv.includes('--no-build')) await buildGame();
const server = providedUrl ? null : await startServer();
const relay = await startRelay();
const browsers = [], pages = [], errors = [];
const receipts = [];
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/result.json`,JSON.stringify({passed:0,failed:null,pending:true,startedUtc},null,2));
const defaultIce = !process.argv.includes('--local-ice');
const options = { relayUrls: [relay.url], ...(defaultIce ? {} : { rtcConfig: { iceServers: [] } }) };
let passed = 0;
const pass = (label) => { passed++; console.log(`PASS ${label}`); };
const shot = async (page, file, caption, evidence) => {
  const sceneState = await page.evaluate(async () => {
    const h = window.__voxelHeroes;
    h.player.hero.root.visible = true; h.render();
    h.gfx.renderer.getContext().finish();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { hero: { x: h.player.x, z: h.player.z, carrying: !!h.player.carrying, model: h.player.object.position.toArray() },
      enemies: h.entities.filter((e) => e.kind === 'enemy').map((e) => ({ id: e.netId, hp: e.hp, x: e.x, z: e.z, visible: e.object.visible })) };
  });
  await page.screenshot({ path: `${out}/${file}.png` });
  receipts.push({ image: `${file}.png`, caption, evidence, sceneState, capturedUtc: new Date().toISOString() });
  writeFileSync(`${out}/receipts.json`, JSON.stringify(receipts, null, 2));
};
const settle = async (ms = 400) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await Promise.all(pages.filter((p) => !p.isClosed()).map((page) => page.evaluate(async () => { await window.__voxelHeroes.step(0.04); })));
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
};
const advance = async (seconds) => {
  for (let i = 0; i < Math.ceil(seconds / .04); i++) {
    await Promise.all(pages.filter(p => !p.isClosed()).map(page => page.evaluate(() => window.__voxelHeroes.step(.04))));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  await settle(300);
};
const view = (page) => page.evaluate(() => window.__voxelHeroes.game.party.partyView());
const actors = (page) => page.evaluate(() => window.__voxelHeroes.entities.filter((e) => !e.removed).map((e) => ({ id: e.netId, type: e.type, kind: e.kind, hp: e.hp, x: e.x, z: e.z, proxy: e._partyProxy })));
const teleport = async (page, key, x, z) => {
  await page.evaluate(({ key, x, z }) => { const h = window.__voxelHeroes; h.teleport(key, x, z); h.player.invT = 999; }, { key, x, z });
  await settle(250);
};
try {
  for (const [name, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch({ headless: true, ...(name === 'chromium' ? { args: [...CHROMIUM_ARGS, ...(defaultIce ? [] : ['--disable-features=WebRtcHideLocalIpsWithMdns'])] } : defaultIce ? { firefoxUserPrefs: { 'media.volume_scale': '0.0' } } : {
      firefoxUserPrefs: { 'media.volume_scale': '0.0', 'media.peerconnection.ice.obfuscate_host_addresses': false, 'media.peerconnection.ice.loopback': true },
    }) });
    browsers.push(browser);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
    page.on('console', (message) => { if (process.argv.includes('--debug') && message.type() !== 'debug') console.log(name, message.text()); });
    await page.addInitScript(() => {
      window.__rtc = [];
      const Native = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Native { constructor(...args) { super(...args); window.__rtc.push(this); } };
    });
    await page.goto(`${providedUrl ?? server.url}?manual=1&look=flat&seed=1`);
    await page.waitForFunction(() => window.__voxelHeroes?.game?.party);
    await page.evaluate(() => { const h = window.__voxelHeroes; h.game.progress.startNewGame(); h.player.invT = 999; });
    pages.push(page);
  }
  const [host, guest] = pages;
  assert.equal(await host.evaluate((options) => window.__voxelHeroes.game.party.createParty('TESTCOOP', options), options), true);
  assert.equal(await guest.evaluate((options) => window.__voxelHeroes.game.party.joinParty('TESTCOOP', options), options), true);
  console.log('Waiting for Chromium + Firefox RTC handshake');
  for (const page of pages) await page.waitForFunction(() => {
    const p = window.__voxelHeroes.game.party;
    return p.partyView().ready && p.partyView().count === 2 && p.partyConnections().some((c) => c.state === 'connected');
  }, null, { timeout: 45000 });
  await settle();
  pass('Chromium + Firefox joined over real Trystero WebRTC, two heroes in Mossbrook');
  if (process.argv.includes('--debug')) console.log(JSON.stringify(await Promise.all(pages.map(view))));

  const hub = await host.evaluate(() => window.__voxelHeroes.screen().key);
  await teleport(host, hub, 8.5, 5.5); await teleport(guest, hub, 10.5, 5.5);
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.input.setStick(0, 1); await h.step(0.2); h.input.setStick(0, 0); });
  await settle();
  const position = await guest.evaluate(() => ({ x: window.__voxelHeroes.player.x, z: window.__voxelHeroes.player.z }));
  await host.waitForFunction(position=>{const e=window.__voxelHeroes.game.party.partyFriends()[0];return e?.info&&Math.hypot(e.info.x-position.x,e.info.z-position.z)<.01;},position,{timeout:10000});
  // Wall time can elapse under rendering load without enough manual ticks.
  await host.evaluate(()=>window.__voxelHeroes.step(.3));
  await settle(250);
  const friend = await host.evaluate(() => { const e = window.__voxelHeroes.game.party.partyFriends()[0]; return { x: e.x, z: e.z, visible: e.object.visible, solid: e.solid }; });
  assert.ok(Math.hypot(friend.x - position.x, friend.z - position.z) < 0.1 && friend.visible && friend.solid,JSON.stringify({friend,position}));
  pass('Remote movement and solid player bodies');
  await shot(host, '01-town-party', 'Two heroes in Mossbrook', 'Firefox and Chromium connected through real Trystero RTC data channels. Movement and solid bodies agree.');
  await host.evaluate(() => window.__voxelHeroes.game.partyUi.openParty());
  await shot(host, '02-party-roster', 'The party menu', 'An invite code, copyable link, member names, and each hero\'s location.');
  await host.evaluate(() => window.__voxelHeroes.game.partyUi.closeParty());

  await teleport(host, 'd1:3,9', 8.5, 6.5); await teleport(guest, 'd1:3,9', 9.6, 6.5);
  await host.evaluate(async () => { const h = window.__voxelHeroes; h.input.setStick(1, 0); await h.step(0.2); h.input.setStick(0, 0); });
  assert.ok(await host.evaluate(() => { const h = window.__voxelHeroes; const friend = h.game.party.partyFriends()[0]; return friend.x - h.player.x >= h.player.r + friend.r - 0.02; }));
  pass('Walking into a friend stops at their body');
  await teleport(host, 'd1:3,9', 8.5, 6.5);
  await host.evaluate(() => { const h = window.__voxelHeroes; h.give('blade-start'); h.game.hero.hero.setFacing('east'); });
  await settle();
  const before = await guest.evaluate(() => ({ hp: window.__voxelHeroes.state.hp, x: window.__voxelHeroes.player.x }));
  await host.evaluate(async () => { const h = window.__voxelHeroes; h.input.tap('sword'); await h.step(0.08); });
  await settle(400);
  const after = await guest.evaluate(() => ({ hp: window.__voxelHeroes.state.hp, x: window.__voxelHeroes.player.x, knockT: window.__voxelHeroes.player.knockT }));
  assert.equal(after.hp, before.hp); assert.ok(after.x > before.x + 0.2, JSON.stringify({ before, after }));
  pass('Sword bonks knock a friend back without removing health');
  await shot(guest, '03-friendly-bonk', 'Friendly sword bonks', `Guest health stayed at ${after.hp}; a real sword swing pushed the guest from x=${before.x.toFixed(2)} to x=${after.x.toFixed(2)}.`);

  await teleport(guest, 'd1:3,9', 2.5, 3.4);
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.game.hero.hero.setFacing('north'); h.input.tap('sword'); await h.tick(); });
  await settle();
  assert.ok(await guest.evaluate(() => !!window.__voxelHeroes.player.carrying));
  const tiles = await Promise.all(pages.map((p) => p.evaluate(() => { const h = window.__voxelHeroes, s = h.screen(); return h.world.tile(s.x0 + 2, s.z0 + 2); })));
  assert.deepEqual(tiles, ['.', '.']);
  pass('Guest pot lift resolves on room owner and clears the pot for both players');
  await shot(guest, '04-shared-pot', 'Lift a shared pot', 'The guest carries the model; the source pot is gone in both browsers.');

  await guest.evaluate(() => { const h = window.__voxelHeroes, s = h.screen(); h.player.x = s.x0 + 5; h.player.z = s.z0 + 6.5; h.game.hero.hero.setFacing('east'); });
  const target = await host.evaluate(() => { const h = window.__voxelHeroes; const e = h.spawn('skeleton', 7, 6.5); e.spawned = true; e.growT = 1; e.hp = 8; e.think = () => {}; return { id: e.netId, hp: e.hp }; });
  await settle();
  assert.ok((await actors(guest)).some((e) => e.id === target.id && e.hp === 8));
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.input.tap('sword'); await h.step(0.28); });
  await settle();
  const enemies = await Promise.all(pages.map(async (p) => (await actors(p)).find((e) => e.id === target.id)));
  assert.equal(enemies[0]?.hp, 4); assert.equal(enemies[1]?.hp, 4);
  pass('Guest pot throw damages one shared enemy; health matches in both browsers');
  await shot(guest, '05-shared-combat', 'Throw pots in co-op combat', 'The guest\'s pot dealt 4 damage to one shared skeleton. Both browsers report 4 HP remaining.');

  const coins = await Promise.all(pages.map((p) => p.evaluate(() => window.__voxelHeroes.state.coins)));
  const coin = await host.evaluate(() => { const h = window.__voxelHeroes; const e = h.spawn('coin-10', 9, 5); e.t = 1; return e.netId; });
  await settle();
  await guest.evaluate(async () => { const h = window.__voxelHeroes, s = h.screen(); h.player.x = s.x0 + 9; h.player.z = s.z0 + 5; await h.step(0.1); });
  await settle();
  assert.equal(await guest.evaluate(() => window.__voxelHeroes.state.coins), coins[1] + 10);
  assert.equal(await host.evaluate(() => window.__voxelHeroes.state.coins), coins[0]);
  assert.ok((await actors(host)).every((e) => e.id !== coin) && (await actors(guest)).every((e) => e.id !== coin));
  pass('A shared pickup is claimed once and paid to its collector');

  await host.evaluate(() => { const h = window.__voxelHeroes; h.give('heart-piece'); h.give('key'); h.game.state.setFlag('party-test:milestone'); });
  await settle();
  assert.deepEqual(await Promise.all(pages.map((p) => p.evaluate(() => ({ hearts: window.__voxelHeroes.state.heartPieces, keys: window.__voxelHeroes.state.keys, flag: window.__voxelHeroes.state.flags.has('party-test:milestone') })))),
    Array(2).fill(await host.evaluate(() => ({ hearts: window.__voxelHeroes.state.heartPieces, keys: window.__voxelHeroes.state.keys, flag: true }))));
  pass('Permanent rewards, dungeon keys, and milestone flags are shared');

  // A second pot solves the real seal puzzle, then the guest opens its reward chest.
  await guest.evaluate(() => { const h = window.__voxelHeroes, s = h.screen(); h.player.x = s.x0 + 12.4; h.player.z = s.z0 + 5.5; h.game.hero.hero.setFacing('east'); });
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.input.tap('sword'); await h.tick(); });
  await settle();
  assert.ok(await guest.evaluate(() => !!window.__voxelHeroes.player.carrying));
  await guest.evaluate(async () => { const h = window.__voxelHeroes, s = h.screen(); h.player.x = s.x0 + 12.5; h.player.z = s.z0 + 6.5; h.game.hero.hero.setFacing('north'); h.input.tap('sword'); await h.step(0.5); });
  await settle();
  assert.ok((await Promise.all(pages.map((p) => p.evaluate(() => window.__voxelHeroes.state.flags.has('pot-seal:d1:3,9'))))).every(Boolean));
  const pieces = await host.evaluate(() => window.__voxelHeroes.state.heartPieces);
  await guest.evaluate(async () => { const h = window.__voxelHeroes, s = h.screen(); h.player.x = s.x0 + 12.5; h.player.z = s.z0 + 5.4; h.input.setStick(0, -1); await h.step(0.4); h.input.setStick(0, 0); });
  await settle();
  assert.equal(await host.evaluate(() => window.__voxelHeroes.state.heartPieces), pieces + 1);
  assert.equal(await guest.evaluate(() => window.__voxelHeroes.state.heartPieces), pieces + 1);
  pass('A guest solves the pot seal and opens a chest; the permanent reward reaches everyone once');
  await shot(guest, '06-coop-puzzle', 'Solve the dungeon together', 'A guest pot rings the bronze seal, revealing a shared chest. Opening it grants both heroes one heart piece.');

  await teleport(guest, 'd1:3,8', 8.5, 6.5);
  const owners = await Promise.all(pages.map((p) => p.evaluate(() => { const party = window.__voxelHeroes.game.party; return { owner: party.roomOwner('d1:3,8'), self: party.partyView().selfId, key: window.__voxelHeroes.screen().key }; })));
  assert.equal(owners[0].owner, owners[1].self); assert.equal(owners[0].key, 'd1:3,9'); assert.equal(owners[1].key, 'd1:3,8');
  pass('Independent rooms keep running with separate room owners');
  await guest.evaluate(() => { const h = window.__voxelHeroes; const e = h.spawn('skeleton', 6, 6); e.spawned = true; e.growT = 1; e.hp = 17; e.think = () => {}; window.__guestOwnedEnemy = e.netId; });
  const separateEnemy = await guest.evaluate(() => window.__guestOwnedEnemy);
  await settle();
  await shot(guest, '07-independent-room', 'Explore independently', 'The guest is in Map Hall while the host stays in Barrow Mouth. Each occupied room has its own simulation owner.');
  await teleport(host, 'd1:3,8', 10.5, 6.5);
  assert.equal((await actors(host)).find((e) => e.id === separateEnemy)?.hp, 17);
  assert.equal(await guest.evaluate(() => { const p = window.__voxelHeroes.game.party; return p.roomOwner('d1:3,8') === p.partyView().hostId; }), true);
  pass('Meeting again hands off a guest-owned room without replacing its enemy state');
  await teleport(host, 'd1:3,9', 8.5, 6.5);
  await teleport(guest, 'd1:3,9', 10.5, 6.5);
  assert.equal((await actors(guest)).find((e) => e.id === target.id)?.hp, 4);
  pass('Returning to a room restores its existing enemies rather than respawning them');

  await teleport(host, 'd1:3,4', 8.5, 6.5); await teleport(guest, 'd1:3,4', 6.5, 6.5);
  await guest.evaluate(async () => { const h = window.__voxelHeroes; for (const x of [2, 5]) h.spawn('boomerang', x + 0.5, 2.5, { dir: { x: 0, z: -1 } }); await h.step(0.35); });
  await settle();
  for (const page of pages) assert.ok(await page.evaluate(() => { const h = window.__voxelHeroes, s = h.screen(); return h.world.propAt(s.x0 + 2, s.z0).children[1].visible; }));
  await host.evaluate(async () => { const h = window.__voxelHeroes; for (const x of [10, 13]) h.spawn('boomerang', x + 0.5, 2.5, { dir: { x: 0, z: -1 } }); await h.step(0.35); });
  await settle();
  for (const page of pages) assert.ok(await page.evaluate(() => { const h = window.__voxelHeroes, s = h.screen(); return h.state.flags.has('dungeon:d1:switches:E-4') && h.world.tile(s.x0 + 15, s.z0 + 5) === '.'; }));
  pass('Two players light different wall switches with real boomerangs and open one shared gate');
  await shot(guest, '08-shared-switches', 'Split the puzzle between players', 'The guest lit two eyes and the host lit two. Partial switch lighting and the opened gate agree in both browsers.');

  await teleport(host, 'd1:3,9', 8.5, 6.5); await teleport(guest, 'd1:3,9', 10.5, 6.5);

  // The boss head creates its segments in onAdd. Replication must reuse that graph.
  const bossId = await host.evaluate(() => { const h = window.__voxelHeroes; const e = h.spawn('boss-serpent', 7, 8, { skipIntro: true }); e.spawned = true; e.growT = 1; e.think = () => {}; window.__partyBoss = e; return e.netId; });
  await settle();
  for (const page of pages) assert.equal((await actors(page)).filter((e) => e.type === 'serpent-segment').length, 6);
  assert.ok(await guest.evaluate((bossId) => { const h = window.__voxelHeroes; const boss = h.entities.find((e) => e.netId === bossId); return boss.segments.every((e) => e.head === boss); }, bossId));
  await host.evaluate(() => window.__partyBoss.tail().setGlow(true)); await settle();
  await guest.evaluate(() => { const h = window.__voxelHeroes; const boss = h.entities.find((e) => e.type === 'boss-serpent'); const tail = boss.tail(); h.game.damage.dealDamage(tail, { amount: 3, source: 'sword', from: h.player, swingId: 'coop-tail' }); });
  await settle();
  for (const page of pages) assert.equal((await actors(page)).filter((e) => e.type === 'serpent-segment').length, 5);
  pass('Multipart boss replicates six linked segments; a guest breaks one shared tail');
  await shot(guest, '09-shared-boss', 'Fight a shared boss', 'The serpent replicated six linked body parts without duplicates. A guest hit removed the glowing tail for both players.');
  await host.evaluate(() => window.__partyBoss.remove()); await settle();

  // The room owner decides shield blocks, while guests see the attack's model and cue.
  await teleport(host, 'd1:3,9', 2.5, 6);
  await teleport(guest, 'd1:3,9', 5, 9.6);
  await guest.evaluate(() => { const h = window.__voxelHeroes; h.setHp(5); h.game.swords.equipSword('blade-start'); h.game.hero.hero.setFacing('north'); });
  const wardenId = await host.evaluate(async () => {
    const h = window.__voxelHeroes, w = h.spawn('barrow-warden', 5, 8, { crowned: false, spawnDelay: 0 });
    w.spawned = true; w.growT = 1; w.holder.scale.setScalar(1); w.ai.melee.t = 0;
    await h.tick(); w.think = () => {}; window.__partyWarden = w;
    return w.netId;
  });
  await settle();
  for (const page of pages) assert.deepEqual(await page.evaluate(id => {
    const w = window.__voxelHeroes.entities.find(e => e.netId === id);
    return { phase: w.ai.melee.phase, cue: w.cue.visible, pose: w.mesh.pose };
  }, wardenId), { phase: 'aim', cue: true, pose: 'aim' });
  pass('A guest sees the owner’s raised blade and floor marks before a guard lunge');
  await shot(guest, '11-shared-guard-tell', 'Read the same attack cue', 'A real warden wind-up replicated its raised blade, floor marks and AI phase from Chromium to Firefox.');
  await host.evaluate(() => { const w = window.__partyWarden; w.ai.melee.phase = 'hunt'; w.harmless = false; w.cue.visible = false; w.mesh.setPose('idle'); w.yaw = 0; });
  await settle();
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.input.tap('sword'); await h.step(0.3); });
  await settle();
  for (const page of pages) assert.equal((await actors(page)).find(e => e.id === wardenId)?.hp, 9);
  await guest.evaluate(async () => {
    const h = window.__voxelHeroes, s = h.screen(); h.player.x = s.x0 + 5; h.player.z = s.z0 + 6.4;
    h.game.hero.hero.setFacing('south'); h.input.tap('sword'); await h.step(0.2);
  });
  await settle();
  const wardenHealth = await Promise.all(pages.map(async page => (await actors(page)).find(e => e.id === wardenId)?.hp));
  assert.deepEqual(wardenHealth, [6, 6]);
  pass('Guest sword strikes are blocked from the front and damage one shared warden from behind');
  await host.evaluate(async () => { await window.__voxelHeroes.step(0.4); }); await settle(120);
  await shot(guest, '12-shared-warden-flank', 'Flank a shield together', 'The front strike left 9 HP in both browsers. A real guest strike from behind lowered the same warden to 6 HP.');
  await host.evaluate(() => window.__partyWarden.remove()); await settle();

  await host.evaluate(() => { window.__voxelHeroes.state.errands.Nell = { status: 'active', found: false }; });
  await settle();
  await teleport(host, 'ow-3-2:1,1', 8, 8);
  await teleport(guest, 'ow-3-2:1,1', 2.5, 10.5);
  const outdoor = await Promise.all(pages.map(async page => (await actors(page)).filter(e => e.kind === 'enemy').map(e => ({ id: e.id, type: e.type })).sort((a, b) => a.id.localeCompare(b.id))));
  assert.ok(outdoor[0].length > 2);
  assert.equal(new Set(outdoor[0].map(e => e.id)).size, outdoor[0].length);
  assert.deepEqual(outdoor[1], outdoor[0]);
  pass('Random outdoor enemy groups have distinct actor IDs and matching enemy types in both browsers');
  await host.evaluate(() => { const h = window.__voxelHeroes; for (const e of [...h.entities]) if (e.kind === 'enemy') e.remove(); });
  await settle();
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.game.hero.hero.setFacing('north'); h.input.tap('sword'); await h.step(0.12); });
  await settle(500);
  for (const page of pages) assert.deepEqual(await page.evaluate(() => {
    const h = window.__voxelHeroes;
    return { revealed: h.state.flags.has('errand:Nell:revealed'), found: h.state.errands.Nell.found,
      objects: h.entities.filter(e => e.type === 'quest-locket' && !e.removed).length };
  }), { revealed: true, found: false, objects: 1 });
  pass('A guest’s real bush cut reveals one shared locket without completing the search');
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.player.x += 2; await h.tick(); });
  await shot(guest, '13-shared-locket', 'Search the crossing together', 'The guest cut the marked bush. Both browsers show one unclaimed gold locket and an unfinished search.');
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.player.x -= 2; await h.tick(); });
  await guest.evaluate(async () => { const h = window.__voxelHeroes; h.input.setStick(0, -1); await h.step(0.25); h.input.setStick(0, 0); });
  await settle();
  for (const page of pages) assert.deepEqual(await page.evaluate(() => {
    const h = window.__voxelHeroes;
    return { found: h.state.errands.Nell.found, flag: h.state.flags.has('errand:Nell:found'),
      objects: h.entities.filter(e => e.type === 'quest-locket' && !e.removed).length };
  }), { found: true, flag: true, objects: 0 });
  pass('Walking onto the locket claims it once and shares quest progress with the party');
  await guest.evaluate(() => window.__voxelHeroes.game.journal.openJournal());
  await shot(guest, '14-shared-journal', 'The journal follows shared progress', 'The shared search is now ready to return to Nell for a heart piece. The journal derives that status from campaign state.');
  await guest.evaluate(() => window.__voxelHeroes.game.journal.closeJournal());

  await teleport(host, 'd2:2,2', 8, 6); await teleport(guest, 'd2:2,2', 13.5, 6);
  await guest.evaluate(async () => {
    const h = window.__voxelHeroes;
    h.give('bombs'); h.game.inventory.selectItem('bombs'); h.game.hero.hero.setFacing('east');
    h.input.tap('item'); await h.tick();
  });
  await advance(2.3);
  for (const page of pages) assert.equal(await page.evaluate(() => {
    const h = window.__voxelHeroes, s = h.screen(); return h.world.tile(s.x0 + 15, s.z0 + 5);
  }), 'y');
  pass('A guest plants a real bomb and opens the hive breach in both browsers');
  await shot(guest, '15-shared-hive-breach', 'Blast a path together', 'Firefox planted a bomb with real B input. The room owner resolved the explosion, and both browsers show the persistent hive breach.');

  await teleport(host, 'd2-boss:0,0', 7, 11); await teleport(guest, 'd2-boss:0,0', 14, 11);
  await advance(5);
  for (const page of pages) {
    const swarm = await page.evaluate(() => {
      const es = window.__voxelHeroes.entities.filter(e => !e.removed);
      return { queens: es.filter(e => e.type === 'boss-queen').length, drones: es.filter(e => e.type === 'queen-drone').length,
        ids: es.filter(e => e.type === 'queen-drone').map(e => e.netId) };
    });
    assert.equal(swarm.queens, 1); assert.equal(swarm.drones, 8); assert.equal(new Set(swarm.ids).size, 8);
  }
  pass('The hive queen and eight distinct drones replicate once per browser');
  await host.evaluate(() => {
    const h = window.__voxelHeroes, q = h.entities.find(e => e.type === 'boss-queen'), s = h.screen();
    q.x = s.x0 + 11; q.z = s.z0 + 7; q.ai.phase = 'gather'; q.ai.t = .7; q.flashT = 0;
  });
  await settle(160);
  await guest.evaluate(async () => {
    const h = window.__voxelHeroes, s = h.screen();
    h.player.x = s.x0 + 11; h.player.z = s.z0 + 7.7;
    h.game.inventory.selectItem('bombs'); h.game.hero.hero.setFacing('north');
    h.input.tap('item'); await h.tick();
  });
  await advance(2.2);
  // RTC delivery may lag the manually stepped simulation under concurrent
  // rendering load. Wait for this particular replicated outcome, not a delay.
  await Promise.all(pages.map(page=>page.waitForFunction(()=>{
    const es=window.__voxelHeroes.entities.filter(e=>!e.removed),q=es.find(e=>e.type==='boss-queen');
    return q?.hp===39&&q.ai.phase==='flipped'&&!es.some(e=>e.type==='queen-drone');
  },null,{timeout:10000})));
  for (const page of pages) {
    const counter = await page.evaluate(() => {
      const es = window.__voxelHeroes.entities.filter(e => !e.removed), q = es.find(e => e.type === 'boss-queen');
      return { hp: q.hp, phase: q.ai.phase, drones: es.filter(e => e.type === 'queen-drone').length };
    });
    assert.deepEqual(counter, { hp: 39, phase: 'flipped', drones: 0 });
  }
  pass('A guest bomb flips one shared queen, clears the brood, and synchronizes health');
  await advance(.45); // let the blast and hit flash clear so the overturned pose is visible
  await shot(guest, '16-shared-queen-counter', 'Overturn the amber crown', 'A real guest bomb dealt six damage. Chromium and Firefox agree on 39 HP, the overturned pose, and zero surviving drones.');
  await teleport(host, 'd3:3,3', 5, 6.5); await teleport(guest, 'd3:3,3', 6.3, 6.5);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.give('grapple');h.game.inventory.selectItem('grapple');h.game.hero.hero.setFacing('east');h.input.tap('item');await h.tick();});
  await advance(1.3);
  assert.ok(await guest.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return h.player.x-s.x0>10&&!h.game.hero.hero.isPulled();}));
  assert.ok(await host.evaluate(()=>window.__voxelHeroes.game.inventory.hasItem('grapple')));
  pass('A guest grapple crosses the watch channel while the tool is shared with the party');
  await shot(guest,'17-shared-grapple-crossing','A friend crosses the channel','Firefox used real grapple input to cross the water. The hero landed on the far bank; the tool belongs to the shared campaign.');
  await guest.evaluate(()=>window.__voxelHeroes.give('bomb-bag-1'));await settle();
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.inventory.maxAmmo('bombs')),20);
  pass('The permanent bomb-bag upgrade increases capacity in both browsers');

  await teleport(host,'d3:1,7',11,9);await teleport(guest,'d3:1,7',6.5,8);await advance(1.5);
  const guardId=await host.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='skeleton');for(const other of h.entities)if(other.kind==='enemy'&&other!==e){other.x=s.x0+3.5;other.z=s.z0+3.5;other.recover?.(5);}e.x=s.x0+6.5;e.z=s.z0+5;e.recover(5);return e.netId;});await settle(180);
  const stunHp=(await actors(host)).find(e=>e.id===guardId).hp;
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(6.5,8,Math.PI);h.game.hero.hero.setFacing('north');h.game.inventory.selectItem('grapple');h.input.tap('item');await h.tick();});await advance(.35);
  for(const page of pages)assert.ok(await page.evaluate(({id,hp})=>{const e=window.__voxelHeroes.entities.find(e=>e.netId===id);return e.hp===hp&&e.stunT>0;},{id:guardId,hp:stunHp}));
  pass('A guest hook stuns one shared guard without changing its health');

  await teleport(host,'d3-boss:0,0',7,12);await teleport(guest,'d3-boss:0,0',14,12);await advance(4.5);
  for(const page of pages){
    const parts=await page.evaluate(()=>{const es=window.__voxelHeroes.entities.filter(e=>!e.removed),b=es.find(e=>e.type==='boss-colossus');return {bosses:es.filter(e=>e.type==='boss-colossus').length,parts:es.filter(e=>e.type==='colossus-part').length,ids:es.filter(e=>e.type==='colossus-part').map(e=>e.netId),hp:b.remainingHp()};});
    assert.equal(parts.bosses,1);assert.equal(parts.parts,4);assert.equal(new Set(parts.ids).size,4);assert.equal(parts.hp,45);
  }
  pass('The colossus and its four distinct parts replicate once in each browser');
  await host.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-colossus');b.ai.phase='laser-tell';b.ai.t=99;b.ai.dx=0;b.ai.dz=1;});await settle(160);
  const footId=await guest.evaluate(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus'),e=b.segments[0];h.player.x=e.x;h.player.z=e.z+1.15;h.game.hero.hero.setFacing('north');h.game.swords.equipSword('blade-start');h.setHp(5);h.input.tap('sword');await h.tick();return e.netId;});await advance(.45);
  const footHp=(await actors(host)).find(e=>e.id===footId).hp;assert.ok(footHp<8&&footHp>0);
  assert.equal((await actors(guest)).find(e=>e.id===footId).hp,footHp);
  pass('A guest sword damages one shared colossus foot and both browsers agree on health');
  await host.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');for(const e of b.segments.slice(0,2))h.game.damage.dealDamage(e,{amount:99,source:'sword',from:h.player});});await advance(.4);
  await teleport(host,'d3:2,3',8,9);await advance(.6);
  assert.deepEqual(await guest.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');return {stage:b.stage,hp:b.remainingHp(),parts:h.entities.filter(e=>e.type==='colossus-part'&&!e.removed).length,owner:h.game.party.roomOwner(h.screen().key)===h.game.party.partyView().selfId};}),{stage:2,hp:29,parts:2,owner:true});
  await teleport(host,'d3-boss:0,0',7,12);await advance(.5);
  for(const page of pages)assert.deepEqual(await page.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');return {stage:b.stage,hp:b.remainingHp(),parts:h.entities.filter(e=>e.type==='colossus-part'&&!e.removed).length};}),{stage:2,hp:29,parts:2});
  pass('Splitting up and meeting again preserves the colossus’s broken feet and exposed arms');
  await shot(guest,'18-shared-colossus-arms','Keep the fight when friends split up','Room ownership changed twice after the feet broke. Both peers retained one colossus, two exposed arms, and 29 total HP. The foot-breaking setup uses the damage API.');
  await teleport(host,'d4:3,1',10,8);await teleport(guest,'d4:3,1',3.5,5);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.give('fire-wand');h.game.inventory.selectItem('fire-wand');h.game.hero.hero.setFacing('north');h.input.tap('item');await h.tick();});await advance(.45);
  for(const page of pages)assert.deepEqual(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return [h.world.tile(s.x0+3,s.z0+3),h.world.tile(s.x0+12,s.z0+3),h.game.inventory.hasItem('fire-wand')];}),['F','f',true]);
  pass('A guest fire shot lights exactly one shared bowl and shares the earned wand');
  await host.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(12.5,5,Math.PI);h.game.inventory.selectItem('fire-wand');h.input.tap('item');await h.tick();});await advance(.45);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+12,s.z0+3)==='F'&&h.entities.filter(e=>e.type==='key').length===1;}));
  pass('Two friends lighting separate bowls release one shared key');
  await guest.waitForTimeout(2400);await shot(guest,'19-shared-ember-bowls','Light a gate together','Firefox lit the left bowl and Chromium lit the right with real item input. Both peers retain two flames and one key reward.');
  await teleport(host,'d4:3,3',11,8);await teleport(guest,'d4:3,3',8.5,3.1);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('fire-wand');h.game.hero.hero.setFacing('south');h.input.tap('item');await h.tick();});await advance(.4);
  for(const page of pages)assert.deepEqual(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return [h.world.tile(s.x0+8,s.z0+4),h.world.tile(s.x0+8,s.z0+5)];}),['.',':']);
  await guest.evaluate(()=>window.__voxelHeroes.give('bomb-bag-2'));await settle();for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.inventory.maxAmmo('bombs')),30);
  pass('Guest fire melts one persistent ice block and bag thirty upgrades both heroes');

  await teleport(host,'d4-boss:0,0',7,13);await teleport(guest,'d4-boss:0,0',16,13);await advance(4.5);
  for(const page of pages)assert.deepEqual(await page.evaluate(()=>{const h=window.__voxelHeroes,es=h.entities.filter(e=>!e.removed),b=es.find(e=>e.type==='boss-beast');return {bosses:es.filter(e=>e.type==='boss-beast').length,parts:es.filter(e=>e.type==='beast-tentacle').length,ids:new Set(es.filter(e=>e.type==='beast-tentacle').map(e=>e.netId)).size,hp:b.hp,linked:b.segments.every(e=>e?.head===b)};}),{bosses:1,parts:4,ids:4,hp:105,linked:true});
  pass('One Nacre body and four distinct linked tentacles replicate across browsers');
  await host.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast'),s=h.screen();b.ai.site=0;b.surface();b.ai.t=99;b.ai.shots=0;for(const e of b.segments){e.ai.phase='buried';e.ai.t=99;}const e=b.segments[0];e.x=s.x0+4.5;e.z=s.z0+8.5;e.ai.phase='root';e.ai.t=99;});await settle(160);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(4.5,11,Math.PI);h.game.inventory.selectItem('fire-wand');h.input.tap('item');await h.tick();});await advance(.35);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');return b.hp===105&&b.segments[0].ai.phase==='buried';}));
  pass('Guest fire withdraws one shared tentacle while leaving the body at 105 HP');
  await guest.evaluate(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');h.player.x=b.x;h.player.z=b.z+1.3;h.game.hero.hero.setFacing('north');h.game.swords.equipSword('blade-start');h.setHp(5);h.input.tap('sword');await h.tick();});await advance(.1);
  const tideHp=await host.evaluate(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-beast').hp);assert.ok(tideHp<105);
  for(const page of pages)assert.ok(await page.evaluate(hp=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');return b.hp===hp&&b.ai.phase!=='surface';},tideHp));
  pass('One guest sword hit damages the shared body and drives it under on both peers');
  await teleport(host,'d4:2,3',8,9);await advance(.6);
  assert.ok(await guest.evaluate(hp=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');return b.hp===hp&&b.segments.length===4&&b.segments.every(e=>e?.head===b)&&h.game.party.roomOwner(h.screen().key)===h.game.party.partyView().selfId;},tideHp));
  await teleport(host,'d4-boss:0,0',7,13);await advance(.4);
  for(const page of pages)assert.ok(await page.evaluate(hp=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');return b.hp===hp&&b.segments.length===4&&b.segments.every(e=>e?.head===b);},tideHp));
  pass('Splitting up and rejoining preserves Nacre health and tentacle references');
  let tideOwner=host;for(const page of pages)if(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.game.party.roomOwner(h.screen().key)===h.game.party.partyView().selfId;}))tideOwner=page;
  await tideOwner.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');b.surface();b.ai.shots=0;b.ai.t=3;for(const e of b.segments){e.ai.phase='root';e.ai.t=3;}});await advance(.25);
  await shot(guest,'20-shared-nacre','Keep the undertow fight shared','A guest fire shot cleared a tentacle without harming the body. A guest sword then drove Nacre under. Leaving and rejoining preserved health and four linked tentacles. Placement and attack windows use fixtures.');
  await host.evaluate(()=>{const h=window.__voxelHeroes;for(const id of ['spell-reveal','spell-reflect','spell-quake','spell-freeze'])h.give(id);const s=h.screen();window.__partyFreeze=h.spawn('barrow-warden',17,12,{spawnDelay:0});window.__partyFreeze.recover(5);});await settle(180);
  const freezeId=await host.evaluate(()=>window.__partyFreeze.netId);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(16,12);h.game.vitals.refill();h.game.inventory.selectItem('spell-freeze');h.input.tap('item');await h.tick();});await advance(.15);
  for(const page of pages)assert.ok(await page.evaluate(id=>window.__voxelHeroes.entities.find(e=>e.netId===id).frozenT>4,freezeId));
  pass('Guest Freeze holds the same nearby enemy on both peers');
  // Final progression uses earlier campaign fixtures; sword and spell inputs below are real.
  await host.evaluate(()=>{const h=window.__voxelHeroes;h.give('spell-truesight');h.state.flags.delete('tower:mask-broken');h.state.flags.delete('campaign:complete');});await settle(200);
  await teleport(host,'tower-final:0,0',11,13);await teleport(guest,'tower-final:0,0',12,13);await advance(4);
  let crownOwner=host;
  for(const page of pages)if(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.game.party.roomOwner(h.screen().key)===h.game.party.partyView().selfId;}))crownOwner=page;
  const crownGuest=crownOwner===host?guest:host;
  await crownOwner.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');b.ai.phase='hold';b.ai.t=99;b.ai.addT=99;for(const e of [...h.entities])if(e.kind==='projectile'||e.type==='crown-wisp')e.remove();});await settle(200);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop'),copies=h.entities.filter(e=>e.type==='bishop-copy');return b&&copies.length===2&&new Set([b.netId,...copies.map(e=>e.netId)]).size===3&&copies.every(e=>e.head===b);}));
  pass('Final keeper and two linked reflections replicate once in each browser');
  await crownGuest.evaluate(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');h.player.x=b.x;h.player.z=b.z+1.3;h.game.hero.hero.setFacing('north');h.game.swords.equipSword('blade-start');h.setHp(5);h.input.tap('sword');await h.tick();});await advance(.3);
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-bishop').hp),75);
  pass('Guest sword cannot hurt the shared keeper without Truesight');
  await crownGuest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.vitals.refill();h.game.inventory.selectItem('spell-truesight');h.input.tap('item');await h.tick();});await advance(.15);
  const guestSight=await crownGuest.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');return{active:h.game.effects.effectActive('truesight'),remaining:h.game.effects.effectLeft('truesight'),shadow:b.shadow.visible,copies:b.segments.map(e=>e.shadow.visible),magic:h.state.magic,selected:h.state.item,mode:h.state.mode};});
  assert.ok(guestSight.active&&guestSight.shadow&&guestSight.copies.every(visible=>!visible),JSON.stringify(guestSight));
  assert.ok(await crownOwner.evaluate(()=>!window.__voxelHeroes.game.effects.effectActive('truesight')));
  pass('Guest Truesight reveals one local shadow while the room owner has no sight effect');
  await crownGuest.evaluate(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');h.player.x=b.x;h.player.z=b.z+1.3;h.game.hero.hero.setFacing('north');h.input.tap('sword');await h.tick();});await advance(.2);
  const maskHp=await crownOwner.evaluate(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-bishop').hp);assert.ok(maskHp<75);
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-bishop').hp),maskHp);
  pass('Guest sight authorizes one shared sword hit without borrowing the owner effect');
  await crownOwner.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');b.hp=24;b.vanish();});await advance(.8);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-bishop');return b.hp===24&&b.segments.length===4&&b.segments.every(e=>e.head===b)&&new Set(b.segments.map(e=>e.netId)).size===4;}));
  pass('Low-life keeper grows to five distinct shared bodies with correct links');
  await teleport(crownOwner,'tower-crown:1,0',8,8);await advance(.4);await teleport(crownOwner,'tower-final:0,0',11,13);await advance(.4);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-bishop');return b.hp===24&&b.segments.length===4&&b.segments.every(e=>e.head===b);}));
  pass('Separating and rejoining preserves keeper health and all four copy references');
  for(const page of pages)if(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.game.party.roomOwner(h.screen().key)===h.game.party.partyView().selfId;}))crownOwner=page;
  await crownOwner.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');b.ai.phase='hold';b.ai.t=99;b.ai.addT=99;});await settle(150);
  await crownGuest.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');h.player.x=b.x;h.player.z=b.z+1.3;h.game.hero.hero.setFacing('north');});await settle(2400);
  await shot(crownGuest,'21-shared-reflections','Find the real keeper together','The guest cast Truesight while the owner had no effect. One real sword input damaged the shared body. Five-body growth and a room handoff preserve links and health. Low-life setup and attack windows are fixtures.');
  await crownOwner.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');b.hp=3;b.ai.phase='hold';b.ai.t=99;});await settle(180);
  const transitionOwner=await crownOwner.evaluate(()=>window.__voxelHeroes.game.party.partyView().selfId);
  await crownGuest.evaluate(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');h.game.effects.startEffect('truesight',2);h.player.x=b.x;h.player.z=b.z+1.3;h.game.hero.hero.setFacing('north');h.input.tap('sword');await h.tick();});await advance(.3);
  assert.equal(await crownOwner.evaluate(()=>window.__voxelHeroes.state.mode),'boss-intro','the real second-stage introduction starts');
  for(const page of pages)assert.equal(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.game.party.roomOwner(h.screen().key);}),transitionOwner,'the introduction preserves the owner while publishing the new boss');
  await advance(3.7);
  for(const page of pages){await page.waitForFunction(()=>{const h=window.__voxelHeroes;return h.state.flags.has('tower:mask-broken')&&h.entities.filter(e=>e.type==='boss-king').length===1&&!h.entities.some(e=>e.type==='bishop-copy');},null,{timeout:10000});assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.flags.has('tower:mask-broken')&&h.entities.filter(e=>e.type==='boss-king').length===1&&!h.entities.some(e=>e.type==='bishop-copy');}));}
  pass('Guest finishing strike starts exactly one shared king and removes the reflections');
  for(const page of pages)if(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.game.party.roomOwner(h.screen().key)===h.game.party.partyView().selfId;}))crownOwner=page;
  const lightningGuest=crownOwner===host?guest:host;
  await lightningGuest.evaluate(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(15,12);h.game.vitals.refill();h.player.invT=0;h.input.up('guard');});await settle(180);
  await crownOwner.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-king');b.ai.phase='recover';b.ai.t=99;b.ai.shots=0;for(const e of [...h.entities])if(e.kind==='projectile')e.remove();h.spawn('crown-lightning',15,12);});await advance(.6);
  const lightningHp=await lightningGuest.evaluate(()=>window.__voxelHeroes.state.hp);
  assert.equal(lightningHp,await lightningGuest.evaluate(()=>window.__voxelHeroes.state.maxHp));
  assert.ok(await lightningGuest.evaluate(()=>window.__voxelHeroes.entities.some(e=>e.type==='crown-lightning'&&e.harmless)));
  pass('Replicated lightning warning is visible and harmless to the guest');
  await advance(.65);assert.ok(await lightningGuest.evaluate(hp=>window.__voxelHeroes.state.hp<hp,lightningHp));
  pass('Replicated lightning strike damages the guest only after its warning');
  await teleport(host,'tower-crown:1,0',8,8);await advance(.4);
  await guest.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-king');b.hp=3;b.ai.phase='recover';b.ai.t=99;b.ai.shots=0;h.game.hero.hero.place(b.x-h.screen().x0,b.z-h.screen().z0+2.2,Math.PI);h.game.swords.equipSword('blade-start');h.player.invT=999;});
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(1.8);
  for(const page of pages)assert.ok(await page.evaluate(()=>window.__voxelHeroes.state.flags.has('campaign:complete')));
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.state.mode),'ending');
  pass('Real finishing sword strike shares campaign victory and opens the local ending');
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.state.mode),'play');
  pass('A friend exploring another room keeps playing when the campaign is completed');
  await teleport(host,'tower-final:0,0',11,13);await advance(1.5);assert.equal(await host.evaluate(()=>window.__voxelHeroes.state.mode),'ending');
  pass('Returning friend receives the ending without respawning either final boss');
  await shot(guest,'22-shared-victory','A shared victory, independent journeys','A real finishing sword strike shares the completed campaign. The friend in a different room keeps exploring, then receives the ending on returning. Earlier progress, low-life setup and attack windows are fixtures.');
  for(const page of pages)await page.evaluate(async()=>{const h=window.__voxelHeroes;for(let i=0;i<3;i++){h.input.tap('confirm');await h.step(.8);}await h.step(2);});await settle(300);

  // Actual cooperative sidequest after the campaign. Equipment and positioning
  // are fixtures; bombs, movement, pot actions, treasure and NPC dialogs are real.
  await teleport(host,'v1:1,1',12.3,8.6);await teleport(guest,'v1:1,1',14.5,8.6);
  const talkTobin=async page=>{
    await page.evaluate(async()=>{const h=window.__voxelHeroes;h.entities.find(e=>e.name==='Old Tobin').onInteract(h.player);
      for(let i=0;i<500&&h.state.mode==='dialog';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
    await settle(400);
  };
  await talkTobin(host);
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.errands['Old Tobin']?.status),'active');
  pass('A real Tobin conversation shares the accepted cellar errand');
  await host.evaluate(()=>{const h=window.__voxelHeroes;h.give('bombs');h.game.inventory.addAmmo('bombs',3);h.game.inventory.selectItem('bombs');});await settle(250);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('bombs');h.game.hero.hero.setFacing('north');h.input.tap('item');await h.tick();});await advance(2.7);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.world.screen('v1',1,1);return h.state.flags.has('village:tobin-cellar-open')&&h.world.tile(s.x0+14,s.z0+7)==='y';}));
  pass('Guest bomb reveals the same root-cellar stairs in both browsers');
  const walk=async(page,key,seconds)=>{await page.keyboard.down(key);try{await advance(seconds);}finally{await page.keyboard.up(key);}await advance(2);};
  await walk(guest,'ArrowUp',.42);
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.screen().key),'cellar-tobin:0,0');
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.screen().key),'v1:1,1');
  const put=async(page,x,z,facing='north')=>{await page.evaluate(({x,z,facing})=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(facing);h.player.invT=999;},{x,z,facing});await settle(120);};
  await put(guest,9.5,8.5);await put(host,14.5,8.6);await walk(host,'ArrowUp',.42);
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.screen().key),'cellar-tobin:0,0');
  pass('Friends independently walk into the physically opened cellar');
  await put(host,2.5,7.9);await host.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(.25);await put(host,9.5,8.5);
  await put(guest,2.5,7.9);await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(.25);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return h.player.carrying&&h.player.carrying.loot===false&&h.world.tile(s.x0+2,s.z0+7)==='&';}));
  pass('Both heroes can hold spare pots without consuming or farming the shared supply');
  await shot(guest,'23-shared-cellar-pots','A cellar friends can solve together','Both heroes independently lift spare pots from the native crate. The supply stays intact and its pots give no loot. The actual stairs are opened by the guest bomb; equipment and positioning are fixtures.');
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('south');h.input.tap('sword');await h.tick();});await advance(1);
  await put(guest,2.5,7.9);await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(.25);
  assert.ok(await guest.evaluate(()=>!!window.__voxelHeroes.player.carrying));
  await put(guest,6.5,7.7);await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(1);
  for(const page of pages)assert.ok(await page.evaluate(()=>window.__voxelHeroes.state.flags.has('pot-seal:cellar-tobin:0,0')));
  pass('A missed guest throw can be retried and a real pot opens the shared bronze-seal chest');
  const hearts=await Promise.all(pages.map(page=>page.evaluate(()=>{const s=window.__voxelHeroes.state;return s.maxHp*2+s.heartPieces;})));
  await put(guest,6.5,3.3);await walk(guest,'ArrowUp',.4);await advance(2);
  for(const [i,page] of pages.entries())assert.ok(await page.evaluate(before=>{const h=window.__voxelHeroes,s=h.state;return s.flags.has('errand:tobin:keepsake')&&s.maxHp*2+s.heartPieces===before+1;},hearts[i]));
  pass('The real keepsake chest shares exactly one permanent heart piece with each hero');
  await guest.evaluate(()=>window.__voxelHeroes.setMode('play'));
  await put(guest,5.5,8.3,'south');await walk(guest,'ArrowDown',.35);
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.screen().key),'cellar-tobin:0,0');
  const tobinCoinsBefore=await guest.evaluate(()=>window.__voxelHeroes.state.coins);
  await talkTobin(guest);
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.errands['Old Tobin']?.status),'done');
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.state.coins),tobinCoinsBefore+40);
  pass('One hero returns the keepsake while the other explores; completed quest progress reaches both');
  await shot(guest,'24-tobin-shared-return','Bring a shared keepsake home','The guest returns by the actual stairs, talks to Tobin and receives forty personal coins. The friend stays inside the cellar and receives completed quest progress. Both already received exactly one heart piece from the chest.');

  // Bow adventure: fixtures shorten the patrol and vault combat, while actual
  // inputs, projectile damage, chests, targets and shared rewards are exercised.
  await teleport(guest,'v1:0,1',12.5,9.4);
  const talkRook=async page=>{
    await page.evaluate(async()=>{const h=window.__voxelHeroes;h.entities.find(e=>e.name==='Rook').onInteract(h.player);
      for(let i=0;i<500&&h.state.mode==='dialog';i++){
        if(i%15===0){const d=h.game.dialog.dialogView();if(d.choices?.includes('Goodbye')&&d.choice!==d.choices.indexOf('Goodbye')){h.input.tap('down');await h.tick();}h.input.tap('confirm');}await h.tick();}});
    await advance(2);
  };
  await talkRook(guest);
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.errands.Rook?.status),'active');
  pass('Rook\'s physical dice adventure is accepted for friends in separate areas');
  await put(guest,3.5,4.4);await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(.6);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.world.screen('v1',0,1);return h.state.flags.has('rook:den-open')&&h.world.tile(s.x0+3,s.z0+3)==='j';}));
  await walk(guest,'ArrowUp',.45);
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.screen().key),'rook-den:0,2');
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='enemy'&&!e.removed).length),2,'a physical multiplayer stair entry must preserve the newly spawned patrol');
  pass('A real guest sword cut shares the stairs and physical movement enters Briar Den');
  const prepareFoes=async page=>{
    await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();for(const e of h.entities.filter(e=>e.kind==='enemy')){
      e.hp=2;e.x=s.x0+7.5;e.z=s.z0+6.5;e.growT=1;e.spawned=true;
      if(e.ai.melee)e.ai.melee={phase:'recover',t:99,dx:0,dz:1,left:0};
      e.ai.shoot={cool:99,dir:null};e.ai.wander={pause:true,t:99};
    }});await settle(300);
  };
  await prepareFoes(guest);await put(guest,7.5,7.7);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('sword');await h.tick();});await advance(1);
  assert.ok(await guest.evaluate(()=>window.__voxelHeroes.state.flags.has('rook:patrol-cleared')));
  for(const page of pages)await page.evaluate(()=>{
    const h=window.__voxelHeroes;window.__bowGets=0;
    h.game.events.on('item-get',e=>{if(e.id==='bow')window.__bowGets++;});
  });
  await put(guest,8.5,3.3);await walk(guest,'ArrowUp',.4);await advance(2);
  for(const page of pages)assert.ok(await page.evaluate(()=>window.__voxelHeroes.game.inventory.hasItem('bow')));
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.screen().key),'cellar-tobin:0,0');
  pass('The actual patrol chest shares the earned bow with a friend exploring another cellar');
  assert.equal(await guest.evaluate(()=>window.__bowGets),1);
  assert.equal(await host.evaluate(()=>window.__bowGets),0);
  assert.ok(await host.evaluate(()=>{const h=window.__voxelHeroes;return h.state.mode==='play'&&!h.gfx.scene.getObjectByName('item-prize');}));
  pass('An earned bow presents once locally; its shared grant neither presents nor pauses the exploring friend');
  await host.evaluate(async()=>{const h=window.__voxelHeroes;if(h.player.carrying){h.input.tap('sword');await h.tick();}});await advance(1);
  for(const page of pages)await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('bow');h.game.inventory.useAmmo('arrows',h.game.inventory.ammo('arrows'));h.game.inventory.addAmmo('arrows',10);});
  await put(guest,7.5,1.4);await walk(guest,'ArrowUp',.45);
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.screen().key),'rook-den:0,1');
  await teleport(host,'rook-den:0,1',11.5,8.5);
  await put(guest,5.5,7.7);await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('item');await h.tick();});await advance(.8);
  for(const page of pages)assert.ok(await page.evaluate(()=>window.__voxelHeroes.state.flags.has('rook:target:5,2')));
  for(const page of pages)assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.flags.has('rook:bridge')),false);
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.game.inventory.ammo('arrows')),9);
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.game.inventory.ammo('arrows')),10);
  pass('A guest arrow lights the shared first target while spending only that hero\'s ammunition');
  await put(guest,12.5,8.5);await put(host,10.5,7.7);
  await host.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('item');await h.tick();});await advance(.8);
  for(const page of pages)assert.ok(await page.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return h.state.flags.has('rook:bridge')&&h.world.tile(s.x0+7,s.z0+5)==='+'&&h.world.tile(s.x0+10,s.z0+2)===':';}));
  pass('Friends shoot different targets and receive the same lowered bridge');
  await shot(host,'25-shared-arrow-span','Two heroes lower the arrow span','Firefox and Chromium each fire an actual arrow at a different far-bank target. Target states and the native plank bridge agree; ammunition is personal. The earned bow came from the real chest, after a reduced-life patrol fixture.');
  // Fire directly through a friend on safe ground: bow shots do not hurt heroes.
  await put(host,8.5,8.5,'east');await put(guest,10.5,8.5);
  await guest.evaluate(()=>{window.__voxelHeroes.player.invT=0;});
  const friendHp=await guest.evaluate(()=>window.__voxelHeroes.state.hp);
  await host.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('item');await h.tick();});await advance(.8);
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.state.hp),friendHp);
  pass('A real bow shot through a friend leaves their health unchanged');
  await put(guest,7.5,8.3);await walk(guest,'ArrowUp',1.5);
  assert.ok(await guest.evaluate(()=>{const h=window.__voxelHeroes,s=h.screen();return h.player.z-s.z0<4;}));
  await put(guest,7.5,1.4);await walk(guest,'ArrowUp',.45);
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.screen().key),'rook-den:0,0');
  await teleport(host,'rook-den:0,0',12.5,8.5);await prepareFoes(host);await put(guest,7.5,8.2);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('item');await h.tick();});await advance(.6);
  await guest.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('item');await h.tick();});await advance(.6);
  for(const page of pages)assert.ok(await page.evaluate(()=>window.__voxelHeroes.state.flags.has('rook:vault-cleared')));
  pass('Guest bow damage clears the shared vault against reduced-life enemy fixtures');
  await teleport(host,'v1:0,1',12.5,9.4);await put(guest,8.5,3.3);await walk(guest,'ArrowUp',.4);await advance(2);
  for(const page of pages)assert.ok(await page.evaluate(()=>window.__voxelHeroes.state.flags.has('errand:rook:dice')));
  assert.equal(await host.evaluate(()=>window.__voxelHeroes.state.mode),'play');
  pass('The actual dice chest makes both journals ready without interrupting the friend outside');
  const bombsBeforeRook=[];
  for(const [i,page]of pages.entries()){
    await page.evaluate(i=>{const h=window.__voxelHeroes;h.game.inventory.useAmmo('bombs',h.game.inventory.ammo('bombs'));h.game.inventory.addAmmo('bombs',2+i);},i);
    bombsBeforeRook.push(await page.evaluate(()=>window.__voxelHeroes.game.inventory.ammo('bombs')));
  }
  await talkRook(host);
  for(const [i,page]of pages.entries())assert.ok(await page.evaluate(before=>{const h=window.__voxelHeroes;return h.state.errands.Rook.status==='done'&&h.state.bags.arrows===1&&h.game.inventory.ammo('arrows')===30&&h.game.inventory.ammo('bombs')===before+3;},bombsBeforeRook[i]));
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.screen().key),'rook-den:0,0');
  assert.equal(await guest.evaluate(()=>window.__voxelHeroes.state.mode),'play');
  pass('One Rook turn-in shares the permanent quiver and exactly three bombs without moving the exploring friend');
  for(const page of pages)await page.evaluate(()=>window.__voxelHeroes.game.inventory.useAmmo('arrows',1));
  await talkRook(host);
  for(const [i,page]of pages.entries())assert.equal(await page.evaluate(before=>{const h=window.__voxelHeroes;return h.game.inventory.ammo('arrows')===29&&h.game.inventory.ammo('bombs')===before+3;},bombsBeforeRook[i]),true);
  pass('A repeated Rook conversation cannot duplicate either hero\'s quiver refill or bombs');
  await shot(host,'26-rook-shared-reward','A reward for a shared adventure','The town hero receives the completed quest while the friend remains in the vault. Both gain a thirty-arrow quiver and three bombs. A repeated conversation leaves 29 arrows after each hero deliberately spends one; no second reward is paid.');
  await teleport(host, 'd1:3,9', 8.5, 6.5); await teleport(guest, 'd1:3,9', 10.5, 6.5);

  await host.evaluate(() => window.__voxelHeroes.game.party.leaveParty());
  await guest.waitForFunction(() => window.__voxelHeroes.game.party.partyView().count === 1);
  await settle();
  assert.equal(await guest.evaluate(() => { const h = window.__voxelHeroes; return h.game.party.roomOwner(h.screen().key) === h.game.party.partyView().selfId; }), true);
  assert.equal((await actors(guest)).find((e) => e.id === target.id)?.hp, 4);
  pass('Owner departure transfers the room with its latest enemy state');

  // The old host rejoins as a late guest after host migration.
  assert.ok(await host.evaluate((options) => window.__voxelHeroes.game.party.joinParty('TESTCOOP', options), options));
  await host.waitForFunction(() => window.__voxelHeroes.game.party.partyView().ready && window.__voxelHeroes.game.party.partyView().count === 2);
  await settle();
  assert.ok(await host.evaluate(() => window.__voxelHeroes.state.flags.has('pot-seal:d1:3,9')));
  await teleport(host, 'd1:3,9', 5.5, 7.5);
  assert.equal((await actors(host)).find((e) => e.id === target.id)?.hp, 4);
  pass('Late join after host migration receives existing puzzle flags and enemies');
  await shot(host, '10-late-join', 'Leave and rejoin the adventure', 'Host migration kept the skeleton at 4 HP and the bronze seal solved; the returning hero received both.');
  await host.evaluate(() => window.__voxelHeroes.game.party.leaveParty()); await settle();
  await guest.evaluate(() => window.__voxelHeroes.game.party.leaveParty()); await settle();
  assert.equal(await guest.evaluate(() => window.__voxelHeroes.game.party.partyFriends().length), 0);
  pass('Leaving clears remote heroes and resumes solo simulation');
  assert.deepEqual(errors, []);
  console.log(`${passed}/${passed} multiplayer checks passed (real Firefox + Chromium RTC connections)`);
  writeFileSync(`${out}/result.json`, JSON.stringify({ passed, failed: 0, pending:false, startedUtc, errors, browsers: ['Chromium', 'Firefox'], transport: 'Real Trystero RTC; local Nostr signaling relay', ice: defaultIce?'default browser ICE settings':'local host candidates only', completedUtc: new Date().toISOString() }, null, 2));
} catch (error) {
  writeFileSync(`${out}/result.json`,JSON.stringify({passed,failed:1,pending:false,startedUtc,completedUtc:new Date().toISOString(),errors:[error.message,...errors]},null,2));
  console.error(error);
  for (const [i, page] of pages.entries()) if (!page.isClosed()) {
    console.error(`peer ${i}`, JSON.stringify(await view(page)), JSON.stringify(await actors(page)));
    console.error('room', JSON.stringify(await page.evaluate(() => { const h = window.__voxelHeroes; return {
      records: h.game.party.partyRoomSnapshot(h.screen().key)?.actors.map((r) => ({ id: r.id, type: r.type, opts: r.opts })), cleared: h.game.clears.clearedScreens(),
    }; })));
  }
  console.error('page errors', errors);
  if (process.argv.includes('--debug')) for (const page of pages) console.error(await page.evaluate(() => window.__rtc.map((pc) => ({ state: pc.connectionState, ice: pc.iceConnectionState,
    local: pc.localDescription?.sdp.match(/^a=candidate:.*$/gm), remote: pc.remoteDescription?.sdp.match(/^a=candidate:.*$/gm) }))));
  process.exitCode = 1;
} finally {
  for (const browser of browsers) await browser.close();
  await relay.close(); await server?.close();
}

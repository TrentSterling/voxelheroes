import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { firefox } from 'playwright';
import { launch, startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'playtest-out/companion-coop';
const url = process.argv.find(a => a.startsWith('--url='))?.slice(6);
mkdirSync(out, { recursive: true });
const result = { startedUtc: new Date().toISOString(), checks: [], fixtures: 'Local signaling, ICE servers empty, manually placed stationary 100-HP enemy, Copper Memory granted through the real reward API. Real RTC, charged sword input, damage routing, split exploration and host migration. Game master muted; NPC voices disabled.' };
let server, relay, fox;
const pages = [];
try {
  server = url ? { url, close: async () => {} } : await startServer();
  relay = await startRelay();
  fox = await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.volume_scale': '0.0' } });
  for (const [name, browser] of [['host', null], ['guest', fox]]) {
    const t = await launch({ url: server.url, browser, out: `${out}/${name}` }); pages.push(t);
    await t.page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await t.eval(() => {
      const h = window.__voxelHeroes;
      h.game.audio.setMuted(true); h.game.audio.setVolumes({ master: 0 }); h.game.settings.setSetting('npcVoices', false);
      h.game.progress.startNewGame(); h.player.invT = 999;
      window.__coopTechs = []; window.__coopDamage = [];
      h.events.on('companion-tech', data => window.__coopTechs.push(data));
      h.events.on('enemy-hit', data => { if (String(data.hit?.swingId).includes('clockwork-')) window.__coopDamage.push({ result: data.result, damage: data.damage, swing: data.hit.swingId }); });
    });
  }
  const [host, guest] = pages, config = { relayUrls: [relay.url], rtcConfig: { iceServers: [] } };
  await host.eval(c => window.__voxelHeroes.game.party.createParty('MIRACOOP', c), config);
  await guest.eval(c => window.__voxelHeroes.game.party.joinParty('MIRACOOP', c), config);
  for (const t of pages) await t.page.waitForFunction(() => window.__voxelHeroes.game.party.partyView().count === 2 && window.__voxelHeroes.game.party.partyConnections().some(c => c.state === 'connected'), null, { timeout: 45000 });
  const pump = async (n = 30) => { for (let i = 0; i < n; i++) { await Promise.all(pages.map(t => t.step(.04))); await new Promise(done => setTimeout(done, 30)); } };
  const view = t => t.eval(() => window.__voxelHeroes.game.companions.companionView());
  const check = (pass, text) => { assert.ok(pass, text); result.checks.push(text); console.log('PASS ' + text); };
  const shot = async (t, name) => { await t.eval(() => { window.__voxelHeroes.player.hero.root.visible = true; }); await t.shot(name); };
  check(true, 'Muted Chromium and Firefox connect through real local Trystero RTC');
  for (const t of pages) await t.teleport('Crossroads', 8, 5.5);
  await host.eval(() => {
    const h = window.__voxelHeroes; h.game.state.setFlag('era:bell'); h.game.companions.setMiraTravelling(true);
    h.game.grants.grant('copper-memory', 1, { fanfare: false });
  });
  await pump(40);
  const views = await Promise.all(pages.map(view));
  check(views.every(v => v.recruited && v.unlocked && v.mira.visible), 'Recruitment and technique unlock reach both heroes');
  check(views[0].mira.localLeader && !views[1].mira.localLeader, 'One party leader drives Mira; the guest presents her pose');
  check(Math.hypot(views[0].mira.x - views[1].mira.x, views[0].mira.z - views[1].mira.z) < .05, 'Both browsers see the same travelling Mira position');
  check((await Promise.all(pages.map(t => t.eval(() => window.__voxelHeroes.entities.filter(e => !e.removed && e.kind === 'companion').length)))).every(n => n === 1), 'Room replication leaves exactly one Mira presentation in each browser');
  await guest.eval(() => {
    const h = window.__voxelHeroes, m = h.game.companions.companionView().mira, s = h.screen();
    h.game.hero.hero.place(m.x - s.x0 + 1.8, m.z - s.z0); h.game.hero.hero.setFacing('north');
  });
  await pump(10);
  const target = await guest.eval(() => ({ x: window.__voxelHeroes.player.x + 2.4, z: window.__voxelHeroes.player.z }));
  await host.eval(point => {
    const h = window.__voxelHeroes, s = h.screen(), e = h.spawn('slime', point.x - s.x0, point.z - s.z0);
    e.hp = e.maxHp = 100; e.spawned = true; e.growT = 1; e.update = () => {}; window.__sharedClockTarget = e;
  }, target);
  await pump(12);
  check((await view(guest)).ready, 'A nearby guest can use the shared companion technique');
  const hostMagic = await host.eval(() => window.__voxelHeroes.state.magic), guestMagic = await guest.eval(() => window.__voxelHeroes.state.magic);
  const life = await Promise.all(pages.map(t => t.eval(() => window.__voxelHeroes.state.hp)));
  await guest.page.keyboard.down('j'); await guest.step(1.8); await host.step(1.8);
  check(await guest.eval(() => !!window.__voxelHeroes.player.charge?.ready), 'Guest reaches a charged spin through actual keyboard input');
  await guest.page.keyboard.up('j'); await guest.step(1 / 60); await pump(18);
  check((await view(guest)).techniqueCount === 1 && await guest.eval(() => window.__voxelHeroes.state.magic) === guestMagic - 2 && await host.eval(() => window.__voxelHeroes.state.magic) === hostMagic, 'Guest pays exactly two personal magic; the leader pays none');
  check(await host.eval(() => window.__coopDamage.length === 1 && window.__coopDamage[0].damage === 6), 'The room owner resolves exactly one six-point combination hit');
  check(await host.eval(() => window.__coopTechs.some(t => t.remote)) && await guest.eval(() => window.__coopTechs.length === 1), 'The technique cue reaches the leader without replaying guest damage');
  check((await Promise.all(pages.map(t => t.eval(() => window.__voxelHeroes.state.hp)))).every((hp, i) => hp === life[i]), 'The shared technique does not hurt either player');
  await shot(host,'01-leader-sees-guest-tech'); await shot(guest,'02-guest-clockwork-cross');
  await host.teleport('mossbrook-past:1,0',8,10); await guest.teleport('mossbrook-future:1,0',8,10); await pump();
  check((await view(host)).mira.visible && !(await view(guest)).mira.visible, 'Mira stays with the leader when friends split across eras');
  check(!(await view(guest)).nearby && !(await view(guest)).ready, 'A hero in another era cannot summon a remote combination');
  await shot(host,'03-mira-in-the-past'); await shot(guest,'04-friend-alone-in-the-future');
  await guest.eval(() => window.__voxelHeroes.game.companions.setMiraTravelling(false)); await pump();
  check((await Promise.all(pages.map(view))).every(v => !v.recruited && !v.mira.visible), 'Either friend can dismiss the shared companion');
  await host.eval(() => window.__voxelHeroes.game.companions.setMiraTravelling(true)); await pump();
  await host.eval(() => window.__voxelHeroes.game.party.leaveParty()); await pump(40);
  const migrated = await view(guest);
  check((await guest.eval(() => window.__voxelHeroes.game.party.partyView().count)) === 1 && migrated.mira.localLeader && migrated.mira.visible && !migrated.mira.blocked, 'Mira safely follows the surviving hero after host departure');
  check(await guest.eval(() => window.__voxelHeroes.entities.filter(e => e.kind === 'companion' && !e.removed).length) === 1, 'Host migration does not duplicate Mira');
  await shot(guest,'05-mira-after-host-migration');
  for (const t of pages) assert.deepEqual(t.errors, []);
  result.ok = true;
} catch (error) { result.ok = false; result.error = { message: error.message, stack: error.stack }; process.exitCode = 1; console.error(error.stack); }
finally {
  result.completedUtc = new Date().toISOString(); result.passed = result.checks.length;
  writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
  for (const t of pages) await t.close(); await fox?.close(); await relay?.close(); await server?.close();
}

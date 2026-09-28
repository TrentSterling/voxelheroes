// Focused probes: sword on open ground, serpent tail-hit punishment, smart head phase.
// Usage: node scripts/fun/audit2.mjs [--url=...] [--base=...] (see audit.mjs's header).
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from '../playtest.mjs';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = flags.base ?? process.env.VH_AUDIT_SCRATCH ?? '.';
mkdirSync(`${BASE}/shots`, { recursive: true });
const t = await launch({ url: flags.url ?? 'http://localhost:4197/', out: `${BASE}/shots`, seed: 11 });
const R = {};
await t.step(0.3);
await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ name: 'Bo', class: 'balanced', prologue: false }));
await t.step(1.0);
await t.eval(() => {
  const h = window.__voxelHeroes;
  if (!h.state.swords.owned.includes('blade-start')) h.give('blade-start');
  h.game.swords.equipSword('blade-start');
  h.setHp(h.state.maxHp);
});

// 1. sword probe
await t.teleport('Crossroads', 8, 5.5);
await t.step(0.4);
R.sword = await t.eval(async () => {
  const h = window.__voxelHeroes;
  const g = h.game;
  const out = {};
  for (const type of ['blob', 'hopper', 'skeleton']) {
    for (const e of h.entities) if (e.kind === 'enemy') e.remove();
    h.setHp(h.state.maxHp);
    const s = h.screen();
    h.player.x = s.x0 + 8;
    h.player.z = s.z0 + 5.5;
    const e = h.spawn(type, 10, 5.5);
    e.spawned = true;
    e.growT = 1;
    const think = e.think.bind(e);
    let thinkAt = null, tick = 0;
    e.think = (...a) => { if (thinkAt === null && tick > 1) thinkAt = tick; };
    g.hero.hero.setFacing('east');
    await h.tick();
    const x0 = e.x;
    h.input.tap('sword');
    let rooted = 0, swinging = 0, maxReach = 0, hitTick = null;
    const hp0 = e.hp;
    for (tick = 0; tick < 60; tick++) {
      await h.tick();
      if (h.player.thrust && h.player.attackT > 0) swinging++;
      if (h.player.thrust) maxReach = Math.max(maxReach, h.player.thrust.reach);
      if (hitTick === null && e.hp < hp0) hitTick = tick;
    }
    out[type] = { hp0, hpLeft: e.hp, dead: e.removed, knockTiles: +(e.x - x0).toFixed(2), hitTick, recoverTick: thinkAt, swingTicks: swinging, maxReach: +maxReach.toFixed(2) };
    e.remove();
  }
  return out;
});
console.log('sword', JSON.stringify(R.sword));

// 2. serpent: tail hits from three approach angles, count orbs
await t.eval(() => {
  const h = window.__voxelHeroes;
  h.state.maxHp = 20;
  h.setHp(20);
  h.transitions.warpTo('d1-boss');
});
await t.waitFor((st) => st.area === 'd1-boss' && st.mode === 'play', { seconds: 15, soft: true });
await t.step(0.5);
await t.waitFor((st) => st.mode === 'play', { seconds: 10, soft: true });
R.tail = await t.eval(async () => {
  const h = window.__voxelHeroes;
  const g = h.game;
  const boss = h.entities.find((e) => e.type === 'boss-serpent' && !e.removed);
  if (!boss) return { error: 'no boss', mode: h.state.mode };
  const res = [];
  const orbs = () => h.entities.filter((e) => !e.removed && e.type === 'serpent-orb').length;
  const until = async (pred, max) => { for (let i = 0; i < max && !pred(); i++) await h.tick(); };
  // approaches: 'behind' (along the body axis, from beyond the tail), 'side' (perpendicular), 'diag' (45)
  const plan = ['behind', 'side', 'diag', 'behind', 'side', 'diag'];
  for (const how of plan) {
    if (!boss.segments.length) break;
    await until(() => boss.tail()?.glowing, 400);
    const tail = boss.tail();
    if (!tail?.glowing) { res.push({ how, skipped: true }); continue; }
    for (const o of h.entities.filter((e) => e.type === 'serpent-orb' || e.type === 'serpent-shot')) o.remove();
    const nb = boss.segments[boss.segments.length - 2] ?? boss;
    // body axis: from neighbour to tail
    let ax = tail.x - nb.x, az = tail.z - nb.z;
    const L = Math.hypot(ax, az) || 1;
    ax /= L; az /= L;
    // cardinal thrusts only: choose a cardinal direction d and put the hero 1.6 tiles from the tail opposite d
    const card = [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']];
    // desired approach vector (hero -> tail)
    let want;
    if (how === 'behind') want = [-ax, -az]; // hero beyond the tail, thrusting toward the head
    else if (how === 'side') want = [-az, ax];
    else want = [(-ax - az) / Math.SQRT2, (-az + ax) / Math.SQRT2];
    // hero->tail direction = -want... pick the cardinal closest to (tail - hero) = -want? hero sits at tail + want*d, thrusts along -want
    let best = card[0], bd = -9;
    for (const c of card) { const d = -(c[0] * want[0] + c[1] * want[1]); if (d > bd) { bd = d; best = c; } }
    const hx = tail.x - best[0] * 1.6, hz = tail.z - best[1] * 1.6;
    h.player.x = hx;
    h.player.z = hz;
    h.player.invT = 5;
    g.hero.hero.setFacing(best[2]);
    const seg0 = boss.segments.length;
    // freeze the boss for the thrust so the geometry holds
    const think = boss.think;
    boss.think = () => {};
    const o0 = orbs();
    h.input.tap('sword');
    for (let i = 0; i < 16; i++) await h.tick();
    boss.think = think;
    res.push({ how, dir: best[2], broke: seg0 - boss.segments.length, orbsSpawned: orbs() - o0 });
    for (let i = 0; i < 30; i++) await h.tick();
  }
  return res;
});
console.log('tail', JSON.stringify(R.tail));
await t.shot('08-boss-orbs');

// 3. head phase with a smart "stand and thrust when it lines up" bot
R.head = await t.eval(async () => {
  const h = window.__voxelHeroes;
  const g = h.game;
  const boss = h.entities.find((e) => e.type === 'boss-serpent' && !e.removed);
  if (!boss) return { error: 'no boss' };
  // clear the body instantly
  let n = 0;
  while (boss.segments.length) {
    const tail = boss.tail();
    tail.setGlow(true);
    g.damage.dealDamage(tail, { amount: 3, source: 'sword', swingId: `x${n++}`, from: h.player });
  }
  const s = h.screen();
  h.setHp(20);
  h.player.invT = 0;
  const hurt = [];
  const off = h.events.on('player-hurt', (p) => hurt.push(p.amount));
  let t = 0, swings = 0, hits = 0, lastHp = boss.hp;
  const cx = s.x0 + 8, cz = s.z0 + 6;
  while (t < 120 && !boss.removed) {
    if (h.state.mode === 'dead') break;
    if (h.state.mode !== 'play') { await h.tick(); t += 1 / 60; continue; }
    if (h.state.hp <= 4) h.setHp(20);
    const dx = boss.x - h.player.x, dz = boss.z - h.player.z;
    const d = Math.hypot(dx, dz);
    // drift back toward the centre when idle
    const reach = 2.85 + boss.r;
    let stick = [0, 0];
    if (d < reach && h.player.attackT <= 0) {
      const horiz = Math.abs(dx) >= Math.abs(dz);
      const perp = horiz ? Math.abs(dz) : Math.abs(dx);
      if (perp < boss.r + 0.2) {
        g.hero.hero.setFacing(horiz ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north'));
        h.input.tap('sword');
        swings++;
      }
    } else if (d > 3.5) {
      const ex = cx - h.player.x, ez = cz - h.player.z;
      const el = Math.hypot(ex, ez);
      if (el > 0.5) stick = [ex / el, ez / el];
    } else if (d < 1.8) {
      stick = [-dx / d, -dz / d];
    }
    h.input.setStick(stick[0], stick[1]);
    await h.tick();
    t += 1 / 60;
    if (boss.hp < lastHp) { hits++; lastHp = boss.hp; }
  }
  h.input.setStick(0, 0);
  off();
  return { seconds: +t.toFixed(1), dead: boss.removed, hpLeft: boss.hp, swings, hits, hurtCount: hurt.length, dmg: hurt.reduce((a, b) => a + b, 0), speed: boss.speed };
});
console.log('head', JSON.stringify(R.head));
writeFileSync(`${BASE}/audit2-result.json`, JSON.stringify({ R, errors: t.errors.slice(0, 10) }, null, 1));
await t.close();
console.log('done', t.errors.slice(0, 5));

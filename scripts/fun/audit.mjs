// Fun audit: plays a running build and measures feel, density, economy,
// boss, death. Usage: node scripts/fun/audit.mjs [section] [--url=...] [--base=...]
// --base is a scratch folder for shots and the result JSON (each agent's
// own scratchpad: this writes outside the repo, so there is no repo-relative
// default). --url points at whatever build you booted.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from '../playtest.mjs';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const only = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'all';
const BASE = flags.base ?? process.env.VH_AUDIT_SCRATCH ?? '.';
const OUT = `${BASE}/shots`;
mkdirSync(OUT, { recursive: true });
const R = {};
const t = await launch({ url: flags.url ?? 'http://localhost:4197/', out: OUT, seed: 7 });
const sec = async (name, fn) => {
  if (only !== 'all' && !only.split(',').includes(name)) return;
  try {
    R[name] = await fn();
  } catch (e) {
    R[name] = { error: String(e?.message ?? e).slice(0, 400) };
  }
  console.log(name, JSON.stringify(R[name]).slice(0, 1500));
};

await t.step(0.3);
// tracking helpers in page
await t.eval(() => {
  const h = window.__voxelHeroes;
  const A = (window.__A = { hurt: [], hits: [], kills: [], shots: 0, pickups: [] });
  h.events.on('player-hurt', (p) => A.hurt.push({ amount: p.amount, kind: p.kind, src: p.source?.type ?? p.source ?? null, t: h.state.time }));
  h.events.on('enemy-hit', (p) => A.hits.push({ type: p.entity?.type, result: p.result, src: p.hit?.source, dmg: p.damage }));
  h.events.on('enemy-killed', (p) => A.kills.push(p.entity?.type));
  h.events.on('pickup', (p) => A.pickups.push(p.type));
  A.reset = () => {
    A.hurt = [];
    A.hits = [];
    A.kills = [];
    A.pickups = [];
  };
  A.arm = () => {
    const g = h.game;
    if (!h.state.swords.owned.includes('blade-start')) h.give('blade-start');
    g.swords.equipSword('blade-start');
    h.state.gear.shield = Math.max(1, h.state.gear.shield ?? 0);
    h.setHp(h.state.maxHp);
  };
});

await sec('start', async () => {
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ name: 'Bo', class: 'balanced', prologue: true }));
  await t.step(1.2);
  const s = await t.state();
  await t.shot('01-start');
  return { screen: s.screenName, hp: s.hp, maxHp: s.maxHp, enemies: s.enemies, ents: s.entities.map((e) => e.type), coins: s.gems };
});

await sec('sword', async () => {
  await t.eval(() => window.__A.arm());
  await t.teleport('Castle Road', 4, 3.5);
  await t.step(0.5);
  return t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    for (const e of h.entities) if (e.kind === 'enemy') e.remove();
    h.setHp(h.state.maxHp);
    const out = { tuning: { ...g.tuning.TUNING.sword, length: undefined, width: undefined }, blade: g.hero.hero.blade() };
    const s = h.screen();
    const e = h.spawn('blob', 6, 3.5);
    e.spawned = true;
    e.growT = 1;
    e.think = () => {};
    h.player.x = s.x0 + 4;
    h.player.z = s.z0 + 3.5;
    g.hero.hero.setFacing('east');
    const x0 = e.x;
    h.input.tap('sword');
    let rooted = 0, swinging = 0, stunned = 0, maxReach = 0, knockEnd = null;
    for (let i = 0; i < 90; i++) {
      await h.tick();
      if (g.api?.sword?.isRooted?.(h.player) ?? (h.player.thrust && h.player.attackT > 0.08)) rooted++;
      if (h.player.attackT > 0) swinging++;
      if (h.player.thrust) maxReach = Math.max(maxReach, h.player.thrust.reach);
      if (e.knockT > 0 || e.stunT > 0) stunned++;
      if (knockEnd === null && i > 3 && !(e.knockT > 0) && !(e.stunT > 0)) knockEnd = i;
    }
    out.probe = { hpLeft: e.hp, maxHp: e.maxHp, knockTiles: +(e.x - x0).toFixed(2), stunnedTicks: stunned, swingTicks: swinging, maxReach: +maxReach.toFixed(2) };
    // small blade (below full life)
    h.setHp(h.state.maxHp - 1);
    out.smallBlade = g.hero.hero.blade();
    h.setHp(h.state.maxHp);
    e.remove();
    // walk accel: ticks to reach full speed
    h.input.setStick(0, 1);
    const z0 = h.player.z;
    const v = [];
    let prev = h.player.z;
    for (let i = 0; i < 12; i++) {
      await h.tick();
      v.push(+((h.player.z - prev) * 60).toFixed(2));
      prev = h.player.z;
    }
    h.input.setStick(0, 0);
    await h.tick();
    const stopV = +((h.player.z - prev) * 60).toFixed(2);
    out.walk = { first12TickSpeeds: v, afterReleaseSpeed: stopV, dist: +(h.player.z - z0).toFixed(2) };
    return out;
  });
});

// Fight every combat screen with the naive bot (nearest foe, thrust).
const COMBAT = ['West Pasture', 'East Pasture', 'Buzzing Heath', 'Stump Wood', 'Leaper Hollow', 'Barrow Crossing', 'Barrow Road', 'Archer Ridge', 'Barrow Meadow'];
await sec('screens', async () => {
  const rows = [];
  for (const name of COMBAT) {
    await t.eval(() => {
      window.__A.arm();
      window.__A.reset();
    });
    await t.teleport(name, 8, 8);
    await t.step(1.6);
    const before = await t.state();
    const foes = before.entities.filter((e) => e.kind === 'enemy').map((e) => e.type);
    const coins0 = before.gems;
    let fr;
    if (name === 'Buzzing Heath') {
      fr = await t.fight({ seconds: 2.5, heal: 1, soft: true });
      await t.shot('02-fight-buzzing-heath');
      const fr2 = await t.fight({ seconds: 60, heal: 1, soft: true });
      fr = { ...fr2, t: fr2.t + fr.t, kills: fr2.kills + fr.kills, swings: fr2.swings + fr.swings };
    } else fr = await t.fight({ seconds: 60, heal: 1, soft: true });
    const after = await t.state();
    const A = await t.eval(() => ({ hurt: window.__A.hurt, hits: window.__A.hits.length, kills: window.__A.kills }));
    const drops = after.entities.filter((e) => e.kind === 'pickup').map((e) => e.type);
    const dmg = A.hurt.reduce((s, h) => s + h.amount, 0);
    rows.push({ name, foes, t: +fr.t.toFixed(1), kills: fr.kills, swings: fr.swings, heals: fr.heals, reason: fr.reason, hitsTaken: A.hurt.length, dmgTaken: dmg, hurtBy: A.hurt.map((h) => h.src), dropsOnGround: drops, coinsPicked: after.gems - coins0 });
    if (name === 'Barrow Meadow') {
      // cut every bush with real thrusts: walk beside each and swing
      const bushes = await t.eval(() => {
        const h = window.__voxelHeroes;
        const s = h.screen();
        const out = [];
        for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) if (h.world.tile(s.x0 + x, s.z0 + z) === 'B') out.push([x, z]);
        return out;
      });
      const before2 = (await t.state()).entities.filter((e) => e.kind === 'pickup').length;
      let cut = 0;
      for (const [x, z] of bushes) {
        const r = await t.walkTo(x + 0.5, z + 1.6, { soft: true, timeout: 8 });
        if (!r.ok) continue;
        await t.eval(() => window.__voxelHeroes.game.hero.hero.setFacing('north'));
        await t.tap('sword');
        await t.step(0.4);
        cut++;
      }
      const s2 = await t.state();
      rows.push({ bushes: bushes.length, cutAttempts: cut, bushTilesLeft: await t.eval(() => { const h = window.__voxelHeroes; const s = h.screen(); let n = 0; for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) if (h.world.tile(s.x0 + x, s.z0 + z) === 'B') n++; return n; }), pickupsFromBushes: s2.entities.filter((e) => e.kind === 'pickup').length - before2, pickupTypes: s2.entities.filter((e) => e.kind === 'pickup').map((e) => e.type) });
      await t.shot('03-barrow-meadow-after');
    }
  }
  return rows;
});

// Cleared screens: do foes come back on re-entry?
await sec('respawn', async () => {
  await t.teleport('Buzzing Heath', 8, 8);
  await t.step(1.6);
  const a = (await t.state()).enemies;
  await t.teleport('Stump Wood', 8, 8);
  await t.step(1.0);
  await t.teleport('Buzzing Heath', 8, 8);
  await t.step(1.6);
  const b = (await t.state()).enemies;
  return { rightAfterClear: a, reenterSoon: b, memory: await t.eval(() => window.__voxelHeroes.game.tuning.TUNING.enemy.roomClearMemory) };
});

await sec('town', async () => {
  await t.teleport('Mossbrook Square', 8, 9);
  await t.step(1.0);
  const s = await t.state();
  await t.shot('04-mossbrook-square');
  const smith = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const p = g.menus.openMenu('smith', { speaker: 'Brannoc' });
    for (let i = 0; i < 10; i++) await h.tick();
    const v = g.dialog?.dialogView?.() ?? null;
    return { view: v ? JSON.stringify(v).slice(0, 300) : null };
  });
  // close any dialog
  for (let i = 0; i < 6; i++) await t.press('Enter');
  return { npcs: s.entities.filter((e) => e.kind === 'npc').length, kinds: [...new Set(s.entities.map((e) => e.type))], smith, time: s.time };
});

await sec('d1', async () => {
  await t.eval(() => window.__A.arm());
  await t.teleport('d1:3,9', 8, 9);
  await t.step(1.2);
  const s = await t.state();
  await t.shot('05-d1-entrance');
  return { name: s.screenName, ents: s.entities.map((e) => e.type) };
});

await sec('boss', async () => {
  await t.eval(() => {
    window.__A.arm();
    window.__A.reset();
    window.__voxelHeroes.state.maxHp = 10;
    window.__voxelHeroes.setHp(10);
    window.__voxelHeroes.transitions.warpTo('d1-boss');
  });
  await t.waitFor((st) => st.area === 'd1-boss' && (st.mode === 'boss-intro' || st.mode === 'play'), { seconds: 8, soft: true });
  await t.waitFor((st) => st.mode === 'play', { seconds: 10, soft: true });
  const shotsBefore = await t.eval(() => window.__voxelHeroes.entities.filter((e) => e.kind === 'projectile').length);
  // count foe projectiles spawned
  await t.eval(() => {
    const h = window.__voxelHeroes;
    window.__A.proj = 0;
    window.__A.seen = new Set();
  });
  let total = 0;
  let segs = [];
  let shot = false;
  let res;
  for (let k = 0; k < 12; k++) {
    res = await t.fight({ seconds: 10, heal: 2, soft: true });
    total += res.t;
    const info = await t.eval(() => {
      const h = window.__voxelHeroes;
      const b = h.entities.find((e) => e.type === 'boss-serpent' && !e.removed);
      for (const e of h.entities) if (e.kind === 'projectile' && !window.__A.seen.has(e)) { window.__A.seen.add(e); window.__A.proj++; }
      return b ? { segs: b.segments?.length, headHp: b.hp } : { dead: true };
    });
    segs.push(info);
    if (!shot && total > 8) {
      await t.shot('06-boss-fight');
      shot = true;
    }
    if (info.dead || res.reason === 'died' || res.ok) break;
  }
  const A = await t.eval(() => {
    const A = window.__A;
    const by = {};
    for (const h of A.hits) by[`${h.type}:${h.result}`] = (by[`${h.type}:${h.result}`] ?? 0) + 1;
    return { hitsBy: by, hurt: A.hurt.length, dmg: A.hurt.reduce((s, h) => s + h.amount, 0), hurtBy: A.hurt.map((h) => h.src + ':' + h.kind), proj: A.proj };
  });
  return { seconds: +total.toFixed(1), progress: segs, last: res, ...A };
});

await sec('death', async () => {
  await t.eval(() => window.__A.arm());
  await t.teleport('Leaper Hollow', 8, 8);
  await t.step(0.3);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.setHp(1);
    h.player.invT = 0;
    h.game.hero.hero.receiveHit({ damage: 2, from: { x: h.player.x + 1, z: h.player.z }, kind: 'contact' });
  });
  await t.step(2.0);
  const s = await t.state();
  await t.shot('07-death');
  await t.press('Enter');
  await t.step(1.5);
  const s2 = await t.state();
  return { mode: s.mode, overlay: s.overlay, after: { mode: s2.mode, area: s2.area, screen: s2.screenName, hp: s2.hp, coins: s2.gems } };
});

writeFileSync(`${BASE}/audit-result.json`, JSON.stringify({ R, errors: t.errors.slice(0, 10), warnings: t.warnings.slice(0, 5) }, null, 1));
await t.close();
console.log('done', t.errors.slice(0, 5));

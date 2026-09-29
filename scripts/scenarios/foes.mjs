// Items and foes (M2 stream 2; gameplay spec 8, 9.1, 9.2, 6.4, 6.6, 8.6):
// the boomerang (out 6 tiles, back to the hand, a 2 s stun, pickups carried
// home), bombs (fuse, radius, damage, 2 out at once, the hero's own blast,
// chain blasts), the item pose and the use lock; the overworld roster
// (hopper, blob, blob-blue, buzzer, stump, archer, leaper, guardian,
// treasure-slime, wyrm) and D1's (skeleton, bat, gazer, turret, blade-trap,
// arrow-trap) with contact through receiveHit, guard blocks and shield
// tiers; the drop packs, crowns and cleared screens; and boss-serpent from
// its intro to the payout. Screenshots: a boomerang throw, a bomb blast, the
// boss.
export const description = 'Items and foes: boomerang, bombs, item pose; overworld and D1 enemies, traps, drops, crowns, clears; boss-serpent.';

const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

const install = (t) =>
  t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = (window.__fk = {});
    H.T = g.tuning.TUNING;
    H.hero = g.hero.hero;
    H.p = h.player;
    H.clear = () => {
      for (const e of h.entities) if (['enemy', 'projectile', 'pickup', 'bomb', 'spawner'].includes(e.kind) || e.type === 'boss-tombstone') e.remove();
    };
    H.ticks = async (n, each) => {
      for (let i = 0; i < n; i++) {
        if (each && each(i) === false) return i;
        await h.tick();
      }
      return n;
    };
    H.until = async (pred, max = 600) => {
      for (let i = 0; i < max; i++) {
        if (pred()) return i;
        await h.tick();
      }
      return -1;
    };
    H.place = (x, z, facing = 'east') => {
      H.p.knockT = 0;
      H.p.stopDash?.();
      H.p.thrust = null;
      H.p.attackT = 0;
      H.p.invT = 0;
      H.p.lockT = 0;
      H.hero.place(x, z);
      H.hero.setFacing(facing);
      H.hero.clearStatus('paralyzed');
    };
    H.release = () => {
      h.input.setStick(0, 0);
      for (const a of ['guard', 'dash', 'sword', 'item']) h.input.up(a);
    };
    H.full = () => h.setHp(h.state.maxHp);
    // spawn at local (x, z), visible at once, not crowned unless asked
    H.foe = (type, x, z, opts = {}) => {
      const e = h.spawn(type, x, z, { crowned: false, ...opts });
      e.spawned = true;
      e.growT = 1;
      e.holder?.scale.setScalar(1);
      return e;
    };
    H.of = (type) => h.entities.filter((e) => e.type === type);
    H.local = (e) => {
      const s = h.screen();
      return { x: +(e.x - s.x0).toFixed(3), z: +(e.z - s.z0).toFixed(3) };
    };
    H.hits = [];
    g.events.on('hero-hit', (p) => H.hits.push({ result: p.result, damage: p.damage, kind: p.kind, type: p.source?.type ?? p.source }));
  });

export default async function foes(t) {
  await t.track('item-used', 'explosion', 'enemy-hit', 'enemy-killed', 'boss-intro', 'boss-phase', 'boss-defeated', 'room-cleared');
  await t.eval(() => window.__voxelHeroes.start());
  await t.step(1.1);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.camera.choose('A');
    h.teleport('test-foes-range', 8, 8);
  });
  await install(t);
  let r;

  // ---------------------------------------------------------------- the boomerang
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    await h.step(0.6);
    H.clear();
    const out = {};
    h.give('boomerang');
    out.owned = g.inventory.hasItem('boomerang');
    out.selected = g.inventory.selectedItem()?.id;
    await h.step(1.1); // the item get's cheer
    H.place(3.5, 8.5, 'east');
    await h.tick();
    h.input.tap('item');
    await h.tick();
    const b = H.of('boomerang')[0];
    out.thrown = !!b;
    out.pose = H.hero.pose();
    // it flies out along the facing to 6 tiles, then comes back to the hand
    let far = 0;
    let turned = null;
    let k = 0;
    while (b && !b.removed && k < 240) {
      const d = b.x - H.p.x;
      if (d > far) far = d;
      if (b.back && turned === null) turned = +(b.out).toFixed(2);
      if (k === 10) out.x10 = b.x;
      if (k === 20) out.speed = +((b.x - out.x10) * 6).toFixed(2);
      await h.tick();
      k++;
    }
    out.far = +far.toFixed(2);
    out.turned = turned;
    out.back = b?.removed;
    out.flightTicks = k;
    // a second throw needs the first back; one out at a time
    h.input.tap('item');
    await h.tick();
    h.input.tap('item');
    await H.ticks(20);
    out.oneOut = H.of('boomerang').length === 1;
    await H.until(() => H.of('boomerang').length === 0, 200);
    // it stuns a blob for TUNING.enemy.stunBoomerang s, with no damage
    const blob = H.foe('blob', 7.5, 8.5);
    blob.update = ((u) => (dt) => (blob.stunT > 0 ? u.call(blob, dt) : null))(blob.update);
    await H.ticks(16);
    h.input.tap('item');
    const hp0 = blob.hp;
    let stunned = 0;
    await H.until(() => blob.stunT > 0, 60);
    stunned = blob.stunT;
    out.stun = +stunned.toFixed(2);
    out.blobHp = [hp0, blob.hp];
    await H.until(() => H.of('boomerang').length === 0, 200);
    blob.remove();
    // it carries a coin home
    const c0 = h.state.coins;
    const coin = h.spawn('coin-10', 8.5, 8.5, { life: 60 });
    await H.ticks(10);
    h.input.tap('item');
    let carried = false;
    await H.until(() => {
      const bb = H.of('boomerang')[0];
      if (bb && bb.carried.includes(coin)) carried = true;
      return carried;
    }, 120);
    out.carried = carried;
    out.coinMoved = Math.abs(coin.x - (h.screen().x0 + 8.5)) > 0.2 || coin.removed;
    await H.until(() => H.of('boomerang').length === 0, 200);
    out.coins = h.state.coins - c0;
    out.coinBy = coin.removed;
    return out;
  });
  t.expect(r.owned && r.selected === 'boomerang', 'give boomerang: it is owned and on B');
  t.expect(r.thrown && r.pose === 'item', `B throws it and the hero shows the item pose (${r.pose})`);
  t.expect(near(r.speed, 10, 0.4), `out at 10 t/s (${r.speed})`);
  t.expect(r.turned !== null && near(r.turned, 6, 0.2) && r.far < 6.6, `it turns back at 6 tiles (${r.turned}, furthest ${r.far})`);
  t.expect(r.back, `it comes back to the hand (${r.flightTicks} ticks)`);
  t.expect(r.oneOut, 'one boomerang out at a time');
  t.expect(near(r.stun, 2.0, 0.1) && r.blobHp[0] === r.blobHp[1], `it stuns a blob for 2 s without hurting it (${r.stun} s, hp ${r.blobHp})`);
  t.expect(r.carried && r.coins === 10, `it carries a coin back to the hero (+${r.coins})`);

  await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__fk;
    H.clear();
    H.place(3.5, 8.5, 'east');
    await h.tick();
    h.input.tap('item');
    await H.ticks(14);
  });
  await t.shot('foes-boomerang');

  // ---------------------------------------------------------------- bombs
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    await H.until(() => H.of('boomerang').length === 0, 200);
    H.clear();
    H.full();
    const out = {};
    h.give('bombs');
    g.inventory.selectItem('bombs');
    await h.step(1.1);
    out.ammo0 = g.inventory.ammo('bombs');
    out.cap = g.inventory.maxAmmo('bombs');
    H.place(4.5, 8.5, 'east');
    await h.tick();
    h.input.tap('item');
    await h.tick();
    // the use lock: a second press on the next tick does nothing
    h.input.tap('item');
    await h.tick();
    out.afterLock = H.of('bomb').length;
    out.ammo1 = g.inventory.ammo('bombs');
    const bomb = H.of('bomb')[0];
    out.bombAt = bomb ? H.local(bomb) : null;
    // two out at most
    await H.ticks(16);
    h.input.tap('item');
    await H.ticks(16);
    h.input.tap('item');
    await h.tick();
    out.maxOut = H.of('bomb').length;
    out.ammo2 = g.inventory.ammo('bombs');
    for (const b of H.of('bomb')) if (b !== bomb) b.remove();
    // a blob beside it; walk the hero clear
    const blob = H.foe('blob', out.bombAt.x + 1.0, out.bombAt.z);
    blob.update = () => {};
    H.place(1.5, 3.5, 'east');
    const fuseStart = bomb.t;
    let ticks = 0;
    while (!bomb.removed && ticks < 200) {
      await h.tick();
      ticks++;
    }
    out.fuse = +((ticks + fuseStart * 60) / 60).toFixed(3);
    out.blobKilled = blob.removed;
    out.flashes = g.bombFlashes?.() ?? null;
    return out;
  });
  const blasts = await t.events('explosion');
  t.expect(r.ammo0 === 10 && r.cap === 10, `bombs come with 10, the first bag holds 10 (${r.ammo0}/${r.cap})`);
  t.expect(r.afterLock === 1 && r.ammo1 === 9, `the use lock: a second press 1 tick later does nothing (${r.afterLock} out, ${r.ammo1} left)`);
  t.expect(r.bombAt && near(r.bombAt.x, 5.1, 0.02), `the bomb is set down in front of the hero (${JSON.stringify(r.bombAt)})`);
  t.expect(r.maxOut === 2 && r.ammo2 === 8, `at most 2 bombs out at once (${r.maxOut}, ${r.ammo2} left)`);
  t.expect(near(r.fuse, 2.0, 0.02), `the fuse burns 2.0 s (${r.fuse})`);
  const last = blasts.at(-1) ?? {};
  t.expect(blasts.length >= 1 && last.radius === 1.5 && last.damage === 6, `it blows up: radius 1.5, 6 damage (${JSON.stringify({ radius: last.radius, damage: last.damage })})`);
  t.expect(r.blobKilled, 'a blob 1 tile away (4 HP) dies in the blast');

  // your own bomb hurts you (a hazard: the guard does not help), chains set off bombs
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__fk;
    H.clear();
    H.full();
    h.give('shield-2');
    H.hits.length = 0;
    const out = {};
    const hp0 = h.state.hp;
    H.place(6.5, 8.5, 'east');
    const b1 = h.spawn('bomb', 7.5, 8.5);
    const b2 = h.spawn('bomb', 8.9, 8.5, { fuse: 99 });
    h.input.down('guard');
    let k = 0;
    while (!b1.removed && k < 200) {
      await h.tick();
      k++;
    }
    await h.tick();
    out.ownBomb = hp0 - h.state.hp;
    out.hit = H.hits.at(-1);
    out.chain = b2.removed;
    h.input.up('guard');
    H.full();
    return out;
  });
  t.expect(r.ownBomb === 2 && r.hit?.kind === 'hazard' && r.hit?.result === 'hit', `his own bomb takes 2 units even behind the guard (${r.ownBomb}, ${JSON.stringify(r.hit)})`);
  t.expect(r.chain, 'a blast sets off a bomb within its radius');

  // screenshot the blast
  await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__fk;
    H.clear();
    H.place(3.5, 8.5, 'east');
    h.spawn('bomb', 8, 8.5, { fuse: 0.05 });
    h.spawn('blob', 9.5, 7.5, { crowned: true });
    await H.ticks(5);
  });
  await t.shot('foes-bomb-blast');

  // ---------------------------------------------------------------- the overworld roster
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    await h.step(0.5);
    h.teleport('test-foes-field', 8, 8);
    await h.step(0.6);
    H.clear();
    const maxHp = h.state.maxHp;
    h.state.maxHp = 40; // the wyrm's contact is 3 hearts
    H.full();
    const out = { hp: {}, contact: {}, spawnWait: null };
    const R = H.T.enemy.roster;
    for (const type of ['hopper', 'blob', 'blob-blue', 'buzzer', 'stump', 'archer', 'leaper', 'guardian', 'treasure-slime', 'wyrm']) {
      const e = h.spawn(type, 4.5, 4.5, { crowned: false });
      out.hp[type] = [e.hp, R[type].hp];
      // contact: the hero stands on it, unguarded
      e.spawned = true;
      e.update = ((u) => (dt) => {
        e.think = () => {};
        return u.call(e, dt);
      })(e.update);
      H.place(4.5 + 0.3, 4.5, 'west');
      H.hits.length = 0;
      await h.tick();
      await h.tick();
      out.contact[type] = [H.hits[0]?.damage ?? null, R[type].contact, H.hits[0]?.kind];
      e.remove();
      H.full();
      H.p.invT = 0;
    }
    // appearing: TUNING.scroll.spawnWait, then spawnStagger between enemies
    const a = h.spawn('blob', 3.5, 3.5, { spawnIndex: 0 });
    const b = h.spawn('blob', 12.5, 12.5, { spawnIndex: 2 });
    H.place(8.5, 8.5);
    const ta = await H.until(() => a.spawned, 120);
    const tb = await H.until(() => b.spawned, 120);
    out.spawnWait = [ta, ta + tb];
    h.state.maxHp = maxHp;
    H.full();
    return out;
  });
  const hpOk = Object.entries(r.hp).every(([, [a, b]]) => a === b);
  t.expect(hpOk, `HP from TUNING.enemy.roster (${JSON.stringify(r.hp)})`);
  const contactOk = Object.entries(r.contact).every(([, [a, b, k]]) => a === b && k === 'contact');
  t.expect(contactOk, `contact goes through receiveHit with the roster's damage (${JSON.stringify(r.contact)})`);
  t.expect(r.spawnWait[0] >= 29 && r.spawnWait[0] <= 31 && r.spawnWait[1] >= 41 && r.spawnWait[1] <= 43, `enemies appear after 0.5 s, 0.1 s apart (${r.spawnWait} ticks)`);

  // guard blocks contact: the hero takes the push, the foe is knocked 1 tile and stunned 0.4 s; 90 ticks of blinking after a hit
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__fk;
    H.clear();
    H.full();
    h.give('shield-1');
    const out = {};
    const e = H.foe('blob', 6.2, 8.5);
    e.think = () => {};
    H.place(5.5, 8.5, 'east');
    H.hits.length = 0;
    h.input.down('guard');
    const x0 = e.x;
    await h.tick();
    await h.tick();
    out.first = H.hits[0];
    await H.ticks(14);
    out.knock = +(e.x - x0).toFixed(2);
    out.stun = +e.stunT.toFixed(2);
    h.input.up('guard');
    // unguarded from behind: a hit, then 90 ticks of blinking
    e.remove();
    const f = H.foe('blob', 4.8, 8.5);
    f.think = () => {};
    H.place(5.5, 8.5, 'east');
    H.hits.length = 0;
    await h.tick();
    await h.tick();
    out.behind = H.hits[0];
    const blink = await H.until(() => H.p.invT <= 0, 200);
    out.blink = blink + 1;
    f.remove();
    H.full();
    return out;
  });
  t.expect(r.first?.result === 'blocked', `a raised guard blocks contact from the front (${JSON.stringify(r.first)})`);
  t.expect(near(r.knock, 1.0, 0.1) && r.stun > 0.25 && r.stun <= 0.4, `the blocked foe is knocked 1 tile and stunned (${r.knock} tiles, ${r.stun} s left)`);
  t.expect(r.behind?.result === 'hit' && r.blink >= 88 && r.blink <= 91, `contact from behind lands; the hero blinks ~90 ticks (${r.blink})`);

  // behaviours: the hopper charges down a line, the stump wakes at 3 tiles, the leaper can't be hit in the air
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    H.clear();
    H.full();
    const out = {};
    H.place(10.0, 8.5, 'west');
    H.p.invT = 99;
    const hop = H.foe('hopper', 5.5, 8.5);
    let maxV = 0;
    let px = hop.x;
    let tellTicks = 0;
    for (let i = 0; i < 70; i++) {
      await h.tick();
      if (hop.ai.tellT > 0 && maxV === 0) tellTicks++;
      maxV = Math.max(maxV, (hop.x - px) * 60);
      px = hop.x;
    }
    out.hopper = { maxV: +maxV.toFixed(2), tellTicks };
    hop.remove();
    // stump
    const st = H.foe('stump', 5.5, 8.5);
    H.place(9.5, 8.5, 'west');
    await H.ticks(30);
    out.stumpAsleep = !st.awake && Math.abs(st.x - h.screen().x0 - 5.5) < 0.05;
    H.place(8.3, 8.5, 'west');
    await H.ticks(30);
    out.stumpAwake = st.awake && st.x - h.screen().x0 > 5.6;
    st.remove();
    // leaper in the air
    const lp = H.foe('leaper', 5.5, 5.5);
    await H.until(() => lp.airborne, 200);
    const r1 = g.damage.dealDamage(lp, { amount: 3, source: 'sword' }).result;
    out.leaperAir = r1;
    await H.until(() => !lp.airborne, 200);
    out.leaperGround = g.damage.dealDamage(lp, { amount: 3, source: 'sword', swingId: 'x1' }).result;
    lp.remove();
    // a crowned foe moves 1.5 x
    const cr = h.spawn('blob', 5.5, 5.5, { crowned: true });
    out.crown = [cr.speed, cr.baseSpeed, !!cr.crown];
    cr.remove();
    // the crown rolls at TUNING.enemy.crownedChance
    let crowned = 0;
    for (let i = 0; i < 400; i++) {
      const e = h.spawn('blob', 5.5, 5.5);
      if (e.crowned) crowned++;
      e.remove();
    }
    out.crownRate = crowned / 400;
    H.p.invT = 0;
    return out;
  });
  t.expect(r.hopper.maxV > 5.5 && r.hopper.maxV < 6.6 && near(r.hopper.tellTicks, 18, 2), `a hopper lined up within 5 tiles tells for 0.3 s, then charges at 6 t/s (${JSON.stringify(r.hopper)})`);
  t.expect(r.stumpAsleep && r.stumpAwake, 'a stump sleeps until the hero is within 3 tiles, then follows');
  t.expect(r.leaperAir === 'ignored' && r.leaperGround !== 'ignored', `a leaper can't be hit in the air (${r.leaperAir}, then ${r.leaperGround})`);
  t.expect(r.crown[0] === r.crown[1] * 1.5 && r.crown[2], `a crowned foe moves 1.5 x and wears the crown (${r.crown})`);
  t.expect(r.crownRate > 0.04 && r.crownRate < 0.13, `crowns roll at about 8% (${r.crownRate})`);

  // shots and the shield tiers: arrows and rocks need a raised guard and shield 2; the gazer's magic shot needs 3
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__fk;
    H.clear();
    H.full();
    const out = {};
    const fire = async (type, shield, guard) => {
      h.state.gear.shield = shield;
      H.place(10.5, 8.5, 'west');
      H.p.invT = 0;
      if (guard) h.input.down('guard');
      H.hits.length = 0;
      h.spawn(type, 6.5, 8.5, { dir: { x: 1, z: 0 }, speed: 8 });
      await H.ticks(40);
      h.input.up('guard');
      H.full();
      return H.hits[0]?.result ?? 'none';
    };
    out.rockS1 = await fire('rock-shot', 1, true);
    out.rockS2 = await fire('rock-shot', 2, true);
    out.rockNoGuard = await fire('rock-shot', 2, false);
    out.arrowS2 = await fire('archer-arrow', 2, true);
    out.gazeS2 = await fire('gazer-shot', 2, true);
    out.gazeS3 = await fire('gazer-shot', 3, true);
    // the archer looses an arrow down a line within 7 tiles
    h.state.gear.shield = 1;
    const ar = H.foe('archer', 4.5, 8.5);
    ar.ai.shoot = { cool: 0, dir: null }; // ready to shoot
    H.place(10.5, 8.5, 'west');
    H.p.invT = 99;
    out.arrow = (await H.until(() => H.of('archer-arrow').length > 0, 240)) >= 0;
    ar.remove();
    H.p.invT = 0;
    return out;
  });
  t.expect(r.rockS1 === 'hit' && r.rockS2 === 'blocked' && r.rockNoGuard === 'hit', `rock-shot: the guard with shield 2 blocks it, shield 1 or no guard does not (${r.rockS1}, ${r.rockS2}, ${r.rockNoGuard})`);
  t.expect(r.arrowS2 === 'blocked' && r.gazeS2 === 'hit' && r.gazeS3 === 'blocked', `archer arrows are tier 2, the gazer's shot tier 3 (${r.arrowS2}, ${r.gazeS2}, ${r.gazeS3})`);
  t.expect(r.arrow, 'an archer lined up within 7 tiles looses an arrow');

  // drop packs and cleared screens
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    H.clear();
    const T = g.drops.DROP_TABLES;
    const sum = (n) => +T[n].reduce((s, e) => s + e.chance, 0).toFixed(3);
    const out = { packs: ['pack-a', 'pack-b', 'pack-c', 'pack-d', 'pack-e', 'pot'].map((n) => [n, sum(n)]) };
    // pack A gives bombs only once he owns them
    out.bombEntry = T['pack-a'].find((e) => e.type === 'bomb-1')?.else;
    // kill every enemy on the field: the screen stays empty until the area loads again
    h.teleport('test-foes-field', 8, 8);
    await h.step(0.2);
    H.clear();
    const e = H.foe('blob', 4.5, 4.5);
    g.damage.dealDamage(e, { amount: 99, source: 'sword' });
    out.cleared = g.clears.isCleared('test-foes-field:0,0');
    const again = h.spawn('blob', 5.5, 5.5);
    out.skipped = again.removed;
    g.events.emit('area-enter', { area: 'test-foes-field', from: null, via: 'edge' });
    out.forgotten = !g.clears.isCleared('test-foes-field:0,0');
    return out;
  });
  t.expect(r.packs.every(([n, s]) => ({ 'pack-a': 0.5, 'pack-b': 0.6, 'pack-c': 1, 'pack-d': 0.6, 'pack-e': 0.7, pot: 0.5 })[n] === s), `drop packs roll at the spec's odds (${JSON.stringify(r.packs)})`);
  t.expect(r.bombEntry === 'coin-1', 'bomb drops fall back to coin-1 for a hero without bombs');
  t.expect(r.cleared && r.skipped && r.forgotten, 'an overworld screen cleared of enemies stays empty until its area loads again');

  // ---------------------------------------------------------------- D1's roster and traps
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    h.teleport('test-foes-rooms', 8, 6);
    await h.step(0.6);
    H.clear();
    H.full();
    h.state.gear.shield = 1;
    const out = {};
    // gazer: lined up and facing: holds the hero 1 s, then fires
    const gz = H.foe('gazer', 4.5, 6);
    gz.yaw = Math.PI / 2; // facing east
    gz.cool = 0;
    H.place(10.5, 6, 'west');
    await H.until(() => gz.gaze, 60);
    out.held = H.hero.hasStatus('paralyzed');
    const x0 = H.p.x;
    h.input.setStick(1, 0);
    await H.ticks(50);
    out.stayed = Math.abs(H.p.x - x0) < 0.01; // pushing the stick does nothing while held
    const shotAt = 50 + (await H.until(() => H.of('gazer-shot').length > 0, 120));
    h.input.setStick(0, 0);
    out.shotAt = shotAt;
    gz.remove();
    H.clear();
    // turret: fires every 2 s, glowing 0.3 s first; immune; never holds the room
    const tu = H.foe('turret', 3.5, 3.5, { phase: 2.0 });
    H.place(10.5, 8.5, 'west');
    H.p.invT = 99;
    const shots = [];
    let glowAt = null;
    for (let i = 0; i < 300; i++) {
      const before = H.of('turret-bolt').length;
      await h.tick();
      if (glowAt === null && tu.glowing) glowAt = i;
      if (H.of('turret-bolt').length > before) shots.push(i);
    }
    out.turret = { shots, glowAt };
    out.turretImmune = g.damage.dealDamage(tu, { amount: 99, source: 'sword', swingId: 'y' }).result;
    out.clearCount = g.combat.enemiesLeft();
    tu.remove();
    H.clear();
    // blade trap: slides at 8 when lined up, back at 3; 1 heart
    const bt = H.foe('blade-trap', 2.5, 6);
    H.place(8.5, 6, 'west');
    H.p.invT = 99;
    let v = 0;
    let px = bt.x;
    for (let i = 0; i < 40; i++) {
      await h.tick();
      v = Math.max(v, (bt.x - px) * 60);
      px = bt.x;
    }
    out.bladeOut = +v.toFixed(2);
    H.place(8.5, 2.5, 'west');
    await H.until(() => bt.back, 120);
    px = bt.x;
    await h.tick();
    out.bladeBack = +((px - bt.x) * 60).toFixed(2);
    bt.remove();
    // skeleton and bat move; bat flies
    const sk = H.foe('skeleton', 4.5, 4.5);
    const bat = H.foe('bat', 10.5, 4.5);
    const s0 = [sk.x, sk.z, bat.x, bat.z];
    await H.ticks(90);
    out.moved = Math.hypot(sk.x - s0[0], sk.z - s0[1]) > 0.3 && Math.hypot(bat.x - s0[2], bat.z - s0[3]) > 0.3;
    out.batFlies = bat.flying;
    // a cleared room is remembered (the room rule)
    H.p.invT = 0;
    H.clear();
    const last = H.foe('skeleton', 5.5, 5.5);
    g.damage.dealDamage(last, { amount: 99, source: 'sword' });
    out.roomCleared = g.clears.isCleared('test-foes-rooms:0,0');
    // arrow trap
    const at = H.foe('arrow-trap', 1.3, 6, { dir: 'east' });
    H.place(9.5, 6, 'west');
    H.p.invT = 99;
    out.trapArrow = (await H.until(() => H.of('trap-arrow').length > 0, 60)) >= 0;
    at.remove();
    H.p.invT = 0;
    H.full();
    return out;
  });
  t.expect(r.held && r.stayed && r.shotAt >= 58 && r.shotAt <= 62, `a gazer holds the hero still for 1 s, then fires (${r.shotAt} ticks, ${r.held}, ${r.stayed})`);
  const ts = r.turret.shots;
  t.expect(ts.length >= 2 && near(ts[1] - ts[0], 120, 1) && r.turret.glowAt !== null && near(ts[0] - r.turret.glowAt, 18, 2), `a turret glows 0.3 s, then fires every 2.0 s (${JSON.stringify(r.turret)})`);
  t.expect(r.turretImmune === 'immune' && r.clearCount === 0, `traps are immune and never hold a room (${r.turretImmune}, ${r.clearCount} left)`);
  t.expect(near(r.bladeOut, 8, 0.2) && near(r.bladeBack, 3, 0.1), `a blade trap slides out at 8 t/s and back at 3 (${r.bladeOut}, ${r.bladeBack})`);
  t.expect(r.moved && r.batFlies, 'skeletons wander, bats fly');
  t.expect(r.roomCleared, 'a cleared dungeon room is remembered');
  t.expect(r.trapArrow, 'an arrow trap fires along its line');

  // ---------------------------------------------------------------- boss-serpent
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    if (!g.dungeons.getDungeon('test-foes')) g.dungeons.registerDungeon({ id: 'test-foes', number: 1, name: 'Coil Test', areas: ['test-foes-arena'], boss: 'boss-serpent' });
    H.full();
    const out = {};
    h.teleport('test-foes-arena', 11, 13.5);
    await h.tick();
    h.spawn('boss-serpent', 11, 4.5, { dungeon: 'test-foes' });
    const intro = await H.until(() => h.state.mode === 'boss-intro', 240);
    out.intro = intro >= 0;
    const introTicks = await H.until(() => h.state.mode === 'play', 400);
    out.introTicks = introTicks;
    const boss = H.of('boss-serpent')[0];
    out.segments = boss.segments.length;
    const gaps = [];
    let prev = boss;
    for (const s of boss.segments) {
      gaps.push(+Math.hypot(s.x - prev.x, s.z - prev.z).toFixed(2));
      prev = s;
    }
    out.gaps = gaps;
    out.tombstone = H.of('boss-tombstone').length;
    H.p.invT = 999;
    // a hit on a part that isn't glowing: a ring of 8 orbs
    const head = boss;
    const orbs0 = H.of('serpent-orb').length;
    const r1 = g.damage.dealDamage(head.segments[0], { amount: 3, source: 'sword', swingId: 'b1', from: H.p });
    out.punish = [r1.result, H.of('serpent-orb').length - orbs0];
    // the tail glows 2.5 s after the fight starts (and after each break)
    const tail = head.tail();
    out.tailGlowing0 = tail.glowing;
    await H.until(() => tail.glowing, 200);
    out.speed0 = head.speed;
    const hearts0 = H.of('heart').length;
    const r2 = g.damage.dealDamage(tail, { amount: 3, source: 'sword', swingId: 'b2', from: H.p });
    out.break = [r2.result, head.segments.length, H.of('heart').length - hearts0, head.speed];
    // volleys of 3 every 4 s
    const shots0 = H.of('serpent-shot').length;
    let volley = 0;
    await H.until(() => (volley = H.of('serpent-shot').length - shots0) > 0, 260);
    out.volley = volley;
    // break the rest
    let n = 3;
    while (head.segments.length) {
      const t = head.tail();
      await H.until(() => t.glowing, 200);
      g.damage.dealDamage(t, { amount: 3, source: 'sword', swingId: `b${n++}`, from: H.p });
    }
    out.speedAlone = head.speed;
    out.headHp = head.hp;
    const coins0 = h.state.coins;
    for (let i = 0; i < 20 && !head.removed; i++) g.damage.dealDamage(head, { amount: 3, source: 'sword', swingId: `h${i}`, from: H.p });
    out.dead = head.removed;
    await h.tick();
    out.container = H.of('heart-container').length;
    const coinsOut = H.of('coin-100').length * 100 + H.of('coin-10').length * 10 + H.of('coin-1').length;
    out.coins = coinsOut;
    out.flag = h.state.flags?.has?.('boss:test-foes') ?? null;
    H.p.invT = 0;
    return out;
  });
  const phases = (await t.events('boss-phase')).map((e) => e.phase);
  const defeated = await t.events('boss-defeated');
  const intros = await t.events('boss-intro');
  t.expect(r.intro && intros.length === 1 && intros[0].name, `the arena opens with the boss intro (${intros[0]?.name}, ${r.introTicks} ticks)`);
  t.expect(near(r.introTicks, 120, 3), `the intro lasts 2.0 s (${r.introTicks} ticks)`);
  t.expect(r.segments === 6 && r.gaps.every((d) => near(d, 0.9, 0.08)), `a head and 6 segments 0.9 tile apart (${r.gaps})`);
  t.expect(r.tombstone === 0, 'no tombstone before the boss is beaten');
  t.expect(r.punish[0] === 'blocked' && r.punish[1] === 8, `hitting a dull part fires a ring of 8 orbs (${r.punish})`);
  t.expect(r.break[0] === 'killed' && r.break[1] === 5 && r.break[2] === 1 && near(r.break[3], r.speed0 + 0.5, 1e-6), `the glowing tail breaks in one hit, drops a heart and speeds it up 0.5 t/s (${r.break})`);
  t.expect(r.volley === 3, `it fires a fan of 3 (${r.volley})`);
  t.expect(r.speedAlone === 4.2 && r.headHp === 24, `alone, the head is capped at 4.2 t/s (never outruns the hero) with 24 HP (${r.speedAlone}, ${r.headHp})`);
  t.expect(JSON.stringify(phases.slice(0, 2)) === '[1,2]', `phases change at 66% and 33% (${phases})`);
  // Reward pacing (fun audit item 5, deliberately changed): the arena used to shower the whole
  // 250-coin bossPay; most of it now lives in D1's own chests (world/areas/d1.js, >= 120 coins,
  // secrets.mjs), and the arena keeps TUNING.boss.serpent.coinCap (80) on top of the container.
  t.expect(r.dead && defeated.length === 1 && r.container === 1 && r.coins === 80, `beaten: boss-defeated, a heart container and a smaller 80-coin shower, most of the payout moved to D1's own chests (${defeated.length}, ${r.container}, ${r.coins})`);

  // the tombstone starts a re-fight once the boss is beaten
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__fk;
    H.clear();
    h.teleport('test-foes-arena', 11, 13.5);
    await h.step(0.3);
    h.spawn('boss-serpent', 11, 4.5, { dungeon: 'test-foes' }); // as the arena's marker would
    await h.tick();
    const out = { boss: H.of('boss-serpent').length, stone: H.of('boss-tombstone').length };
    const stone = H.of('boss-tombstone')[0];
    stone?.onSword({});
    await h.tick();
    const b = H.of('boss-serpent')[0];
    out.refight = !!b && b.refight;
    await H.until(() => h.state.mode === 'boss-intro', 60);
    await H.until(() => h.state.mode === 'play', 400);
    H.place(8, 12.5, 'north');
    await h.step(1.6);
    return out;
  });
  t.expect(r.boss === 0 && r.stone === 1 && r.refight, `a beaten boss stays away; its tombstone starts a re-fight (${JSON.stringify(r)})`);
  await t.shot('foes-boss');

  // ---------------------------------------------------------------- overworld teeth (fun audit
  // item 3): basic foes no longer die to one starting-blade hit, Barrow Crossing and The Old
  // Barrow have real ambushes instead of open ground. Run last (own teleport, own dungeon reuse)
  // so it never shifts the gameplay random stream or shared event counts the boss tests above
  // read from a fixed tick count.
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    H.clear();
    h.teleport('test-foes-field', 8, 8);
    await h.step(0.3);
    const blob = H.foe('blob', 7.5, 7.5);
    const hp0 = blob.hp;
    const r1 = g.damage.dealDamage(blob, { amount: 3, source: 'sword', swingId: 'bt1', from: H.p });
    const afterOne = { result: r1.result, alive: !blob.removed, hp: blob.hp };
    const r2 = g.damage.dealDamage(blob, { amount: 3, source: 'sword', swingId: 'bt2', from: H.p });
    const afterTwo = { result: r2.result, dead: blob.removed };
    const crossing = h.world.screen('ow-3-2:1,1');
    const archers = crossing.spawns.filter((s) => s.type === 'group' && (s.opts.of ?? []).includes('archer'));
    const barrow = h.world.screen('ow-3-2:1,2');
    const ambush = barrow.spawns.filter((s) => s.type === 'group');
    return { hp0, afterOne, afterTwo, archers: archers.map((a) => ({ of: a.opts.of, count: a.opts.count })), ambushCount: ambush.length };
  });
  t.expect(r.hp0 === 4 && r.afterOne.result === 'hit' && r.afterOne.alive && r.afterOne.hp === 1, `a basic blob (hp ${r.hp0}) survives one starting-blade hit (3 dmg) with ${r.afterOne.hp} hp left`);
  t.expect(r.afterTwo.result === 'killed' && r.afterTwo.dead, 'a basic blob needs 2 starting-blade hits');
  t.expect(r.archers.length === 1 && r.archers[0].of.join() === 'archer' && r.archers[0].count.join() === '2,2', `Barrow Crossing ambushes with an archer pair (${JSON.stringify(r.archers)})`);
  t.expect(r.ambushCount > 0, `The Old Barrow's doorstep is no longer empty (${r.ambushCount} spawn group(s))`);

  // The serpent's one rule reaches the screen, not just the bestiary (fun audit item 4): a toast
  // once the intro's camera returns control, and the tail pulses/sparks while it can be hurt.
  // test-foes is already beaten by now, so this spawns a refight, same as the tombstone above.
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__fk;
    H.clear();
    H.full();
    // toast() drops a repeat of the same text within 2.5 real seconds (ui/toast.js); the boss
    // tests just above already showed this same hint at the end of their own intros, in far less
    // real time than that (simulated ticks, not real frames), so a real wait clears it here.
    await new Promise((resolve) => setTimeout(resolve, 2600));
    h.teleport('test-foes-arena', 11, 13.5);
    await h.tick();
    h.spawn('boss-serpent', 11, 4.5, { dungeon: 'test-foes', refight: true });
    await H.until(() => h.state.mode === 'boss-intro', 240);
    await H.until(() => h.state.mode === 'play', 400);
    const hint = g.bestiary.getBestiaryEntry('boss-serpent')?.text; // SERPENT_HINT, without importing the module here
    const hintShown = !!hint && g.toast.toastView().text === hint && g.toast.toastView().visible;
    const boss = H.of('boss-serpent')[0];
    const tail = boss.tail();
    await H.until(() => tail.glowing, 200);
    const e0 = tail.mat.emissive.getHex();
    // sparkT only ever ticks up again where the tail's own spark timer fires a burst (serpent.js
    // Segment.update): sampling it for a rise, rather than the shared particle pool's live count
    // (which also drains on its own clock), keeps this deterministic.
    let sparked = false;
    let prev = tail.sparkT;
    for (let i = 0; i < 40 && !sparked; i++) {
      await h.tick();
      if (tail.sparkT > prev + 1e-6) sparked = true;
      prev = tail.sparkT;
    }
    const e1 = tail.mat.emissive.getHex();
    const out = { hintShown, pulses: e0 !== e1, sparked };
    H.clear();
    return out;
  });
  t.expect(r.hintShown, "the serpent's tail rule shows as an on-screen hint once the intro hands control back");
  t.expect(r.pulses, "the glowing tail's emissive pulses instead of holding one flat tint");
  t.expect(r.sparked, 'the glowing tail throws off sparks while it can be hurt');
}

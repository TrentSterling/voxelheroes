// The hero kit (gameplay spec 7.2 to 7.10, P0.3 and P0.4 of section 13):
// 8-way movement at 4.5 t/s with the attack facing, corner assist, the
// thrust (timing, rooting, one hit per target, terrain clip, pierce), the
// full-life blade (L10 reaches 9.85; half a heart shrinks it to 1.6 on the
// same tick), the spin (8 dummies in a ring of 2.5), guard, dash, damage
// (90 ticks of blinking, 1 tile of knockback, locked input) and the
// camera-B bounce-back fix. Screenshots: the spin, the guard, the long blade.
export const description = 'Hero kit: movement and facing, corner assist, thrust, full-life blade, spin, terrain clip, guard, dash, damage and knockback, and the B landing dead band.';

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

// In-page helpers, installed once: open ground, walls, dummies, ticking.
const install = (t) =>
  t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = (window.__hk = {});
    H.hero = g.hero.hero;
    H.p = h.player;
    H.clear = () => {
      for (const e of h.entities) if (e.kind === 'enemy' || e.kind === 'projectile' || e.kind === 'pickup') e.remove();
    };
    H.solid = (tx, tz) => h.world.blocked(tx + 0.5, tz + 0.5, 0.05, H.p);
    H.shotSolid = (tx, tz) => h.world.shotBlockedAt(tx + 0.5, tz + 0.5);
    H.freeTile = (tx, tz) => !H.solid(tx, tz) && !H.shotSolid(tx, tz) && !h.world.tileDefAt(tx, tz)?.onEnter && !h.world.tileDefAt(tx, tz)?.hazard;
    // a local tile centre on the current screen with free tiles all round (radius r)
    H.openSpot = (r) => {
      const s = h.screen();
      for (let z = r + 1; z < s.h - r - 1; z++)
        for (let x = r + 1; x < s.w - r - 1; x++) {
          let ok = true;
          for (let dz = -r; dz <= r && ok; dz++) for (let dx = -r; dx <= r && ok; dx++) if (!H.freeTile(s.x0 + x + dx, s.z0 + z + dz)) ok = false;
          if (ok) return [x + 0.5, z + 0.5];
        }
      return null;
    };
    // a solid, shot-stopping tile with `run` free tiles west of it (local)
    H.wallEast = (run) => {
      const s = h.screen();
      for (let z = 1; z < s.h - 1; z++)
        for (let x = run + 1; x < s.w; x++) {
          if (!H.solid(s.x0 + x, s.z0 + z) || !H.shotSolid(s.x0 + x, s.z0 + z) || h.world.tileDefAt(s.x0 + x, s.z0 + z)?.onSword) continue;
          let ok = true;
          for (let k = 1; k <= run && ok; k++) if (!H.freeTile(s.x0 + x - k, s.z0 + z)) ok = false;
          if (ok) return [x, z];
        }
      return null;
    };
    H.ticks = async (n, each) => {
      for (let i = 0; i < n; i++) {
        if (each) each(i);
        await h.tick();
      }
    };
    H.place = (x, z, facing = 'south') => {
      H.p.knockT = 0;
      H.p.stopDash();
      H.p.thrust = null;
      H.p.attackT = 0;
      H.p.invT = 0;
      H.p.lockT = 0;
      H.p.stallT = 0;
      H.hero.place(x, z);
      H.hero.setFacing(facing);
    };
    H.release = () => {
      h.input.setStick(0, 0);
      for (const a of ['guard', 'dash', 'sword', 'item']) h.input.up(a);
    };
    // a dummy that stands still and counts hits (spawned, so the blade may hit it)
    H.dummy = (lx, lz) => {
      const e = h.spawn('slime', lx, lz);
      e.spawned = true;
      e.hp = 999;
      e.maxHp = 999;
      e.hits = 0;
      const hurt = e.hurt.bind(e);
      e.hurt = (hit) => {
        e.hits++;
        hit.knockback = 0;
        hit.stun = 0;
        return hurt({ ...hit, damage: 0 });
      };
      e.update = () => {};
      return e;
    };
    H.full = () => h.setHp(h.state.maxHp);
  });

export default async function hero(t) {
  await t.track('sword-swing', 'enemy-hit', 'hero-hit', 'blade-changed');
  await t.eval(() => window.__voxelHeroes.start());
  await t.step(1.1);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.camera.choose('A');
    h.teleport('Crossroads', 8, 5.5);
  });
  await install(t);
  let r;

  // ---------------------------------------------------------------- movement (P0.3)
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    H.clear();
    const out = { box: H.p.r * 2 };
    const [x, z] = H.openSpot(2) ?? [8, 5.5];
    out.spot = [x, z];
    // 60 ticks east, from the west end of an open row
    let run = 0;
    const s = h.screen();
    for (let row = 1; row < s.h - 1 && !out.row; row++) {
      run = 0;
      for (let col = 0; col < s.w; col++) {
        const ok = H.freeTile(s.x0 + col, s.z0 + row) && H.freeTile(s.x0 + col, s.z0 + row - 1) && H.freeTile(s.x0 + col, s.z0 + row + 1);
        run = ok ? run + 1 : 0;
        if (run >= 7) {
          out.row = [col - 6, row];
          break;
        }
      }
    }
    const [c0, row] = out.row;
    H.place(c0 + 0.5, row + 0.5, 'east');
    const x0 = H.p.x;
    await H.ticks(60, () => h.input.setStick(1, 0));
    out.east = H.p.x - x0;
    // a diagonal covers the same distance
    H.place(x, z, 'north');
    const a = { x: H.p.x, z: H.p.z };
    await H.ticks(10, () => h.input.setStick(0.7071, -0.7071));
    out.diag = Math.hypot(H.p.x - a.x, H.p.z - a.z) / (10 / 60);
    out.facingDiag = H.hero.facing();
    out.yaw = +H.p.yaw.toFixed(3);
    // weak stick past the dead zone: still full speed (8-way, never analog)
    H.place(x, z, 'south');
    const b = H.p.x;
    await H.ticks(10, () => h.input.setStick(0.4, 0));
    out.weak = (H.p.x - b) / (10 / 60);
    // keys pressed while the thrust roots him (the facing holds): facing
    // south, up then right; once free, up-right takes the half pressed last
    H.place(x, z, 'south');
    h.input.setStick(0, 0);
    h.input.tap('sword');
    await h.tick();
    h.input.down('up');
    await h.tick();
    h.input.down('right');
    await H.ticks(24);
    out.lastPressed = H.hero.facing();
    h.input.up('right');
    h.input.up('up');
    // a stick: the half nearer its angle
    H.place(x, z, 'south');
    await h.tick();
    await h.tick();
    h.input.setStick(0.4, -0.9);
    await h.tick();
    out.stickNear = H.hero.facing();
    H.release();
    return out;
  });
  t.expect(near(r.box, 0.8, 1e-9), `the hero's body is a 0.8 box (${r.box})`);
  t.expect(near(r.east, 4.5, 0.01), `60 ticks of right input move 4.5 tiles (${r.east.toFixed(3)})`);
  t.expect(near(r.diag, 4.5, 0.01), `a diagonal also moves 4.5 t/s (${r.diag.toFixed(3)})`);
  t.expect(r.facingDiag === 'north' && near(r.yaw, (3 * Math.PI) / 4, 0.01), `holding up-right after facing up keeps the facing up; the body turns to the diagonal (${r.facingDiag}, yaw ${r.yaw})`);
  t.expect(near(r.weak, 4.5, 0.01), `a weak stick push walks at full speed (${r.weak.toFixed(3)})`);
  t.expect(r.lastPressed === 'east', `facing south with up-right held (keys), the facing takes the half pressed last (${r.lastPressed})`);
  t.expect(r.stickNear === 'north', `on the stick, the half nearer its angle (${r.stickNear})`);

  // ---------------------------------------------------------------- corner assist
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    const s = h.screen();
    // a solid tile T with open ground west, south-west, south and south-east of it
    let T = null;
    for (let z = 2; z < s.h - 3 && !T; z++)
      for (let x = 3; x < s.w - 4 && !T; x++) {
        if (!H.solid(s.x0 + x, s.z0 + z)) continue;
        const free = [[-2, 0], [-1, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]].every(([dx, dz]) => H.freeTile(s.x0 + x + dx, s.z0 + z + dz));
        if (free) T = [x, z];
      }
    if (!T) return { none: true };
    const run = async (assist) => {
      h.state.settings.cornerAssist = assist;
      // his box overlaps T's row by 0.2 tile
      H.place(T[0] - 1, T[1] + 1 + 0.4 - 0.2, 'east');
      await H.ticks(40, () => h.input.setStick(1, 0));
      H.release();
      return { x: +(H.p.x - s.x0).toFixed(3), z: +(H.p.z - s.z0).toFixed(3) };
    };
    const on = await run(true);
    const off = await run(false);
    h.state.settings.cornerAssist = true;
    return { T, on, off };
  });
  t.expect(!r.none, 'found a corner to test on');
  if (!r.none) {
    t.expect(r.on.x > r.T[0] + 1.4 && r.on.z >= r.T[1] + 1.4 - 1e-6, `corner assist: 0.2 tile onto a corner he slides past it (${r.on.x}, ${r.on.z}; corner tile ${r.T})`);
    t.expect(r.off.x < r.T[0] - 0.39, `without the option he snags on it (${r.off.x})`);
  }

  // ---------------------------------------------------------------- thrust
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    const T = h.game.tuning.TUNING.sword;
    H.clear();
    H.full();
    const [x, z] = H.openSpot(3);
    H.place(x, z, 'east');
    const out = { spot: [x, z] };
    const d = H.dummy(x + 2, z);
    const swings0 = window.__hkSwings ?? 0;
    h.input.tap('sword');
    await h.tick();
    out.afterOne = +(H.p.thrust.reach - T.handOffset).toFixed(3);
    await h.tick();
    out.afterTwo = +H.p.thrust.reach.toFixed(3);
    out.fullReach = H.hero.blade().reach;
    // rooted during the hold; a press in the hold does nothing
    const x0 = H.p.x;
    await H.ticks(10, () => h.input.setStick(0, 1));
    out.rooted = +(H.p.x - x0).toFixed(4) === 0 && +(H.p.z - z - h.screen().z0).toFixed(4) === 0;
    const id = H.p.thrust.id;
    h.input.tap('sword');
    await h.tick();
    out.sameThrust = H.p.thrust.id === id;
    // run to the last tick of the hold (13 ticks so far; extend + hold from TUNING), then the retract
    await H.ticks(Math.max(0, Math.round((T.extend + T.hold) * 60) - 14), () => h.input.setStick(0, 0));
    out.inHold = H.p.thrust.t < T.extend + T.hold;
    await h.tick();
    out.retracting = H.p.thrust.t >= T.extend + T.hold - 1e-9;
    const xr = H.p.x;
    await H.ticks(2, () => h.input.setStick(1, 0));
    out.walksInRetract = H.p.x > xr;
    h.input.setStick(0, 0);
    h.input.tap('sword');
    await h.tick();
    out.newFromRetract = H.p.thrust && H.p.thrust.id !== id && H.p.thrust.t < 0.02;
    await H.ticks(30);
    out.dummyHits = d.hits;
    d.remove();
    H.release();
    return out;
  });
  const swings = (await t.events('sword-swing')).length;
  t.expect(near(r.afterTwo, r.fullReach, 1e-6) && r.afterOne > 0 && r.afterOne < r.afterTwo, `the thrust extends in 2 ticks (half out after one: ${r.afterOne}; ${r.afterTwo} of ${r.fullReach} after two)`);
  t.expect(r.rooted && r.sameThrust && r.inHold, 'he is rooted through the hold, and a press in the hold starts nothing');
  t.expect(r.retracting && r.walksInRetract, 'he can walk once the blade retracts');
  t.expect(r.newFromRetract, 'a press in the retract starts a new thrust at once');
  t.expect(r.dummyHits === 2, `each thrust hits the dummy once (2 thrusts, ${r.dummyHits} hits)`);
  t.expect(swings >= 2, `'sword-swing' fires per thrust (${swings})`);

  // ---------------------------------------------------------------- the full-life blade (P0.4)
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    const S = h.game.swords;
    if (!S.getSword('probe-long')) S.registerSword({ id: 'probe-long', name: 'Probe Long', base: { length: 10, strength: 3, spin: 1, pierce: 1 } });
    if (!S.getSword('probe-pierce')) S.registerSword({ id: 'probe-pierce', name: 'Probe Pierce', base: { strength: 3, pierce: 1 } });
    S.giveSword('probe-long');
    S.giveSword('probe-pierce');
    S.equipSword('probe-long');
    H.clear();
    H.full();
    const [x, z] = H.openSpot(2);
    H.place(x, z, 'east');
    const out = {};
    out.fullReach = +H.hero.blade().reach.toFixed(3);
    h.input.tap('sword');
    await H.ticks(2);
    out.thrustReach = +H.p.thrust.reach.toFixed(3);
    await H.ticks(4);
    out.slab = H.p.hero.swordPivot.getObjectByName('long-blade')?.visible === true && H.p.hero.sword.visible === false;
    // one half-heart hit: the small blade on the same tick
    H.hero.receiveHit({ damage: 1, kind: 'hazard', knockback: false });
    out.hurtReach = +H.hero.blade().reach.toFixed(3);
    out.small = H.hero.blade().small;
    await h.tick();
    out.thrustAfter = +H.p.thrust.reach.toFixed(3);
    await H.ticks(30);
    H.full();
    out.backReach = +H.hero.blade().reach.toFixed(3);
    await h.tick(); // direct writes (the test's setHp) are reported on the next tick
    H.release();
    return out;
  });
  t.expect(near(r.fullReach, 9.85, 1e-6) && near(r.thrustReach, 9.85, 1e-6), `at full life with L10 the thrust reaches 9.85 tiles (${r.fullReach}, thrust ${r.thrustReach})`);
  t.expect(r.slab, 'the full blade is the long white slab, not the small sword');
  t.expect(near(r.hurtReach, 1.6, 1e-6) && r.small && r.thrustAfter <= 1.6 + 1e-6, `half a heart of damage shrinks the reach to 1.6 on the same tick (${r.hurtReach}; the blade out ${r.thrustAfter})`);
  t.expect(near(r.backReach, 9.85, 1e-6), `full life again: the long blade is back (${r.backReach})`);
  const changes = (await t.events('blade-changed')).map((e) => e.full).join(',');
  t.expect(/false,true/.test(changes), `'blade-changed' reports the swap both ways (${changes})`);

  // long-blade screenshot
  await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    H.clear();
    const [x, z] = H.openSpot(2);
    H.place(x, z, 'north');
    h.input.tap('sword');
    await H.ticks(6);
  });
  await t.shot('hero-long-blade');
  await t.step(0.5);

  // ---------------------------------------------------------------- spin (P0.4)
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    h.game.swords.equipSword('blade-start');
    H.clear();
    H.full();
    const [x, z] = H.openSpot(3);
    H.place(x, z, 'north');
    const ring = [];
    for (let i = 0; i < 8; i++) ring.push(H.dummy(x + 2.5 * Math.sin((i * Math.PI) / 4), z - 2.5 * Math.cos((i * Math.PI) / 4)));
    // press with the stick north, then twist it clockwise a quarter at a time
    const seq = [0, 2, 2, 2, 2, 4, 4, 4, 4, 6, 6, 6, 6, 0, 0, 0, 0, 2, 2, 2];
    const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    h.input.setStick(0, -1);
    h.input.tap('sword');
    await h.tick();
    let shotAt = null;
    for (let i = 1; i < seq.length; i++) {
      const [sx, sz] = dirs[seq[i]];
      h.input.setStick(sx, sz);
      await h.tick();
      if (i === 11) shotAt = H.p.thrust?.swept;
      if (i === 11) break;
    }
    return { spot: [x, z], shotAt, ringIds: ring.map((e) => e.id) };
  });
  await t.shot('hero-spin');
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    const seq = [0, 0, 0, 0, 2, 2, 2, 2, 2];
    const dirs = [[0, -1], [1, -1], [1, 0]];
    for (const d of seq) {
      const [sx, sz] = dirs[d];
      h.input.setStick(sx, sz);
      await h.tick();
    }
    h.input.setStick(0, 0);
    const dummies = h.entities.filter((e) => e.kind === 'enemy');
    const out = { hits: dummies.map((e) => e.hits), turned: 0 };
    await H.ticks(20);
    for (const e of dummies) e.remove();
    // below full life: no spin
    H.hero.receiveHit({ damage: 1, kind: 'hazard', knockback: false });
    H.place(H.p.x - h.screen().x0, H.p.z - h.screen().z0, 'north');
    h.input.setStick(0, -1);
    h.input.tap('sword');
    await h.tick();
    await H.ticks(10, () => h.input.setStick(1, 0));
    out.smallTurned = H.p.thrust?.turned ?? -1;
    await H.ticks(20);
    H.full();
    H.release();
    return out;
  });
  t.expect(r.hits.length === 8 && r.hits.every((n) => n === 1), `one 360-degree spin at full life hits all 8 dummies in a ring of 2.5, each once (${r.hits})`);
  t.expect(r.smallTurned === 0, 'below full life the blade does not spin');

  // ---------------------------------------------------------------- terrain clip
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    H.clear();
    H.full();
    const W = H.wallEast(3);
    if (!W) return { none: true };
    const out = { wall: W };
    const run = async (id) => {
      h.game.swords.equipSword(id);
      H.place(W[0] - 2, W[1] + 0.5, 'east');
      h.input.tap('sword');
      await H.ticks(4);
      const reach = +H.p.thrust.reach.toFixed(3);
      await H.ticks(30);
      return reach;
    };
    out.plain = await run('blade-start');
    out.pierce = await run('probe-pierce');
    h.game.swords.equipSword('blade-start');
    return out;
  });
  t.expect(!r.none, 'found a wall to test the clip on');
  if (!r.none) {
    t.expect(r.plain >= 1.8 && r.plain <= 2.05, `without pierce the blade stops at a wall 2 tiles away (reach ${r.plain})`);
    t.expect(near(r.pierce, 2.85, 1e-6), `with pierce it passes (reach ${r.pierce})`);
  }

  // ---------------------------------------------------------------- damage (P0.4, spec 7.10)
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    H.clear();
    H.full();
    const [x, z] = H.openSpot(2);
    H.place(x, z, 'north');
    const x0 = H.p.x;
    const out = {};
    out.result = H.hero.receiveHit({ damage: 1, from: { x: H.p.x + 1, z: H.p.z }, kind: 'contact' });
    let ticks = 0;
    while (H.hero.isInvulnerable() && ticks < 200) {
      h.input.setStick(ticks < 20 ? 1 : 0, 0);
      await h.tick();
      ticks++;
      if (ticks === 9) out.knock = +(x0 - H.p.x).toFixed(3);
      if (ticks === 14) out.lockedStill = +(x0 - H.p.x).toFixed(3); // locked: the stick east does nothing
    }
    out.ticks = ticks;
    H.release();
    H.full();
    return out;
  });
  t.expect(r.result === 'hit' && r.ticks === 90, `a hit gives 90 ticks of invulnerability (${r.ticks})`);
  t.expect(near(r.knock, 1.0, 0.02), `and knocks him 1.0 tile away over 0.15 s (${r.knock})`);
  t.expect(near(r.lockedStill, r.knock, 1e-3), `input stays locked for 0.25 s (${r.lockedStill})`);

  // ---------------------------------------------------------------- guard (spec 7.8)
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    H.clear();
    H.full();
    h.state.gear.shield = Math.max(1, h.state.gear.shield ?? 0);
    const [x, z] = H.openSpot(2);
    H.place(x, z, 'south');
    const out = {};
    h.input.down('guard');
    await h.tick();
    out.up = H.hero.isGuarding();
    const x0 = H.p.x;
    await H.ticks(30, () => h.input.setStick(1, 0));
    out.speed = (H.p.x - x0) / 0.5;
    out.facing = H.hero.facing();
    out.yaw = +H.p.yaw.toFixed(3);
    out.shieldShown = !!H.p.hero.body.getObjectByName('guard-shield');
    h.input.setStick(0, 0);
    await h.tick();
    return out;
  });
  await t.shot('hero-guard');
  r = await t.eval(async (out) => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    const z0 = H.p.z;
    out.front = H.hero.receiveHit({ damage: 2, from: { x: H.p.x, z: H.p.z + 1 }, kind: 'contact' });
    await H.ticks(6);
    out.push = +(z0 - H.p.z).toFixed(3);
    out.back = H.hero.receiveHit({ damage: 1, from: { x: H.p.x, z: H.p.z - 1 }, kind: 'contact' });
    H.p.invT = 0;
    H.p.lockT = 0;
    await H.ticks(20);
    // attack while guarding: a thrust, then the guard comes back
    h.input.tap('sword');
    await h.tick();
    out.thrustDrops = !!H.p.thrust && !H.hero.isGuarding();
    await H.ticks(30);
    out.back2 = H.hero.isGuarding();
    return out;
  }, r);
  await t.eval(() => window.__hk.release());
  t.expect(r.up && r.shieldShown, 'holding guard raises the shield (the guard model shows)');
  t.expect(near(r.speed, 2.25, 0.01), `guarding he walks at half speed (${r.speed.toFixed(3)} t/s)`);
  t.expect(r.facing === 'south' && near(r.yaw, 0, 0.01), `the facing locks while guarding (${r.facing}, yaw ${r.yaw})`);
  t.expect(r.front === 'blocked' && near(r.push, 0.3, 0.02), `a contact hit from the front is blocked and pushes him back 0.3 tile (${r.push})`);
  t.expect(r.back === 'hit', 'a hit from behind gets through');
  t.expect(r.thrustDrops && r.back2, 'attacking while guarding thrusts, and the guard comes back while the button is held');

  // ---------------------------------------------------------------- dash (spec 7.9)
  r = await t.eval(async () => {
    const H = window.__hk;
    const h = window.__voxelHeroes;
    const W = h.game.tuning.TUNING.hero.walk;
    H.clear();
    const out = {};
    // no boots: no dash
    h.state.gear.boots = null;
    const [x, z] = H.openSpot(2);
    H.place(x, z, 'east');
    h.input.tap('dash');
    await h.tick();
    out.noBoots = !H.p.dashing;
    h.state.gear.boots = 'boots-dash';
    // small blade, so the blade does not crash on the first scenery
    H.hero.receiveHit({ damage: 1, kind: 'hazard', knockback: false });
    H.place(x, z, 'east');
    h.input.tap('dash');
    await h.tick();
    out.dashing = !!H.p.dashing;
    // it revs in place first (no movement), then charges
    const rx = H.p.x;
    let rev = 0;
    while (H.p.dashing?.rev > 0 && rev < 30) {
      await h.tick();
      rev++;
    }
    out.revTicks = rev;
    out.revStill = Math.abs(H.p.x - rx) < 1e-6;
    out.v0 = H.p.dashing ? +(H.p.dashing.speed / W).toFixed(3) : 0;
    await H.ticks(11, () => h.input.setStick(1, 0));
    out.v10 = H.p.dashing ? +(H.p.dashing.speed / W).toFixed(4) : 0;
    // a 90-degree turn adds 0.25 x walking speed
    const before = H.p.dashing?.speed ?? 0;
    h.input.setStick(0, 1);
    await h.tick();
    out.turn = H.p.dashing ? +((H.p.dashing.speed - before) / W).toFixed(4) : 0;
    out.dir = H.p.dashing?.dir;
    // a neutral stick keeps it going; held against it, it brakes
    h.input.setStick(0, 0);
    await H.ticks(6);
    out.neutralKeeps = !!H.p.dashing;
    h.input.setStick(0, -1);
    let n = 0;
    while (H.p.dashing && n < 30) {
      await h.tick();
      n++;
    }
    h.input.setStick(0, 0);
    out.brakeTicks = n;
    // guard stops it
    H.place(x, z, 'east');
    h.input.tap('dash');
    await h.tick();
    h.input.down('guard');
    await h.tick();
    out.guardStops = !H.p.dashing;
    h.input.up('guard');
    // crash into a wall
    const Wl = H.wallEast(4);
    out.wall = Wl;
    if (Wl) {
      H.place(Wl[0] - 3, Wl[1] + 0.5, 'east');
      h.input.tap('dash');
      let k = 0;
      while (k < 60) {
        h.input.setStick(1, 0);
        await h.tick();
        k++;
        if (!H.p.dashing) break;
      }
      out.crashed = !H.p.dashing && H.p.knockT > 0;
      const cx = H.p.x;
      await H.ticks(9);
      out.bounce = +(cx - H.p.x).toFixed(3);
      const sx = H.p.x;
      await H.ticks(20, () => h.input.setStick(-1, 0));
      out.stalled = near(H.p.x, sx);
      await H.ticks(10, () => h.input.setStick(-1, 0));
      out.walksAfter = H.p.x < sx - 0.1;
    }
    H.release();
    H.full();
    return out;
    function near(a, b) {
      return Math.abs(a - b) < 1e-6;
    }
  });
  t.expect(r.noBoots, 'no dash without boots');
  t.expect(r.dashing && r.revStill && r.revTicks >= 10 && r.revTicks <= 13, `with boots, the dash revs in place for about 0.2 s first (${r.revTicks} ticks)`);
  t.expect(near(r.v0, 2.0, 0.01), `then charges at 2.0 x walking speed (${r.v0})`);
  t.expect(near(r.v10, 2.0 + 0.25 * (11 / 60), 0.01), `it gains 0.25 x walking speed per second (${r.v10})`);
  t.expect(r.dir === 'south' && near(r.turn, 0.25 + 0.25 / 60, 0.005), `a 90-degree turn steers it and adds 0.25 x walking speed (${r.dir}, +${r.turn})`);
  t.expect(r.neutralKeeps && r.brakeTicks >= 5 && r.brakeTicks <= 8, `a neutral stick keeps it going; held against it for 0.1 s it stops (${r.brakeTicks} ticks)`);
  t.expect(r.guardStops, 'pressing guard stops it');
  t.expect(!!r.wall && r.crashed && near(r.bounce, 0.5, 0.05) && r.stalled && r.walksAfter, `a dash into a wall crashes: 0.5 tile back, a stall, then he walks (${r.bounce})`);

  // ---------------------------------------------------------------- camera B: no bounce back
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const H = window.__hk;
    h.camera.choose('B');
    // Cairn Ridge is north of the Crossroads in this area: walk north over the edge
    h.teleport('Crossroads', 8, 1.5);
    H.clear();
    await h.step(0.1);
    const from = h.state.screenKey;
    const out = { from };
    let k = 0;
    while (h.state.screenKey === from && k < 120) {
      h.input.setStick(0, -1);
      await h.tick();
      k++;
    }
    h.input.setStick(0, 0);
    let w = 0;
    while (h.state.mode !== 'play' && w < 200) {
      await h.tick();
      w++;
    }
    const s = h.screen();
    const line = h.camera.rules.southLine();
    out.to = h.state.screenKey;
    out.past = +(s.z1 - line - h.player.z).toFixed(3);
    // step back south 0.9 tile: still on the new screen
    const key = h.state.screenKey;
    await H.ticks(12, () => h.input.setStick(0, 1));
    out.stays = h.state.screenKey === key && h.state.mode === 'play';
    await H.ticks(6, () => h.input.setStick(0, 1));
    h.input.setStick(0, 0);
    out.backAfter = h.state.screenKey !== key || h.state.mode === 'scroll';
    for (let i = 0; i < 80 && h.state.mode !== 'play'; i++) await h.tick();
    h.camera.choose('A');
    return out;
  });
  t.expect(r.to !== r.from && near(r.past, 1.0, 0.03), `camera B: a slide north lands him 1.0 tile past the new screen's south line (${r.past})`);
  t.expect(r.stays && r.backAfter, 'a step back does not slide him straight back; walking the full tile does');
}

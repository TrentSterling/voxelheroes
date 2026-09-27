// The M2 contracts (docs/CONTRACTS.md), one check each, so the seven
// streams start from code that works: TUNING and the fixed step, the event
// catalogue, input actions on keyboard, gamepad and touch, the shared state
// fields and their saving, life, magic and money, classes and difficulty,
// the hero API (facing, receiveHit, guard, lock, poses, pits, revive),
// damage to enemies, projectiles and the reflect spell, swords and the
// smith, spells, dungeons and their entrance respawn, shops and inns, save
// slots, the bestiary, music, loading cards, settings, prompts, pickups and
// grants with the item get.
//
// Everything goes through window.__voxelHeroes.game (src/game/testapi.js).
// Runtime content (a sword, spell, dungeon, shop, entity) is prefixed "probe".
export const description =
  'M2 contracts: tuning, fixed step, events, input (keys, pad, touch), state and saves, vitals, classes, hero API, damage, projectiles, swords, spells, dungeons, shops, inns, slots, bestiary, music, cards, settings, prompts, pickups, grants.';

const DT = 1 / 60;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

export default async function contractsM2(t) {
  const kb = t.page.keyboard;
  await t.page.waitForFunction(() => !!window.__voxelHeroes?.game, null, { timeout: 10000 });
  await t.eval(() => {
    const g = window.__voxelHeroes.game;
    window.__allEvents = new Set();
    g.events.onAny((name) => window.__allEvents.add(name));
  });
  await t.track(
    'life-changed',
    'magic-changed',
    'coins-changed',
    'new-game',
    'hero-hit',
    'player-revived',
    'hero-respawn',
    'hero-pose',
    'enemy-hit',
    'sword-swing',
    'sword-found',
    'sword-upgrade',
    'sword-reset',
    'spell-learned',
    'spell-cast',
    'effect-start',
    'effect-end',
    'dungeon-enter',
    'dungeon-leave',
    'boss-defeated',
    'dungeon-complete',
    'keys-changed',
    'shop-buy',
    'inn-rest',
    'saved',
    'loaded',
    'music-change',
    'settings-changed',
    'item-get',
    'pickup',
    'screen-visited'
  );
  const count = async (name) => (await t.events(name)).length;
  const last = async (name) => (await t.events(name)).pop() ?? null;
  let s;
  let r;

  // ---------------------------------------------------------------- tuning and the step
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const { TUNING, ticks, TICK } = g.tuning;
    const { advance, STEP, MAX_STEPS } = g.loop;
    return {
      hz: TUNING.sim.hz,
      tick: TICK,
      step: STEP,
      lock: ticks(TUNING.damage.knockLock),
      walk: TUNING.hero.walk,
      reach10: TUNING.sword.handOffset + TUNING.sword.length(10),
      one: advance(0, 1 / 60),
      slow: advance(0, 0.5),
      part: advance(0.01, 0.01),
      max: MAX_STEPS,
      options: Object.keys(TUNING.options).length,
    };
  });
  t.expect(r.hz === 60 && near(r.tick, 1 / 60) && near(r.step, 1 / 60), 'the simulation steps at 60 Hz (TUNING.sim.hz, TICK, loop STEP)');
  t.expect(r.lock === 15 && r.walk === 4.5, `TUNING reads in spec units: knock lock ${r.lock} ticks, walk ${r.walk} t/s`);
  t.expect(near(r.reach10, 9.85), `an L10 blade reaches ${r.reach10} tiles`);
  t.expect(r.one.steps === 1 && r.slow.steps === r.max && r.slow.acc === 0 && r.part.steps === 1 && near(r.part.acc, 0.02 - 1 / 60, 1e-9), 'the accumulator runs whole ticks and drops a backlog past MAX_STEPS');

  // ---------------------------------------------------------------- start
  await t.press('Enter');
  await t.step(1.1);
  s = await t.state();
  t.expect(s.mode === 'play' && s.screenName === 'Crossroads', 'the game starts at the Crossroads');

  // ---------------------------------------------------------------- input
  r = await t.eval(() => {
    const { ACTIONS, input } = window.__voxelHeroes.game.input;
    const b = input.bindings();
    return { clashes: input.clashes(), play: ACTIONS.play.join(','), sword: b.keys.sword.join(','), mute: b.keys.mute.join(','), map: b.keys.map.join(','), dash: b.keys.dash.join(','), padGuard: b.pad.guard[0], touch: b.touch['btn-dash'] };
  });
  t.expect(r.clashes.length === 0, `no key or button means two actions in one context (${JSON.stringify(r.clashes)})`);
  t.expect(r.sword === 'KeyJ,KeyZ' && r.dash === 'Space' && r.map === 'KeyM' && r.mute === 'KeyN', 'keyboard: sword J/Z, dash Space, map M, mute N');
  t.expect(r.padGuard === 5 && r.touch === 'dash', 'gamepad RB guards; the touch D button dashes');

  await t.eval(() => {
    const h = window.__voxelHeroes;
    window.__acts = [];
    h.api.registerPlayHook({
      id: 'probe-actions',
      phase: 'input',
      order: 5,
      update() {
        for (const a of ['map', 'dash', 'inventory', 'item', 'prev-item', 'next-item']) if (h.input.pressed(a)) window.__acts.push(a);
      },
    });
  });
  let swings = await count('sword-swing');
  await t.press('KeyM');
  await t.press('Space');
  await t.press('Tab');
  await t.press('KeyE');
  r = await t.eval(() => ({ acts: window.__acts.join(','), muted: window.__voxelHeroes.state.settings.muted }));
  t.expect(r.acts === 'map,dash,inventory,next-item' && !r.muted, `M, Space, Tab and E press map, dash, inventory and next-item in play (${r.acts}), and M does not mute`);
  t.expect((await count('sword-swing')) === swings, 'Space no longer swings the sword');
  await t.press('KeyN');
  r = await t.eval(() => ({ muted: window.__voxelHeroes.state.settings.muted, audio: window.__voxelHeroes.game.audio.isMuted(), label: document.getElementById('mute').textContent }));
  t.expect(r.muted && r.audio && r.label === 'Sound off', 'N mutes (the muted setting, the audio and the Sound button agree)');
  await t.press('KeyN');
  t.expect(!(await t.eval(() => window.__voxelHeroes.state.settings.muted)), 'N again unmutes');
  swings = await count('sword-swing');
  await t.press('KeyJ');
  t.expect((await count('sword-swing')) === swings + 1, 'J swings');
  await t.step(0.5);

  await kb.down('Shift');
  await t.step(DT);
  r = await t.eval(() => window.__voxelHeroes.game.hero.hero.isGuarding());
  await kb.up('Shift');
  await t.step(DT);
  t.expect(r && !(await t.eval(() => window.__voxelHeroes.game.hero.hero.isGuarding())), 'holding Shift raises the guard; letting go lowers it');

  // A fake standard-mapping gamepad.
  await t.eval(() => {
    window.__pad = { button: -1, axes: [0, 0] };
    window.__voxelHeroes.game.input.input.setPadSource(() => [
      {
        connected: true,
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === window.__pad.button, value: i === window.__pad.button ? 1 : 0 })),
        axes: window.__pad.axes,
      },
    ]);
  });
  swings = await count('sword-swing');
  await t.eval(() => (window.__pad.button = 0));
  await t.step(DT);
  await t.eval(() => (window.__pad.button = -1));
  await t.step(0.5);
  r = await t.eval(() => window.__voxelHeroes.game.input.input.lastDevice());
  t.expect((await count('sword-swing')) === swings + 1 && r === 'gamepad', 'gamepad A (button 0) swings once, and the last device is the gamepad');
  s = await t.state();
  await t.eval(() => (window.__pad.axes = [0.25, 0]));
  await t.step(0.3);
  const still = await t.state();
  await t.eval(() => (window.__pad.axes = [1, 0]));
  await t.step(0.3);
  const moved = await t.state();
  await t.eval(() => {
    window.__pad.axes = [0, 0];
    window.__voxelHeroes.game.input.input.setPadSource(null);
  });
  t.expect(near(still.x, s.x, 1e-3) && moved.x - still.x > 0.8, `the left stick has a 0.3 dead zone and walks east when pushed (${s.x} -> ${still.x} -> ${moved.x})`);

  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const inp = h.input;
    const btn = document.getElementById('btn-dash');
    const out = {};
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch' }));
    out.held = inp.held('dash');
    out.pressed = inp.pressed('dash');
    out.device = inp.lastDevice();
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch' }));
    out.released = inp.released('dash') && !inp.held('dash');
    await h.tick();
    inp.setStick(0.7, -0.7);
    out.m8 = inp.move8();
    inp.setStick(0, 0);
    out.idle = inp.move8().dir;
    out.buttons = ['btn-a', 'btn-b', 'btn-dash', 'btn-guard', 'btn-map', 'btn-inv', 'btn-start'].filter((id) => document.getElementById(id)).length;
    return out;
  });
  t.expect(r.held && r.pressed && r.released && r.device === 'touch', 'the touch D button presses, holds and releases dash');
  t.expect(r.m8.dir === 1 && near(r.m8.x, Math.SQRT1_2, 1e-4) && near(r.m8.z, -Math.SQRT1_2, 1e-4) && r.idle === -1, 'move8 snaps the stick to 8 directions (north-east: 1)');
  t.expect(r.buttons === 7, 'index.html has all seven touch buttons');
  await t.eval(() => {
    document.getElementById('touch').hidden = false;
  });
  await t.page.setViewportSize({ width: 390, height: 844 });
  await t.step(DT);
  await t.shot('01-touch-phone');
  r = await t.eval(() => {
    const ids = ['stick', 'btn-map', 'btn-inv', 'btn-start', 'btn-guard', 'btn-dash', 'btn-a'];
    return ids.map((id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      return { id, left: b.left, right: b.right };
    });
  });
  await t.page.setViewportSize({ width: 1280, height: 720 });
  await t.eval(() => {
    document.getElementById('touch').hidden = true;
  });
  t.expect(r.every((b) => b.left >= 0 && b.right <= 390), `the touch controls fit a 390 px phone (${r.map((b) => `${b.id} ${Math.round(b.left)}-${Math.round(b.right)}`).join(', ')})`);

  // ---------------------------------------------------------------- state fields and saving
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const st = h.state;
    const fields = Object.keys(g.state.serializeState().fields);
    return {
      fields,
      version: g.state.SAVE_VERSION,
      alias: st.gems === st.coins,
      defaults: [st.coins, st.magic, st.maxMagic, st.heartPieces, st.tokens, st.profile.class, st.gear.shield, st.swords.equipped, st.swords.owned.join(','), st.bottles.length, st.colorKeys.red, st.deaths],
    };
  });
  const want = ['hp', 'maxHp', 'coins', 'keys', 'flags', 'heartPieces', 'magic', 'maxMagic', 'tokens', 'profile', 'gear', 'swords', 'bags', 'bottles', 'colorKeys', 'visited', 'visitedAreas', 'cardsSeen', 'bestiary', 'shops', 'playTime', 'deaths', 'inventory'];
  t.expect(want.every((f) => r.fields.includes(f)), `every shared field is saved (missing: ${want.filter((f) => !r.fields.includes(f)).join(', ') || 'none'})`);
  t.expect(!r.fields.includes('gems') && !r.fields.includes('effects'), 'the save has coins, not gems, and no runtime effects');
  t.expect(r.version === 2 && r.alias, 'SAVE_VERSION is 2 and state.gems reads state.coins');
  t.expect(JSON.stringify(r.defaults) === JSON.stringify([0, 0, 0, 0, 0, null, 1, 'blade-start', 'blade-start', 0, 0, 0]), `new-game defaults (${JSON.stringify(r.defaults)})`);

  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const st = h.state;
    const out = {};
    st.coins = 123;
    st.visited.add('probe:9,9');
    st.bestiary.seen.probe = 2;
    const data = JSON.parse(JSON.stringify(h.save()));
    out.visitedIsList = Array.isArray(data.fields.visited) && data.fields.visited.includes('probe:9,9');
    h.load(data);
    out.visitedIsSet = st.visited instanceof Set && st.visited.has('probe:9,9');
    out.coins = st.coins;
    out.seen = st.bestiary.seen.probe;
    const m1 = { version: 1, fields: { ...data.fields, gems: 42 } };
    delete m1.fields.coins;
    h.load(m1);
    out.migrated = st.coins;
    try {
      h.load({ ...data, version: 3 });
      out.newer = 'loaded';
    } catch (e) {
      out.newer = e.message;
    }
    st.coins = 0;
    st.visited.delete('probe:9,9');
    delete st.bestiary.seen.probe;
    return out;
  });
  t.expect(r.visitedIsList && r.visitedIsSet && r.coins === 123 && r.seen === 2, 'sets save as lists and load back as sets; plain fields round-trip');
  t.expect(r.migrated === 42, 'a version 1 save loads with its gems as coins (SAVE_MIGRATIONS[1])');
  t.expect(/newer version/.test(r.newer), 'a save from a newer version is refused');

  // ---------------------------------------------------------------- vitals
  const lifeBefore = await count('life-changed');
  r = await t.eval(() => {
    const V = window.__voxelHeroes.game.vitals;
    const st = window.__voxelHeroes.state;
    const out = {};
    out.set = V.setLife(3, 'probe');
    out.heal = V.heal(2);
    out.cap = V.heal(10);
    out.full = V.isFullLife();
    out.hp = st.hp;
    out.coinsMax = (V.addCoins(20000), st.coins);
    out.short = V.spendCoins(10000);
    out.spent = V.spendCoins(9999) && st.coins === 0;
    out.noMagic = V.spendMagic(1);
    V.addMaxMagic(2);
    out.magic = [st.magic, st.maxMagic];
    out.cast = V.spendMagic(1) && st.magic === 1;
    V.restoreMagic(5);
    out.refilled = st.magic;
    V.addHeartPiece(3);
    out.pieces3 = [st.heartPieces, st.maxHp];
    V.addHeartPiece(1);
    out.pieces4 = [st.heartPieces, st.maxHp, st.hp];
    st.hp = 4; // a write that bypasses vitals.js
    return out;
  });
  t.expect(r.set === -3 && r.heal === 2 && r.cap === 1 && r.full && r.hp === 6, 'setLife and heal report the change and stop at max life');
  t.expect(r.coinsMax === 9999 && r.short === false && r.spent, 'coins stop at the 9,999 wallet; spending more than you have fails');
  t.expect(r.noMagic === false && r.magic[0] === 2 && r.magic[1] === 2 && r.cast && r.refilled === 2, 'magic: spend fails when short, containers fill, restore stops at max');
  t.expect(r.pieces3[0] === 3 && r.pieces3[1] === 6 && r.pieces4[0] === 4 && r.pieces4[1] === 8 && r.pieces4[2] === 8, 'the fourth heart piece adds a heart and refills');
  await t.step(DT);
  const lives = (await t.events('life-changed')).slice(lifeBefore);
  t.expect(lives[0].reason === 'probe' && lives[0].delta === -3, "'life-changed' carries the reason and delta");
  t.expect(lives.some((e) => e.reason === 'heart-piece') && lives[lives.length - 1].reason === 'direct' && lives[lives.length - 1].hp === 4, "a direct write to state.hp is reported next tick as 'direct'");
  t.expect((await last('coins-changed')).coins === 0 && (await last('magic-changed')).magic === 2, "'coins-changed' and 'magic-changed' fire");

  // ---------------------------------------------------------------- classes and difficulty
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const st = window.__voxelHeroes.state;
    const out = {};
    try {
      g.progress.applyProfile({ class: 'wizard' });
      out.bad = 'accepted';
    } catch (e) {
      out.bad = e.message;
    }
    const p = g.progress.startNewGame({ name: ' Ada<>! ', class: 'balanced', trait: 'focus' });
    out.profile = p;
    out.vitals = [st.hp, st.maxHp, st.magic, st.maxMagic, st.coins, st.heartPieces];
    out.mode = st.mode;
    out.name = g.progress.heroName();
    const dmg = () => g.hero.damageTaken(3);
    out.normal = dmg();
    st.gear.ring = 'ring-quarter';
    out.quarter = dmg();
    st.gear.ring = 'ring-half';
    out.half = dmg();
    st.profile.difficulty = 'hard';
    out.hardHalf = dmg();
    st.gear.ring = null;
    out.hard = dmg();
    st.profile.difficulty = 'one-hit';
    out.oneHit = g.hero.damageTaken(1) === st.hp;
    st.profile.difficulty = 'normal';
    return out;
  });
  t.expect(/Unknown class "wizard"/.test(r.bad), 'an unknown class is refused');
  t.expect(r.profile.name === 'Ada' && r.name === 'Ada' && r.profile.class === 'balanced' && r.profile.trait === 'focus', `names are cleaned ("${r.profile.name}")`);
  t.expect(JSON.stringify(r.vitals) === '[8,8,4,4,0,0]' && r.mode === 'play', `a balanced hero starts with 4 hearts and 4 magic, in play (${r.vitals})`);
  t.expect((await last('new-game')) !== null, "startNewGame fires 'new-game'");
  t.expect(r.normal === 3 && r.quarter === 2 && r.half === 1 && r.hardHalf === 3 && r.hard === 6 && r.oneHit, `damage = max(1, floor(base x mode x (1 - ring))): ${r.normal}, ${r.quarter}, ${r.half}, hard ${r.hardHalf}/${r.hard}, one-hit kills`);

  // ---------------------------------------------------------------- hero API
  await t.step(1.2); // the start blink wears off
  r = await t.eval(() => {
    const { hero, facingFromYaw } = window.__voxelHeroes.game.hero;
    const p = window.__voxelHeroes.player;
    const out = {};
    out.yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(facingFromYaw).join(',');
    p.yaw = Math.PI / 2;
    out.facing = hero.facing();
    out.vec = hero.facingVector();
    p.yaw = 0;
    const pos = hero.position();
    out.local = [pos.lx, pos.lz];
    out.full = hero.isFullLife();
    return out;
  });
  t.expect(r.yaws === 'south,east,north,west' && r.facing === 'east' && r.vec.x === 1 && r.vec.z === 0, 'facing: the cardinal nearest the yaw (0 faces south)');
  t.expect(near(r.local[0], 8, 0.01) && near(r.local[1], 5.5, 0.01) && r.full, `position() gives local tiles (${r.local})`);

  await kb.down('Shift');
  await t.step(DT);
  r = await t.eval(() => {
    const { hero } = window.__voxelHeroes.game.hero;
    const h = window.__voxelHeroes;
    const p = h.player;
    const st = h.state;
    const out = { guarding: hero.isGuarding() };
    const front = { x: p.x, z: p.z + 1 };
    const back = { x: p.x, z: p.z - 1 };
    out.contact = hero.receiveHit({ damage: 2, from: front, kind: 'contact' });
    out.hpAfterBlock = st.hp;
    out.tier3 = hero.receiveHit({ damage: 1, from: front, kind: 'projectile', tier: 3 });
    out.hpAfterShot = st.hp;
    out.locked = hero.inputLocked();
    out.blink = hero.receiveHit({ damage: 1, from: front, kind: 'contact' });
    out.hazard = hero.receiveHit({ damage: 1, kind: 'hazard', ignoreIframes: true });
    out.behind = hero.receiveHit({ damage: 1, from: back, kind: 'contact', ignoreIframes: true });
    out.hp = st.hp;
    try {
      hero.receiveHit({ kind: 'laser' });
      out.badKind = 'accepted';
    } catch (e) {
      out.badKind = e.message;
    }
    return out;
  });
  await kb.up('Shift');
  t.expect(r.guarding && r.contact === 'blocked' && r.hpAfterBlock === 8, 'a guarded contact hit from the front is blocked, no damage');
  t.expect(r.tier3 === 'hit' && r.hpAfterShot === 7 && r.locked, 'a tier-3 shot goes through a tier-1 shield and locks input');
  t.expect(r.blink === 'ignored', 'hits while blinking are ignored');
  t.expect(r.hazard === 'hit' && r.behind === 'hit' && r.hp === 5, 'hazards and hits from behind get through the guard');
  t.expect(/kind must be/.test(r.badKind), 'an unknown hit kind is refused');
  const hits = (await t.events('hero-hit')).map((e) => e.result).join(',');
  t.expect(hits === 'blocked,hit,hit,hit', `'hero-hit' reports every hit that is not ignored (${hits})`);

  swings = await count('sword-swing');
  await t.eval(() => window.__voxelHeroes.game.hero.hero.lockInput(0.3));
  await t.tap('sword');
  const lockedSwing = (await count('sword-swing')) - swings;
  await t.step(0.4);
  await t.tap('sword');
  t.expect(lockedSwing === 0 && (await count('sword-swing')) === swings + 1, 'lockInput eats sword presses until it runs out');
  await t.step(0.5);

  r = await t.eval(async () => {
    const { hero } = window.__voxelHeroes.game.hero;
    const h = window.__voxelHeroes;
    const out = {};
    hero.cheer(0.5);
    out.pose = hero.pose();
    hero.addStatus('paralyzed', 0.3);
    out.canAct = hero.canAct();
    await h.step(0.6);
    out.poseAfter = hero.pose();
    out.canActAfter = hero.canAct();
    return out;
  });
  t.expect(r.pose === 'cheer' && r.poseAfter === null, 'cheer holds the cheer pose for its time');
  t.expect(!r.canAct && r.canActAfter, 'a status (paralyzed) stops acting until it wears off');

  r = await t.eval(() => {
    const { hero } = window.__voxelHeroes.game.hero;
    const h = window.__voxelHeroes;
    const hp = h.state.hp;
    hero.place(3, 3);
    const result = hero.fall();
    const pos = hero.position();
    return { result, lost: hp - h.state.hp, at: [pos.lx, pos.lz] };
  });
  t.expect(r.result === 'hit' && r.lost === 2 && near(r.at[0], 8, 0.01) && near(r.at[1], 5.5, 0.01), `a pit costs 2 units and puts the hero back where he entered (${r.at})`);

  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const h = window.__voxelHeroes;
    window.__reviveOnce = true;
    g.combat.registerReviver('probe-dust', () => {
      if (!window.__reviveOnce) return 0;
      window.__reviveOnce = false;
      return 8;
    });
    const deaths = h.state.deaths;
    h.state.hp = 1;
    const result = g.hero.hero.receiveHit({ damage: 4, kind: 'hazard', ignoreIframes: true });
    return { result, hp: h.state.hp, mode: h.state.mode, deaths: h.state.deaths - deaths };
  });
  t.expect(r.result === 'hit' && r.hp === 8 && r.mode === 'play' && r.deaths === 0, 'a reviver (revive dust) catches a killing blow: back up with 4 hearts, not a death');
  t.expect((await last('player-revived'))?.by === 'probe-dust', "'player-revived' names the reviver");

  await t.eval(() => window.__voxelHeroes.game.hero.hero.respawn({ spot: { area: 'overworld', screen: [1, 0], x: 8, z: 5.5, yaw: 0 } }));
  await t.step(DT);
  s = await t.state();
  t.expect(s.screenName === 'Cairn Ridge' && near(s.lx, 8, 0.01) && s.hp === s.maxHp && (await last('hero-respawn')) !== null, 'respawn({ spot }) stands the hero up there with full life');
  await t.teleport('overworld:1,1', 8, 5.5, { yaw: 0 });

  // ---------------------------------------------------------------- damage to enemies
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const { dealDamage, damageAt } = h.game.damage;
    const mk = (x, z) => {
      const e = h.spawn('slime', x, z);
      e.spawned = true;
      e.growT = 1;
      e.think = () => {};
      return e;
    };
    const a = mk(3, 3);
    const b = mk(13, 3);
    const out = {};
    a.hp = 10;
    out.hit = dealDamage(a, { amount: 1, source: 'sword', from: { x: a.x - 1, z: a.z }, swingId: 'probe-1' });
    out.again = dealDamage(a, { amount: 1, source: 'sword', swingId: 'probe-1' });
    a.immune = ['arrow'];
    out.immune = dealDamage(a, { amount: 4, source: 'arrow' });
    a.guards = () => true;
    out.blocked = dealDamage(a, { amount: 4, source: 'sword' });
    delete a.guards;
    a.weak = { fire: 3 };
    out.weak = dealDamage(a, { amount: 1, source: 'fire' });
    out.hp = a.hp;
    out.freeze = dealDamage(a, { amount: 0, freeze: 1 });
    out.frozen = a.frozenT;
    out.shatter = dealDamage(a, { amount: 1 });
    out.gone = a.removed;
    b.boss = true;
    dealDamage(b, { amount: 0, freeze: 5 });
    out.bossFrozen = b.frozenT ?? 0;
    b.boss = false;
    b.hp = 10;
    out.area = damageAt(b.x, b.z, 1.5, { amount: 2, source: 'bomb' }).map((x) => `${x.entity.type}:${x.result}:${x.damage}`);
    b.remove();
    return out;
  });
  t.expect(r.hit.result === 'hit' && r.hit.damage === 1 && r.again.result === 'ignored', 'dealDamage hits once per swing id');
  t.expect(r.immune.result === 'immune' && r.blocked.result === 'blocked', 'immune sources and guards stop the damage');
  t.expect(r.weak.damage === 3 && r.hp === 6, 'weak spots multiply it');
  t.expect(r.freeze.result === 'hit' && r.frozen === 1 && r.shatter.result === 'killed' && r.gone, 'a frozen enemy dies to the next hit');
  t.expect(r.bossFrozen === 0, 'bosses never freeze');
  t.expect(r.area.join(' ') === 'slime:hit:2', `damageAt hits what is in the radius (${r.area})`);
  const hitResults = (await t.events('enemy-hit')).map((e) => e.result).join(',');
  t.expect(hitResults.startsWith('hit,immune,blocked,hit,hit,killed'), `'enemy-hit' reports each result (${hitResults})`);

  // ---------------------------------------------------------------- spawn groups
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const st = h.state;
    const out = {};
    const rect = g.places.currentRect();
    const grp = h.spawn('group', 8, 5, { of: ['slime'], count: [3, 3], minDist: 3 });
    const kids = grp.children;
    out.n = kids.length;
    out.gone = grp.removed;
    out.far = kids.every((e) => Math.hypot(e.x - h.player.x, e.z - h.player.z) >= 3);
    out.inside = kids.every((e) => e.x > rect.x0 && e.x < rect.x1 && e.z > rect.z0 && e.z < rect.z1);
    out.floor = kids.every((e) => !h.world.tileDefAt(Math.floor(e.x), Math.floor(e.z)).solid);
    out.spread = new Set(kids.map((e) => `${Math.floor(e.x)},${Math.floor(e.z)}`)).size;
    for (const e of kids) e.remove();
    const was = st.profile.difficulty;
    st.profile.difficulty = 'hard';
    const hard = h.spawn('group', 8, 5, { of: ['slime'], count: 4 });
    out.hard = hard.children.length;
    for (const e of hard.children) e.remove();
    st.profile.difficulty = was;
    return out;
  });
  t.expect(r.n === 3 && r.gone && r.spread === 3, "a 'group' marker places its enemies on separate tiles and leaves");
  t.expect(r.far && r.inside && r.floor, 'group enemies stand on free floor of the screen, away from the hero');
  t.expect(r.hard === 6, `hard mode brings 50% more (${r.hard} for 4)`);

  // ---------------------------------------------------------------- projectiles
  await t.eval(() => {
    const h = window.__voxelHeroes;
    const { Projectile } = h.game.projectile;
    h.api.registerEntity('probe-bolt', (o) => new Projectile(o, { owner: 'enemy', damage: 2, speed: 8, tier: 2 }));
    window.__hero = h.game.hero.hero;
    window.__shoot = (x, z, dir, extra = {}) => h.spawn('probe-bolt', x, z, { dir, ...extra });
  });
  await t.step(1.2);
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const st = h.state;
    window.__hero.place(8, 5.5, 0);
    const out = { hp0: st.hp };
    h.player.invT = 0;
    const bolt = window.__shoot(8, 9.5, { x: 0, z: -1 });
    await h.step(0.7);
    out.hit = st.hp;
    out.gone = bolt.removed;
    const wall = window.__shoot(3.5, 1.5, { x: -1, z: 0 });
    await h.step(0.5);
    out.wall = wall.removed;
    return out;
  });
  t.expect(r.hit === r.hp0 - 2 && r.gone, `an enemy bolt hits the hero through receiveHit (${r.hp0} -> ${r.hit}) and breaks`);
  t.expect(r.wall, 'a bolt breaks on a tree');

  await t.step(1.2);
  await kb.down('Shift');
  await t.step(DT);
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const st = h.state;
    window.__hero.place(8, 5.5, 0);
    const out = { hp0: st.hp };
    h.player.invT = 0;
    st.gear.shield = 2;
    const b1 = window.__shoot(8, 9.5, { x: 0, z: -1 });
    await h.step(0.7);
    out.blocked = b1.removed && st.hp === out.hp0;
    const slime = h.spawn('slime', 8, 8.7);
    slime.spawned = true;
    slime.growT = 1;
    slime.think = () => {};
    slime.hp = 10;
    g.effects.startEffect('reflect', 10);
    const b2 = window.__shoot(8, 9.5, { x: 0, z: -1 });
    await h.step(0.55);
    out.reflected = b2.reflected && b2.owner === 'hero' && b2.vz > 0 && Math.abs(Math.hypot(b2.vx, b2.vz) - 12) < 1e-6;
    await h.step(0.4);
    out.slimeHp = slime.hp;
    out.b2gone = b2.removed;
    g.effects.clearEffect('reflect');
    const b3 = window.__shoot(8, 9.5, { x: 0, z: -1 }, { tier: 3 });
    await h.step(0.7);
    out.tier3 = st.hp;
    out.b3gone = b3.removed;
    slime.remove();
    st.gear.shield = 1;
    return out;
  });
  await kb.up('Shift');
  t.expect(r.blocked, 'a guarded shot of a tier the shield covers is blocked');
  t.expect(r.reflected && r.b2gone && r.slimeHp === 8, `under the reflect spell a blocked shot flies back at 1.5x and hurts an enemy (hp 10 -> ${r.slimeHp})`);
  t.expect(r.tier3 === r.hp0 - 2 && r.b3gone, 'a shot above the shield tier gets through the guard');
  await t.step(1.2);

  // ---------------------------------------------------------------- swords and the smith
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const st = window.__voxelHeroes.state;
    const S = g.swords;
    const out = {};
    st.hp = st.maxHp;
    const full = S.bladeStats();
    out.full = [full.strength, full.spin, full.length, full.beam, S.bladeSize(full).reach];
    st.hp = st.maxHp - 1;
    const small = S.bladeStats();
    out.small = [small.strength, small.spin, small.small, S.bladeSize(small).reach];
    st.profile.trait = 'might';
    out.might = [S.bladeStats().strength, S.bladeStats({ full: true }).strength];
    st.profile.trait = 'focus';
    st.hp = st.maxHp;
    try {
      S.registerSword({ id: 'probe-bad', base: { strength: 0 } });
      out.bad = 'accepted';
    } catch (e) {
      out.bad = e.message;
    }
    S.registerSword({ id: 'probe-blade', name: 'Probe Blade', base: { length: 10, strength: 2 }, max: { length: 12, width: 1, strength: 3 }, price: { length: 100, strength: 300 }, budget: 450 });
    out.notOwned = S.canBuyLevel('probe-blade', 'length').reason;
    out.found = S.giveSword('probe-blade');
    out.reach = S.bladeSize(S.bladeStats({ id: 'probe-blade', full: true })).reach;
    out.notSold = S.canBuyLevel('probe-blade', 'width').reason;
    st.coins = 0;
    out.poor = S.canBuyLevel('probe-blade', 'length').reason;
    g.vitals.addCoins(1000);
    out.buy1 = S.buyLevel('probe-blade', 'length');
    out.buy2 = S.buyLevel('probe-blade', 'strength');
    out.max = S.buyLevel('probe-blade', 'strength').reason;
    out.budget = S.buyLevel('probe-blade', 'length').reason;
    out.levels = S.swordLevels('probe-blade');
    out.coins = st.coins;
    out.left = S.budgetLeft('probe-blade');
    const stars = S.swordStars('probe-blade');
    out.stars = [stars.length.level, stars.length.base, stars.length.max, stars.width.max];
    out.lost = S.resetSword('probe-blade');
    out.afterReset = [S.swordLevels('probe-blade').length, S.budgetLeft('probe-blade'), st.coins];
    out.equip = S.equipSword('probe-blade') && st.swords.equipped;
    out.heroReach = g.hero.hero.blade().reach;
    S.equipSword('blade-start');
    S.registerSword({ id: 'probe-thrift', name: 'Probe Thrift', base: { strength: 2, special: 4 }, special: 'thrift' });
    return out;
  });
  t.expect(JSON.stringify(r.full.slice(0, 4)) === '[3,1,0,0]' && near(r.full[4], 2.85), `blade-start at full life: strength 3, spin, reach 2.85 (${r.full})`);
  t.expect(JSON.stringify(r.small.slice(0, 3)) === '[3,0,true]' && near(r.small[3], 1.6), `below full life: the small blade, base strength, no spin, reach 1.6 (${r.small})`);
  t.expect(r.might[0] === 4 && r.might[1] === 4, 'the might trait adds 1 strength at any life');
  t.expect(/strength must be a whole number 1-20/.test(r.bad), 'registerSword checks the stat ranges');
  t.expect(r.notOwned === 'not-owned' && r.found === true && near(r.reach, 9.85), 'a sword is bought for only once owned; L10 reaches 9.85');
  t.expect(r.notSold === 'not-sold' && r.poor === 'coins', 'the smith refuses unsold stats and short purses');
  t.expect(r.buy1.ok && r.buy1.level === 11 && r.buy2.ok && r.max === 'max' && r.budget === 'budget', 'levels are bought up to each max and within the budget');
  t.expect(r.levels.length === 11 && r.levels.strength === 3 && r.coins === 600 && r.left === 50, `levels, coins and budget add up (${r.coins} coins, ${r.left} budget left)`);
  t.expect(r.stars.join(',') === '11,10,12,1', `the sword menu's stars: level, base and max per stat (${r.stars})`);
  t.expect(r.lost === 400 && r.afterReset[0] === 10 && r.afterReset[1] === 450 && r.afterReset[2] === 600, 'a reset returns base values, frees the budget and refunds nothing');
  t.expect(r.equip === 'probe-blade' && near(r.heroReach, 9.85), 'equipSword changes the blade the hero API reports');
  const swordEvents = [await count('sword-found'), await count('sword-upgrade'), await count('sword-reset')];
  t.expect(swordEvents.join(',') === '1,2,1', `sword events: found, upgrade x2, reset (${swordEvents})`);

  // ---------------------------------------------------------------- spells
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const st = h.state;
    const out = {};
    g.spells.registerSpell({
      id: 'probe-ward',
      name: 'Probe Ward',
      cost: [3, 2],
      cast: () => {
        g.effects.startEffect('reflect', 10);
        return true;
      },
    });
    out.max0 = st.maxMagic;
    out.learned = g.grants.grant('probe-ward');
    out.max1 = [st.magic, st.maxMagic];
    out.again = g.spells.learnSpell('probe-ward');
    out.cost = g.spells.spellCost('probe-ward');
    st.profile.trait = null;
    out.costMight = g.spells.spellCost('probe-ward');
    st.profile.trait = 'focus';
    g.swords.giveSword('probe-thrift');
    g.swords.equipSword('probe-thrift');
    out.thrift = g.spells.spellCost('probe-ward');
    g.swords.equipSword('blade-start');
    out.cast = g.spells.castSpell('probe-ward');
    out.magic = st.magic;
    out.active = g.effects.effectActive('reflect');
    g.vitals.setMagic(1);
    out.short = g.spells.castSpell('probe-ward');
    g.effects.tickEffects(11);
    out.ended = !g.effects.effectActive('reflect');
    g.vitals.setMagic(st.maxMagic);
    g.hero.hero.lockInput(0.2);
    out.locked = g.spells.castSpell('probe-ward');
    await h.step(0.3);
    h.game.inventory.selectItem('probe-ward');
    return out;
  });
  t.expect(r.learned && r.max1[1] === r.max0 + 1 && r.max1[0] === r.max1[1] && r.again === false, 'learning a spell (by grant) adds 1 max magic and refills');
  t.expect(r.cost === 2 && r.costMight === 3 && r.thrift === 1, `costs: focus ${r.cost}, might ${r.costMight}, thrift special 1`);
  t.expect(r.cast === 'cast' && r.magic === r.max1[1] - 2 && r.active, 'castSpell spends the cost and runs the spell');
  t.expect(r.short === 'no-magic' && r.ended && r.locked === 'blocked', "casting fails short of magic ('no-magic') and while locked ('blocked'); effects end");
  const magicBefore = await t.eval(() => window.__voxelHeroes.state.magic);
  await t.press('KeyK');
  t.expect((await t.eval(() => window.__voxelHeroes.state.magic)) === magicBefore - 2 && (await last('spell-cast'))?.id === 'probe-ward', 'a spell on the quick ring casts with B (K)');
  t.expect((await count('spell-learned')) === 1 && (await count('effect-start')) >= 2 && (await count('effect-end')) >= 1, 'spell and effect events fire');
  await t.eval(() => window.__voxelHeroes.game.effects.clearEffect('reflect'));
  r = await t.eval(() => {
    const inv = window.__voxelHeroes.game.inventory;
    const out = { ring: inv.ringItems().map((i) => i.id).join(',') };
    inv.setOnRing('probe-ward', false);
    out.off = inv.ringItems().length === 0 && inv.selectedItem() === null && inv.hasItem('probe-ward');
    inv.setOnRing('probe-ward', true);
    out.back = inv.isOnRing('probe-ward');
    return out;
  });
  t.expect(r.ring === 'probe-ward' && r.off && r.back, 'items can be taken off the quick ring and put back');

  // ---------------------------------------------------------------- dungeons
  const enterBefore = await count('dungeon-enter');
  await t.teleport('crypt:0,1', 8, 8.4, { yaw: Math.PI });
  await t.step(DT);
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const D = g.dungeons;
    const out = {};
    out.current = D.currentDungeon()?.id ?? null;
    out.entrance = D.dungeonEntrance('crypt');
    g.grants.grant('map');
    g.grants.grant('key-boss');
    g.grants.grant('key-red', 2);
    out.red = D.colorKeyCount('red');
    out.useRed = D.useColorKey('red') && D.colorKeyCount('red') === 1;
    out.noGreen = D.useColorKey('green');
    g.grants.grant('key-master');
    out.master = D.useColorKey('green') && D.colorKeyCount('green') === 0;
    out.progress = D.dungeonProgress('crypt');
    out.rooms = D.dungeonRooms('crypt').map((x) => `${x.key}=${x.room}${x.visited ? '*' : ''}`).join(' ');
    out.labels = [D.roomLabel([3, 9]).room, D.roomLabel([0, 11]).room + '/' + D.roomLabel([0, 11]).floor, String(D.roomLabel([0, 10]).room)];
    out.music = g.music.currentMusic();
    out.visited = g.places.hasVisited('crypt:0,1');
    return out;
  });
  const enter = (await t.events('dungeon-enter')).slice(enterBefore);
  t.expect(r.current === 'crypt' && enter.length === 1 && enter[0].id === 'crypt' && enter[0].via === 'door', "walking into the crypt fires 'dungeon-enter' once");
  t.expect(r.entrance.area === 'crypt' && r.entrance.screen.join(',') === '0,1', `the crypt's entrance is its Sunken Gate (${JSON.stringify(r.entrance)})`);
  t.expect(r.progress.entered && r.progress.map && r.progress.bossKey && !r.progress.complete, 'map and boss key grants mark the dungeon (flags per the spec)');
  t.expect(r.red === 2 && r.useRed && r.noGreen === false && r.master, 'colored keys are spent; the master key opens any colored lock');
  t.expect(r.rooms.includes('crypt:0,1=B-1*') && r.rooms.split(' ').length === 4 && r.visited, `dungeonRooms lists the rooms, their map labels and visits (${r.rooms})`);
  t.expect(r.labels.join(' ') === 'J-4 A-1/1 null', `room labels: row letter and column, floors 11 rows apart (${r.labels.join(' ')})`);
  t.expect(r.music === 'dungeon', 'the crypt plays its dungeon music');

  await t.teleport('crypt:1,1', 8, 5.5);
  const deathsBefore = await t.eval(() => window.__voxelHeroes.state.deaths);
  await t.setHp(0);
  await t.step(1.4);
  s = await t.state();
  t.expect(s.mode === 'dead' && /Sunken Gate/.test(await t.eval(() => document.getElementById('overlay-msg').textContent)), 'falling in the Pillar Hall: the game-over panel names the Sunken Gate');
  await t.press('Enter');
  await t.step(0.2);
  s = await t.state();
  r = await t.eval(() => ({ respawn: window.__voxelHeroes.state.respawn, deaths: window.__voxelHeroes.state.deaths }));
  t.expect(s.mode === 'play' && s.screenName === 'Sunken Gate' && s.hp === s.maxHp, `getting up after falling in a dungeon: its entrance, full life (${s.screenName} ${s.lx},${s.lz})`);
  t.expect(r.respawn === null && r.deaths === deathsBefore + 1, 'the inn respawn point is untouched and the death is counted');

  await t.teleport('overworld:1,1', 8, 5.5, { yaw: 0 });
  t.expect((await last('dungeon-leave'))?.id === 'crypt', "leaving fires 'dungeon-leave'");
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const D = g.dungeons;
    D.registerDungeon({ id: 'probe-d1', number: 1, name: 'Probe Barrow', areas: ['probe-nowhere'], boss: 'probe-boss' });
    const out = {};
    out.first = D.defeatBoss('probe-d1');
    out.second = D.defeatBoss('probe-d1');
    out.flag = window.__voxelHeroes.state.flags.has('boss:probe-d1') && D.bossDefeated('probe-d1') && D.dungeonProgress('probe-d1').boss;
    out.complete = D.completeDungeon('probe-d1');
    out.twice = D.completeDungeon('probe-d1');
    g.grants.grant('orb-2');
    out.orbs = D.orbs().join(',');
    out.music = g.music.currentMusic();
    return out;
  });
  t.expect(r.first.heartContainer && r.first.coins === 250 && !r.second.heartContainer && r.second.coins === 250, 'the first boss kill pays a heart container and 250 coins; a re-fight pays coins only');
  t.expect(r.flag, 'a boss kill sets boss:<dungeon id> (spec P1.5: boss:d1)');
  t.expect(r.complete && !r.twice && r.orbs === '1,2', `taking the orb completes the dungeon once (orbs ${r.orbs})`);
  const bossEvents = (await t.events('boss-defeated')).map((e) => `${e.id}:${e.refight}`).join(' ');
  t.expect(bossEvents === 'probe-boss:false probe-boss:true' && (await last('dungeon-complete'))?.orb === 1, `boss and orb events (${bossEvents})`);
  t.expect(r.music === null && (await last('music-change'))?.id === null, 'the overworld has no track yet, so the music stops');

  // ---------------------------------------------------------------- shops and inns
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const st = window.__voxelHeroes.state;
    const out = {};
    g.shops.registerShop({
      id: 'probe-shop',
      name: 'Probe Goods',
      entries: [
        { id: 'piece', grant: 'heart-piece', price: 50, stock: 1 },
        { id: 'hidden', grant: 'coins', price: 1, when: () => false },
        { id: 'bottled', grant: 'coins', price: 1, can: () => 'no-bottle' },
      ],
    });
    st.coins = 0;
    out.poor = g.shops.buy('probe-shop', 'piece').reason;
    g.vitals.addCoins(100);
    const pieces = st.heartPieces;
    out.buy = g.shops.buy('probe-shop', 'piece');
    out.got = st.heartPieces - pieces;
    out.coins = st.coins;
    out.soldOut = g.shops.buy('probe-shop', 'piece').reason;
    out.hidden = g.shops.buy('probe-shop', 'hidden').reason;
    out.shelf = g.shops.shopEntries('probe-shop').map((e) => `${e.id}:${e.reason}`).join(' ');
    g.services.registerInn({ id: 'probe-inn', name: 'Probe Inn', price: 10, bed: { area: 'overworld', screen: [0, 1], x: 5, z: 5, yaw: 0 } });
    st.hp = 1;
    out.inn = g.services.innRest('probe-inn');
    out.innHp = st.hp === st.maxHp;
    out.respawn = g.places.respawnSpot('death');
    st.coins = 5;
    out.innPoor = g.services.innRest('probe-inn').reason;
    st.respawn = null;
    return out;
  });
  t.expect(r.poor === 'coins' && r.buy.ok && r.got === 1 && r.coins === 50, 'a shop entry pays out through its grant');
  t.expect(r.soldOut === 'sold-out' && r.hidden === 'unavailable' && r.shelf === 'piece:sold-out bottled:no-bottle', `stock, when() and can() (${r.shelf})`);
  t.expect((await last('shop-buy'))?.entry === 'piece' && (await last('item-get'))?.id === 'heart-piece' && (await last('item-get'))?.source === 'shop', "'shop-buy' fires and the heart piece is an item get from the shop");
  t.expect(r.inn.ok && r.innHp && r.respawn.screen.join(',') === '0,1' && r.respawn.x === 5 && r.innPoor === 'coins', 'a night at the inn refills and moves the respawn point to its bed');
  t.expect((await last('inn-rest'))?.inn === 'probe-inn', "'inn-rest' fires");

  // ---------------------------------------------------------------- menus (the dialog fallbacks)
  // Shopkeepers, the smith and innkeepers open menus by id; until the ui
  // registers its screens, dialogs answer. Text shows at once here.
  const choicesNow = () => t.eval(() => [...document.querySelectorAll('#dialog .dialog-choices li')].map((li) => li.textContent).join('|'));
  const pick = async (n) => {
    for (let i = 0; i < n; i++) await t.press('ArrowRight');
    await t.press('KeyJ');
    await t.step(DT * 2);
  };
  await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const st = window.__voxelHeroes.state;
    g.settings.setSetting('textSpeed', 'instant');
    st.coins = 500;
    g.shops.registerShop({ id: 'probe-stall', name: 'Probe Stall', entries: [{ id: 'hearty', grant: 'heart', price: 5 }, { id: 'tok', grant: 'token', price: 40 }] });
    window.__menu = 'open';
    window.__tokens = st.tokens;
    g.menus.openMenu('shop', { shop: 'probe-stall', speaker: 'Probe' }).then(() => (window.__menu = 'closed'));
  });
  await t.step(DT * 2);
  const shelf = await choicesNow();
  await t.shot('03-shop-menu');
  await pick(1); // the token
  const again = await choicesNow();
  await pick(2); // Leave
  r = await t.eval(() => ({ menu: window.__menu, tokens: window.__voxelHeroes.state.tokens - window.__tokens, coins: window.__voxelHeroes.state.coins, mode: window.__voxelHeroes.state.mode }));
  t.expect(shelf === 'Heart 5|Sword Token 40|Leave' && again === shelf, `the shop fallback lists the shelf as dialog choices (${shelf})`);
  t.expect(r.tokens === 1 && r.coins === 460 && r.menu === 'closed' && r.mode === 'play', `choosing buys through shops.js; Leave closes the menu (${r.coins} coins)`);

  await t.eval(() => {
    const g = window.__voxelHeroes.game;
    window.__menu = 'open';
    g.menus.openMenu('smith', { sword: 'probe-blade' }).then(() => (window.__menu = 'closed'));
  });
  await t.step(DT * 2);
  const smith = await choicesNow();
  await pick(0); // a level of length
  const smithAfter = await choicesNow();
  await pick(3); // Leave
  r = await t.eval(() => ({ menu: window.__menu, length: window.__voxelHeroes.game.swords.swordLevels('probe-blade').length, coins: window.__voxelHeroes.state.coins }));
  t.expect(smith === 'length 10/12: 100|strength 2/3: 300|Reset|Leave' && smithAfter.startsWith('length 11/12'), `the smith fallback sells the sword's levels (${smith})`);
  t.expect(r.length === 11 && r.coins === 360 && r.menu === 'closed', 'buying a level at the smith pays and adds it');

  await t.eval(() => {
    const g = window.__voxelHeroes.game;
    window.__voxelHeroes.state.hp = 1;
    window.__menu = 'open';
    g.menus.openMenu('inn', { inn: 'probe-inn' }).then((stayed) => (window.__menu = stayed));
  });
  await t.step(DT * 2);
  const inn = await choicesNow();
  await pick(0); // Stay
  await t.press('KeyJ'); // "Sleep well."
  await t.step(DT * 2);
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const st = window.__voxelHeroes.state;
    const out = { menu: window.__menu, full: st.hp === st.maxHp, coins: st.coins, respawn: g.places.respawnSpot('death').screen.join(',') };
    st.respawn = null;
    out.registered = [];
    g.menus.registerMenu('probe-menu', async ({ n }) => n * 2);
    g.menus.registerMenu('inn', async () => 'screen');
    try {
      g.menus.registerMenu('inn', async () => 'again');
    } catch (e) {
      out.twice = e.message;
    }
    out.fallback = g.menus.usesFallback('shop') && !g.menus.usesFallback('inn');
    return out;
  });
  const own = await t.eval(() => Promise.all([window.__voxelHeroes.game.menus.openMenu('probe-menu', { n: 21 }), window.__voxelHeroes.game.menus.openMenu('inn', {})]));
  t.expect(inn === 'Stay|Leave' && r.menu === true && r.full && r.coins === 350 && r.respawn === '0,1', 'the inn fallback: a night refills, pays and moves the respawn point');
  t.expect(own.join(',') === '42,screen' && /already registered/.test(r.twice) && r.fallback, 'registerMenu adds menus and replaces a fallback once');
  await t.eval(() => window.__voxelHeroes.game.settings.setSetting('textSpeed', 'normal'));

  // ---------------------------------------------------------------- save slots
  r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    const out = {};
    out.saved = g.saves.saveSlot(3);
    out.summary = g.saves.slotSummary(3);
    out.count = g.saves.slotSummaries().length;
    localStorage.setItem('voxel-heroes:slot:2', JSON.stringify({ time: 1, data: { version: 1, fields: { hp: 6, maxHp: 6, gems: 42 } } }));
    out.old = g.saves.slotSummary(2);
    localStorage.removeItem('voxel-heroes:slot:2');
    out.loaded = g.saves.loadSlot(3);
    g.saves.eraseSlot(3);
    out.erased = g.saves.slotSummary(3);
    return out;
  });
  t.expect(r.saved && r.summary.name === 'Ada' && r.summary.class === 'balanced' && r.summary.orbs === 2 && r.summary.ok && r.count === 3, 'slot summaries show the hero without loading the slot');
  t.expect(r.old.coins === 42 && r.old.name === 'Hero' && r.old.hearts === 3, 'an M1 slot summarises too (gems as coins)');
  t.expect(r.loaded && r.erased === null && (await last('saved'))?.ok === true && (await last('loaded'))?.slot === 3, "saveSlot, loadSlot and eraseSlot fire 'saved' and 'loaded'");

  // ---------------------------------------------------------------- bestiary, music, cards
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    g.bestiary.registerBestiary({ id: 'slime', name: 'Slime', band: 1, hp: 2 });
    const before = g.bestiary.bestiaryEntries().find((e) => e.id === 'slime');
    const e = h.spawn('slime', 3, 3);
    e.spawned = true;
    g.damage.dealDamage(e, { amount: 99 });
    const after = g.bestiary.bestiaryEntries().find((x) => x.id === 'slime');
    const out = { seen: after.seen - before.seen, defeated: after.defeated - before.defeated };
    out.boss = g.music.playMusic('boss');
    try {
      g.music.playMusic('probe-missing');
      out.unknown = 'played';
    } catch (err) {
      out.unknown = err.message;
    }
    g.music.stopMusic();
    out.card = g.cards.cardForArea('crypt')?.id;
    out.fallback = g.cards.cardForArea('probe-nowhere')?.id;
    g.cards.markCardSeen('card-crypt');
    out.gallery = g.cards
      .galleryCards()
      .map((c) => `${c.id}${c.seen ? '*' : ''}`)
      .join(' ');
    out.savedCards = h.save().fields.cardsSeen;
    return out;
  });
  t.expect(r.seen === 1 && r.defeated === 1, 'the bestiary counts sightings and wins');
  t.expect(r.boss === 'boss' && /Unknown music/.test(r.unknown), 'playMusic switches tracks and refuses unknown ones');
  t.expect(r.card === 'card-crypt' && r.fallback === 'card-road' && r.gallery.includes('card-crypt*') && r.savedCards.includes('card-crypt'), 'loading cards: per area, a fallback, and a saved gallery');

  // ---------------------------------------------------------------- settings
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const S = h.game.settings;
    const out = {};
    out.fast = S.setSetting('textSpeed', 'fast');
    out.cps = S.textSpeed();
    out.bad = S.setSetting('camera', 'Z');
    try {
      S.setSetting('probe-missing', 1);
      out.unknown = 'set';
    } catch (e) {
      out.unknown = e.message;
    }
    S.setSetting('camera', 'B');
    out.camera = h.camera.get();
    S.setSetting('camera', 'A');
    out.stored = JSON.parse(localStorage.getItem('voxel-heroes:settings')).textSpeed;
    localStorage.setItem('voxel-heroes:settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('voxel-heroes:settings')), textSpeed: 'slow', camera: 'Q' }));
    S.loadSettings();
    out.reloaded = [h.state.settings.textSpeed, h.state.settings.camera];
    S.setSetting('textSpeed', 'fast');
    S.setSetting('largeText', true);
    return out;
  });
  t.expect(r.fast && r.cps === 90 && r.bad === false && /unknown setting/.test(r.unknown), 'setSetting checks keys and values');
  t.expect(r.camera === 'B', 'the camera option picks the camera preset');
  t.expect(r.stored === 'fast' && r.reloaded[0] === 'slow' && r.reloaded[1] === 'A', 'options persist in localStorage; a stored value that is not allowed is ignored');
  t.expect((await t.events('settings-changed')).some((e) => e.key === 'textSpeed' && e.value === 'fast'), "'settings-changed' fires");
  await t.eval(() => {
    window.__said = null;
    window.__voxelHeroes.showDialog('Well met, {hero}.').then(() => (window.__said = 'closed'));
  });
  await t.step(0.4);
  r = await t.eval(() => ({ text: document.querySelector('#dialog .dialog-text').textContent, large: document.getElementById('dialog').classList.contains('large') }));
  await t.shot('02-large-text');
  await t.press('Space');
  t.expect(r.text === 'Well met, Ada.' && r.large, `dialogs: {hero} becomes the name, large text, fast typing ("${r.text}")`);
  t.expect((await t.eval(() => window.__said)) === 'closed', 'Space confirms in a dialog');
  await t.eval(() => window.__voxelHeroes.game.settings.resetSettings());

  // ---------------------------------------------------------------- prompts, pickups, grants
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    h.player.yaw = 0;
    const at = g.hero.hero.position(); // lx, lz: local to the screen, as spawn() takes them
    const npc = h.spawn('npc', at.lx, at.lz + 1, { name: 'Probe' });
    const out = {};
    out.find = g.interact.findInteraction(h.player)?.label;
    out.prompts = g.prompts
      .currentPrompts()
      .map((p) => `${p.action}:${p.label}`)
      .join(' ');
    out.labels = [g.prompts.buttonLabel('sword', 'keyboard'), g.prompts.buttonLabel('sword', 'gamepad'), g.prompts.buttonLabel('dash', 'touch'), g.prompts.buttonLabel('guard', 'keyboard')].join(',');
    npc.remove();
    return out;
  });
  t.expect(r.find === 'Talk' && r.prompts.startsWith('sword:Talk'), `the prompt bar offers Talk on A beside someone (${r.prompts})`);
  t.expect(r.labels === 'J,A,D,Shift', `button names follow the device (${r.labels})`);

  const coins0 = await t.eval(() => window.__voxelHeroes.state.coins);
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const out = {};
    out.pieces = g.pickups.coinPieces(250).join(',');
    const drops = g.pickups.dropCoins(h.player.x + 4, h.player.z, 111);
    out.types = drops.map((d) => d.type).join(',');
    out.collected = drops.map((d) => g.pickups.collectPickup(d, { by: 'blade' })).every(Boolean);
    const at = g.hero.hero.position();
    h.spawn('coin-10', at.lx, at.lz);
    h.state.magic = 0;
    h.spawn('magic', at.lx, at.lz);
    return out;
  });
  await t.step(0.4);
  r.coins = (await t.eval(() => window.__voxelHeroes.state.coins)) - coins0;
  r.magic = await t.eval(() => window.__voxelHeroes.state.magic);
  t.expect(r.pieces === 'coin-100,coin-100,coin-10,coin-10,coin-10,coin-10,coin-10' && r.types === 'coin-100,coin-10,coin-1', `coins split largest first (${r.types})`);
  t.expect(r.collected && r.coins === 121 && r.magic === 1, `collectPickup and walking over coins and magic (+${r.coins} coins, magic ${r.magic})`);
  const pickups = await t.events('pickup');
  t.expect(pickups.filter((p) => p.by === 'blade').length === 3 && pickups.some((p) => p.type === 'coin-10' && p.by === undefined), "'pickup' says who collected it ('blade'; walked over: no by)");

  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const out = {};
    window.__gets = [];
    g.grants.setItemGetPresenter((get) => window.__gets.push(`${get.id}:${get.text}`));
    out.meta = g.grants.grantMeta('heart-container');
    g.grants.grant('heart-container');
    g.grants.grant('heart-container', 1, { fanfare: false });
    g.grants.grant('gems', 5);
    g.items.registerItem({ id: 'probe-lamp', name: 'Probe Lamp', getText: 'A lamp! It lights dark rooms.', use: () => true });
    g.grants.grant('probe-lamp');
    g.grants.grant('key');
    g.grants.setItemGetPresenter(null);
    out.gets = window.__gets.join(' | ');
    out.maxHp = h.state.maxHp;
    return out;
  });
  t.expect(r.meta.fanfare && r.meta.name === 'Heart Container', 'grantMeta describes a grant');
  t.expect(r.gets === 'heart-container:Heart container! Max health up | probe-lamp:A lamp! It lights dark rooms.', `fanfare grants and new items go through the item-get presenter; quiet ones do not (${r.gets})`);
  t.expect((await last('keys-changed'))?.delta === 1, "a small key fires 'keys-changed'");
  t.expect((await t.events('hero-pose')).some((e) => e.pose === 'cheer'), 'an item get puts the hero in the cheer pose');

  // ---------------------------------------------------------------- records and events
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const { EVENTS } = h.game.events;
    const unknown = [...window.__allEvents].filter((n) => !(n in EVENTS) && !n.startsWith('probe'));
    return { unknown, playTime: h.state.playTime, visited: [...h.state.visited].sort().join(' '), fired: window.__allEvents.size };
  });
  t.expect(r.playTime > 5, `play time counts (${r.playTime.toFixed(1)} s)`);
  t.expect(r.visited.includes('overworld:1,1') && r.visited.includes('crypt:1,1') && (await count('screen-visited')) >= 4, `visited screens are recorded (${r.visited})`);
  t.expect(r.unknown.length === 0, `every event fired is in the EVENTS catalogue (${r.fired} names; unknown: ${r.unknown.join(', ') || 'none'})`);
}

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
// Runtime content (a sword, spell, dungeon, shop, entity, card, place, menu)
// is prefixed "probe": the enemies here are probe-foe and probe-rare, not a
// stream's real types. The dialog box, the game-over panel and the Sound
// button are read through the ui's views (dialogView, overlayView,
// muteLabel), never the DOM, and the menus through their dialog fallbacks
// ({ fallback: true }), so the ui can restyle and replace them. What this
// still takes from M1 content (the Crossroads start, Cairn Ridge, the
// crypt's four rooms) is frozen until M3 (docs/CONTRACTS.md, "Fixtures").
export const description =
  'M2 contracts: tuning, fixed step, events, input (keys, pad, touch, menus), state and saves, vitals, classes, hero API, damage, freeze and slow, projectiles, spawn groups and clears, swords, spells, dungeons, shops, inns, menus, places, slots, bestiary, music, cards, settings, prompts, pickups, grants, chests.';

const DT = 1 / 60;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

export default async function contractsM2(t) {
  const kb = t.page.keyboard;
  await t.page.waitForFunction(() => !!window.__voxelHeroes?.game, null, { timeout: 10000 });
  await t.eval(() => {
    const g = window.__voxelHeroes.game;
    window.__allEvents = new Set();
    g.events.onAny((name) => window.__allEvents.add(name));
    // t.track keeps only flat fields; where a hit came from is kept here.
    window.__heroHitFrom = [];
    g.events.on('hero-hit', (p) => window.__heroHitFrom.push({ kind: p.kind, x: p.from ? p.from.x : null }));
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
    'screen-visited',
    'chest-opened'
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
  r = await t.eval(() => ({ muted: window.__voxelHeroes.state.settings.muted, audio: window.__voxelHeroes.game.audio.isMuted(), label: window.__voxelHeroes.game.hud.muteLabel() }));
  t.expect(r.muted && r.audio && r.label === 'Sound off', 'N mutes (the muted setting, the audio and the Sound label agree)');
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

  // Menus read directions with input.menuDir(): a press at once, a held
  // stick again after TUNING.menu.repeatDelay, then every repeatEvery.
  // (endFrame stands in for the tick boundary, so the hero does not walk.)
  r = await t.eval(() => {
    const { input: inp } = window.__voxelHeroes.game.input;
    const { TUNING } = window.__voxelHeroes.game.tuning;
    const seq = [];
    const read = () => seq.push(inp.menuDir() ?? '-');
    inp.tap('left');
    read();
    read(); // the same answer all tick
    inp.endFrame();
    read();
    inp.endFrame();
    inp.setStick(0, 0.9);
    for (let i = 0; i < 36; i++) {
      read();
      inp.endFrame();
    }
    inp.setStick(0, 0);
    read();
    inp.endFrame();
    return { seq: seq.join(','), repeat: [TUNING.menu.repeatDelay, TUNING.menu.repeatEvery] };
  });
  const menuWant = ['left', 'left', '-', ...Array.from({ length: 36 }, (_, i) => ([0, 21, 27, 33].includes(i) ? 'down' : '-')), '-'].join(',');
  t.expect(r.repeat.join(',') === '0.35,0.1' && r.seq === menuWant, `menuDir: a tap moves a menu cursor once; a held stick moves it, then again after 0.35 s and every 0.1 s (${r.seq.replace(/(-,)+/g, '..,')})`);

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
    out.set = hero.setFacing('east');
    out.facing = hero.facing();
    out.vec = hero.facingVector();
    out.toward = hero.faceToward(p.x + 0.3, p.z - 4); // a point to the north, a little east
    out.towardFacing = hero.facing();
    try {
      hero.setFacing('up');
      out.bad = 'accepted';
    } catch (e) {
      out.bad = e.message;
    }
    hero.setFacing('south');
    out.south = hero.facing();
    const pos = hero.position();
    out.local = [pos.lx, pos.lz];
    out.full = hero.isFullLife();
    return out;
  });
  t.expect(r.yaws === 'south,east,north,west', 'facingFromYaw: the cardinal nearest a yaw (0 faces south)');
  t.expect(r.set === 'east' && r.facing === 'east' && r.vec.x === 1 && r.vec.z === 0 && r.south === 'south', 'setFacing turns the attack facing (east: +x)');
  t.expect(r.toward === 'north' && r.towardFacing === 'north' && /setFacing: north, east, south, west/.test(r.bad), 'faceToward faces the cardinal nearest a point; setFacing takes only the four');
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
  const heroHits = await t.events('hero-hit');
  const hits = heroHits.map((e) => e.result).join(',');
  t.expect(hits === 'blocked,hit,hit,hit', `'hero-hit' reports every hit that is not ignored (${hits})`);
  const froms = await t.eval(() => window.__heroHitFrom.slice(0, 4));
  t.expect(froms.length === 4 && froms.every((e) => (e.kind === 'hazard' ? e.x === null : Number.isFinite(e.x))), "'hero-hit' says where the hit came from (null for hazards), so the caller can recoil");

  await kb.down('Shift');
  await t.step(DT);
  r = await t.eval(() => {
    const { hero } = window.__voxelHeroes.game.hero;
    const h = window.__voxelHeroes;
    const p = h.player;
    const front = { x: p.x, z: p.z + 1 };
    p.invT = 0;
    const out = { guarding: hero.isGuarding(), shield: h.state.gear.shield };
    out.basic = hero.receiveHit({ damage: 1, from: front, kind: 'projectile' });
    out.tier1 = hero.receiveHit({ damage: 1, from: front, kind: 'projectile', tier: 1, ignoreIframes: true });
    return out;
  });
  await kb.up('Shift');
  t.expect(r.guarding && r.shield === 1 && r.basic === 'hit' && r.tier1 === 'blocked', 'a shot is tier 2 unless it says otherwise: shield 1 blocks only tier-1 shots');

  await t.step(0.5);
  r = await t.eval(async () => {
    const { hero } = window.__voxelHeroes.game.hero;
    const h = window.__voxelHeroes;
    const { TUNING } = h.game.tuning;
    const p = h.player;
    const out = { iframes: TUNING.damage.iframes };
    hero.place(8, 5.5, 0);
    p.invT = 0;
    const x0 = p.x;
    out.push = hero.receiveHit({ damage: 1, from: { x: p.x - 1, z: p.z }, kind: 'contact', knockback: 2 });
    out.blink = p.invT;
    out.locked = hero.inputLocked();
    await h.step(0.4);
    out.moved = p.x - x0;
    p.invT = 0;
    await h.step(0.3); // the lock runs out
    const swamp = () => hero.receiveHit({ damage: 1, kind: 'hazard', knockback: false, iframes: false, lock: false });
    out.swamp = [swamp(), swamp()];
    out.after = [p.invT, hero.inputLocked()];
    h.game.vitals.setLife(5, 'probe');
    hero.place(8, 5.5, 0);
    return out;
  });
  t.expect(r.push === 'hit' && near(r.blink, r.iframes) && r.locked && near(r.moved, 2, 0.1), `receiveHit({ knockback: 2 }) pushes him 2 tiles (${r.moved.toFixed(2)}); he blinks TUNING.damage.iframes s with input locked`);
  t.expect(r.swamp.join(',') === 'hit,hit' && r.after[0] === 0 && !r.after[1], 'with iframes: false and lock: false, damage over time neither blinks nor locks (a swamp lands every tick it is called)');

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
  r = await t.eval(async () => {
    const { hero } = window.__voxelHeroes.game.hero;
    const h = window.__voxelHeroes;
    const out = {};
    hero.place(4, 5.5);
    await h.tick(); // he stands on a safe tile
    hero.place(6, 5.5); // and steps into (say) lava
    out.safe = hero.fall({ to: 'safe', damage: 1 });
    let pos = hero.position();
    out.safeAt = [pos.lx, pos.lz];
    out.spot = hero.fall({ to: { area: 'overworld', screen: [1, 1], x: 12, z: 5.5 }, damage: 1 });
    pos = hero.position();
    out.spotAt = [pos.lx, pos.lz];
    hero.place(8, 5.5, 0);
    return out;
  });
  t.expect(r.safe === 'hit' && near(r.safeAt[0], 4, 0.01) && near(r.safeAt[1], 5.5, 0.01), `fall({ to: 'safe' }) puts him back on the last safe tile he stood on (${r.safeAt})`);
  t.expect(r.spot === 'hit' && near(r.spotAt[0], 12, 0.01) && near(r.spotAt[1], 5.5, 0.01), `fall({ to: spot }) on this screen puts him on the spot (${r.spotAt})`);

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
  // Probe enemies: the least an enemy is (kind 'enemy', hp, hurt, die with
  // 'enemy-killed' and the room-clear check), so no stream's enemy is pinned.
  await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    class ProbeFoe extends g.entity.Entity {
      constructor(o = {}) {
        super(o);
        this.kind = 'enemy';
        this.swordable = true;
        this.hp = o.hp ?? 10;
        this.boss = !!o.boss;
        this.rare = !!o.rare;
        this.hitSwing = undefined;
      }
      canBeHit(hit) {
        return hit.swingId === undefined || hit.swingId !== this.hitSwing;
      }
      hurt(hit) {
        if (hit.swingId !== undefined) this.hitSwing = hit.swingId;
        this.hp -= hit.damage;
        if (this.hp <= 0) this.die(hit);
        return true;
      }
      die(hit = null) {
        this.remove();
        g.events.emit('enemy-killed', { entity: this, hit });
        g.combat.checkRoomCleared();
      }
    }
    for (const type of ['probe-foe', 'probe-rare']) g.registry.registerEntity(type, (o) => new ProbeFoe(o));
  });
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const { dealDamage, damageAt } = h.game.damage;
    const a = h.spawn('probe-foe', 3, 3, { hp: 10 });
    const b = h.spawn('probe-foe', 13, 3, { hp: 10 });
    const out = {};
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
    let seen = null;
    const stop = h.game.events.on('enemy-hit', (p) => (seen = p));
    out.crit = [dealDamage(b, { amount: 1, source: 'sword', crit: true }).result, seen?.hit?.crit === true];
    stop();
    b.remove();
    return out;
  });
  t.expect(r.hit.result === 'hit' && r.hit.damage === 1 && r.again.result === 'ignored', 'dealDamage hits once per swing id');
  t.expect(r.immune.result === 'immune' && r.blocked.result === 'blocked', 'immune sources and guards stop the damage');
  t.expect(r.weak.damage === 3 && r.hp === 6, 'weak spots multiply it');
  t.expect(r.freeze.result === 'hit' && r.frozen === 1 && r.shatter.result === 'killed' && r.gone, 'a frozen enemy dies to the next hit');
  t.expect(r.bossFrozen === 0, 'bosses never freeze');
  t.expect(r.area.join(' ') === 'probe-foe:hit:2', `damageAt hits what is in the radius (${r.area})`);
  let enemyHits = await t.events('enemy-hit');
  const hitResults = enemyHits.map((e) => e.result).join(',');
  t.expect(hitResults.startsWith('hit,immune,blocked,hit,hit,killed'), `'enemy-hit' reports each result (${hitResults})`);
  t.expect(r.crit[0] === 'hit' && r.crit[1], "a critical hit says so in 'enemy-hit' (hit.crit, for the red word)");

  // The freeze spell's path: freezeAt freezes without hurting, never a boss.
  const hitsBefore = enemyHits.length;
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const { freezeAt, dealDamage } = h.game.damage;
    const b = h.spawn('probe-foe', 12, 3, { hp: 10 });
    const c = h.spawn('probe-foe', 13, 4, { hp: 4 });
    const boss = h.spawn('probe-foe', 11, 4, { hp: 10, boss: true });
    const far = h.spawn('probe-foe', 3, 8, { hp: 10 });
    const name = (e) => (e === b ? 'b' : e === c ? 'c' : e === boss ? 'boss' : 'far');
    const out = {};
    out.frozen = freezeAt(b.x, b.z, 2, 3).map(name).sort().join(',');
    out.times = [b.frozenT, c.frozenT, boss.frozenT ?? 0, far.frozenT ?? 0];
    out.unhurt = b.hp === 10 && c.hp === 4 && !b.removed && !c.removed;
    out.again = freezeAt(b.x, b.z, 2, 5).length;
    out.renewed = [b.frozenT, b.removed, b.hp];
    out.shatter = dealDamage(c, { amount: 1 }).result;
    for (const e of [b, boss, far]) e.remove();
    return out;
  });
  enemyHits = (await t.events('enemy-hit')).slice(hitsBefore);
  t.expect(r.frozen === 'b,c' && r.times.join(',') === '3,3,0,0' && r.unhurt, `freezeAt freezes the enemies in reach for its time, not bosses, with no damage (${r.frozen}; ${r.times})`);
  t.expect(r.again === 2 && r.renewed.join(',') === '5,false,10' && r.shatter === 'killed', 'freezing again only renews the time; the next real hit shatters');
  t.expect(enemyHits.slice(0, 2).every((e) => e.result === 'frozen' && e.damage === 0), "'enemy-hit' reports freezeAt as 'frozen' with no damage");

  // ---------------------------------------------------------------- spawn groups
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const st = h.state;
    const out = {};
    const rect = g.places.currentRect();
    const grp = h.spawn('group', 8, 5, { of: ['probe-foe'], count: [3, 3], minDist: 3 });
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
    const hard = h.spawn('group', 8, 5, { of: ['probe-foe'], count: 4 });
    out.hard = hard.children.length;
    for (const e of hard.children) e.remove();
    st.profile.difficulty = was;
    return out;
  });
  t.expect(r.n === 3 && r.gone && r.spread === 3, "a 'group' marker places its enemies on separate tiles and leaves");
  t.expect(r.far && r.inside && r.floor, 'group enemies stand on free floor of the screen, away from the hero');
  t.expect(r.hard === 6, `hard mode brings 50% more (${r.hard} for 4)`);

  // Remembered clears (game/clears.js) and rare spawns.
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const { TUNING } = g.tuning;
    const C = g.clears;
    const here = g.places.spotHere();
    const key = `${here.area}:${here.screen.join(',')}`;
    const out = { key };
    C.markCleared(key);
    const skipped = h.spawn('group', 8, 5, { of: ['probe-foe'], count: 3 });
    out.skipped = skipped.children.length === 0 && skipped.removed;
    C.forgetCleared((k) => k === key);
    out.forgot = !C.isCleared(key);
    out.noRule = C.remembersClear();
    window.__probeClears = true;
    C.registerClearRule('probe-rule', (ctx) => (window.__probeClears && ctx.key === key ? !ctx.rare : undefined));
    out.rule = C.remembersClear();
    const foe = h.spawn('probe-foe', 3, 3, { hp: 1 });
    g.damage.dealDamage(foe, { amount: 1 });
    out.cleared = C.isCleared(key) && C.clearedScreens().includes(key);
    C.forgetCleared((k) => k === key);
    TUNING.enemy.rare['probe-rare'] = 1;
    const rg = h.spawn('group', 8, 5, { of: ['probe-foe'], count: 3, rare: ['probe-rare'] });
    out.rare = rg.children.map((e) => `${e.type}${e.rare ? '*' : ''}`).sort().join(',');
    for (const e of rg.children) e.remove();
    delete TUNING.enemy.rare['probe-rare'];
    out.rareVisit = C.remembersClear();
    window.__probeClears = false;
    return out;
  });
  t.expect(r.skipped && r.forgot, `a screen remembered as cleared (${r.key}) gets no group enemies until it is forgotten`);
  t.expect(!r.noRule && r.rule && r.cleared, "with a clear rule that says yes, 'room-cleared' remembers the screen");
  t.expect(r.rare === 'probe-foe,probe-foe,probe-rare*' && !r.rareVisit, `a group's rare roll replaces a member and marks it rare; a screen with a rare spawn is not remembered (${r.rare})`);

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
    const foe = h.spawn('probe-foe', 8, 8.7, { hp: 10 });
    g.effects.startEffect('reflect', 10);
    const b2 = window.__shoot(8, 9.5, { x: 0, z: -1 });
    await h.step(0.55);
    out.reflected = b2.reflected && b2.owner === 'hero' && b2.vz > 0 && Math.abs(Math.hypot(b2.vx, b2.vz) - 12) < 1e-6;
    await h.step(0.4);
    out.foeHp = foe.hp;
    out.b2gone = b2.removed;
    g.effects.clearEffect('reflect');
    const b3 = window.__shoot(8, 9.5, { x: 0, z: -1 }, { tier: 3 });
    await h.step(0.7);
    out.tier3 = st.hp;
    out.b3gone = b3.removed;
    foe.remove();
    st.gear.shield = 1;
    return out;
  });
  await kb.up('Shift');
  t.expect(r.blocked, 'a guarded shot of a tier the shield covers is blocked');
  t.expect(r.reflected && r.b2gone && r.foeHp === 8, `under the reflect spell a blocked shot flies back at 1.5x and hurts an enemy (hp 10 -> ${r.foeHp})`);
  t.expect(r.tier3 === r.hp0 - 2 && r.b3gone, 'a shot above the shield tier gets through the guard');
  await t.step(1.2);

  // The slow spell: everything but the hero and his shots runs at
  // TUNING.spells.slow.factor (movers scale dt by effects.worldScale).
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const out = {};
    g.effects.startEffect('slow', 5);
    const bolt = window.__shoot(1.5, 4.5, { x: 1, z: 0 });
    out.scales = [g.effects.worldScale(bolt), g.effects.worldScale(h.player), g.effects.worldScale({ kind: 'projectile', owner: 'hero' })].join(',');
    await h.step(0.1);
    out.travelled = bolt.travelled;
    bolt.remove();
    g.effects.clearEffect('slow');
    out.after = g.effects.worldScale(bolt);
    return out;
  });
  t.expect(r.scales === '0.5,1,1' && near(r.travelled, 0.4, 0.02) && r.after === 1, `the slow spell halves what is not the hero's: an enemy bolt flies ${r.travelled.toFixed(2)} of 0.8 tiles in 0.1 s`);

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
  r = await t.eval(() => window.__voxelHeroes.game.overlay.overlayView());
  t.expect(s.mode === 'dead' && r.visible && /Sunken Gate/.test(r.message), `falling in the Pillar Hall: the game-over panel names the Sunken Gate ("${r.message}")`);
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
    out.areaTrack = g.music.areaMusic(g.places.spotHere().area);
    return out;
  });
  t.expect(r.first.heartContainer && r.first.coins === 250 && !r.second.heartContainer && r.second.coins === 250, 'the first boss kill pays a heart container and 250 coins; a re-fight pays coins only');
  t.expect(r.flag, 'a boss kill sets boss:<dungeon id> (spec P1.5: boss:d1)');
  t.expect(r.complete && !r.twice && r.orbs === '1,2', `taking the orb completes the dungeon once (orbs ${r.orbs})`);
  const bossEvents = (await t.events('boss-defeated')).map((e) => `${e.id}:${e.refight}`).join(' ');
  t.expect(bossEvents === 'probe-boss:false probe-boss:true' && (await last('dungeon-complete'))?.orb === 1, `boss and orb events (${bossEvents})`);
  t.expect(r.music === r.areaTrack && (await last('music-change'))?.id === r.areaTrack, `leaving the crypt plays the overworld's own track (${r.areaTrack ?? 'none yet: the music stops'})`);

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
  // Shopkeepers, counters, the smith, innkeepers and the warp feather open
  // menus by id. The ui registers the real screens in M2; each id keeps a
  // dialog fallback, which { fallback: true } reaches whatever is
  // registered. The choices are read from dialogView(). Text shows at once.
  const choicesNow = () => t.eval(() => window.__voxelHeroes.game.dialog.dialogView()?.choices?.join('|') ?? '');
  const pick = async (n) => {
    for (let i = 0; i < n; i++) await t.press('ArrowRight');
    await t.press('KeyJ');
    await t.step(DT * 2);
  };
  const FALLBACK = { fallback: true };
  await t.eval((fb) => {
    const g = window.__voxelHeroes.game;
    const st = window.__voxelHeroes.state;
    g.settings.setSetting('textSpeed', 'instant');
    st.coins = 500;
    g.shops.registerShop({ id: 'probe-stall', name: 'Probe Stall', entries: [{ id: 'hearty', grant: 'heart', price: 5 }, { id: 'tok', grant: 'token', price: 40 }] });
    window.__menu = 'open';
    window.__tokens = st.tokens;
    g.menus.openMenu('shop', { shop: 'probe-stall', speaker: 'Probe' }, fb).then(() => (window.__menu = 'closed'));
  }, FALLBACK);
  await t.step(DT * 2);
  const shelf = await choicesNow();
  await t.shot('03-shop-menu');
  await pick(1); // the token
  const again = await choicesNow();
  await pick(2); // Leave
  r = await t.eval(() => ({ menu: window.__menu, tokens: window.__voxelHeroes.state.tokens - window.__tokens, coins: window.__voxelHeroes.state.coins, mode: window.__voxelHeroes.state.mode }));
  t.expect(shelf === 'Heart 5|Sword Token 40|Leave' && again === shelf, `the shop fallback lists the shelf as dialog choices (${shelf})`);
  t.expect(r.tokens === 1 && r.coins === 460 && r.menu === 'closed' && r.mode === 'play', `choosing buys through shops.js; Leave closes the menu (${r.coins} coins)`);

  await t.eval((fb) => {
    const g = window.__voxelHeroes.game;
    window.__menu = 'open';
    g.menus.openMenu('smith', { sword: 'probe-blade' }, fb).then(() => (window.__menu = 'closed'));
  }, FALLBACK);
  await t.step(DT * 2);
  const smith = await choicesNow();
  await pick(0); // a level of length
  const smithAfter = await choicesNow();
  await pick(3); // Leave
  r = await t.eval(() => ({ menu: window.__menu, length: window.__voxelHeroes.game.swords.swordLevels('probe-blade').length, coins: window.__voxelHeroes.state.coins }));
  t.expect(smith === 'length 10/12: 100|strength 2/3: 300|Reset|Leave' && smithAfter.startsWith('length 11/12'), `the smith fallback sells the sword's levels (${smith})`);
  t.expect(r.length === 11 && r.coins === 360 && r.menu === 'closed', 'buying a level at the smith pays and adds it');

  await t.eval((fb) => {
    const g = window.__voxelHeroes.game;
    window.__voxelHeroes.state.hp = 1;
    window.__menu = 'open';
    g.menus.openMenu('inn', { inn: 'probe-inn' }, fb).then((stayed) => (window.__menu = stayed));
  }, FALLBACK);
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
    return out;
  });
  t.expect(inn === 'Stay|Leave' && r.menu === true && r.full && r.coins === 350 && r.respawn === '0,1', 'the inn fallback: a night refills, pays and moves the respawn point');

  // One thing on a shop counter: yes or no.
  await t.eval((fb) => {
    window.__menu = 'open';
    window.__voxelHeroes.game.menus.openMenu('counter', { shop: 'probe-stall', entry: 'hearty', speaker: 'Probe' }, fb).then((bought) => (window.__menu = bought));
  }, FALLBACK);
  await t.step(DT * 2);
  const counter = await choicesNow();
  await pick(0); // Buy
  r = await t.eval(() => ({ menu: window.__menu, coins: window.__voxelHeroes.state.coins }));
  t.expect(counter === 'Buy|No' && r.menu === true && r.coins === 345, `the counter fallback asks once and buys (${counter})`);

  // Named places and the warp feather's list.
  r = await t.eval(() => {
    const P = window.__voxelHeroes.game.places;
    const out = {};
    P.registerPlace({ id: 'probe-camp', name: 'Probe Camp', kind: 'other', order: -1, spot: { area: 'overworld', screen: [0, 1], x: 8, z: 5.5, yaw: 0 } });
    try {
      P.registerPlace({ id: 'probe-moon', kind: 'moon', spot: { area: 'overworld' } });
      out.bad = 'accepted';
    } catch (e) {
      out.bad = e.message;
    }
    out.visited = P.placeVisited('probe-camp');
    out.listed = P.warpPlaces(['other'])[0]?.id;
    out.kinds = [P.areaKind('overworld'), P.areaKind('crypt')].join(',');
    return out;
  });
  t.expect(/kind must be one of/.test(r.bad) && r.visited && r.listed === 'probe-camp', 'registerPlace checks the kind; a place in a visited area is on the warp list');
  t.expect(r.kinds === 'overworld,dungeon', `areaKind: the overworld and a dungeon (${r.kinds})`);
  await t.eval((fb) => {
    window.__menu = 'open';
    window.__voxelHeroes.game.menus.openMenu('warp', { kinds: ['other'] }, fb).then((place) => (window.__menu = place?.id ?? 'none'));
  }, FALLBACK);
  await t.step(DT * 2);
  const warpList = await choicesNow();
  await pick(0);
  r = await t.eval(() => window.__menu);
  t.expect(warpList.startsWith('Probe Camp|') && warpList.endsWith('|Stay') && r === 'probe-camp', `the warp fallback lists visited places and returns the one picked (${warpList})`);

  // A screen replaces a fallback; { fallback: true } still reaches it.
  r = await t.eval(() => {
    const M = window.__voxelHeroes.game.menus;
    const out = { builtIn: ['shop', 'counter', 'smith', 'inn', 'warp'].every((id) => M.hasFallback(id)) };
    M.registerFallback('probe-menu', async ({ n }) => `fallback ${n}`);
    out.before = M.usesFallback('probe-menu');
    M.registerMenu('probe-menu', async ({ n }) => n * 2);
    out.after = M.usesFallback('probe-menu');
    for (const [k, fn] of [
      ['twice', () => M.registerMenu('probe-menu', async () => 'again')],
      ['twiceFallback', () => M.registerFallback('probe-menu', async () => 'again')],
      ['noFallback', () => M.openMenu('probe-none', {}, { fallback: true })],
    ]) {
      try {
        fn();
        out[k] = 'accepted';
      } catch (e) {
        out[k] = e.message;
      }
    }
    return out;
  });
  const own = await t.eval(() => {
    const M = window.__voxelHeroes.game.menus;
    return Promise.all([M.openMenu('probe-menu', { n: 21 }), M.openMenu('probe-menu', { n: 21 }, { fallback: true })]);
  });
  t.expect(r.builtIn && r.before && !r.after, 'shop, counter, smith, inn and warp have fallbacks; usesFallback is true until a screen is registered');
  t.expect(own.join(',') === '42,fallback 21', `openMenu opens the screen, and the fallback with { fallback: true } (${own})`);
  t.expect(/already registered/.test(r.twice) && /already has a fallback/.test(r.twiceFallback) && /Unknown menu|has no fallback/.test(r.noFallback), 'one screen and one fallback per id');
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
    g.bestiary.registerBestiary({ id: 'probe-foe', name: 'Probe Foe', band: 1, hp: 2 });
    const before = g.bestiary.bestiaryEntries().find((e) => e.id === 'probe-foe');
    const e = h.spawn('probe-foe', 3, 3, { hp: 2 });
    g.damage.dealDamage(e, { amount: 99 });
    const after = g.bestiary.bestiaryEntries().find((x) => x.id === 'probe-foe');
    const out = { seen: after.seen - before.seen, defeated: after.defeated - before.defeated };
    out.boss = g.music.playMusic('boss');
    try {
      g.music.playMusic('probe-missing');
      out.unknown = 'played';
    } catch (err) {
      out.unknown = err.message;
    }
    g.music.stopMusic();
    const C = g.cards;
    C.registerLoadingCard({ id: 'probe-card', title: 'Probe Card', areas: ['probe-area'], order: 5 });
    try {
      C.registerLoadingCard({ id: 'probe-bad-art', areas: ['probe-area'], art: 42 });
      out.badArt = 'accepted';
    } catch (err) {
      out.badArt = err.message;
    }
    const card = C.cardForArea('probe-area');
    out.card = [card?.id, card?.art];
    const stars = C.galleryCards().filter((c) => c.areas === '*');
    const lowest = stars.reduce((a, c) => (!a || c.order < a.order ? c : a), null);
    out.fallback = [C.cardForArea('probe-nowhere')?.id ?? null, lowest?.id ?? null, stars.length];
    C.markCardSeen('probe-card');
    out.gallery = C.galleryCards()
      .map((c) => `${c.id}${c.seen ? '*' : ''}`)
      .join(' ');
    out.savedCards = h.save().fields.cardsSeen;
    return out;
  });
  t.expect(r.seen === 1 && r.defeated === 1, 'the bestiary counts sightings and wins');
  t.expect(r.boss === 'boss' && /Unknown music/.test(r.unknown), 'playMusic switches tracks and refuses unknown ones');
  t.expect(r.card[0] === 'probe-card' && r.card[1] === null && /art is an image URL/.test(r.badArt), 'a loading card per area; art is an image URL, a model function or null (the default)');
  t.expect(r.fallback[0] === r.fallback[1] && r.fallback[2] === 1, `an area with no card gets the one '*' card (${r.fallback[0]})`);
  t.expect(r.gallery.includes('probe-card*') && r.savedCards.includes('probe-card'), 'shown cards join the saved gallery');

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
    // An applier that throws only warns (expected warning below); the option is still stored.
    let calls = 0;
    S.registerSettingApplier('autosave', (on) => {
      calls++;
      if (on) throw new Error('probe applier refuses');
    });
    out.throwing = [S.setSetting('autosave', true), h.state.settings.autosave, calls];
    S.setSetting('autosave', false);
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
  t.expect(r.throwing[0] === true && r.throwing[1] === true && r.throwing[2] === 2, `an applier that throws only warns, and the option is stored (${r.throwing})`);
  t.expect(r.stored === 'fast' && r.reloaded[0] === 'slow' && r.reloaded[1] === 'A', 'options persist in localStorage; a stored value that is not allowed is ignored');
  t.expect((await t.events('settings-changed')).some((e) => e.key === 'textSpeed' && e.value === 'fast'), "'settings-changed' fires");
  await t.eval(() => {
    window.__said = null;
    window.__voxelHeroes.showDialog('Well met, {hero}.').then(() => (window.__said = 'closed'));
  });
  await t.step(0.4);
  r = await t.eval(() => window.__voxelHeroes.game.dialog.dialogView());
  await t.shot('02-large-text');
  await t.press('Space');
  t.expect(r.text === 'Well met, Ada.' && r.shown === r.text && r.large, `dialogs: {hero} becomes the name, large text, fast typing ("${r.shown}")`);
  t.expect((await t.eval(() => window.__said)) === 'closed', 'Space confirms in a dialog');
  await t.eval(() => window.__voxelHeroes.game.settings.resetSettings());

  // ---------------------------------------------------------------- prompts, pickups, grants
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    g.hero.hero.setFacing('south');
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
    const at = g.hero.hero.position();
    h.state.hp = h.state.maxHp;
    g.pickups.collectPickup(h.spawn('heart', at.lx + 4, at.lz), { by: 'boomerang' });
    h.state.hp = h.state.maxHp - 2;
    g.pickups.collectPickup(h.spawn('heart', at.lx + 4, at.lz), { by: 'boomerang' });
    return { hp: h.state.hp, max: h.state.maxHp, heart: g.tuning.TUNING.pickups.heart };
  });
  const hearts = (await t.events('pickup'))
    .filter((p) => p.by === 'boomerang')
    .map((p) => `${p.type}:${p.wasFull}`)
    .join(' ');
  t.expect(hearts === 'heart:true heart:false' && r.heart === 2 && r.hp === r.max, `'pickup' says whether life was already full (${hearts}); a heart heals TUNING.pickups.heart units`);

  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const out = {};
    window.__gets = [];
    const models = {};
    g.grants.setItemGetPresenter((get) => {
      window.__gets.push(`${get.id}:${get.text}`);
      models[get.id] = get.model;
    });
    out.meta = g.grants.grantMeta('heart-container');
    g.grants.grant('heart-container');
    g.grants.grant('heart-container', 1, { fanfare: false });
    g.grants.grant('gems', 5);
    const lampModel = () => null; // a real one returns a THREE.Object3D
    g.items.registerItem({ id: 'probe-lamp', name: 'Probe Lamp', getText: 'A lamp! It lights dark rooms.', use: () => true, model: lampModel });
    g.grants.grant('probe-lamp');
    g.grants.grant('key');
    g.grants.setItemGetPresenter(null);
    try {
      g.items.registerItem({ id: 'probe-bad-lamp', use: () => true, model: 'lamp' });
      out.badModel = 'accepted';
    } catch (e) {
      out.badModel = e.message;
    }
    out.models = [models['heart-container'] === null, models['probe-lamp'] === lampModel, g.grants.grantMeta('probe-lamp').model === lampModel];
    out.gets = window.__gets.join(' | ');
    out.maxHp = h.state.maxHp;
    return out;
  });
  t.expect(r.meta.fanfare && r.meta.name === 'Heart Container' && r.meta.model === null, 'grantMeta describes a grant (model: null until its owner makes one)');
  t.expect(r.models.every(Boolean) && /model must be a function/.test(r.badModel), 'an item get carries the prize model the hero holds overhead (registerItem model)');
  t.expect(r.gets === 'heart-container:Heart container! Max health up | probe-lamp:A lamp! It lights dark rooms.', `fanfare grants and new items go through the item-get presenter; quiet ones do not (${r.gets})`);
  t.expect((await last('keys-changed'))?.delta === 1, "a small key fires 'keys-changed'");
  t.expect((await t.events('hero-pose')).some((e) => e.pose === 'cheer'), 'an item get puts the hero in the cheer pose');

  // ---------------------------------------------------------------- shared tile actions, presets, HUD regions
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const T = g.tileActions;
    const out = {};
    const coins = h.state.coins;
    // A chest as a tile hook sees it (world tile 900,900; local 4,4 of a screen whose chests name its contents).
    const ctx = { world: { propAt: () => null }, tx: 900, tz: 900, x: 4, z: 4, screen: { def: { chests: { '4,4': 'coins' } } } };
    out.contents = T.chestContents(ctx);
    out.first = T.openChest(ctx, { flag: 'probe:chest', source: 'probe-chest' });
    out.second = T.openChest(ctx, { flag: 'probe:chest' });
    out.open = T.isChestOpen(ctx, 'probe:chest');
    out.coins = h.state.coins - coins;
    h.state.flags.delete('probe:chest');
    const P = h.camera.presets;
    const { TUNING } = g.tuning;
    out.presets = [!!P.boss && !!P['boss-intro'], P.boss?.selectable === false, P.boss?.height === TUNING.camera.bossHeight, P['boss-intro']?.height < P.boss?.height];
    out.regions = ['vitals', 'counters', 'slots', 'minimap', 'prompts', 'toast'].filter((k) => !(k in g.hud.REGIONS));
    return out;
  });
  const chest = await last('chest-opened');
  t.expect(r.contents === 'coins' && r.first && !r.second && r.open && r.coins === 1, 'openChest opens once, by its flag, and grants what the screen lists');
  t.expect(chest?.tx === 900 && chest?.contents === 'coins' && chest?.source === 'probe-chest', "'chest-opened' names the contents and the source");
  t.expect(r.presets.every(Boolean), "the 'boss' and 'boss-intro' camera presets are registered once, for every stream");
  t.expect(r.regions.length === 0, `the HUD regions of the art bible exist (missing: ${r.regions.join(', ') || 'none'})`);

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

  // ---------------------------------------------------------------- the prologue (last: a new game)
  // Until the overworld registers one (registerPrologue), startNewGame warns
  // once and starts at START (an expected warning).
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const st = h.state;
    g.progress.startNewGame({ name: 'Bo', class: 'life', trait: 'might', prologue: true });
    return { owned: st.swords.owned.length, equipped: st.swords.equipped, shield: st.gear.shield, none: g.swords.bladeStats().none === true, reach: g.hero.hero.blade().reach, mode: st.mode };
  });
  const started = await last('new-game');
  swings = await count('sword-swing');
  await t.tap('sword');
  await t.step(0.3);
  t.expect(r.owned === 0 && r.equipped === null && r.shield === 0 && r.none && r.reach === 0 && r.mode === 'play' && started?.prologue === true, "startNewGame({ prologue: true }): no sword and no shield until the king's grants ('new-game' says prologue)");
  t.expect((await count('sword-swing')) === swings, 'with no sword, A swings nothing');
}

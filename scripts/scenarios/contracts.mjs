// The extension points and fixes from the M1 review, one check each: A and B
// carried through slides and warps, the slide landing guard, solid NPCs,
// dialog follow-ups between ticks, dialogs cancelled by a mode change, ammo
// grants and upgradable capacity, HUD widget order, drop odds, map checks
// (markers hiding tiles, warps and spawns by position, warps into missing
// areas), flying bodies, camera presets, knockback at any frame rate, play
// hooks, blasts and the onShot tile hook, safe loading, and the title's
// start button while a dialog is open.
//
// Runtime content (a test item, tile, entity, HUD widget, play hook, mode) is
// registered through __voxelHeroes.api and prefixed "probe".
export const description =
  'Review fixes and M2 contracts: carried presses, landing guard, solid NPCs, dialogs, grants, HUD order, drops, map checks, flying, camera, knockback, hooks, blasts, safe loading.';

const DT = 1 / 60;
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

export default async function contracts(t) {
  const kb = t.page.keyboard;
  const swings = async () => (await t.events('sword-swing')).length;
  await t.track('sword-swing', 'mode-change');
  let s;

  await t.press('Enter');
  await t.step(1.1);
  t.expect((await t.state()).mode === 'play', 'the game starts');

  // ---------------------------------------------------------------- carried presses
  await t.teleport('overworld:1,1', 13.5, 5.5, { yaw: Math.PI / 2 });
  await kb.down('ArrowRight');
  await t.waitFor((st) => st.mode === 'scroll', { seconds: 3 });
  await kb.up('ArrowRight');
  await t.step(20 * DT);
  let n = await swings();
  await t.press('Space');
  t.expect((await t.state()).mode === 'scroll' && (await swings()) === n, 'a sword press during the slide does not swing mid-slide');
  await t.waitFor((st) => st.mode === 'play', { seconds: 2 });
  await t.step(5 * DT);
  let sw = await t.events('sword-swing');
  const arrived = (await t.events('mode-change')).filter((e) => e.from === 'scroll' && e.to === 'play').pop();
  t.expect(sw.length === n + 1, 'the press swings once on arrival in Rattlestone Hollow');
  t.expect(near(sw[sw.length - 1].time - arrived.time, DT, 0.002), 'the swing starts on the first play tick after the slide');

  await t.step(0.5);
  n = await swings();
  await t.press('Escape');
  await t.press('Space');
  await t.press('Escape');
  await t.step(0.2);
  s = await t.state();
  t.expect(s.mode === 'play' && (await swings()) === n, 'a sword press while paused does not swing after resuming');

  await t.teleport('overworld:1,0', 8.5, 1.6, { yaw: Math.PI });
  await kb.down('ArrowUp');
  await t.waitFor((st) => st.mode === 'warp', { seconds: 2 });
  await kb.up('ArrowUp');
  await t.step(10 * DT);
  n = await swings();
  await t.press('Space');
  await t.waitFor((st) => st.mode === 'play' && st.area === 'crypt', { seconds: 2 });
  await t.step(5 * DT);
  t.expect((await swings()) === n + 1, 'a sword press during the doorway warp swings on arrival in the Sunken Gate');

  // ---------------------------------------------------------------- slide landing
  const lane = async (label) => {
    await t.teleport('overworld:2,1', 7.5, 0.9, { yaw: Math.PI });
    await kb.down('ArrowUp');
    await t.waitFor((st) => st.mode === 'play' && st.screenName === 'Mirror Lake', { seconds: 3 });
    await kb.up('ArrowUp');
    const a = await t.state();
    await t.hold('ArrowLeft', 0.3);
    const b = await t.state();
    t.expect(a.lx - b.lx > 1, `${label}: he walks on at once (${a.lx},${a.lz} -> ${b.lx},${b.lz})`);
    return a;
  };
  t.expect((await t.eval(() => window.__voxelHeroes.world.tile(2 * 16 + 7, 9))) === '.', "Mirror Lake's south lane has no bush on it");
  s = await lane('north from Rattlestone Hollow into Mirror Lake');
  t.expect(near(s.lz, 9.87, 0.1), 'he lands 1.1 tiles into the lane as usual');
  await t.eval(() => window.__voxelHeroes.world.setTile(2 * 16 + 7, 9, 'B', { rebuild: false }));
  s = await lane('with a bush planted on the landing spot');
  t.expect(s.lz <= 8.7 + 1e-6, `the slide carries him past the bush instead of into it (lz ${s.lz})`);
  await t.eval(() => window.__voxelHeroes.world.setTile(2 * 16 + 7, 9, '.', { rebuild: false }));

  // ---------------------------------------------------------------- solid NPCs
  await t.teleport('overworld:1,1', 11.5, 4.5, { yaw: -Math.PI / 2 });
  await t.eval(() =>
    window.__voxelHeroes.spawn('npc', 8.5, 4.5, { name: 'Tamsin', lines: ['The road north climbs to Cairn Ridge.', 'Mind the spitters up there.'] })
  );
  await t.hold('ArrowLeft', 1.2);
  s = await t.state();
  // Bodies stop on the last step that keeps them apart (radii 0.34 + 0.3), like walls.
  t.expect(s.lx >= 8.5 + 0.64 - 1e-6 && s.lx < 8.5 + 0.64 + 0.075 && near(s.lz, 4.5, 0.01), `the hero stops against the NPC instead of walking through (lx ${s.lx})`);
  await t.shot('01-npc-blocks');
  await t.press('Space');
  s = await t.state();
  const npcYaw = await t.eval(() => window.__voxelHeroes.entities.find((e) => e.type === 'npc').yaw);
  t.expect(s.mode === 'dialog' && s.dialog && !s.attacking, 'A beside the NPC opens its dialog instead of swinging');
  t.expect(near(npcYaw, Math.PI / 2, 0.01), 'the NPC turns to face the hero');
  await t.step(1.2);
  await t.shot('02-npc-talks');
  await t.press('Space');
  await t.step(1);
  await t.press('Space');
  t.expect((await t.state()).mode === 'play', 'both pages read, play resumes');
  const walk = await t.walkTo(6.5, 4.5);
  t.expect(walk.ok, `the bot paths around the NPC to the far side (${walk.t.toFixed(2)} s)`);
  t.expect(await t.eval(() => !window.__vhBot.walkable(8, 4, true)), "the bot treats the NPC's tile as blocked");

  // ---------------------------------------------------------------- dialog follow-ups
  await t.eval(() => {
    const g = window.__voxelHeroes;
    window.__chain = [];
    g.showDialog(['A gift for the road.'], { speaker: 'Tamsin' })
      .then(() => {
        window.__chain.push(g.state.mode);
        g.give('gems', 7);
        return g.showDialog(['Spend it well.'], { speaker: 'Tamsin' });
      })
      .then(() => window.__chain.push('done'));
  });
  await t.step(1.5);
  const before = await t.state();
  await kb.down('ArrowLeft'); // held across the gap between the two boxes
  await t.press('Space');
  await t.step(1);
  await kb.up('ArrowLeft');
  s = await t.state();
  t.expect(s.mode === 'dialog' && s.dialog, 'the follow-up box opens before the next tick');
  t.expect(s.gems === before.gems + 7, 'code after await showDialog ran between ticks (7 gems)');
  t.expect(s.x === before.x && s.z === before.z, 'the hero did not walk between the two boxes');
  await t.press('Space');
  await t.step(DT);
  t.expect(JSON.stringify(await t.eval(() => window.__chain)) === '["play","done"]', 'the chain finished');

  // ---------------------------------------------------------------- dialogs cut short
  await t.eval(() => {
    window.__cut = 'pending';
    window.__voxelHeroes
      .showDialog(['This box is about to be cut short.'], { choices: ['Yes', 'No'] })
      .then((v) => (window.__cut = v === undefined ? 'undefined' : v));
  });
  await t.step(0.2);
  await t.teleport('overworld:1,1', 8, 5.5);
  await t.step(DT);
  s = await t.state();
  t.expect(s.mode === 'play' && !s.dialog, 'a teleport closes an open dialog');
  t.expect(await t.eval(() => document.getElementById('dialog').hidden), 'the box is hidden');
  t.expect((await t.eval(() => window.__cut)) === 'undefined', 'the cut-short choice dialog resolves with undefined');
  await t.eval(() => {
    window.__again = 'pending';
    window.__voxelHeroes.showDialog(['Still working.']).then(() => (window.__again = 'closed'));
  });
  await t.step(1);
  await t.press('Space');
  t.expect((await t.eval(() => window.__again)) === 'closed' && (await t.state()).mode === 'play', 'the next dialog opens and closes normally');

  await t.eval(() => {
    const g = window.__voxelHeroes;
    window.__probeExits = [];
    g.api.registerMode('probe-menu', { exit: (e) => window.__probeExits.push(e.suspended) });
    g.api.pushMode('probe-menu');
    g.showDialog(['Over the menu.']);
  });
  t.expect((await t.eval(() => window.__voxelHeroes.state.modeStack.join(','))) === 'play,probe-menu', 'a dialog over a menu over play');
  await t.teleport('overworld:1,1', 8, 5.5);
  t.expect((await t.eval(() => window.__probeExits.join(','))) === 'true,false', 'setMode unwinds the stack: the menu under the dialog gets exit too');

  // ---------------------------------------------------------------- grants, ammo, HUD order
  const g = await t.eval(() => {
    const h = window.__voxelHeroes;
    const icon = '<svg viewBox="0 0 8 8"><rect x="2" y="2" width="4" height="4" fill="#2b2b3a"/><rect x="4" y="1" width="1" height="1" fill="#f1c232"/></svg>';
    h.api.registerItem({ id: 'probe-bombs', name: 'Probe bombs', icon, order: 90, ammo: 'probe-bombs', maxAmmo: 10, startAmmo: 1, use: (ctx) => ctx.useAmmo(1) });
    const out = {};
    out.first = h.give('probe-bombs');
    out.a1 = h.api.ammo('probe-bombs');
    out.refill = h.give('probe-bombs', 5);
    out.a2 = h.api.ammo('probe-bombs');
    h.give('probe-bombs', 50);
    out.a3 = h.api.ammo('probe-bombs');
    h.state.probeBag = 3;
    h.api.registerItem({ id: 'probe-sling', order: 91, ammo: 'probe-seeds', maxAmmo: (st) => 10 * (st.probeBag ?? 1), startAmmo: 5, use: () => true });
    out.cap = h.api.maxAmmo('probe-seeds');
    h.give('probe-sling');
    h.give('probe-seeds', 100);
    out.seeds = h.api.ammo('probe-seeds');
    return out;
  });
  t.expect(g.first && g.a1 === 1, 'an item named like its ammo: the first grant gives it with its start ammo');
  t.expect(g.refill && g.a2 === 6 && g.a3 === 10, `later grants add ammo up to the cap (1 -> ${g.a2} -> ${g.a3})`);
  t.expect(g.cap === 30 && g.seeds === 30, 'maxAmmo can be computed from state (a bag upgrade: 30)');

  const order = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.api.registerHudWidget({
      id: 'probe-counter',
      region: 'right',
      order: 25,
      mount: ({ host }) => host.append(Object.assign(document.createElement('span'), { id: 'probe-counter', textContent: 'x3' })),
      key: () => '1',
      render() {},
    });
    const right = document.getElementById('hud-right');
    return {
      widgets: [...right.querySelectorAll(':scope > .hud-widget')].map((e) => e.dataset.widget).join(','),
      last: right.lastElementChild.id,
    };
  });
  t.expect(order.widgets === 'item-slot,probe-counter,gems,keys' && order.last === 'mute', `HUD widgets sit by order (${order.widgets}, then the Sound button)`);
  await t.give('key');
  await t.step(0.2);
  await t.shot('03-hud-order');

  // ---------------------------------------------------------------- drop odds
  const drops = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.api.registerEntity('probe-drop', () => ({ kind: 'probe', priority: 30, x: 0, z: 0, r: 0, removed: false, screenScoped: true, update() {} }));
    const never = () => false;
    const a = [{ chance: 0.1, type: 'probe-drop', when: never }, { chance: 0.12, type: 'probe-drop' }];
    const b = [{ chance: 0.12, type: 'probe-drop' }, { chance: 0.1, type: 'probe-drop', when: never }];
    const count = (table) => {
      let k = 0;
      for (let i = 0; i < 4000; i++) if (h.api.rollDrop(table, 0, 0)) k++;
      return k;
    };
    h.seed(7);
    return { a: count(a), b: count(b) };
  });
  t.expect(drops.a >= 420 && drops.a <= 540 && drops.b >= 420 && drops.b <= 540, `a failed "when" gives nothing to the next entry: 12% either way (${drops.a}, ${drops.b} of 4000)`);
  await t.teleport('overworld:1,1', 8, 5.5); // clears the probe drops

  // ---------------------------------------------------------------- map checks
  const w = await t.eval(() => {
    const { World } = window.__voxelHeroes.api;
    const rows = (top) => [top, ...Array(9).fill('T..............T'), 'TTTTTTTTTTTTTTTT'];
    const out = {};
    try {
      new World().addArea({ id: 'probe-hide', tileset: 'overworld', origin: [90, 0], spawns: { B: 'npc' }, screens: { '0,0': { name: 'Probe', rows: rows('TTTTTTTBTTTTTTTT') } } });
      out.hide = 'no error';
    } catch (e) {
      out.hide = e.message;
    }
    const world = new World();
    world.addArea({
      id: 'probe-doors',
      tileset: 'overworld',
      origin: [90, 0],
      warps: { D: { area: 'probe-missing', screen: [0, 0], x: 8, z: 5 } },
      screens: {
        '0,0': {
          name: 'Probe',
          rows: rows('TTTDTTTDTTTTTTTT'),
          warps: { '3,0': { screen: [0, 0], x: 5, z: 6, yaw: 0 } },
          spawnsAt: { '4,4': { type: 'npc', name: 'Probe' } },
        },
      },
    });
    try {
      world.validate();
      out.validate = 'ok';
    } catch (e) {
      out.validate = e.message;
    }
    out.byPos = world.warpAt(90 * 16 + 3, 0);
    out.byChar = world.warpAt(90 * 16 + 7, 0);
    out.spawns = world.screen(90, 0).spawns.map((sp) => `${sp.type}@${sp.x},${sp.z}`).join(' ');
    out.tile = world.screen(90, 0).tiles[4][4];
    return out;
  });
  t.expect(/marker "B" hides the "bush" tile/.test(w.hide), `a spawn marker that is also a tile stops the build: ${w.hide}`);
  t.expect(w.validate === 'ok', `a warp into an area that is not registered only warns (${w.validate})`);
  t.expect(w.byChar === null, 'and that warp does nothing');
  t.expect(JSON.stringify(w.byPos) === JSON.stringify({ sx: 90, sy: 0, x: 5, z: 6, yaw: 0 }), 'a warp keyed by position wins over the door char');
  t.expect(w.spawns === 'npc@4,4' && w.tile === '.', 'spawnsAt places an entity by position and keeps the map tile');

  // ---------------------------------------------------------------- flying
  const fly = await t.eval(() => {
    const world = window.__voxelHeroes.world;
    const x = 2 * 16 + 5.5; // Mirror Lake, open water at local (5, 2)
    return {
      walker: world.blocked(x, 2.5, 0.3, { flying: false }),
      flyer: world.blocked(x, 2.5, 0.3, { flying: true }),
      tree: world.blocked(2 * 16 + 0.5, 0.5, 0.3, { flying: true }),
    };
  });
  t.expect(fly.walker && !fly.flyer && fly.tree, 'flying bodies cross water but not trees');

  // ---------------------------------------------------------------- camera presets
  const cam = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.api.registerCameraPreset('probe-boss', { pitch: 70 });
    let err = 'none';
    try {
      h.camera.choose('dungeon');
    } catch (e) {
      err = e.message;
    }
    return { mine: h.camera.playerPresets().join(','), err, has: 'probe-boss' in h.camera.presets, now: h.camera.get() };
  });
  t.expect(cam.mine === 'A,B,C,D' && cam.has, 'area presets are registered but not offered to the player');
  t.expect(/not a player choice/.test(cam.err) && cam.now === 'A', 'choosing an area preset is refused');

  // ---------------------------------------------------------------- knockback
  await t.teleport('overworld:1,1', 3.5, 8.5);
  const knock = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const measure = async (dt) => {
      const e = h.spawn('slime', 8.5, 5.5);
      e.spawned = true;
      e.growT = 1;
      e.think = () => {};
      e.hurt({ damage: 0, fromX: e.x - 1, fromZ: e.z, knockback: 9, stun: 0.28 });
      const x0 = e.x;
      while (e.stunT > 0) await h.tick(dt);
      e.remove();
      return +(e.x - x0).toFixed(3);
    };
    return { at30: await measure(1 / 30), at60: await measure(1 / 60), at144: await measure(1 / 144) };
  });
  t.expect(near(knock.at60, 0.937, 0.01), `a sword hit pushes a slime ${knock.at60} tiles at 60 Hz, as before`);
  t.expect([knock.at30, knock.at144].every((d) => Math.abs(d / knock.at60 - 1) < 0.12), `and about as far at 30 and 144 Hz (${knock.at30}, ${knock.at144})`);

  // ---------------------------------------------------------------- play hooks
  await t.eval(() => {
    const h = window.__voxelHeroes;
    Object.assign(window, { __eat: true, __eaten: 0, __after: 0 });
    h.api.registerPlayHook({
      id: 'probe-eat',
      phase: 'input',
      update() {
        if (window.__eat && h.input.pressed('sword')) {
          h.input.consume('sword');
          window.__eaten++;
        }
      },
    });
    h.api.registerPlayHook({ id: 'probe-after', phase: 'after', update: () => window.__after++ });
  });
  await t.step(0.3);
  await t.tap('sword');
  s = await t.state();
  t.expect(!s.attacking && (await t.eval(() => window.__eaten)) === 1, "an 'input' play hook consumes A before the hero sees it");
  t.expect((await t.eval(() => window.__after)) > 10, "an 'after' play hook runs every play tick");
  await t.eval(() => (window.__eat = false));
  await t.tap('sword');
  t.expect((await t.state()).attacking, 'with the hook idle, A swings again');

  // ---------------------------------------------------------------- blasts and shots
  const blast = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const near1 = h.spawn('slime', 8.5, 2.5);
    const far1 = h.spawn('slime', 13.5, 8.5);
    await h.step(0.6); // both pop in
    const before = [near1.hp, far1.hp];
    h.events.emit('explosion', { x: near1.x, z: near1.z, radius: 1.5, damage: 1, source: null });
    return { before, after: [near1.hp, far1.hp] };
  });
  t.expect(blast.after[0] === blast.before[0] - 1 && blast.after[1] === blast.before[1], "an 'explosion' hurts the enemy it covers through onBomb, and only that one");
  const shots = await t.eval(async () => {
    const h = window.__voxelHeroes;
    window.__shots = [];
    h.api.registerTile('overworld', 'Q', { name: 'probe-target', solid: true, onShot: (ctx) => window.__shots.push(`${ctx.x},${ctx.z}:${ctx.hit.source}`) });
    const tx = h.state.sx * 16 + 13;
    const tz = h.state.sy * 11 + 5;
    h.world.setTile(tx, tz, 'Q', { rebuild: false });
    h.spawn('rock-shot', 10.5, 5.5, { vx: 5.5, vz: 0 });
    await h.step(1);
    h.world.setTile(tx, tz, 'p', { rebuild: false });
    return window.__shots.join(' ');
  });
  t.expect(shots === '13,5:rock-shot', `a rock that breaks on a tile calls its onShot hook (${shots})`);

  // ---------------------------------------------------------------- safe loading
  await t.give('gems', 11);
  const load = await t.eval(() => {
    const h = window.__voxelHeroes;
    const good = h.save();
    const bad = { version: 1, fields: { ...good.fields, gems: 42, flags: 5 } };
    const snap = () => JSON.stringify([h.state.gems, h.state.hp, h.player.x, h.player.z, [...h.state.flags]]);
    const was = snap();
    const out = {};
    try {
      h.load({ ...good, version: 999 });
      out.newer = 'loaded';
    } catch (e) {
      out.newer = e.message;
    }
    try {
      h.load(bad);
      out.bad = 'loaded';
    } catch (e) {
      out.bad = e.message;
    }
    out.untouched = snap() === was;
    const slot = h.activeSlot();
    localStorage.setItem('voxel-heroes:slot:3', JSON.stringify({ time: 0, data: bad }));
    out.slot3 = h.loadFromSlot(3);
    out.slotKept = h.activeSlot() === slot;
    out.untouched2 = snap() === was;
    localStorage.removeItem('voxel-heroes:slot:3');
    return out;
  });
  t.expect(/newer version/.test(load.newer), `a save from a newer version is refused (${load.newer})`);
  t.expect(/"flags"/.test(load.bad) && load.untouched, `a damaged save is refused before anything changes (${load.bad})`);
  t.expect(load.slot3 === false && load.slotKept && load.untouched2, 'loadFromSlot on a damaged slot returns false and keeps the game and the active slot');

  // ---------------------------------------------------------------- title + dialog
  await t.eval(() => window.__voxelHeroes.newGame());
  await t.eval(() => {
    window.__title = 'pending';
    window.__voxelHeroes.showDialog(['Before you set out: the crypt door needs a key.'], { choices: ['Go', 'Wait'] }).then((v) => (window.__title = v));
  });
  await t.step(0.2);
  await t.eval(() => document.getElementById('start').click());
  await t.step(DT);
  s = await t.state();
  t.expect(s.mode === 'dialog' && s.overlay, "the title's start button waits while a dialog is open over it");
  await t.step(1.5);
  await t.press('Space');
  s = await t.state();
  t.expect((await t.eval(() => window.__title)) === 0 && s.mode === 'title' && s.overlay, 'answering it returns to the title');
  await t.eval(() => document.getElementById('start').click());
  await t.step(DT);
  t.expect((await t.state()).mode === 'play', 'then the start button starts the game');
}

// The dungeon kit's doors, switches and puzzle tiles (gameplay spec 6.3, 6.4),
// added to the 'dungeon' tileset by the dungeon stream for D1 and the
// dungeons after it. The M1 crypt's chars (L, C, P) keep M1's behaviour.
//
//   l  small-key door      walk into it for TUNING.dungeon.keyPush s with a key
//                          (systems/tile-actions.js openKeyDoor); flag
//                          dungeon:<id>:door:<room>:<side>
//   H  lock-in shutter     open until the hero is in its room with enemies
//                          left: it shuts TUNING.dungeon.shutterDelay s after
//                          he comes in and opens on 'room-cleared'
//   E  event shutter       shut until a switch or a puzzle opens it (setTile)
//   B  boss door           a doorway warp that stays solid until this
//                          dungeon's boss key opens it (flag ...:door:boss)
//   r  red lock            spends a red key (or the master key)
//   U  arena door          a doorway warp shut while the boss lives
//   w  wall switch         a wall tile with a stone eye; the boomerang or an
//                          arrow lights it (the blade does nothing, spec 6.4)
//   Q  push block          push it for pushBlock.push s and it moves a tile;
//                          on a plate (_) it solves the room's puzzle
//   T  tablet              A reads the room's `tablet` text
//   Y  portal              a warp that works once the portal switch is on
//   Z  portal switch       a floor switch: stepping on it opens the portal
//   c  chest               systems/tile-actions.js openChest (contents from
//                          the screen's chest / chests)
//   h  hidden chest        plain floor until the room is cleared (or its
//                          `chestOn` event), then a chest
//   z  cracked wall         looks like any other wall block until a bomb
//                          clears it (fun audit: a secret per screen); it
//                          becomes 'y', whatever the room's `warps` table
//                          sends that char to (usually a small vault); 'z'
//                          not 'k', which d1-boss already spends on its
//                          tombstone marker
//   y  revealed passage    open floor and a warp (what 'z' becomes)
//
// Room behaviour is data on the screen: `clear: 'key' | 'chest' | 'shutters'`
// (what clearing the room gives), `switches: { count, window, opens: 'E' |
// 'key' }`, `puzzle: 'key'` (a block on the plate drops a key), `tablet`.
// Flags are the dungeon's (CONTRACTS 9): dungeon:<id>:<what>:<room>.
import * as THREE from 'three';
import { GROUND_Y } from '../../core/constants.js';
import { state, hasFlag, setFlag } from '../../core/state.js';
import { on, emit } from '../../core/events.js';
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { registerTile } from '../tiles.js';
import { fineFloor, buildWall } from './dungeon.js';
import { BPT } from '../terrain.js';
import { wallFace, chestProp, doorProp, revealBurst, revealGlint } from '../tilekit.js';
import { modelMesh } from '../../models/kit.js';
import { pushBlockModel } from '../../models/props.js';
import { barsModel, bossDoorModel, colorDoorModel, switchModel, tabletModel, portalModel } from '../../models/d1/props.js';
import { enterWarp } from '../../systems/transitions.js';
import { openChest, openKeyDoor } from '../../systems/tile-actions.js';
import { registerPlayHook } from '../../systems/flow.js';
import { enemiesLeft } from '../../systems/combat.js';
import { burst } from '../../systems/particles.js';
import { spawn } from '../../entities/manager.js';
import { world, currentScreen } from '../world.js';
import { dungeonOfArea, roomLabel, hasBossKey, useColorKey, openPortal, bossDefeated } from '../../game/dungeons.js';
import { showDialog } from '../../ui/dialog.js';
import { showBanner } from '../../ui/banner.js';

// ---------------------------------------------------------------- where a tile is
const dungeonOf = (ctx) => dungeonOfArea(ctx.screen?.area?.id ?? ctx.area?.id);
const dungeonId = (ctx) => dungeonOf(ctx)?.id ?? ctx.screen?.area?.id ?? 'none';
export const roomOf = (screen) => {
  const d = dungeonOfArea(screen.area.id);
  return (d && screen.area.id === d.areas[0] ? roomLabel([screen.lx, screen.ly], d.canvas).room : null) ?? `${screen.lx},${screen.ly}`;
};
const sideOf = (ctx) => (ctx.z === 0 ? 'n' : ctx.z === ctx.screen.h - 1 ? 's' : ctx.x === 0 ? 'w' : ctx.x === ctx.screen.w - 1 ? 'e' : 'c');
export const roomFlag = (screen, what) => `dungeon:${dungeonOfArea(screen.area.id)?.id ?? screen.area.id}:${what}:${roomOf(screen)}`;

// Tiles of a screen with char ch: [[x, z], ...] (local).
const tilesOf = (screen, ch, from = screen.tiles) => {
  const out = [];
  from.forEach((row, z) => row.forEach((c, x) => c === ch && out.push([x, z])));
  return out;
};

// A leaf pair standing in a doorway (like tilekit's doorProp): make(right) -> model.
function leafProp(make) {
  return (ctx) => {
    const f = wallFace(ctx);
    const second = ctx.world.tile(ctx.tx - f.along[0], ctx.tz - f.along[1]) === ctx.ch;
    const obj = modelMesh(make(second, ctx));
    obj.position.set(f.x, GROUND_Y, f.z);
    obj.rotation.y = f.yaw;
    return obj;
  };
}

// ---------------------------------------------------------------- small-key door
registerTile('dungeon', 'l', {
  name: 'key-door',
  solid: true,
  doorway: true,
  becomes: '.',
  build: (ctx) => fineFloor(ctx),
  prop: doorProp,
  onPush: (ctx) => openKeyDoor(ctx, { flag: `dungeon:${dungeonId(ctx)}:door:${roomOf(ctx.screen)}:${sideOf(ctx)}` }),
});

// ---------------------------------------------------------------- shutters
// Lock-in shutters: one state for the room the hero is in.
const lockIn = { screen: null, t: -1, shut: false };
const shutterSolid = () => lockIn.shut;

function barsProp(isShut) {
  return (ctx) => {
    const f = wallFace(ctx);
    const obj = new THREE.Group();
    const bars = modelMesh(barsModel());
    obj.add(bars);
    obj.position.set(f.x, GROUND_Y, f.z - Math.cos(f.yaw) * 0.08);
    obj.rotation.y = f.yaw;
    const down = -2.1;
    bars.position.y = isShut(ctx) ? 0 : down;
    obj.userData.tick = (t, dt) => {
      const want = isShut(ctx) ? 0 : down;
      bars.position.y += Math.sign(want - bars.position.y) * Math.min(Math.abs(want - bars.position.y), dt * 12);
      bars.visible = bars.position.y > down + 0.01;
    };
    return obj;
  };
}

registerTile('dungeon', 'H', {
  name: 'shutter',
  driven: 'room', // opened and shut by the room's logic, not by a verb (scenarios/interact.mjs)
  solid: shutterSolid,
  doorway: true,
  build: (ctx) => fineFloor(ctx),
  prop: barsProp((ctx) => lockIn.shut && lockIn.screen === ctx.screen),
});

registerTile('dungeon', 'E', {
  name: 'event-shutter',
  driven: 'room', // opened and shut by the room's logic, not by a verb (scenarios/interact.mjs)
  solid: true,
  doorway: true,
  becomes: '.',
  build: (ctx) => fineFloor(ctx),
  prop: barsProp(() => true),
});

// Open every event shutter of a screen for good.
export function openEventShutters(screen) {
  let any = false;
  for (const [x, z] of tilesOf(screen, 'E')) any = world.setTile(screen.x0 + x, screen.z0 + z, '.', { rebuild: false, persist: true, reason: 'shutter' }) || any;
  if (any) {
    sfx.door();
    emit('shutters-opened', { screen });
  }
  return any;
}

// ---------------------------------------------------------------- boss door, colored lock, arena doors
const bossDoorFlag = (ctx) => `dungeon:${dungeonId(ctx)}:door:boss`;
const pushT = new Map();
function pushed(ctx, need) {
  const k = `${ctx.tx},${ctx.tz}`;
  const held = pushT.get(k);
  const t = (held && state.time - held.at <= (ctx.dt ?? 1 / 60) * 1.5 ? held.t : 0) + (ctx.dt ?? 1 / 60);
  pushT.set(k, { t, at: state.time });
  if (t < need) return false;
  pushT.delete(k);
  return true;
}

function bossWarp(ctx) {
  if (hasFlag(bossDoorFlag(ctx))) enterWarp(ctx);
}
bossWarp.isWarp = true;

registerTile('dungeon', 'B', {
  name: 'boss-door',
  // solid while shut: solid functions see only the body, and the one boss
  // door that can matter is in the room the hero is in
  solid: () => {
    const s = currentScreen();
    return !(s && hasFlag(`dungeon:${dungeonOfArea(s.area.id)?.id ?? s.area.id}:door:boss`));
  },
  doorway: true,
  build: (ctx) => fineFloor(ctx),
  prop: (ctx) => {
    const obj = leafProp((right) => bossDoorModel(right))(ctx);
    const flag = bossDoorFlag(ctx);
    obj.visible = !hasFlag(flag);
    obj.userData.tick = () => (obj.visible = !hasFlag(flag));
    return obj;
  },
  onEnter: bossWarp,
  onPush(ctx) {
    const flag = bossDoorFlag(ctx);
    if (hasFlag(flag)) return false;
    const d = dungeonOf(ctx);
    if (!d || !hasBossKey(d.id)) {
      if (pushed(ctx, 0.6)) showBanner('The great door is sealed. It wants the boss key.');
      return false;
    }
    if (!pushed(ctx, TUNING.dungeon.keyPush)) return false;
    setFlag(flag);
    sfx.door();
    burst(ctx.tx + 0.5, GROUND_Y + 0.6, ctx.tz + 0.5, [0x4a2a2a, 0xe6b43a, 0x3a3a44], 36, { speed: 3, size: 0.1, up: 4 });
    emit('door-opened', { tx: ctx.tx, tz: ctx.tz, kind: 'boss', flag, room: roomOf(ctx.screen), side: sideOf(ctx) });
    return true;
  },
});

registerTile('dungeon', 'r', {
  name: 'red-lock',
  solid: true,
  doorway: true,
  becomes: '.',
  build: (ctx) => fineFloor(ctx),
  prop: leafProp((right) => colorDoorModel('red', right)),
  onPush(ctx) {
    if (!pushed(ctx, TUNING.dungeon.keyPush)) return false;
    if (!useColorKey('red')) {
      showBanner('A red lock. It wants a red key.');
      return false;
    }
    const flag = `dungeon:${dungeonId(ctx)}:door:${roomOf(ctx.screen)}:${sideOf(ctx)}`;
    const opts = { rebuild: false, persist: true, reason: 'unlock' };
    world.setTile(ctx.tx, ctx.tz, '.', opts);
    for (const dx of [-1, 1, 0]) for (const dz of dx ? [0] : [-1, 1]) if (world.tile(ctx.tx + dx, ctx.tz + dz) === 'r') world.setTile(ctx.tx + dx, ctx.tz + dz, '.', opts);
    setFlag(flag);
    sfx.door();
    emit('door-opened', { tx: ctx.tx, tz: ctx.tz, kind: 'red', flag, room: roomOf(ctx.screen), side: sideOf(ctx) });
    return true;
  },
});

// Arena doors: warps shut while the dungeon's boss is alive.
const arenaOpen = (screen) => {
  const d = screen && dungeonOfArea(screen.area.id);
  return !!d && bossDefeated(d.id);
};
function arenaWarp(ctx) {
  if (arenaOpen(ctx.screen)) enterWarp(ctx);
}
arenaWarp.isWarp = true;
registerTile('dungeon', 'U', {
  name: 'arena-door',
  solid: () => !arenaOpen(currentScreen()),
  doorway: true,
  build: (ctx) => fineFloor(ctx),
  prop: (ctx) => barsProp(() => !arenaOpen(ctx.screen))(ctx),
  onEnter: arenaWarp,
});

// ---------------------------------------------------------------- wall switches
// A switch stays lit TUNING.dungeon.wallSwitch s; when every switch of the
// room is lit at once the room's `switches.opens` happens (once, flagged).
const lit = new Map(); // 'tx,tz' -> time lit
registerTile('dungeon', 'w', {
  name: 'wall-switch',
  solid: true,
  height: 16,
  build: (ctx) => buildWall(ctx),
  prop(ctx) {
    const f = wallFace(ctx);
    const obj = new THREE.Group();
    const off = modelMesh(switchModel(false));
    const onM = modelMesh(switchModel(true));
    obj.add(off, onM);
    obj.position.set(f.x, GROUND_Y + 0.55, f.z + (f.yaw === 0 ? 0.02 : 0));
    obj.rotation.y = f.yaw;
    const key = `${ctx.tx},${ctx.tz}`;
    const done = () => hasFlag(roomFlag(ctx.screen, 'switches'));
    const tick = () => {
      const on = lit.has(key) || done();
      onM.visible = on;
      off.visible = !on;
    };
    tick();
    obj.userData.tick = tick;
    return obj;
  },
  onShot(ctx) {
    const src = ctx.projectile?.source ?? ctx.hit?.source;
    if (src !== 'boomerang' && src !== 'arrow') return false;
    pressWallSwitch(ctx.screen, ctx.tx, ctx.tz);
    return true;
  },
});

export function pressWallSwitch(screen, tx, tz) {
  const spec = screen.def.switches ?? {};
  const flag = roomFlag(screen, 'switches');
  lit.set(`${tx},${tz}`, state.time);
  sfx.block();
  emit('switch-pressed', { id: flag, tx, tz, kind: 'wall', on: true });
  if (hasFlag(flag)) return;
  const all = tilesOf(screen, 'w').every(([x, z]) => lit.has(`${screen.x0 + x},${screen.z0 + z}`));
  if (!all) return;
  setFlag(flag);
  sfx.pickup?.();
  if (spec.opens === 'key') dropKey(screen, 'switch');
  else openEventShutters(screen);
  emit('secret-found', { kind: 'switches', tx, tz });
}

// ---------------------------------------------------------------- push blocks
registerTile('dungeon', 'Q', {
  name: 'push-block',
  solid: true,
  build: (ctx) => fineFloor(ctx),
  prop: (ctx) => {
    const obj = modelMesh(pushBlockModelCached());
    obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
    return obj;
  },
  onPush(ctx) {
    const p = ctx.player;
    if (!p) return false;
    const dx = ctx.tx + 0.5 - p.x;
    const dz = ctx.tz + 0.5 - p.z;
    const [sx, sz] = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
    if (!pushed(ctx, TUNING.dungeon.pushBlock.push)) return false;
    const s = ctx.screen;
    if (s.base[ctx.z][ctx.x] === '_' || hasFlag(roomFlag(s, 'puzzle'))) return false; // set on its plate
    const nx = ctx.x + sx;
    const nz = ctx.z + sz;
    if (nx < 1 || nz < 1 || nx > s.w - 2 || nz > s.h - 2) return false;
    const to = s.tiles[nz][nx];
    if (to !== '.' && to !== '_') return false;
    const ttx = ctx.tx + sx;
    const ttz = ctx.tz + sz;
    const under = s.base[ctx.z][ctx.x] === 'Q' ? '.' : s.base[ctx.z][ctx.x];
    world.setTile(ctx.tx, ctx.tz, under, { rebuild: false, reason: 'push' });
    world.setTile(ttx, ttz, 'Q', { rebuild: false, reason: 'push' });
    sfx.door();
    emit('block-pushed', { tx: ctx.tx, tz: ctx.tz, toX: ttx, toZ: ttz });
    if (to === '_') solvePuzzle(s);
    return true;
  },
});
const pushBlockModelCached = () => pushBlockModel();

function solvePuzzle(screen) {
  const flag = roomFlag(screen, 'puzzle');
  if (hasFlag(flag)) return;
  setFlag(flag);
  // keep the solved layout
  screen.tiles.forEach((row, z) =>
    row.forEach((ch, x) => {
      if (ch !== screen.base[z][x]) state.tileEdits[`${screen.x0 + x},${screen.z0 + z}`] = ch;
    })
  );
  emit('secret-found', { kind: 'puzzle', tx: screen.x0, tz: screen.z0 });
  if (screen.def.puzzle === 'key') dropKey(screen, 'puzzle');
  else openEventShutters(screen);
}

// Unsolved blocks go back where they were when the hero leaves (spec 6.4).
on('screen-leave', ({ screen } = {}) => {
  if (!screen?.def || hasFlag(roomFlag(screen, 'puzzle'))) return;
  screen.tiles.forEach((row, z) =>
    row.forEach((ch, x) => {
      const b = screen.base[z][x];
      if ((ch === 'Q' || b === 'Q') && ch !== b) world.setTile(screen.x0 + x, screen.z0 + z, b, { rebuild: false, reason: 'reset' });
    })
  );
});

// ---------------------------------------------------------------- tablet, portal
registerTile('dungeon', 'T', {
  name: 'tablet',
  solid: true,
  build: (ctx) => fineFloor(ctx),
  prop: (ctx) => {
    const obj = modelMesh(tabletModel());
    obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
    return obj;
  },
  onInteract(ctx) {
    const text = ctx.screen.def.tablet ?? 'The letters are worn away.';
    showDialog(text, { speaker: 'Tablet' });
    return true;
  },
});

function portalWarp(ctx) {
  const d = dungeonOf(ctx);
  if (d && hasFlag(`dungeon:${d.id}:portal`)) enterWarp(ctx);
}
portalWarp.isWarp = true;
registerTile('dungeon', 'Y', {
  name: 'portal',
  build: (ctx) => fineFloor(ctx),
  prop: (ctx) => {
    const d = dungeonOf(ctx);
    const flag = `dungeon:${d?.id}:portal`;
    const obj = new THREE.Group();
    const off = modelMesh(portalModel(false));
    const onM = modelMesh(portalModel(true));
    obj.add(off, onM);
    obj.position.set(ctx.cx, GROUND_Y + 0.01, ctx.cz);
    const tick = () => {
      onM.visible = hasFlag(flag);
      off.visible = !onM.visible;
    };
    tick();
    obj.userData.tick = tick;
    return obj;
  },
  onEnter: portalWarp,
});

registerTile('dungeon', 'Z', {
  name: 'portal-switch',
  build: (ctx) => {
    fineFloor(ctx);
    const { F, FX0, FZ0 } = ctx;
    for (let z = 3; z < 13; z++) for (let x = 3; x < 13; x++) F.set(FX0 + x, 0, FZ0 + z, Math.hypot(x - 7.5, z - 7.5) < 3 ? 0x7ad8ff : 0x9a7866);
  },
  onEnter(ctx) {
    const d = dungeonOf(ctx);
    if (!d || hasFlag(`dungeon:${d.id}:portal`)) return;
    openPortal(d.id);
    sfx.door();
    emit('switch-pressed', { id: `dungeon:${d.id}:portal`, tx: ctx.tx, tz: ctx.tz, kind: 'floor', on: true });
    showBanner('Far off, a portal hums awake.');
  },
});

// ---------------------------------------------------------------- chests
registerTile('dungeon', 'c', {
  name: 'chest-2',
  solid: true,
  build: (ctx) => fineFloor(ctx),
  prop: chestProp,
  onPush: (ctx) => openChest(ctx),
});
registerTile('dungeon', 'h', { name: 'chest-spot', driven: 'room', build: (ctx) => fineFloor(ctx) }); // floor where the room's chest appears

// ---------------------------------------------------------------- secrets (fun audit: a secret per
// screen). A cracked wall is built exactly like any other wall block (buildWall handles wherever it
// stands in the room, boundary or not), so it hides in plain sight; a bomb clears it to 'y', a
// doorway the room's own `warps` table sends wherever it likes (usually a one-room vault off the
// dungeon's free columns, the way the boss arena sits off its own).
registerTile('dungeon', 'z', {
  name: 'cracked-wall',
  solid: true,
  height: 2 * BPT,
  becomes: 'y',
  build: (ctx) => buildWall(ctx),
  prop(ctx) {
    const obj = new THREE.Group();
    obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
    revealGlint(ctx, obj, 1.6);
    return obj;
  },
  onBomb(ctx) {
    const { world, tx, tz, def } = ctx;
    if (!world.setTile(tx, tz, def.becomes, { persist: true, reason: 'bomb-wall' })) return false;
    revealBurst(tx, tz, [0x9a8866, 0x6a5a44, 0xc8b898]);
    emit('secret-found', { kind: 'bomb-wall', tx, tz });
    return true;
  },
});
registerTile('dungeon', 'y', {
  name: 'revealed-passage',
  doorway: true,
  onEnter: enterWarp,
  build: (ctx) => fineFloor(ctx),
});

// ---------------------------------------------------------------- room rules
// A key that drops once per room (clear, switch, puzzle).
export function dropKey(screen, why) {
  const flag = roomFlag(screen, 'key');
  if (hasFlag(flag)) return null;
  setFlag(flag);
  sfx.door();
  const [x, z] = screen.def.keyAt ?? [8, 6];
  emit('secret-found', { kind: `key-${why}`, tx: screen.x0 + x, tz: screen.z0 + z });
  return placeKey(screen);
}
const placeKey = (screen) => {
  const [x, z] = screen.def.keyAt ?? [8, 6];
  return spawn('key', { x: screen.x0 + x, z: screen.z0 + z, life: Infinity });
};
// A dropped key waits in its room until it is taken.
on('pickup', ({ type } = {}) => {
  const s = currentScreen();
  if (type === 'key' && s?.area?.rooms && hasFlag(roomFlag(s, 'key'))) setFlag(roomFlag(s, 'keytaken'));
});

function showChests(screen) {
  for (const [x, z] of tilesOf(screen, 'h')) world.setTile(screen.x0 + x, screen.z0 + z, 'c', { rebuild: false, persist: true, reason: 'chest' });
}

on('room-cleared', ({ screen } = {}) => {
  const s = screen?.def ? screen : currentScreen();
  if (!s?.def) return;
  if (lockIn.screen === s && lockIn.shut) {
    lockIn.shut = false;
    sfx.door();
    emit('shutters-opened', { screen: s });
  }
  lockIn.t = -1;
  const clear = s.def.clear;
  if (clear === 'key') dropKey(s, 'clear');
  if (clear === 'chest') {
    setFlag(roomFlag(s, 'cleared'));
    showChests(s);
  }
  if (clear === 'shutters') openEventShutters(s);
});

on('room-enter', ({ screen } = {}) => {
  const s = screen?.def ? screen : currentScreen();
  lockIn.screen = s;
  lockIn.shut = false;
  lockIn.t = -1;
  if (!s?.def || !s.area?.rooms) return;
  if (tilesOf(s, 'H').length && enemiesLeft() > 0) lockIn.t = TUNING.dungeon.shutterDelay;
  // a room whose chest showed stays that way
  if (s.def.clear === 'chest' && hasFlag(roomFlag(s, 'cleared'))) showChests(s);
  if (hasFlag(roomFlag(s, 'key')) && !hasFlag(roomFlag(s, 'keytaken'))) placeKey(s);
});
on('screen-leave', () => {
  lockIn.shut = false;
  lockIn.t = -1;
  lit.clear();
});

registerPlayHook({
  id: 'dungeon-kit',
  phase: 'after',
  update(dt) {
    if (lockIn.t >= 0) {
      lockIn.t -= dt;
      if (lockIn.t < 0) {
        if (enemiesLeft() > 0) {
          lockIn.shut = true;
          sfx.door();
          emit('shutters-closed', { screen: lockIn.screen });
        }
      }
    }
    // wall switches go dark after their window
    const win = TUNING.dungeon.wallSwitch ?? 5;
    for (const [k, t] of lit) if (state.time - t > win) lit.delete(k);
  },
});

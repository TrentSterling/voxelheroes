// Tile behaviours more than one tileset shares, with the M2 contract's
// context: chests (towns, caves and dungeons open them the same way) and the
// small-key door. New tiles in world/tiles/* call these from their hooks:
//
//   registerTile('town', 'C', { ..., prop: chestProp, onPush: (ctx) => openChest(ctx) });
//   onPush: (ctx) => openChest(ctx, { contents: 'bow', flag: 'overworld:chest:bow' })
//   onPush: (ctx) => openKeyDoor(ctx, { flag: 'dungeon:d1:door:J-4:n' })
//
// openChest(ctx, { source = 'chest', contents = chestContents(ctx), flag })
//   opens once (the flag, default chest:tx,tz), swings the lid of the tile's
//   prop, hands the contents to grant() with { source } (so the item get
//   knows it came from a chest and may wait for a button), and emits
//   'chest-opened' { tx, tz, contents, source }. The fanfare is the item
//   get's (the ui's presenter); the chest itself only clicks open.
// openKeyDoor(ctx, { flag, twin = true, kind = 'small' })
//   onPush for a locked door: after TUNING.dungeon.keyPush s of pushing,
//   spends a small key of the current key group, opens the door (and its
//   twin beside it), sets `flag` (default door:tx,tz) and emits
//   'door-opened' { tx, tz, kind, flag }. Boss-key and colored locks are the
//   dungeon stream's, in its own tile files, with the same event.
//
// world/tilekit.js (look) keeps M1's openChest and unlockDoor for the M1
// crypt and overworld chars ('C', 'L'), which the default play-test pins
// (docs/CONTRACTS.md, "Fixtures"); new chests and doors use these.
import { GROUND_Y } from '../core/constants.js';
import { state, hasFlag, setFlag } from '../core/state.js';
import { emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { burst } from './particles.js';
import { keyCount, useKey } from './keys.js';
import { grant } from './grants.js';
import { showBanner } from '../ui/banner.js';

export const chestFlag = (tx, tz) => `chest:${tx},${tz}`;

// What a chest holds: the screen's chests['x,z'] (local tile) or chest, as grant() takes it.
export const chestContents = (ctx) => ctx.screen?.def?.chests?.[`${ctx.x},${ctx.z}`] ?? ctx.screen?.def?.chest ?? null;

export const isChestOpen = (ctx, flag = chestFlag(ctx.tx, ctx.tz)) => hasFlag(flag);

export function openChest(ctx, { source = 'chest', contents = chestContents(ctx), flag = chestFlag(ctx.tx, ctx.tz) } = {}) {
  const { world, tx, tz } = ctx;
  if (hasFlag(flag)) return false;
  setFlag(flag);
  const prop = world?.propAt?.(tx, tz);
  if (prop) prop.userData.opening = true;
  sfx.door();
  burst(tx + 0.5, GROUND_Y + 0.8, tz + 0.5, [0xf1c232, 0xffffff, 0xe8364a], 40, { speed: 2.5, size: 0.08, up: 6, life: 1.3 });
  if (contents) grant(contents, 1, { source });
  else showBanner('The chest is empty');
  emit('chest-opened', { tx, tz, contents, source });
  return true;
}

// Seconds the hero has pushed each door tile ('tx,tz' -> { t, at }); a push
// that stops for a tick starts over.
const pushing = new Map();

export function openKeyDoor(ctx, { flag = `door:${ctx.tx},${ctx.tz}`, twin = true, kind = 'small', push = TUNING.dungeon.keyPush } = {}) {
  const { world, tx, tz, def, ch, dt = 1 / 60 } = ctx;
  if (world.tile(tx, tz) !== ch) return false;
  if (keyCount() <= 0) return false;
  const key = `${tx},${tz}`;
  const held = pushing.get(key);
  const t = (held && state.time - held.at <= dt * 1.5 ? held.t : 0) + dt;
  pushing.set(key, { t, at: state.time });
  if (t < push - 1e-9) return false;
  pushing.delete(key);
  const to = def.becomes ?? '.';
  const opts = { rebuild: false, persist: true, reason: 'unlock' };
  world.setTile(tx, tz, to, opts);
  setFlag(flag);
  if (twin)
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
      if (world.tile(tx + dx, tz + dz) === ch && world.setTile(tx + dx, tz + dz, to, opts)) setFlag(flag === `door:${tx},${tz}` ? `door:${tx + dx},${tz + dz}` : flag);
  useKey();
  sfx.door();
  burst(tx + 0.5, GROUND_Y + 0.6, tz + 0.5, [0x7a4a26, 0x5e371b, 0x3a3a44], 30, { speed: 3, size: 0.1, up: 4 });
  emit('door-opened', { tx, tz, kind, flag });
  return true;
}

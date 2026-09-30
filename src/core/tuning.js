// TUNING: every gameplay number in one object, as the gameplay spec's
// Appendix A lays it out (units: tiles, seconds, tiles per second, life in
// half-heart units, magic in whole gems, money in coins, degrees).
//
//   import { TUNING, ticks } from '../core/tuning.js';
//   const speed = TUNING.hero.walk;           // 4.5 tiles per second
//   const lock = ticks(TUNING.damage.knockLock); // 15 ticks
//
// Each section lives in src/tuning/<owner>.js so every stream edits only its
// own file (docs/CONTRACTS.md, "Ownership"). This file only assembles them and
// does not change during M2. Content tables (drop packs, shop tiers, sword
// tables, enemy stats) live in their registries, not here.
import * as W from '../tuning/world.js';
import * as H from '../tuning/hero.js';
import * as E from '../tuning/enemy.js';
import * as B from '../tuning/boss.js';
import * as D from '../tuning/dungeon.js';
import * as I from '../tuning/items.js';
import * as O from '../tuning/economy.js';
import * as U from '../tuning/ui.js';
import { stream } from '../tuning/stream.js';

export const TUNING = {
  sim: { hz: 60 }, // the fixed simulation rate (core/loop.js)
  world: W.world,
  camera: W.camera,
  scroll: W.scroll,
  load: W.load,
  // the streamed outdoors and building ahead (systems/streaming.js); assembled here like every
  // other section even though streaming.js also sets it (`TUNING.stream ??= stream`, harmless once
  // this import has already run: same module, same object, so that line is a no-op)
  stream,
  minimap: U.minimap,
  worldMap: U.worldMap,
  hero: H.hero,
  sword: H.sword,
  pots: H.pots,
  guard: H.guard,
  dash: H.dash,
  damage: H.damage,
  readability: U.readability,
  enemy: E.enemy,
  boss: B.boss,
  traps: B.traps,
  dungeon: D.dungeon,
  pickups: I.pickups,
  items: I.items,
  spells: I.spells,
  progression: I.progression,
  economy: O.economy,
  drops: E.drops,
  options: U.options,
  profile: U.profile,
  menu: U.menu,
  toasts: U.toasts,
};

export const TICK = 1 / TUNING.sim.hz; // seconds per simulation tick

// Seconds -> whole simulation ticks.
export const ticks = (seconds) => Math.round(seconds * TUNING.sim.hz);

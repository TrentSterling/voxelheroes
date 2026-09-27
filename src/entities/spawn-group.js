// 'group': a spawn marker that places a random handful of enemies on free
// floor tiles of its screen every time the screen is entered (gameplay spec
// 5.5: 2 to 6 on an overworld screen; 6.5: 1 to 5 in a dungeon room, placed
// at random on each entry). Areas use it like any entity type:
//
//   spawns: { g: { type: 'group', of: ['blob', 'blob', 'hopper'], count: [2, 6] } }
//
// Fields
//   of       entity types, one picked at random per enemy (repeat a type to
//            weight it)
//   count    [min, max] or a number; hard mode adds TUNING.enemy.hardExtra
//            (50% more)
//   minDist  tiles from the hero (default TUNING.enemy.spawnMinDist)
//   rare     rare types this screen may roll (gameplay spec 5.5):
//            ['treasure-slime', 'wyrm']. Each rolls once per entry at
//            TUNING.enemy.rare[type] (times rareHardMultiplier in hard mode);
//            a hit replaces one member of the group and gets rare: true.
//            Not passed on.
//   anything else (variant, crowned, ...) is passed on to every enemy. In
//   M2 the Enemy base (foes-overworld) rolls the crown at
//   TUNING.enemy.crownedChance unless opts.crowned is true or false (a map
//   says crowned: false where a crown makes no sense).
// The marker's tile is only a candidate like any other. Free tiles are
// floor: not solid, not water, pits or lava (blocksShots: false), no warp or
// trigger (onEnter), and in a room not the wall ring. Placement draws from
// the gameplay random stream (core/random.js), so a seeded test sees the
// same layout. With `once: true` in the marker, the group never comes back
// after one of its enemies calls markDone(). A screen remembered as cleared
// (game/clears.js isCleared) places nothing.
//
// Owner in M2: foes-overworld (docs/CONTRACTS.md, "Enemies").
import { random } from '../core/random.js';
import { TUNING } from '../core/tuning.js';
import { world, currentScreen } from '../world/world.js';
import { isSolidDef } from '../world/tiles.js';
import { screenRect, screenId } from '../game/places.js';
import { difficulty } from '../game/progress.js';
import { isCleared } from '../game/clears.js';
import { Entity } from './entity.js';
import { player } from './player.js';
import { spawn } from './manager.js';
import { registerEntity, hasEntityType } from './registry.js';

const warned = new Set();

export function groupSize(count) {
  const [lo, hi] = Array.isArray(count) ? count : [count, count];
  let n = lo + Math.floor(random() * (hi - lo + 1));
  if (difficulty() === 'hard') n = Math.round(n * (1 + TUNING.enemy.hardExtra));
  return Math.max(0, n);
}

// Free floor tiles of a screen (global tile coordinates), at least minDist
// tiles from the hero.
export function freeTiles(screen, minDist = TUNING.enemy.spawnMinDist) {
  const r = screenRect(screen);
  if (!r) return [];
  const ring = screen.area?.rooms ? 1 : 0;
  const out = [];
  for (let z = r.z0 + ring; z < r.z1 - ring; z++)
    for (let x = r.x0 + ring; x < r.x1 - ring; x++) {
      const def = world.tileDefAt(x, z);
      if (!def || isSolidDef(def, null) || def.blocksShots === false || def.onEnter) continue;
      if (Math.hypot(x + 0.5 - player.x, z + 0.5 - player.z) < minDist) continue;
      out.push([x, z]);
    }
  return out;
}

class SpawnGroup extends Entity {
  constructor(opts = {}) {
    super(opts);
    this.kind = 'spawner';
    this.opts = opts;
    this.children = [];
  }

  onAdd() {
    // x, z and r are the marker's own; everything left in `extra` goes to the enemies.
    const { of = [], count = 1, minDist, rare = [], screen = currentScreen(), x, z, r, spawnIndex = 0, spawnFlag = null, ...extra } = this.opts;
    if (screen && isCleared(screenId(screen))) {
      this.remove();
      return;
    }
    const known = (t) => {
      if (hasEntityType(t)) return true;
      if (!warned.has(t)) console.warn(`spawn group: no entity type "${t}"; skipped`);
      warned.add(t);
      return false;
    };
    const types = of.filter(known);
    const tiles = types.length ? freeTiles(screen, minDist ?? TUNING.enemy.spawnMinDist) : [];
    const n = Math.min(groupSize(count), tiles.length);
    const hard = difficulty() === 'hard' ? TUNING.enemy.rareHardMultiplier : 1;
    const rares = n > 0 ? rare.filter(known).filter((t) => random() < (TUNING.enemy.rare[t] ?? 0) * hard).slice(0, n) : [];
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(random() * (tiles.length - i));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      const isRare = i < rares.length;
      const type = isRare ? rares[i] : types[Math.floor(random() * types.length)];
      const [tx, tz] = tiles[i];
      const opts = { ...extra, x: tx + 0.5, z: tz + 0.5, spawnIndex: spawnIndex + i, spawnFlag, screen };
      if (isRare) opts.rare = true;
      this.children.push(spawn(type, opts));
    }
    this.remove();
  }
}

registerEntity('group', (opts) => new SpawnGroup(opts));

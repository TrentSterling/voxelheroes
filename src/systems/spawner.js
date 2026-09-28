// Screen spawns: turn a screen's map markers into entities.
//
// Outdoors a screen's markers spawn when the screen comes into the live ring around the hero
// (systems/streaming.js), into its own bucket (entities/manager.js), already standing there:
// { bucket: true } also skips an enemy's appear-in (the puff and the grow): nobody saw it
// arrive. A room, or a screen the hero lands on by teleport, spawns when it is entered, onto the
// stage, and its enemies appear in as always.
//
// A marker may name an entity type that another feature branch provides. If
// that type is not registered (yet), the marker is skipped with one warning
// instead of stopping the game.
import { hasFlag } from '../core/state.js';
import { spawn, inBucket, bucketOf } from '../entities/manager.js';
import { hasEntityType } from '../entities/registry.js';

const warned = new Set();

// An enemy (entities/enemy.js) placed where nobody watched it appear: already grown, no puff.
function settle(e) {
  if (e.spawned === false) {
    e.spawned = true;
    e.growT = 1;
    e.object?.scale.setScalar(1);
  }
  e.onWake?.();
}

function spawnMarkers(screen) {
  const ox = screen.x0;
  const oz = screen.z0;
  const out = [];
  let enemyIndex = 0; // staggers enemy appearances
  for (const sp of screen.spawns) {
    if (sp.flag && hasFlag(sp.flag)) continue;
    if (!hasEntityType(sp.type)) {
      if (!warned.has(sp.type)) console.warn(`spawn: no entity type "${sp.type}" (marker on ${screen.name}); skipped`);
      warned.add(sp.type);
      continue;
    }
    const e = spawn(sp.type, { ...sp.opts, x: ox + sp.x + 0.5, z: oz + sp.z + 0.5, spawnIndex: enemyIndex, spawnFlag: sp.flag, screen });
    out.push(e);
    if (e.kind === 'enemy') enemyIndex++;
  }
  return out;
}

// Spawn a screen's markers: onto the stage (the hero is there), or with { bucket: true } into the
// screen's own bucket, settled (see the top).
export function spawnScreen(screen, { bucket = false } = {}) {
  if (!bucket) return spawnMarkers(screen);
  inBucket(screen, () => spawnMarkers(screen));
  const list = bucketOf(screen); // a spawn group's members too (the group put them there)
  for (const e of list) settle(e);
  return list;
}

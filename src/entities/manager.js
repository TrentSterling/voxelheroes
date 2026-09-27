// The live entities on screen (everything except the hero).
//
// Entities update in `priority` order (enemies 0, projectiles 10, pickups 20,
// everything else 30), so a rock spat this frame moves this frame and a gem
// dropped this frame can be picked up this frame, as in the prototype.
// Removal is deferred until the end of the update, so removing an entity in
// the middle of the loop never skips another.
import { scene } from '../core/renderer.js';
import { createEntity } from './registry.js';

export const entities = []; // live list, sorted by priority

let frameId = 0;
let updating = false;

export function addEntity(e) {
  let i = entities.length;
  while (i > 0 && entities[i - 1].priority > e.priority) i--;
  entities.splice(i, 0, e);
  if (e.object) scene.add(e.object);
  e.onAdd?.();
  return e;
}

// Create a registered type and put it in the world: spawn('slime', { x, z }).
export function spawn(type, opts = {}) {
  return addEntity(createEntity(type, opts));
}

export function removeEntity(e) {
  if (e.removed) return;
  e.removed = true;
  if (e.object) scene.remove(e.object);
  e.onRemove?.();
}

function compact() {
  if (updating) return; // updateEntities compacts when its loop is done
  let j = 0;
  for (let i = 0; i < entities.length; i++) if (!entities[i].removed) entities[j++] = entities[i];
  entities.length = j;
}

export function updateEntities(dt) {
  frameId++;
  updating = true;
  try {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.removed || e._frame === frameId) continue;
      e._frame = frameId;
      e.update(dt);
    }
  } finally {
    updating = false;
  }
  compact();
}

// Leaving a screen removes everything that belongs to it.
export function clearScreenEntities() {
  for (const e of entities) if (e.screenScoped) removeEntity(e);
  compact();
}

export const liveEntities = () => entities.filter((e) => !e.removed);

export const entitiesOfKind = (kind) => entities.filter((e) => !e.removed && e.kind === kind);

// Entities whose centre is within `radius` (+ their own r) of (x, z).
export function entitiesNear(x, z, radius, filter = null) {
  return entities.filter(
    (e) => !e.removed && Math.hypot(e.x - x, e.z - z) <= radius + e.r && (!filter || filter(e))
  );
}

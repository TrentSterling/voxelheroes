// The live entities (everything except the hero).
//
// `entities` is the stage: the hero's screen's people, foes, pickups and shots, plus anything not
// tied to a screen. Everything that asks "what is here" (combat's enemiesLeft, the sword, bombs,
// the test hook's snapshot) reads it. Outdoors the screens around the hero are live too
// (systems/streaming.js): each keeps its own entities in a bucket, spawned when the screen comes
// in and reaped only when it goes (reapBucket). Walking over a screen line moves the stage into
// the old screen's bucket and the new screen's bucket onto the stage (stash / unstash): nothing
// is deleted and nothing pops in. Buckets of the screens next to the hero's are simulated too
// (updateBuckets, with world.currentScreen() answering their own screen); the rest lie dormant,
// drawn but still, until the hero comes near (onWake() then, if the entity has one).
//
// Entities update in `priority` order (enemies 0, projectiles 10, pickups 20,
// everything else 30), so a rock spat this frame moves this frame and a gem
// dropped this frame can be picked up this frame, as in the prototype.
// Removal is deferred until the end of the update, so removing an entity in
// the middle of the loop never skips another. Adding an enemy to the stage emits
// 'enemy-spawned' (the bestiary counts sightings from it); one added to a bucket
// is announced when it first reaches the stage. An entity may
// remove itself in onAdd() (a spawn group once it has placed its enemies, an
// enemy of a room that is remembered as cleared); it is then not announced.
import { scene } from '../core/renderer.js';
import { emit } from '../core/events.js';
import { withScreen, currentScreen } from '../world/world.js';
import { createEntity } from './registry.js';
import { partyHooks } from '../multiplayer/adapters.js';

export const entities = []; // the stage, sorted by priority
const buckets = new Map(); // screen key -> { screen, list, awake }
let target = null; // the bucket addEntity puts things in (inBucket), else the stage

let frameId = 0;
let updating = false;

function insert(list, e) {
  let i = list.length;
  while (i > 0 && list[i - 1].priority > e.priority) i--;
  list.splice(i, 0, e);
}

function announce(e) {
  if (e.kind === 'enemy' && !e.removed && !e.announced) {
    e.announced = true;
    emit('enemy-spawned', { entity: e });
  }
}

export function addEntity(e) {
  const b = target;
  insert(b ? b.list : entities, e);
  e.homeKey ??= b?.screen.key ?? currentScreen()?.key ?? null;
  partyHooks.added(e);
  if (e.object) scene.add(e.object);
  e.onAdd?.();
  if (!b) announce(e);
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

function compactList(list) {
  let j = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].removed) list[j++] = list[i];
  list.length = j;
}

function compact() {
  if (updating) return; // updateEntities compacts when its loop is done
  compactList(entities);
}

function run(list, dt) {
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.removed || e._frame === frameId) continue;
    e._frame = frameId;
    partyHooks.drive(e, dt);
  }
}

export function updateEntities(dt) {
  frameId++;
  updating = true;
  try {
    run(entities, dt);
  } finally {
    updating = false;
  }
  compact();
}

// ---------------------------------------------------------------- buckets
function bucket(screen) {
  let b = buckets.get(screen.key);
  if (!b) buckets.set(screen.key, (b = { screen, list: [], awake: false }));
  return b;
}

// Run fn with every entity added meanwhile (spawn, a group's members, what an update fires) going
// into `screen`'s bucket instead of onto the stage.
export function inBucket(screen, fn) {
  const was = target;
  target = bucket(screen);
  try {
    return fn();
  } finally {
    target = was;
  }
}

export const hasBucket = (screen) => buckets.has(screen.key);
export const bucketOf = (screen) => buckets.get(screen.key)?.list.filter((e) => !e.removed) ?? [];

// The stage goes into `screen`'s bucket (the hero is leaving it; it stays live). Shots in flight
// are removed, as they always were; everything else stays where it is.
export function stash(screen) {
  const b = bucket(screen);
  for (const e of entities) {
    if (e.removed || !e.screenScoped) continue;
    if (e.kind === 'projectile') removeEntity(e);
    else insert(b.list, e);
  }
  compactList(b.list);
  let j = 0;
  for (let i = 0; i < entities.length; i++) if (!entities[i].screenScoped && !entities[i].removed) entities[j++] = entities[i];
  entities.length = j;
  b.awake = false;
}

// `screen`'s bucket onto the stage (the hero has arrived). false if it has none (never populated).
export function unstash(screen) {
  const b = buckets.get(screen.key);
  if (!b) return false;
  buckets.delete(screen.key);
  const wake = !b.awake;
  for (const e of b.list) {
    if (e.removed) continue;
    insert(entities, e);
    if (wake) e.onWake?.();
  }
  for (const e of entities) announce(e);
  return true;
}

// Remove every entity of `screen`'s bucket (it left the live ring).
export function reapBucket(screen) {
  const b = buckets.get(screen.key);
  if (!b) return;
  buckets.delete(screen.key);
  for (const e of b.list) removeEntity(e);
}

export function reapAllBuckets() {
  for (const b of [...buckets.values()]) reapBucket(b.screen);
}

// Simulate the buckets of `screens` (the hero's neighbours), each seeing its own screen as the
// current one; the rest sleep. A bucket that wakes calls onWake() on its entities (people pick up
// their schedule where the clock is now, entities/npc.js).
export function updateBuckets(dt, screens) {
  const awake = new Set();
  for (const s of screens) {
    const b = buckets.get(s.key);
    if (!b) continue;
    awake.add(b);
    if (!b.awake) {
      b.awake = true;
      for (const e of b.list) if (!e.removed) e.onWake?.();
    }
    withScreen(b.screen, () => {
      const was = target;
      target = b;
      try {
        run(b.list, dt);
      } finally {
        target = was;
      }
    });
    // what they shoot stays on their screen too (a shot of the hero's own screen may fly on in a
    // follow camera; one from next door never reaches him)
    const home = b.screen;
    for (const e of b.list)
      if (!e.removed && e.kind === 'projectile' && (e.x < home.x0 || e.x >= home.x1 || e.z < home.z0 || e.z >= home.z1)) {
        if (e.fizzle) e.fizzle();
        else removeEntity(e);
      }
    compactList(b.list);
  }
  for (const b of buckets.values()) if (!awake.has(b)) b.awake = false;
}

// Leaving a screen removes everything that belongs to it (a room, or a teleport: the stage only).
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

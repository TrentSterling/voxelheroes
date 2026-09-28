// The streamed world (world/world.js "loads and streaming"): what is built around the hero and
// who lives there, updated every step from main.js (updateStreaming) with the build budget spent
// once a frame (pumpBuilds).
//
//   the live ring   outdoors, every streamed screen within TUNING.stream.radius screens of the
//                   hero's (lowRadius at the 'low' look) is live: terrain, props and its people
//                   and foes, built nearest first and ahead of where he is walking, whatever
//                   area it belongs to. A ring further out is scenery (terrain only). A screen
//                   leaves either only `hysteresis` further out, so walking back and forth over a
//                   line frees nothing.
//   people, foes    a screen's markers spawn once its terrain is in (world.onBuilt), into its own
//                   bucket (entities/manager.js), already standing there: never when the camera
//                   arrives. Nothing is deleted when the hero leaves a screen (transitions.js
//                   stashes the stage into its bucket); a bucket is reaped only when its screen
//                   leaves the live ring. Buckets within `active` screens are simulated (foes keep
//                   to their own screen, as in the SNES game); the rest lie dormant, still drawn.
//   building ahead  a door, cave mouth or stairs within prebuildTiles of the hero has its area
//                   built in the background (world.keep), so the fade through it only has to
//                   fade; the area is freed once he is prebuildDrop tiles from all its doors.
//                   In an area of its own, the outdoor screens past its exits are built the same
//                   way, and the outdoor ring he left stays live (hidden) while he is inside.
//
// Events (stream-prefixed, CONTRACTS "Events"): 'world:screen-live' { screen } when a streamed
// screen's markers are about to spawn (foe-clears forgets an expired clear then), and
// 'world:screen-free' { screen } when one leaves the live ring (its foes are gone).
import { TUNING } from '../core/tuning.js';
import { emit, on } from '../core/events.js';
import { look } from '../core/renderer.js';
import { world, heroScreen } from '../world/world.js';
import { getTile } from '../world/tiles.js';
import { player } from '../entities/player.js';
import { stash, unstash, reapBucket, reapAllBuckets, updateBuckets, clearScreenEntities, bucketOf } from '../entities/manager.js';
import { stream } from '../tuning/stream.js';
import { spawnScreen } from './spawner.js';
import { meshStats } from '../world/meshing.js';

TUNING.stream ??= stream;
const S = TUNING.stream;

const populated = new Set(); // keys of streamed screens whose markers have spawned (a bucket, or the stage)

export const ringRadius = () => (look.quality() === 'low' ? S.lowRadius : S.radius);
const sceneryRadius = () => (look.quality() === 'low' ? 0 : S.scenery);

// ---------------------------------------------------------------- the stage (transitions.js)
// The hero leaves `screen` by walking or through a fade: outdoors its entities stay, in its bucket;
// a room's go.
export function leaveStage(screen) {
  if (screen?.streams && world.live.has(screen)) stash(screen);
  else {
    clearScreenEntities();
    if (screen) populated.delete(screen.key);
  }
}

// The hero's screen's entities go for good (a teleport, a load, getting up after a fall): its
// markers spawn afresh when he arrives.
export function dropStage(screen) {
  clearScreenEntities();
  if (screen) populated.delete(screen.key);
}

// The hero arrives on `screen`: its bucket comes onto the stage, or, if its markers have not
// spawned (a room; a screen reached by teleport, or before the ring got to it), they spawn now.
export function arriveStage(screen) {
  if (screen.streams && populated.has(screen.key) && unstash(screen)) return 'stash';
  spawnScreen(screen);
  if (screen.streams) populated.add(screen.key);
  return 'spawn';
}

// ---------------------------------------------------------------- the ring
let ringFor = null; // the screen the ring is laid around
let ringKey = '';
let active = []; // neighbours whose buckets are simulated
const heading = { x: 0, z: 0, px: null, pz: null };

// Lower builds sooner: distance in screens, then ahead of the way he is heading before behind.
function priority(h, s) {
  const d = world.screenDist(h, s);
  const dx = (s.x0 + s.x1 - h.x0 - h.x1) / 2;
  const dz = (s.z0 + s.z1 - h.z0 - h.z1) / 2;
  const len = Math.hypot(dx, dz) * Math.hypot(heading.x, heading.z);
  const ahead = len > 1e-6 ? (dx * heading.x + dz * heading.z) / len : 0; // -1 behind .. 1 ahead
  return d + 0.4 * (1 - ahead);
}

// Lay the ring around screen h: live within the radius, scenery a ring out, and free whatever has
// drifted past both (with hysteresis).
function layRing(h) {
  const R = ringRadius();
  const sc = sceneryRadius();
  const H = S.hysteresis;
  ringFor = h;
  ringKey = `${h.key}/${R}/${sc}`;
  for (const s of world.screensNear(h, R + sc, (o) => o.streams)) {
    const d = world.screenDist(h, s);
    if (d <= R) {
      if (!world.live.has(s)) world.regrow(s); // cut bushes are back by the time anyone sees the screen again
      world.addLive(s, priority(h, s));
    } else world.addScenery(s, priority(h, s) + 0.5);
  }
  for (const s of [...world.live]) {
    if (!s.streams) continue;
    const d = world.screenDist(h, s);
    if (d <= R + H) continue;
    free(s);
    if (d <= R + sc + H) world.toScenery(s);
    else world.unbuild(s);
  }
  for (const s of [...world.previews]) if (world.screenDist(h, s) > R + sc + H) world.unbuild(s);
  active = world.screensNear(h, S.active, (o) => o.streams && o !== h);
}

// A streamed screen leaves the live ring: its people and foes go.
function free(s) {
  if (!populated.has(s.key)) return;
  reapBucket(s);
  populated.delete(s.key);
  emit('world:screen-free', { screen: s });
}

// A screen's terrain is in: outdoors, its markers spawn into its bucket now (the hero's own screen
// spawns when he arrives, transitions.js enterScreen).
function built(s) {
  if (!s.streams || !world.live.has(s) || populated.has(s.key)) return;
  if (s === heroScreen() || s === world.focus) return;
  emit('world:screen-live', { screen: s });
  spawnScreen(s, { bucket: true });
  populated.add(s.key);
}

// From main.js before the world is built.
export function initStreaming() {
  world.onBuilt = built;
  // for play-tests and the console: __voxelHeroes.world.stream
  world.stream = { state: streamState, bucket: (key) => bucketOf(world.screen(key)), populated: (key) => populated.has(key), tuning: S };
}

// ---------------------------------------------------------------- building ahead
const warpCache = new Map(); // screen -> [{ tx, tz, dest }] of its warp tiles into other areas

function warpsOf(s) {
  let list = warpCache.get(s);
  if (list) return list;
  list = [];
  for (let z = 0; z < s.h; z++)
    for (let x = 0; x < s.w; x++) {
      if (!getTile(s.tileset, s.tiles[z][x])?.onEnter?.isWarp) continue;
      const dest = world.warpAt(s.x0 + x, s.z0 + z);
      if (dest && dest.screen.area !== s.area) list.push({ tx: s.x0 + x + 0.5, tz: s.z0 + z + 0.5, dest });
    }
  warpCache.set(s, list);
  return list;
}

on('tile-changed', ({ screen }) => warpCache.delete(screen)); // a door blown open, a stair revealed

const doors = new Map(); // kept area id -> the door tiles that lead into it

function buildAhead(h) {
  const near = h.streams ? world.screensNear(h, 1, (o) => o.streams) : world.screensNear(h, 1, (o) => o.area === h.area);
  for (const s of near)
    for (const w of warpsOf(s)) {
      const d = Math.hypot(w.tx - player.x, w.tz - player.z);
      if (d > S.prebuildTiles) continue;
      const to = w.dest.screen;
      if (to.streams) {
        // out of an area of its own: the outdoor ring past the exit
        if (!h.streams && ringFor !== to) layRing(to);
        continue;
      }
      const id = to.area.id;
      if (id === h.area.id) continue;
      let list = doors.get(id);
      if (!list) doors.set(id, (list = []));
      if (!list.includes(w)) list.push(w);
      if (!world.keep.has(id)) {
        world.keep.add(id);
        world.liveArea(id, to, 10); // behind the outdoor ring (priorities under 10)
      }
    }
  for (const [id, list] of doors) {
    if (id === h.area.id) continue;
    if (list.some((w) => Math.hypot(w.tx - player.x, w.tz - player.z) <= S.prebuildDrop)) continue;
    doors.delete(id);
    world.keep.delete(id);
    for (const s of [...world.live]) if (s.area.id === id) world.unbuild(s);
  }
  // outdoors, an area left some other way (a teleport, a load) goes too
  if (h.streams) for (const s of [...world.live]) if (!s.streams && !world.keep.has(s.area.id)) world.unbuild(s);
}

// ---------------------------------------------------------------- per step
// From main.js, every simulation step, after the mode's update: the ring, building ahead, and in
// play the hero's neighbours' people and foes (after the stage's, flow.js play mode).
export function updateStreaming(dt, playing) {
  const h = heroScreen();
  if (!h) return;
  world.focus = h;
  world.loaded = h.area.id; // (walking over an area edge outdoors loads nothing, but the hero is in that area now)
  if (heading.px !== null) {
    const dx = player.x - heading.px;
    const dz = player.z - heading.pz;
    if (dx || dz) {
      heading.x = heading.x * 0.9 + dx;
      heading.z = heading.z * 0.9 + dz;
    }
  }
  heading.px = player.x;
  heading.pz = player.z;
  if (h.streams && `${h.key}/${ringRadius()}/${sceneryRadius()}` !== ringKey) layRing(h);
  if (playing && h.streams) updateBuckets(dt, active);
  buildAhead(h);
}

// Once a frame (main.js): the build budget, larger at black.
export function pumpBuilds(atBlack = false) {
  return world.pump(atBlack ? S.loadBudgetMs : S.budgetMs);
}

// Screens that must be built before a fade into `screen` may end: it and, outdoors, its live
// neighbours (the frame never shows further).
export function screensToShow(screen) {
  if (!screen.streams) return [screen];
  return world.screensNear(screen, 1, (o) => o.streams && world.live.has(o));
}

// A new game or a load starts every screen's people over (flags and tiles changed); the screens
// spawn again as the ring reaches them.
on('world:reset', () => {
  reapAllBuckets();
  populated.clear();
  ringKey = '';
});

export const streamState = () => ({
  ringFor: ringFor?.key ?? null,
  radius: ringRadius(),
  live: [...world.live].map((s) => s.key),
  scenery: [...world.previews].map((s) => s.key),
  pending: world.pending.size,
  populated: [...populated],
  active: active.map((s) => s.key),
  keep: [...world.keep],
  stats: { ...world.stats },
  meshing: meshStats(),
});

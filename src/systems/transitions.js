// Moving between screens and areas, and what happens on arrival.
//
//   slide  The hero walks off an edge into another screen of the same area:
//          the camera slides over (SLIDE_TIME, ease in-out) while the hero
//          is carried a tile in (SLIDE_STEP from the edge; in a room,
//          ROOM_STEP past the wall the doorway is in). Mode 'scroll'.
//   fade   The hero walks off an edge into another area, or takes a warp
//          (doorway, stairs): fade to black, move, fade back in. Mode 'warp'.
//          Arriving in another area is a load: FADE_OUT, AREA_HOLD seconds
//          of black while the loading card shows ('area-enter' starts it),
//          FADE_IN. A warp inside one area (stairs between the floors of a
//          dungeon, warp tiles) fades out and in over WARP_FADE each, with
//          no card.
// Gameplay pauses in both modes; only the hero's walk animates. The times
// are the gameplay spec's (sections 4.3 and 4.4), themselves guesses until
// footage measures them.
//
// Events
//   'screen-leave' { screen }            before a screen's entities are cleared
//   'area-enter'   { area, from, via }   another area is reached, at the start
//                                        of the black hold (via 'edge' | 'warp')
//   'room-enter'   { area, screen, via } every screen or room entered, once its
//                                        spawns are in (via 'slide' | 'edge' |
//                                        'warp' | 'start' | 'respawn' | 'load' | 'teleport')
//   'screen-enter' { screen }            just before 'room-enter' (the M1 name)
//   'warp'         { dest }              a warp starts; dest { screen, x, z, yaw }
//
// Drawing: in room areas only the current room is drawn (both rooms during a
// slide), so everything outside it is black; elsewhere the screens of the
// hero's group of joined areas (world/links.js) are drawn so the low cameras
// see the land beyond the screen, except those wholly south of the current
// screen: the camera never looks there, and the trees on the next screen's
// first row would otherwise poke up at the frame's bottom edge.
import { state, registerSaveField } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { registerMode, setMode } from '../core/modes.js';
import { applyLighting } from '../core/renderer.js';
import {
  CAMERA_PRESETS,
  easeInOutQuad,
  setCameraPreset,
  snapCamera,
  startCameraTween,
  stepCameraTween,
  subjectFor,
} from '../core/camera.js';
import { world, currentScreen, WALL_INSET } from '../world/world.js';
import { DIRS } from '../world/grid.js';
import { areaGroups } from '../world/links.js';
import { clearScreenEntities } from '../entities/manager.js';
import { player } from '../entities/player.js';
import { showBanner } from '../ui/banner.js';
import { setAreaLabel } from '../ui/hud.js';
import { setFade } from '../ui/overlay.js';
import { clearDistance } from './physics.js';
import { spawnScreen } from './spawner.js';

export const SLIDE_TIME = 0.8; // seconds for the slide to the next screen or room (48 ticks)
export const SLIDE_STEP = 1; // tiles the hero ends up inside the next screen or area
export const ROOM_STEP = 1; // in a room: tiles inside the floor, past the doorway's wall
export const FADE_OUT = 0.25; // a load (into another area): seconds to black
export const AREA_HOLD = 1; // a load: seconds of black for the loading card
export const FADE_IN = 0.25; // a load: seconds back from black (1.5 s, 90 ticks, in all)
export const WARP_FADE = 0.3; // a warp inside one area: seconds to black, and again back
export const WARP_HOLD = 0; // a warp inside one area: seconds of black in between

// The preset a screen is seen with: its own (dungeons fix one) or the player's.
export const presetNameFor = (screen) => screen.camera ?? state.settings.camera;

// Put the hero at local tile coordinates (x, z) of a screen and aim the
// camera at the hero within that screen.
export function placeAt(screen, x, z, yaw = player.yaw) {
  state.screenKey = screen.key;
  player.x = screen.x0 + x;
  player.z = screen.z0 + z;
  player.yaw = yaw;
  snapCamera(subjectFor(player, screen, CAMERA_PRESETS[presetNameFor(screen)]));
  showScreens(screen);
}

// Put the hero at a spot { area, screen: [i, j], x, z, yaw } (see world.resolveSpot).
export function placeAtSpot(spot) {
  const dest = world.resolveSpot(spot);
  placeAt(dest.screen, dest.x, dest.z, dest.yaw);
  return dest;
}

// Lighting and camera preset for a screen. The camera re-aims at once unless
// a slide is running (the slide already aims at the new screen).
export function applyScreenAmbience(screen) {
  applyLighting(screen.lighting);
  setCameraPreset(presetNameFor(screen));
  if (state.mode !== 'scroll') snapCamera(subjectFor(player, screen));
}

// The player's camera choice (for an options menu). It applies on every
// screen that does not fix its own preset, starting with this one, and is
// kept in save data ('camera' field; a new game keeps the current choice).
export function chooseCameraPreset(name) {
  if (!CAMERA_PRESETS[name]) throw new Error(`Unknown camera preset "${name}"`);
  state.settings.camera = name;
  const screen = currentScreen();
  if (screen) applyScreenAmbience(screen);
}

registerSaveField('camera', {
  save: () => state.settings.camera,
  load: (v) => {
    if (typeof v === 'string' && CAMERA_PRESETS[v]) state.settings.camera = v;
  },
  reset: () => {},
});

export function clearScreen() {
  emit('screen-leave', { screen: currentScreen() });
  clearScreenEntities();
}

// The hero is on the current screen for good: spawns, lighting, camera,
// banner, hooks and events. via says how the hero got here (see the top).
export function enterScreen(via = 'teleport') {
  const screen = currentScreen();
  spawnScreen(screen);
  applyScreenAmbience(screen);
  showBanner(screen.name);
  setAreaLabel(screen.name);
  screen.area.onScreenEnter?.(screen);
  screen.def.onEnter?.(screen);
  emit('screen-enter', { screen });
  emit('room-enter', { area: screen.area, screen, via });
}

// ---------------------------------------------------------------- drawing
let groups = null; // area id -> Set of the areas drawn with it
let byArea = null; // area id -> its screens
const shown = new Set();

// The screens drawn while the hero is on `screen` (see the top).
function around(screen) {
  if (!groups) {
    groups = areaGroups(world);
    byArea = new Map();
    for (const s of world.screens.values()) {
      if (!byArea.has(s.area.id)) byArea.set(s.area.id, []);
      byArea.get(s.area.id).push(s);
    }
  }
  if (screen.area.rooms) return [screen];
  const out = [];
  for (const area of groups.get(screen.area.id))
    if (!area.rooms) for (const s of byArea.get(area.id)) if (s.z0 < screen.z1) out.push(s);
  return out;
}

// Draw the screens around `screen`, and during a slide also those around
// `also`, the screen it comes from.
export function showScreens(screen, also = null) {
  shown.clear();
  for (const s of around(screen)) shown.add(s);
  if (also) for (const s of around(also)) shown.add(s);
  syncScreenVisibility();
}

export const screenShown = (screen) => shown.has(screen);

// Hide what is not shown. Runs every frame (main.js) so meshes rebuilt and
// props added on hidden screens stay hidden; shown screens are touched only
// when they come back into view.
export function syncScreenVisibility() {
  for (const s of world.screens.values()) {
    const on = shown.has(s);
    if (on && s.shown === true) continue;
    for (const m of s.meshes) if (m.mesh.visible !== on) m.mesh.visible = on;
    for (const obj of s.props.values()) if (obj.visible !== on) obj.visible = on;
    s.shown = on;
  }
}

// ---------------------------------------------------------------- edges
// The hero's centre has left the current screen through `dir` ('north',
// 'south', 'east' or 'west'). Slide to the screen it is now on, or fade into
// that screen's area. Returns true if a transition started.
export function crossEdge(dir) {
  const from = currentScreen();
  const next = world.screenAt(player.x, player.z);
  if (!next || next === from || !DIRS[dir]) return false;
  const land = landing(next, dir);
  if (next.area === from.area) startSlide(from, next, land);
  else startFade({ screen: next, x: land.x - next.x0, z: land.z - next.z0, yaw: player.yaw }, { via: 'edge', walkTo: land });
  return true;
}

// Where the hero stops after walking `dir` into `next`: SLIDE_STEP tiles in
// from the edge, or in a room ROOM_STEP tiles past the inside face of the
// wall the doorway is in (a tile thick; side walls stand WALL_INSET further
// in), so the hero ends up clear of the doorway. Stops short of anything solid.
function landing(next, dir) {
  const [ux, uz] = DIRS[dir];
  const dist = next.area.rooms ? (ux ? 1 + WALL_INSET : 1) + ROOM_STEP : SLIDE_STEP;
  // how far past the edge the hero already is
  const past = ux > 0 ? player.x - next.x0 : ux < 0 ? next.x1 - player.x : uz > 0 ? player.z - next.z0 : next.z1 - player.z;
  const step = clearDistance(player, ux, uz, Math.max(0, dist - past));
  return { x: player.x + ux * step, z: player.z + uz * step };
}

// ---------------------------------------------------------------- slide
let slide = null;

function startSlide(from, next, land) {
  clearScreen();
  slide = { x0: player.x, z0: player.z, x1: land.x, z1: land.z };
  const preset = presetNameFor(next);
  // The hero walks in linearly; the camera keeps him in frame on the way.
  const anchor = { from: { x: player.x, z: player.z }, to: land };
  startCameraTween(subjectFor(land, next, CAMERA_PRESETS[preset]), SLIDE_TIME, easeInOutQuad, preset, anchor);
  state.screenKey = next.key;
  world.regrow(next);
  showScreens(next, from);
  setMode('scroll');
  sfx.scroll();
}

registerMode('scroll', {
  update(dt) {
    const k = stepCameraTween(dt);
    player.x = slide.x0 + (slide.x1 - slide.x0) * k;
    player.z = slide.z0 + (slide.z1 - slide.z0) * k;
    player.animate(dt, true);
    if (k >= 1) {
      slide = null;
      showScreens(currentScreen());
      setMode('play');
      enterScreen('slide');
    }
  },
});

// ---------------------------------------------------------------- fade
let fade = null;

// Fade to dest { screen, x, z, yaw } (x, z local to that screen). opts.via
// names the way in for the events; opts.walkTo (world point) keeps the hero
// walking there while the screen darkens.
export function startFade(dest, { via = 'warp', walkTo = null } = {}) {
  const from = currentScreen();
  const areaChange = dest.screen.area !== from?.area;
  fade = {
    t: 0,
    dest,
    via,
    from,
    areaChange,
    out: areaChange ? FADE_OUT : WARP_FADE,
    hold: areaChange ? AREA_HOLD : WARP_HOLD,
    in: areaChange ? FADE_IN : WARP_FADE,
    walk: walkTo ? { x0: player.x, z0: player.z, x1: walkTo.x, z1: walkTo.z } : null,
    moved: false,
  };
  setMode('warp');
  sfx.scroll();
}

// dest: { screen, x, z, yaw } as world.warpAt / world.resolveSpot return it.
export function startWarp(dest) {
  startFade(dest, { via: 'warp' });
  emit('warp', { dest });
}

// Tile hook for doorways and stairs: onEnter: enterWarp.
export function enterWarp(ctx) {
  const dest = ctx.world.warpAt(ctx.tx, ctx.tz);
  if (dest) startWarp(dest);
}

registerMode('warp', {
  update(dt) {
    const f = fade;
    f.t += dt + 1e-9; // (a hair of slack, so 15 ticks of 1/60 s reach 0.25 s)
    const inAt = f.out + f.hold; // the fade-in starts
    setFade(f.t < f.out ? f.t / f.out : f.t < inAt ? 1 : Math.max(0, 1 - (f.t - inAt) / f.in));
    if (!f.moved && f.walk) {
      const k = Math.min(1, f.t / f.out);
      player.x = f.walk.x0 + (f.walk.x1 - f.walk.x0) * k;
      player.z = f.walk.z0 + (f.walk.z1 - f.walk.z0) * k;
    }
    if (!f.moved && f.t >= f.out) {
      f.moved = true;
      clearScreen();
      const d = f.dest;
      placeAt(d.screen, d.x, d.z, d.yaw);
      world.regrow(d.screen);
      applyScreenAmbience(d.screen);
      setAreaLabel(d.screen.name);
      if (f.areaChange) emit('area-enter', { area: d.screen.area, from: f.from?.area ?? null, via: f.via });
    }
    player.animate(dt, !f.moved && !!f.walk);
    if (f.t >= inAt + f.in) {
      setFade(0);
      fade = null;
      setMode('play');
      enterScreen(f.via);
    }
  },
});

// Moving between screens and areas, and what happens on arrival.
//
//   slide  The hero walks off an edge into another screen of the same area:
//          the camera slides over (SLIDE_TIME, ease in-out) while the hero
//          walks about a tile in (SLIDE_STEP). Mode 'scroll'.
//   fade   The hero walks off an edge into another area, or takes a warp
//          (doorway, stairs): fade to black, move, fade back in. Mode 'warp'.
//          Arriving in another area holds the black for AREA_HOLD seconds, the
//          time a loading card shows ('area-enter' starts it); a warp inside
//          one area only blinks (WARP_HOLD).
// Gameplay pauses in both modes; only the hero's walk animates.
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
// slide), so everything outside it is black; elsewhere every screen of the
// hero's group of joined areas is drawn (world/links.js), so the low cameras
// see the land beyond the screen.
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
import { world, currentScreen } from '../world/world.js';
import { DIRS } from '../world/grid.js';
import { areaGroups } from '../world/links.js';
import { clearScreenEntities } from '../entities/manager.js';
import { player } from '../entities/player.js';
import { showBanner } from '../ui/banner.js';
import { setAreaLabel } from '../ui/hud.js';
import { setFade } from '../ui/overlay.js';
import { clearDistance } from './physics.js';
import { spawnScreen } from './spawner.js';

export const SLIDE_TIME = 0.5; // seconds for the slide to the next screen (a guess until the gameplay spec)
export const SLIDE_STEP = 1.1; // tiles the hero walks into the next screen or area
export const FADE_OUT = 0.35; // seconds to black
export const FADE_IN = 0.35; // seconds back from black
export const WARP_HOLD = 0.15; // seconds of black for a warp inside one area
export const AREA_HOLD = 0.6; // seconds of black on entering another area: the loading card

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

// Draw the screens that belong around `screen`, plus `also` (the other room
// of a slide).
export function showScreens(screen, also = null) {
  if (!groups) {
    groups = areaGroups(world);
    byArea = new Map();
    for (const s of world.screens.values()) {
      if (!byArea.has(s.area.id)) byArea.set(s.area.id, []);
      byArea.get(s.area.id).push(s);
    }
  }
  shown.clear();
  if (!screen.area.rooms)
    for (const area of groups.get(screen.area.id)) if (!area.rooms) for (const s of byArea.get(area.id)) shown.add(s);
  shown.add(screen);
  if (also) shown.add(also);
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
  const [ux, uz] = DIRS[dir];
  const step = clearDistance(player, ux, uz, SLIDE_STEP);
  const land = { x: player.x + ux * step, z: player.z + uz * step };
  if (next.area === from.area) startSlide(from, next, land);
  else startFade({ screen: next, x: land.x - next.x0, z: land.z - next.z0, yaw: player.yaw }, { via: 'edge', walkTo: land });
  return true;
}

// ---------------------------------------------------------------- slide
let slide = null;

function startSlide(from, next, land) {
  clearScreen();
  slide = { x0: player.x, z0: player.z, x1: land.x, z1: land.z };
  const preset = presetNameFor(next);
  startCameraTween(subjectFor(land, next, CAMERA_PRESETS[preset]), SLIDE_TIME, easeInOutQuad, preset);
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
    hold: areaChange ? AREA_HOLD : WARP_HOLD,
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
    f.t += dt;
    const inAt = FADE_OUT + f.hold; // the fade-in starts
    setFade(f.t < FADE_OUT ? f.t / FADE_OUT : f.t < inAt ? 1 : Math.max(0, 1 - (f.t - inAt) / FADE_IN));
    if (!f.moved && f.walk) {
      const k = Math.min(1, f.t / FADE_OUT);
      player.x = f.walk.x0 + (f.walk.x1 - f.walk.x0) * k;
      player.z = f.walk.z0 + (f.walk.z1 - f.walk.z0) * k;
    }
    if (!f.moved && f.t >= FADE_OUT) {
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
    if (f.t >= inAt + FADE_IN) {
      setFade(0);
      fade = null;
      setMode('play');
      enterScreen(f.via);
    }
  },
});

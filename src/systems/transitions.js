// Moving between screens: the slide scroll at screen edges, the fade warp
// through doorways and stairs, and what happens on arrival.
//
// Events: 'screen-leave' { screen } before a screen's entities are cleared,
// 'screen-enter' { screen } once the new screen's spawns are in place,
// 'warp' { dest } when a warp starts.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { registerMode, setMode } from '../core/modes.js';
import { applyLighting } from '../core/renderer.js';
import { CAMERA_PRESETS, playerCameraPresets, setCameraPreset, snapCamera, startCameraTween, stepCameraTween } from '../core/camera.js';
import { world, currentScreen } from '../world/world.js';
import { screenCenter } from '../world/grid.js';
import { clearScreenEntities } from '../entities/manager.js';
import { player } from '../entities/player.js';
import { showBanner } from '../ui/banner.js';
import { setAreaLabel } from '../ui/hud.js';
import { setFade } from '../ui/overlay.js';
import { spawnScreen } from './spawner.js';

export const SCROLL_TIME = 0.85; // seconds for the slide to the next screen
export const SCROLL_STEP = 1.1; // tiles the hero walks in during the slide
const SCROLL_STEP_MAX = 3.1; // walks further in (up to this) when the usual spot is blocked

// A and B pressed during a slide or a warp act on arrival (as in the prototype).
const CARRY = ['sword', 'item'];

// Put the hero at local tile coordinates (x, z) of screen (sx, sy) and aim
// the camera at that screen.
export function placeAt(sx, sy, x, z, yaw = player.yaw) {
  state.sx = sx;
  state.sy = sy;
  player.x = sx * SCREEN_W + x;
  player.z = sy * SCREEN_H + z;
  player.yaw = yaw;
  snapCamera(screenCenter(sx, sy));
}

// Lighting and camera preset for a screen.
export function applyScreenAmbience(screen) {
  applyLighting(screen.lighting);
  setCameraPreset(screen.camera ?? state.settings.camera);
}

// The player's camera choice (for an options menu). It applies on every
// screen that does not fix its own preset, starting with this one. Only
// selectable presets (playerCameraPresets(): A-D) can be chosen.
export function chooseCameraPreset(name) {
  if (!CAMERA_PRESETS[name]?.selectable)
    throw new Error(`Camera preset "${name}" is not a player choice (choose one of ${playerCameraPresets().join(', ')})`);
  state.settings.camera = name;
  const screen = currentScreen();
  if (screen) applyScreenAmbience(screen);
}

export function clearScreen() {
  emit('screen-leave', { screen: currentScreen() });
  clearScreenEntities();
}

export function enterScreen() {
  const screen = currentScreen();
  spawnScreen(screen);
  applyScreenAmbience(screen);
  showBanner(screen.name);
  setAreaLabel(screen.name);
  screen.area.onScreenEnter?.(screen);
  screen.def.onEnter?.(screen);
  emit('screen-enter', { screen });
}

// ---------------------------------------------------------------- slide
let trans = null;

// How far the hero walks into the next screen: SCROLL_STEP, or further when
// that spot is solid (a bush beside the lane), so a map can never trap him.
function landingStep(dx, dz) {
  for (let step = SCROLL_STEP; step <= SCROLL_STEP_MAX + 1e-6; step += 0.1)
    if (!world.blocked(player.x + dx * step, player.z + dz * step, player.r, player)) return step;
  return SCROLL_STEP;
}

export function startScroll(dx, dz) {
  const next = world.screen(state.sx + dx, state.sy + dz);
  if (!next) return false;
  clearScreen();
  setMode('scroll');
  world.regrow(next);
  const step = landingStep(dx, dz);
  trans = { px0: player.x, pz0: player.z, px1: player.x + dx * step, pz1: player.z + dz * step };
  startCameraTween(screenCenter(state.sx + dx, state.sy + dz), SCROLL_TIME);
  state.sx += dx;
  state.sy += dz;
  sfx.scroll();
  return true;
}

registerMode('scroll', {
  carry: CARRY,
  update(dt) {
    const k = stepCameraTween(dt);
    player.x = trans.px0 + (trans.px1 - trans.px0) * k;
    player.z = trans.pz0 + (trans.pz1 - trans.pz0) * k;
    player.animate(dt, true);
    if (k >= 1) {
      trans = null;
      setMode('play');
      enterScreen();
    }
  },
});

// ---------------------------------------------------------------- warp
let warp = null;

// dest: { sx, sy, x, z, yaw } in global screen coords (world.warpAt resolves it).
export function startWarp(dest) {
  setMode('warp');
  warp = { t: 0, dest, moved: false };
  sfx.scroll();
  emit('warp', { dest });
}

// Tile hook for doorways and stairs: onEnter: enterWarp.
export function enterWarp(ctx) {
  const dest = ctx.world.warpAt(ctx.tx, ctx.tz);
  if (dest) startWarp(dest);
}

registerMode('warp', {
  carry: CARRY,
  update(dt) {
    warp.t += dt;
    const fade = warp.t < 0.4 ? warp.t / 0.4 : Math.max(0, 1 - (warp.t - 0.55) / 0.4);
    setFade(Math.min(1, fade));
    if (!warp.moved && warp.t >= 0.45) {
      warp.moved = true;
      clearScreen();
      const d = warp.dest;
      placeAt(d.sx, d.sy, d.x, d.z, d.yaw);
      const screen = currentScreen();
      world.regrow(screen);
      applyScreenAmbience(screen);
      setAreaLabel(screen.name);
    }
    player.animate(dt, false);
    if (warp.t >= 0.95) {
      setFade(0);
      warp = null;
      setMode('play');
      enterScreen();
    }
  },
});

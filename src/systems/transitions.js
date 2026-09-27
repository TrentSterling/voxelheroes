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
import { setCameraPreset, snapCamera, startCameraTween, stepCameraTween } from '../core/camera.js';
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

export function startScroll(dx, dz) {
  const next = world.screen(state.sx + dx, state.sy + dz);
  if (!next) return false;
  clearScreen();
  setMode('scroll');
  trans = { px0: player.x, pz0: player.z, px1: player.x + dx * SCROLL_STEP, pz1: player.z + dz * SCROLL_STEP };
  startCameraTween(screenCenter(state.sx + dx, state.sy + dz), SCROLL_TIME);
  state.sx += dx;
  state.sy += dz;
  world.regrow(next);
  sfx.scroll();
  return true;
}

registerMode('scroll', {
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

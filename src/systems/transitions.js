// Moving between screens and areas, and what happens on arrival.
//
// The outdoors (every overworld and town screen, world.js screen.streams) is one space: its areas
// are addresses, not loads, and systems/streaming.js keeps the screens around the hero built and
// peopled ahead of him. So a screen line outdoors is crossed the same way whether or not it is an
// area's edge; only doors, caves and stairs (and edges between areas of their own) fade.
//
//   follow With a follow preset (A, D) outdoors, the camera tracks the hero
//          across screen lines, so a screen change is only bookkeeping
//          (followChange): no slide, no input lock. It fires when
//          the hero's centre is TUNING.scroll.followDeadband (0.5) tiles past
//          the edge, a 1-tile dead band against flip-flopping. Via 'follow'.
//          A screen with scroll: 'flip' (and every room) slides instead.
//   slide  The hero walks off an edge into another screen of the same area
//          (or of the outdoors): the camera slides over (SLIDE_TIME, ease
//          in-out) while the hero is carried a tile in (SLIDE_STEP from the
//          edge; in a room, ROOM_STEP past the wall the doorway is in). Mode
//          'scroll'. At a south edge he goes as soon as any of him would leave
//          the frame's bottom edge, which is held on the screen's edge (southLine).
//   fade   The hero takes a warp (doorway, stairs), or walks off an edge into
//          another area that is not part of the outdoors: fade to black, move,
//          fade back in. Mode 'warp'. Arriving in another area is a load:
//          FADE_OUT, loadHold() seconds of black while the loading card shows
//          ('area-enter' starts it; ui/loadcard.js), FADE_IN; the black holds
//          on (up to MAX_LOAD_HOLD) only while the screens it will show are
//          still being built, which near a door is never: its area was built
//          ahead (systems/streaming.js). A warp inside one area (stairs
//          between the floors of a dungeon, warp tiles) fades out and in over
//          WARP_FADE each, with no card.
// Gameplay pauses in both modes; only the hero's walk animates. Input is
// ignored in both (gameplay spec 4.3): neither mode carries a press (see
// `carry` in core/modes.js), so A or B pressed during a slide or a fade acts
// neither on the way nor on arrival. The times are the gameplay spec's
// (sections 4.3 and 4.4), themselves guesses until footage measures them.
//
// People and foes: leaving an outdoor screen keeps everything on it (its bucket,
// entities/manager.js), and arriving finds the next screen's already standing there. A room
// empties when it is left and spawns afresh on entry; a teleport, a load or getting up after a
// fall starts the arrival screen afresh too (FRESH below).
//
// Events
//   'screen-leave' { screen }            before the hero's screen's entities are stashed or cleared
//   'area-enter'   { area, from, via }   another area is reached through a fade, at the start
//                                        of the black hold (via 'edge' | 'warp')
//   'room-enter'   { area, screen, via } every screen or room entered, once its
//                                        people and foes are in (via 'slide' | 'follow' | 'edge' |
//                                        'warp' | 'start' | 'respawn' | 'load' | 'teleport')
//   'screen-enter' { screen }            just before 'room-enter' (the M1 name)
//   'warp'         { dest }              a warp starts; dest { screen, x, z, yaw }
//
// Drawing: only built screens are drawn. In room areas only the current room
// is drawn (both rooms during a slide), so everything outside it is black.
// Outdoors a follow preset draws every live screen around the hero (and the
// scenery ring past them); a hold preset draws them all except those wholly
// south of the current screen: the camera never looks there, and the trees on
// the next screen's first row would otherwise poke up at the frame's bottom edge.
import { state, registerSaveField } from '../core/state.js';
import { TUNING } from '../core/tuning.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { registerMode, setMode } from '../core/modes.js';
import { applyLighting, renderer, scene, camera, look } from '../core/renderer.js';
import { warmLookFrame } from '../core/warm.js';
import { isManual } from '../core/loop.js';
import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import {
  CAMERA_PRESETS,
  followsHero,
  lensFor,
  playerCameraPresets,
  setCameraPreset,
  snapCamera,
  southReach,
  startCameraTween,
  stepCameraTween,
  subjectFor,
} from '../core/camera.js';
import { world, currentScreen, WALL_INSET } from '../world/world.js';
import { DIRS } from '../world/grid.js';
import { player } from '../entities/player.js';
import { entities } from '../entities/manager.js';
import { showBanner } from '../ui/banner.js';
import { setAreaLabel } from '../ui/hud.js';
import { setFade } from '../ui/overlay.js';
import { clearDistance } from './physics.js';
import { leaveStage, dropStage, arriveStage, screensToShow } from './streaming.js';

const S = TUNING.scroll;
const L = TUNING.load;
export const SLIDE_TIME = S.duration; // seconds for the slide to the next screen or room (0.8, 48 ticks)
export const SLIDE_STEP = S.carry; // tiles the hero ends up inside the next screen or area
export const ROOM_STEP = S.carry; // in a room: tiles inside the floor, past the doorway's wall
export const FADE_OUT = L.fade; // a load (into another area): seconds to black
export const AREA_HOLD = L.cardMin; // a load: seconds of black for the loading card (art on)
export const FADE_IN = L.fade; // a load: seconds back from black (1.5 s, 90 ticks, in all)
export const WARP_FADE = L.innerFade; // a warp inside one area: seconds to black, and again back
export const WARP_HOLD = 0; // a warp inside one area: seconds of black in between
const MAX_LOAD_HOLD = TUNING.stream?.maxHold ?? 4; // a load waits at most this long at black for the screens it shows

// A load's black hold: the card's time, shorter with loading art off
// (settings.loadingArt), and never so long that the load passes maxTotal.
export const loadHold = () => Math.min(state.settings.loadingArt === false ? L.cardOff : L.cardMin, L.maxTotal - 2 * L.fade);

// Whether the camera follows the hero on this screen (A or D outdoors, and
// the large-room and interior rigs) rather than holding and sliding.
export const followsOn = (screen) => followsHero(CAMERA_PRESETS[presetNameFor(screen)], screen);

// The preset a screen is seen with: its own (dungeons fix one) or the player's.
export const presetNameFor = (screen) => screen.camera ?? state.settings.camera;

// Put the hero at local tile coordinates (x, z) of a screen and aim the
// camera at the hero within that screen.
export function placeAt(screen, x, z, yaw = player.yaw) {
  world.loadArea(screen.area.id, screen); // only the current area is built; far screens follow
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
  setCameraPreset(presetNameFor(screen), screen);
  if (state.mode !== 'scroll') snapCamera(subjectFor(player, screen));
}

// The player's camera choice (for an options menu): one of the selectable
// presets (A-D, playerCameraPresets()). It applies on every screen that does
// not fix its own preset, starting with this one, and is kept in save data
// ('camera' field; a new game keeps the current choice).
export function chooseCameraPreset(name) {
  if (!CAMERA_PRESETS[name]?.selectable)
    throw new Error(`Camera preset "${name}" is not a player choice (choose one of ${playerCameraPresets().join(', ')})`);
  state.settings.camera = name;
  const screen = currentScreen();
  if (screen) applyScreenAmbience(screen);
}

registerSaveField('camera', {
  save: () => state.settings.camera,
  load: (v) => {
    if (typeof v === 'string' && CAMERA_PRESETS[v]?.selectable) state.settings.camera = v;
  },
  reset: () => {},
});

// The hero's screen's people and foes go for good (a teleport, a load, getting up after a fall):
// its markers spawn afresh on arrival.
export function clearScreen() {
  const screen = currentScreen();
  emit('screen-leave', { screen });
  dropStage(screen);
}

// The hero walks (or fades) off `screen`: outdoors everything on it stays, in its bucket
// (systems/streaming.js), so it is all still there when he looks back; a room empties.
function leaveScreen(screen) {
  emit('screen-leave', { screen });
  leaveStage(screen);
}

// How the hero arrives decides whether his screen's people and foes carry on or start afresh:
// walking, sliding and fading in find them as they were; these reset them.
const FRESH = new Set(['teleport', 'start', 'respawn', 'load']);

// The hero is on the current screen for good: spawns, lighting, camera,
// banner, hooks and events. via says how the hero got here (see the top).
export function enterScreen(via = 'teleport') {
  const screen = currentScreen();
  if (FRESH.has(via)) dropStage(screen);
  arriveStage(screen);
  applyScreenAmbience(screen);
  showBanner(screen.name);
  setAreaLabel(screen.name);
  screen.area.onScreenEnter?.(screen);
  screen.def.onEnter?.(screen);
  // Regrowth, saved tile edits and arriving NPCs must all be in place before checking the body.
  // A saved position on a broken pot used to become a solid pot again under the hero on load.
  const occupied = (x, z) => entities.some((e) => !e.removed && e.solid && e !== player && Math.hypot(e.x - x, e.z - z) < e.r + player.r);
  if (world.blocked(player.x, player.z, player.r, player) || occupied(player.x, player.z)) {
    const safe = world.freeSpot(screen, player.x - screen.x0, player.z - screen.z0, player.r, { body: player, occupied });
    if (!safe) throw new Error(`No clear arrival position in ${screen.key}`);
    player.x = screen.x0 + safe.x;
    player.z = screen.z0 + safe.z;
    player.resetTileTracking();
    snapCamera(subjectFor(player, screen, CAMERA_PRESETS[presetNameFor(screen)]));
  }
  emit('screen-enter', { screen });
  emit('room-enter', { area: screen.area, screen, via });
}

// ---------------------------------------------------------------- drawing
let view = null; // { screen, also }: the hero's screen, and during a slide the one he comes from

// Is `s` drawn while the hero is on `screen` (see the top)? Only built screens ever are.
function inView(screen, s) {
  if (screen.area.rooms) return s === screen;
  const hold = !followsOn(screen) && s.z0 >= screen.z1; // a hold preset never looks south of its screen
  if (screen.streams) return s.streams && world.live.has(s) && !hold;
  return s.area === screen.area && !hold;
}

const drawn = (s) => !!s.built && !!view && (inView(view.screen, s) || (!!view.also && inView(view.also, s)));

// Draw the screens around `screen`, and during a slide also those around
// `also`, the screen it comes from. Both are built now if they are not yet;
// outdoors the rest of the ring shows as it streams in.
export function showScreens(screen, also = null) {
  view = { screen, also };
  world.ensureBuilt(screen);
  if (also) world.ensureBuilt(also);
  if (!screen.streams) for (const s of world.live) if (inView(screen, s)) world.ensureBuilt(s);
  world.focus = screen;
  syncScreenVisibility();
}

export const screenShown = (screen) => !!screen && drawn(screen);

// The world rect { x0, z0, x1, z1 } around every drawn screen: in a dungeon
// the current room, or both rooms during a slide. For the look's polished
// floor and lamp culling (look.bind({ roomRect: shownRect })).
export function shownRect() {
  let r = null;
  for (const s of world.live) {
    if (!drawn(s)) continue;
    if (!r) r = { x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1 };
    else {
      r.x0 = Math.min(r.x0, s.x0);
      r.z0 = Math.min(r.z0, s.z0);
      r.x1 = Math.max(r.x1, s.x1);
      r.z1 = Math.max(r.z1, s.z1);
    }
  }
  return r;
}

// Hide what is not shown. Runs every frame (main.js) so meshes rebuilt, props
// added and screens streamed in on hidden screens stay hidden; shown screens
// are touched only when they come back into view.
let liteShown = false;
export function syncScreenVisibility() {
  // At the 'low' look (weak devices; the watchdog drops there) the far backdrop and the scenery
  // ring are skipped: fewer triangles, which is what a weak device is short of.
  const lite = look.quality() === 'low';
  if (lite !== liteShown) {
    liteShown = lite;
    for (const m of world.backdrop ?? []) m.mesh.visible = !lite;
    for (const s of world.previews) s.shown = null; // re-sync below
  }
  const outdoors = !!view?.screen.streams;
  const sync = (s, on) => {
    if (on && s.shown === true) return;
    for (const m of s.meshes) if (m.mesh.visible !== on) m.mesh.visible = on;
    for (const obj of s.props.values()) if (obj.visible !== on) obj.visible = on;
    s.shown = on;
  };
  for (const s of world.live) sync(s, drawn(s));
  for (const s of world.previews) sync(s, !lite && outdoors && !!s.built); // scenery past the live ring
}

// ---------------------------------------------------------------- edges
// How far north of a screen's south edge the hero leaves it through that
// edge. Wherever the frame's bottom edge is held on the screen's south edge
// (every preset outside a room), that is as soon as all of him would no
// longer fit above it (core/camera.js southReach): he is never cut off at
// the bottom of the frame. In a room the fixed camera follows him down into
// the doorway instead, so there it is his centre crossing the edge.
export function southLine(screen) {
  const p = lensFor(CAMERA_PRESETS[presetNameFor(screen)], screen);
  return p.fixed && screen.area.rooms ? 0 : southReach(p);
}

// The screen past `from`'s edge `dir`, level with the hero, or null.
function neighbour(from, dir) {
  const [ux, uz] = DIRS[dir];
  const past = 1e-6; // a hair past the west and north edges (x0 and z0 belong to this screen)
  const next = world.screenAt(ux > 0 ? from.x1 : ux < 0 ? from.x0 - past : player.x, uz > 0 ? from.z1 : uz < 0 ? from.z0 - past : player.z);
  return next && next !== from ? next : null;
}

// One space: screens of one area, or of the streamed outdoors whatever their areas. Walking
// between them never fades.
const oneSpace = (from, next) => !!next && (next.area === from.area || (from.streams && next.streams));

// A follow change (no slide) rather than a slide or a load: following on
// both screens, in one space.
const softEdge = (from, next) => oneSpace(from, next) && followsOn(from) && followsOn(next);

// The edge of screen s the hero has crossed ('north', 'south', 'east',
// 'west'), or null. Where a follow change waits for the dead band it takes
// his centre that far past the edge; otherwise it is the edge itself (the
// south line at a south edge).
export function edgeCrossed(s, x = player.x, z = player.z) {
  const band = S.followDeadband;
  const soft = (dir) => softEdge(s, neighbour(s, dir));
  if (x < s.x0) return !soft('west') || x < s.x0 - band ? 'west' : null;
  if (x >= s.x1) return !soft('east') || x >= s.x1 + band ? 'east' : null;
  if (z < s.z0) return !soft('north') || z < s.z0 - band ? 'north' : null;
  if (z >= s.z1 - southLine(s)) return !soft('south') ? 'south' : z >= s.z1 + band ? 'south' : null;
  return null;
}

// The hero's centre has left the current screen through `dir` ('north',
// 'south', 'east' or 'west'), or reached its south line. Slide to the screen
// past that edge, level with him, or fade into that screen's area. Returns
// true if a transition started.
export function crossEdge(dir) {
  const from = currentScreen();
  if (!from || !DIRS[dir]) return false;
  const [, uz] = DIRS[dir];
  const next = neighbour(from, dir);
  if (!next) return false;
  if (softEdge(from, next)) return followChange(next);
  // This tick's step (or a knock) may have taken him a little past the south
  // line; he leaves from the line, so no frame shows him cut off.
  if (uz > 0) player.z = Math.min(player.z, from.z1 - southLine(from));
  // Bushes cut on the next screen grow back before the landing is worked
  // out, so it stops short of them instead of inside one. (Outdoors they grew back
  // when the screen came into the live ring, out of sight: systems/streaming.js.)
  if (!next.streams) world.regrow(next);
  const land = landing(next, dir);
  if (oneSpace(from, next)) startSlide(from, next, land);
  else startFade({ screen: next, x: land.x - next.x0, z: land.z - next.z0, yaw: player.yaw }, { via: 'edge', walkTo: land });
  return true;
}

// Where the hero stops after walking `dir` into `next`: SLIDE_STEP tiles in
// from the edge, or in a room ROOM_STEP tiles past the inside face of the
// wall the doorway is in (a tile thick; side walls stand WALL_INSET further
// in), so the hero ends up clear of the doorway; walking north, always clear
// of the new screen's south line, so he never slides straight back. Stops
// short of anything solid.
function landing(next, dir) {
  const [ux, uz] = DIRS[dir];
  let dist = next.area.rooms ? (ux ? 1 + WALL_INSET : 1) + ROOM_STEP : SLIDE_STEP;
  // A slide north into a screen that holds (B, C, flip screens outdoors)
  // lands him 2 x TUNING.scroll.followDeadband past its south line, the same
  // 1-tile dead band a follow change has (0.5 past the edge each way): the
  // slide back needs him to walk 1 tile, not a step. (The line cannot move
  // south instead: past it the held frame cuts him off.)
  if (uz < 0) dist = Math.max(dist, southLine(next) + (!next.area.rooms && !followsOn(next) ? 2 * S.followDeadband : SLIDE_STEP / 4));
  // how far past the edge the hero already is (less than nothing when he
  // leaves at the south line)
  const past = ux > 0 ? player.x - next.x0 : ux < 0 ? next.x1 - player.x : uz > 0 ? player.z - next.z0 : next.z1 - player.z;
  const step = clearDistance(player, ux, uz, Math.max(0, dist - past));
  return { x: player.x + ux * step, z: player.z + uz * step };
}

// ---------------------------------------------------------------- follow change
// The hero is on `next` now; the camera, which follows him, does not move.
function followChange(next) {
  leaveScreen(currentScreen());
  if (!next.streams) world.regrow(next);
  state.screenKey = next.key;
  showScreens(next);
  enterScreen('follow');
  return true;
}

// ---------------------------------------------------------------- slide
let slide = null;

function startSlide(from, next, land) {
  leaveScreen(from);
  slide = { x0: player.x, z0: player.z, x1: land.x, z1: land.z };
  const preset = presetNameFor(next);
  // The hero walks in linearly; the camera keeps him in frame on the way.
  const anchor = { from: { x: player.x, z: player.z }, to: land };
  startCameraTween(subjectFor(land, next, CAMERA_PRESETS[preset]), SLIDE_TIME, { preset, rect: next, anchor });
  state.screenKey = next.key;
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
    hold: areaChange ? loadHold() : WARP_HOLD,
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

// Tile hook for doorways and stairs: onEnter: enterWarp. The world checks
// at startup that every tile with this hook has a destination and that no
// destination lands on one (isWarp marks it without an import).
export function enterWarp(ctx) {
  const dest = ctx.world.warpAt(ctx.tx, ctx.tz);
  if (dest) startWarp(dest);
}
enterWarp.isWarp = true;

// The hero's middle in CSS px of the view, for the iris wipe (null when behind the camera).
const _onScreen = new THREE.Vector3();
function heroOnScreen() {
  _onScreen.set(player.x, GROUND_Y + 0.45, player.z).project(camera);
  if (_onScreen.z > 1) return null;
  const el = renderer.domElement;
  return [((_onScreen.x + 1) / 2) * el.clientWidth, ((1 - _onScreen.y) / 2) * el.clientHeight];
}

// A fade's black at e (0 clear .. 1 black; eased). The iris itself is drawn by the look on the
// canvas (look.setIris), so it costs a frame nothing; the page's black layer (ui/overlay.js setFade,
// over the HUD) only comes in where the loading card needs it: a load's black hold, and the first
// half of its iris opening, the card fading out with it (the hole brightens with it there). Closing,
// and a warp inside one area (stairs), is the iris alone, with the HUD left on as in the SNES game.
// With the hero off screen it is a plain fade.
function showFade(e, at = null, card = false) {
  if (!at || e <= 0 || (card && e >= 1)) {
    look.setIris(0);
    setFade(e);
    return;
  }
  look.setIris(e, at);
  setFade(card ? Math.max(0, 2 * e - 1) : 0);
}

registerMode('warp', {
  update(dt) {
    const f = fade;
    f.t += dt + 1e-9; // (a hair of slack, so 15 ticks of 1/60 s reach 0.25 s)
    // A load's black hold lasts until the screens the fade will show are built (world.pump, in
    // slices of TUNING.stream.loadBudgetMs so the card keeps animating), up to MAX_LOAD_HOLD; the
    // rest of the area streams in behind play. Usually there is nothing left to build: the area
    // was built ahead while the hero stood near its door (systems/streaming.js). Then the new
    // materials' shaders compile in parallel (compileAsync) instead of stalling the first frames
    // after the fade.
    if (f.moved && f.areaChange) {
      const late = f.t - f.out - f.hold > -dt;
      const building = screensToShow(f.dest.screen).some((sc) => !sc.built || world.pending.has(sc));
      const waiting = building || f.compile === 'busy';
      if (!building && !f.compile && !isManual()) { // play-tests never draw
        f.compile = 'busy';
        warmLookFrame({ renderer, scene, camera, look, post: false }).then(() => (f.compile = 'done'), () => (f.compile = 'done'));
      }
      if (late && waiting && f.t - f.out < MAX_LOAD_HOLD) f.hold += dt;
      else if (late && building) for (const sc of screensToShow(f.dest.screen)) world.ensureBuilt(sc); // (a slow device: the fade has waited long enough)
    }
    const inAt = f.out + f.hold; // the fade-in starts
    const k = f.t < f.out ? f.t / f.out : f.t < inAt ? 1 : Math.max(0, 1 - (f.t - inAt) / f.in);
    showFade(k * k * (3 - 2 * k), heroOnScreen(), f.areaChange && f.moved); // an eased iris on the hero, out and back in
    if (!f.moved && f.walk) {
      const k = Math.min(1, f.t / f.out);
      player.x = f.walk.x0 + (f.walk.x1 - f.walk.x0) * k;
      player.z = f.walk.z0 + (f.walk.z1 - f.walk.z0) * k;
    }
    if (!f.moved && f.t >= f.out) {
      f.moved = true;
      leaveScreen(f.from);
      const d = f.dest;
      placeAt(d.screen, d.x, d.z, d.yaw);
      world.regrow(d.screen);
      applyScreenAmbience(d.screen);
      setAreaLabel(d.screen.name);
      if (f.areaChange) emit('area-enter', { area: d.screen.area, from: f.from?.area ?? null, via: f.via });
    }
    player.animate(dt, !f.moved && !!f.walk);
    if (f.t >= inAt + f.in) {
      showFade(0);
      fade = null;
      setMode('play');
      enterScreen(f.via);
    }
  },
});

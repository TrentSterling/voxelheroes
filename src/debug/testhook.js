// window.__voxelHeroes: the handle play-tests and debugging use to drive the
// game without real-time input. See docs/ARCHITECTURE.md ("Test hook").
//
// URL parameters: ?manual=1 starts in manual mode (the loop renders but does
// not advance the simulation); ?seed=N seeds gameplay randomness.
import * as THREE from 'three';
import { state, serializeState } from '../core/state.js';
import { input } from '../core/input.js';
import { on, once, off, emit } from '../core/events.js';
import { setManual, isManual } from '../core/loop.js';
import { seedRandom } from '../core/random.js';
import { setMode } from '../core/modes.js';
import { camera as camera3d } from '../core/renderer.js';
import { CAMERA_PRESETS, setCameraPreset, cameraPreset, camTarget, subjectFor } from '../core/camera.js';
import { world, currentScreen } from '../world/world.js';
import { allAreas } from '../world/areas.js';
import { edgeReport } from '../world/links.js';
import { listTilesets } from '../world/tiles.js';
import { entities, spawn, liveEntities } from '../entities/manager.js';
import { entityTypes } from '../entities/registry.js';
import { player } from '../entities/player.js';
import { allItems } from '../items/registry.js';
import { grant, grantIds } from '../systems/grants.js';
import { keyCount } from '../systems/keys.js';
import { hurtPlayer } from '../systems/combat.js';
import { liveParticles } from '../systems/particles.js';
import { startGame, teleport, loadGame, newGame, saveToSlot, loadFromSlot } from '../systems/flow.js';
import * as transitions from '../systems/transitions.js';
import { showDialog, dialogOpen } from '../ui/dialog.js';
import { overlayVisible } from '../ui/overlay.js';

export function installTestHook({ update, render }) {
  const hook = {
    version: 1,
    state,
    player,
    world,
    input,
    events: { on, once, off, emit },
    get entities() {
      return liveEntities();
    },

    // One simulation tick; the game's own loop calls the same function.
    update(dt = 1 / 60) {
      update(dt);
    },
    // Many ticks. Returns the number of ticks run.
    step(seconds, dt = 1 / 60) {
      const n = Math.max(1, Math.round(seconds / dt));
      for (let i = 0; i < n; i++) update(dt);
      return n;
    },
    setManual(on = true) {
      setManual(on);
    },
    isManual,
    // Draw a frame now (HUD included), e.g. right before a screenshot.
    render() {
      render();
    },
    seed(n) {
      seedRandom(n);
    },

    start() {
      if (state.mode === 'title' || state.mode === 'dead') startGame();
    },
    // teleport('crypt:0,0', 8, 5.5) / teleport('Key Vault') / teleport('crypt') / teleport([2, 1], 3, 5)
    teleport(target, x, z, opts) {
      const s = teleport(target, x, z, opts);
      return { area: s.area.id, screen: [s.lx, s.ly], key: s.key, name: s.name };
    },
    // The current screen object (live): key, area, lx, ly, w, h, x0, z0, x1, z1, tiles, ...
    screen: () => currentScreen(),
    // give('key'), give('gems', 20), give('heart-container'), give('<item id>')
    give(id, amount = 1) {
      return grant(id, amount);
    },
    setHp(n) {
      if (n <= 0) {
        state.hp = 1;
        player.invT = 0;
        hurtPlayer(1, player.x, player.z + 1);
        return state.hp;
      }
      state.hp = Math.min(state.maxHp, Math.round(n));
      return state.hp;
    },
    // x, z: local tile coordinates of the current screen.
    spawn(type, x, z, opts = {}) {
      const s = currentScreen();
      return spawn(type, { ...opts, x: s.x0 + x, z: s.z0 + z });
    },
    setMode,
    newGame,
    save: () => serializeState(),
    load: (data) => loadGame(data),
    // localStorage save slots (false when storage is blocked).
    saveToSlot: (n) => saveToSlot(n),
    loadFromSlot: (n) => loadFromSlot(n),
    showDialog,
    dialogOpen,
    overlayVisible,
    camera: {
      presets: CAMERA_PRESETS,
      // The player's choice (kept across screens and in save data; dungeons keep their own).
      choose: transitions.chooseCameraPreset,
      // Only until the next screen change.
      set: setCameraPreset,
      get: cameraPreset,
      target: camTarget,
      object: camera3d,
      // Where the follow rule puts the subject for the hero now (world units).
      expected: () => subjectFor(player, currentScreen()),
      // World point -> normalised device coordinates [x, y, depth]; x and y
      // are -1..1 inside the frame.
      project(x, y, z) {
        camera3d.updateMatrixWorld();
        const v = new THREE.Vector3(x, y, z).project(camera3d);
        return [v.x, v.y, v.z];
      },
      // Normalised device point -> the ground (y = 0) it shows, or null above the horizon.
      groundAt(nx, ny) {
        camera3d.updateMatrixWorld();
        const o = camera3d.position.clone();
        const d = new THREE.Vector3(nx, ny, 0.5).unproject(camera3d).sub(o);
        if (d.y >= -1e-9) return null;
        const t = -o.y / d.y;
        return { x: o.x + d.x * t, z: o.z + d.z * t };
      },
    },
    // Slide and fade timing (systems/transitions.js).
    transitions: {
      SLIDE_TIME: transitions.SLIDE_TIME,
      SLIDE_STEP: transitions.SLIDE_STEP,
      FADE_OUT: transitions.FADE_OUT,
      FADE_IN: transitions.FADE_IN,
      WARP_HOLD: transitions.WARP_HOLD,
      AREA_HOLD: transitions.AREA_HOLD,
      shown: (key) => transitions.screenShown(world.screen(key)),
    },
    // Where screens of different areas touch, and edge tiles that do not match.
    links: () => edgeReport(world),
    registries: {
      tilesets: listTilesets,
      areas: () => allAreas().map((a) => a.id),
      entities: entityTypes,
      items: () => allItems().map((i) => i.id),
      grants: grantIds,
    },

    // A compact, JSON-friendly summary of the game. screen is the area-local
    // screen [i, j]; lx, lz and cam are local tile coordinates on it.
    snapshot() {
      const s = currentScreen();
      const o = s ?? { x0: 0, z0: 0 };
      return {
        mode: state.mode,
        area: s?.area.id ?? null,
        screen: s ? [s.lx, s.ly] : null,
        key: s?.key ?? null,
        size: s ? [s.w, s.h] : null,
        screenName: s?.name ?? null,
        hp: state.hp,
        maxHp: state.maxHp,
        gems: state.gems,
        keys: keyCount(),
        keysByGroup: { ...state.keys },
        x: +player.x.toFixed(3),
        z: +player.z.toFixed(3),
        lx: +(player.x - o.x0).toFixed(3),
        lz: +(player.z - o.z0).toFixed(3),
        cam: { preset: cameraPreset(), x: +(camTarget.x - o.x0).toFixed(3), z: +(camTarget.z - o.z0).toFixed(3) },
        yaw: +player.yaw.toFixed(3),
        invT: +player.invT.toFixed(3),
        attacking: player.attackT > 0,
        enemies: entities.filter((e) => !e.removed && e.kind === 'enemy').length,
        entities: liveEntities().map((e) => ({ type: e.type, kind: e.kind, x: +e.x.toFixed(2), z: +e.z.toFixed(2), hp: e.hp })),
        flags: [...state.flags],
        inventory: JSON.parse(JSON.stringify(state.inventory)),
        overlay: overlayVisible(),
        dialog: dialogOpen(),
        particles: liveParticles(),
        time: +state.time.toFixed(3),
      };
    },
  };

  const params = new URLSearchParams(window.location.search);
  if (params.has('manual')) setManual(params.get('manual') !== '0');
  if (params.has('seed')) seedRandom(Number(params.get('seed')) >>> 0);

  window.__voxelHeroes = hook;
  return hook;
}

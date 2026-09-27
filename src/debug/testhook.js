// window.__voxelHeroes: the handle play-tests and debugging use to drive the
// game without real-time input. See docs/ARCHITECTURE.md ("Test hook").
//
// URL parameters: ?manual=1 starts in manual mode (the loop renders but does
// not advance the simulation); ?seed=N seeds gameplay randomness.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state, serializeState } from '../core/state.js';
import { input } from '../core/input.js';
import { on, once, off, emit } from '../core/events.js';
import { setManual, isManual } from '../core/loop.js';
import { seedRandom } from '../core/random.js';
import { setMode } from '../core/modes.js';
import { CAMERA_PRESETS, setCameraPreset, cameraPreset, camTarget } from '../core/camera.js';
import { world, currentScreen } from '../world/world.js';
import { allAreas } from '../world/areas.js';
import { listTilesets } from '../world/tiles.js';
import { entities, spawn, liveEntities } from '../entities/manager.js';
import { entityTypes } from '../entities/registry.js';
import { player } from '../entities/player.js';
import { allItems } from '../items/registry.js';
import { grant, grantIds } from '../systems/grants.js';
import { keyCount } from '../systems/keys.js';
import { hurtPlayer } from '../systems/combat.js';
import { liveParticles } from '../systems/particles.js';
import { startGame, teleport, loadGame, newGame } from '../systems/flow.js';
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
    // teleport('crypt:0,0', 8, 5.5) / teleport('Key Vault') / teleport([2, 1], 3, 5)
    teleport(target, x, z, opts) {
      const s = teleport(target, x, z, opts);
      return { sx: s.sx, sy: s.sy, name: s.name };
    },
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
    spawn(type, x, z, opts = {}) {
      return spawn(type, { ...opts, x: state.sx * SCREEN_W + x, z: state.sy * SCREEN_H + z });
    },
    setMode,
    newGame,
    save: () => serializeState(),
    load: (data) => loadGame(data),
    showDialog,
    dialogOpen,
    overlayVisible,
    camera: {
      presets: CAMERA_PRESETS,
      set: setCameraPreset,
      get: cameraPreset,
      target: camTarget,
    },
    registries: {
      tilesets: listTilesets,
      areas: () => allAreas().map((a) => a.id),
      entities: entityTypes,
      items: () => allItems().map((i) => i.id),
      grants: grantIds,
    },

    // A compact, JSON-friendly summary of the game.
    snapshot() {
      const s = currentScreen();
      return {
        mode: state.mode,
        area: s?.area.id ?? null,
        screen: [state.sx, state.sy],
        screenName: s?.name ?? null,
        hp: state.hp,
        maxHp: state.maxHp,
        gems: state.gems,
        keys: keyCount(),
        keysByGroup: { ...state.keys },
        x: +player.x.toFixed(3),
        z: +player.z.toFixed(3),
        lx: +(player.x - state.sx * SCREEN_W).toFixed(3),
        lz: +(player.z - state.sy * SCREEN_H).toFixed(3),
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

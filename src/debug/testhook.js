// window.__voxelHeroes: the handle play-tests and debugging use to drive the
// game without real-time input. See docs/ARCHITECTURE.md ("Test hook").
//
// URL parameters: ?manual=1 starts in manual mode (the loop renders but does
// not advance the simulation); ?seed=N seeds gameplay randomness.
//
// tick() and step() are async: after each simulation tick they let pending
// promise continuations run (code after `await showDialog(...)`), the way the
// real loop does between two animation frames. update() is one bare tick.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state, serializeState } from '../core/state.js';
import { input } from '../core/input.js';
import { on, once, off, emit } from '../core/events.js';
import { setManual, isManual } from '../core/loop.js';
import { seedRandom } from '../core/random.js';
import { setMode, registerMode, pushMode, popMode } from '../core/modes.js';
import { CAMERA_PRESETS, setCameraPreset, cameraPreset, camTarget, playerCameraPresets, registerCameraPreset } from '../core/camera.js';
import { world, currentScreen } from '../world/world.js';
import { allAreas } from '../world/areas.js';
import { listTilesets, registerTile } from '../world/tiles.js';
import { entities, spawn, liveEntities } from '../entities/manager.js';
import { entityTypes, registerEntity } from '../entities/registry.js';
import { player } from '../entities/player.js';
import { allItems, registerItem } from '../items/registry.js';
import { ammo, maxAmmo, hasItem } from '../items/inventory.js';
import { grant, grantIds, registerGrant } from '../systems/grants.js';
import { addDrop, rollDrop, registerDropTable } from '../systems/drops.js';
import { keyCount } from '../systems/keys.js';
import { hurtPlayer } from '../systems/combat.js';
import { liveParticles } from '../systems/particles.js';
import { startGame, teleport, loadGame, newGame, saveToSlot, loadFromSlot, activeSlot, registerPlayHook } from '../systems/flow.js';
import { chooseCameraPreset } from '../systems/transitions.js';
import { registerHudWidget } from '../ui/hud.js';
import { showDialog, dialogOpen } from '../ui/dialog.js';
import { overlayVisible } from '../ui/overlay.js';

// Promise continuations get this many microtask turns after each tick. A
// continuation that awaits again needs one more turn per level; eight covers
// NPC code several awaits deep. Microtasks never let the browser render, so
// this costs almost nothing.
const SETTLE_TURNS = 8;

export function installTestHook({ update, render }) {
  const hook = {
    version: 2,
    state,
    player,
    world,
    input,
    events: { on, once, off, emit },
    get entities() {
      return liveEntities();
    },

    // One bare simulation tick; the game's own loop calls the same function.
    // Promise continuations only run after the calling script returns.
    update(dt = 1 / 60) {
      update(dt);
    },
    // One tick, then let promise continuations run, as between two frames.
    async tick(dt = 1 / 60) {
      update(dt);
      for (let i = 0; i < SETTLE_TURNS; i++) await null;
    },
    // Many ticks (each one a tick()). Resolves to the number of ticks run.
    async step(seconds, dt = 1 / 60) {
      const n = Math.max(1, Math.round(seconds / dt));
      for (let i = 0; i < n; i++) await hook.tick(dt);
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
    // localStorage save slots (false when storage is blocked or the slot is
    // empty, damaged or from a newer version).
    saveToSlot: (n) => saveToSlot(n),
    loadFromSlot: (n) => loadFromSlot(n),
    activeSlot,
    showDialog,
    dialogOpen,
    overlayVisible,
    camera: {
      presets: CAMERA_PRESETS,
      // Names the player can choose (A-D): an options menu offers these.
      playerPresets: playerCameraPresets,
      // The player's choice (kept across screens; dungeons keep their own).
      choose: chooseCameraPreset,
      // Any preset, only until the next screen change.
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
    // Registration functions and small APIs, so a test can add content at
    // run time (an item, an entity type, a play hook) without a build.
    api: {
      registerTile,
      registerMode,
      pushMode,
      popMode,
      registerItem,
      registerEntity,
      registerGrant,
      registerPlayHook,
      registerHudWidget,
      registerCameraPreset,
      registerDropTable,
      addDrop,
      rollDrop,
      ammo,
      maxAmmo,
      hasItem,
      World: world.constructor,
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

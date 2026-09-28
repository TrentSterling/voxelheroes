// window.__voxelHeroes: the handle play-tests and debugging use to drive the
// game without real-time input. See docs/ARCHITECTURE.md ("Test hook").
//
// URL parameters: ?manual=1 starts in manual mode (the loop neither advances
// the simulation nor draws: call render()); ?seed=N seeds gameplay randomness.
//
// tick() and step() are async: after each simulation tick they let pending
// promise continuations run (code after `await showDialog(...)`), the way the
// real loop does between two animation frames. update() is one bare tick.
import * as THREE from 'three';
import { state, serializeState } from '../core/state.js';
import { input } from '../core/input.js';
import { on, once, off, emit } from '../core/events.js';
import { setManual, isManual } from '../core/loop.js';
import { seedRandom } from '../core/random.js';
import { setMode, registerMode, pushMode, popMode } from '../core/modes.js';
import { camera as camera3d } from '../core/renderer.js';
import {
  CAMERA_PRESETS,
  currentHeroOutline,
  currentCameraPreset,
  playerCameraPresets,
  registerCameraPreset,
  setCameraPreset,
  cameraPreset,
  camTarget,
  southReach,
  subjectFor,
} from '../core/camera.js';
import { world, currentScreen } from '../world/world.js';
import { allAreas } from '../world/areas.js';
import { edgeReport } from '../world/links.js';
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
import * as transitions from '../systems/transitions.js';
import { registerHudWidget } from '../ui/hud.js';
import { showDialog, dialogOpen } from '../ui/dialog.js';
import { overlayVisible } from '../ui/overlay.js';
import { look, LIGHTING, applyLighting, registerLighting, lightingName, camera as viewCamera } from '../core/renderer.js';
import { QUALITY_ORDER, DOF_PRESETS } from '../core/look/index.js';
import { getMaterial, makeWaterMaterial, makeGlowMaterial, setSeams, materialValues } from '../core/materials.js';

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
    // The look (docs/ARCHITECTURE.md, "Look"): quality level, lighting preset, frame info.
    // In manual mode the loop does not draw at all (a look frame takes seconds in software
    // GL): render() above draws, and shots call it. ?look=high|medium|low|flat pins a quality.
    look: {
      levels: QUALITY_ORDER,
      set: (level, opts) => look.setQuality(level, opts), // opts: { pin: false } keeps the watchdog on
      get: () => look.quality(),
      lighting: () => lightingName(),
      presets: () => Object.keys(LIGHTING),
      applyLighting,
      registerLighting,
      dof: DOF_PRESETS,
      info: () => look.info(),
      // the three.js camera (project points to find pixels in a frame)
      camera: viewCamera,
      setSeams,
      // player options: { brightness, saturation } (1 = the look's own values)
      setDisplay: (opts) => look.setDisplay(opts),
      materials: materialValues,
      // the material and lamp API, for probes and previews
      getMaterial,
      makeWaterMaterial,
      makeGlowMaterial,
      makeLampLight: (overrides) => look.makeLampLight(overrides),
      setMirrorRect: (rect) => look.setMirrorRect(rect),
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
      // Names the player can choose (A-D): an options menu offers these
      // (choices is the same list under feat/world's name).
      playerPresets: playerCameraPresets,
      choices: playerCameraPresets,
      // The player's choice (kept across screens and in save data; dungeons keep their own).
      choose: transitions.chooseCameraPreset,
      // Any preset, only until the next screen change.
      set: setCameraPreset,
      get: cameraPreset,
      // The lens in use: the preset fitted to the room (interior), or a blend mid-slide.
      lens: currentCameraPreset,
      target: camTarget,
      object: camera3d,
      // Frame rules (core/camera.js): the hero's outline ([reach, bottom,
      // top] slabs, tiles), how far north of the frame's bottom edge his
      // centre stays under a preset, and the south line of a screen (how far
      // north of its south edge he leaves it).
      rules: {
        outline: () => currentHeroOutline(),
        southReach: (name = cameraPreset()) => southReach(CAMERA_PRESETS[name]),
        southLine: (key) => transitions.southLine(key ? world.screen(key) : currentScreen()),
      },
      // Where the follow rule puts the subject for the hero now (world units).
      expected: () => subjectFor(player, currentScreen()),
      // Every vertex of the hero's model (the sword and the flat contact
      // shadow left out) in normalised device coordinates: worst is the
      // largest |x| or |y| (over 1 lies outside the frame), out the vertices
      // outside, of total; side names the edge the worst one is past.
      heroInFrame() {
        camera3d.updateMatrixWorld();
        const skip = new Set();
        player.hero.swordPivot?.traverse((o) => skip.add(o));
        player.hero.root.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        const r = { worst: 0, out: 0, total: 0, side: null };
        player.hero.root.traverse((o) => {
          if (!o.isMesh || skip.has(o) || o.material?.transparent) return;
          const pos = o.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera3d);
            const m = Math.max(Math.abs(v.x), Math.abs(v.y));
            r.total++;
            if (m > 1 + 1e-4) r.out++;
            if (m > r.worst) {
              r.worst = m;
              r.side = Math.abs(v.x) >= Math.abs(v.y) ? (v.x > 0 ? 'east' : 'west') : v.y > 0 ? 'top' : 'bottom';
            }
          }
        });
        r.worst = +r.worst.toFixed(4);
        return r;
      },
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
      ROOM_STEP: transitions.ROOM_STEP,
      FADE_OUT: transitions.FADE_OUT,
      FADE_IN: transitions.FADE_IN,
      WARP_FADE: transitions.WARP_FADE,
      WARP_HOLD: transitions.WARP_HOLD,
      AREA_HOLD: transitions.AREA_HOLD,
      shown: (key) => transitions.screenShown(world.screen(key)),
      shownRect: transitions.shownRect, // world rect around the drawn screens
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

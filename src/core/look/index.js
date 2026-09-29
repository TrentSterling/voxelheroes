// The look: lighting presets, light rigs, materials, the post stack, the polished floor and the
// quality levels, driven once per rendered frame (art bible sections 3 to 7, appendix A).
//
// src/core/renderer.js owns the renderer, scene and camera and exposes this module's API
// (LIGHTING, registerLighting, applyLighting, followSun, renderScene). main.js binds the hero and
// the camera preset getters; the test hook reaches the rest through `look`.
import * as THREE from 'three';
import { GROUND_Y, SCREEN_W, SCREEN_H } from '../constants.js';
import { state } from '../state.js';
import { on } from '../events.js';
import { applyMaterialLook, setFlatMaterials, setWaterTime, materialValues, setSeams, getMaterial } from '../materials.js';
import { LOOK_DAY, LOOK_CRYPT, DOF_PRESETS, QUALITY_LEVELS, QUALITY_ORDER, dofForCamera, mergeLook, fromLegacy } from './presets.js';
import { gradientEnvironment } from './environment.js';
import { LightRig, makeLampLightFrom } from './lights.js';
import { FloorMirror } from './mirror.js';
import { LookPipeline } from './pipeline.js';

export { DOF_PRESETS, QUALITY_LEVELS, QUALITY_ORDER };

// Frame-time watchdog: drop one quality level when the median frame time stays above
// SLOW_FRAME_MS for SLOW_SECONDS (real-time loop only; never below 'low').
const SLOW_FRAME_MS = 20;
const SLOW_SECONDS = 3;

const _size = new THREE.Vector2();
const _hero = new THREE.Vector3();

export function createLook({ renderer, scene, camera }) {
  const LIGHTING = { day: LOOK_DAY, crypt: LOOK_CRYPT };
  const rig = new LightRig(scene);
  const mirror = new FloorMirror(scene);
  const pipeline = new LookPipeline(renderer, scene, camera);
  renderer.info.autoReset = false; // count every pass of a frame (reset in render())
  const subject = new THREE.Vector3(); // the camera subject (followSun)
  const bound = { hero: null, cameraPreset: () => null, cameraPresetName: () => 'A' };

  let lookName = null;
  let L = LOOK_DAY;
  let quality = 'high';
  let pinned = false;
  let flash = null; // { start, seconds, boost }
  const display = { brightness: 1, saturation: 1 }; // player options, on top of the look's own values
  let lastFrame = { dof: null, focusDistance: 0, exposure: 1, path: 'post', ms: 0 };

  // ---------------------------------------------------------------- presets
  function registerLighting(name, preset) {
    const { extends: base = 'day', ...rest } = preset ?? {};
    const parent = LIGHTING[base];
    if (!parent) throw new Error(`registerLighting("${name}"): unknown base look "${base}"`);
    LIGHTING[name] = mergeLook(parent, fromLegacy(rest));
    if (lookName === name) applyLook(name, true);
    warmEnvironments(); // content can register a look at any time, not only at boot
    return LIGHTING[name];
  }

  function applyLook(name, force = false) {
    const next = LIGHTING[name];
    if (!next) throw new Error(`Unknown lighting preset "${name}"`);
    if (name === lookName && !force) return;
    const from = lookName;
    lookName = name;
    L = next;
    const Q = QUALITY_LEVELS[quality];
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    scene.background.setHex(L.background ?? 0x000000);
    scene.fog = L.fog ? new THREE.Fog(L.fog.color, L.fog.near, L.fog.far) : null;
    rig.apply(L.lights, Q);
    if (L.env) {
      scene.environment = gradientEnvironment(renderer, L.env, L.lights.sun.dir);
      scene.environmentIntensity = Q.flat ? 0 : L.env.intensity ?? 1;
    } else {
      scene.environment = null;
    }
    applyMaterialLook(L);
    if (from !== name) {
      const F = L.arrivalFlash;
      flash = from && F && F.from?.includes(from) ? { start: state.time, seconds: F.seconds ?? 1, boost: F.boost ?? 0.4 } : null;
    }
  }

  // ---------------------------------------------------------------- quality
  function setQuality(level, { pin = true } = {}) {
    if (!QUALITY_LEVELS[level]) throw new Error(`Unknown look quality "${level}" (${QUALITY_ORDER.join(', ')})`);
    quality = level;
    pinned = pin;
    const Q = QUALITY_LEVELS[level];
    setFlatMaterials(!!Q.flat);
    renderer.toneMapping = THREE.NoToneMapping;
    if (lookName) applyLook(lookName, true);
    watchdog.reset();
    return level;
  }

  function defaultQuality() {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const small = Math.max(window.innerWidth, window.innerHeight) < 900;
    return coarse || small ? 'medium' : 'high';
  }

  // ?look= wins, then a saved settings choice, then the device default (which the watchdog may lower)
  function initQuality() {
    const url = new URLSearchParams(window.location.search).get('look');
    if (url && QUALITY_LEVELS[url]) return setQuality(url, { pin: true });
    const saved = state.settings?.look;
    if (saved && QUALITY_LEVELS[saved]) return setQuality(saved, { pin: true });
    return setQuality(defaultQuality(), { pin: false });
  }

  // Frames are timed between loop draws; a hidden tab restarts the timing (rAF pauses there), so
  // slow devices whose frames take seconds still count.
  const watchdog = {
    samples: [], // [end time, frame ms]
    last: 0,
    hold: 0,
    frames: 0,
    lastDt: 0,
    drops: [],
    reset() {
      this.samples.length = 0;
      this.hold = 2000; // ignore the first 2 s after a change (shader compiles)
      this.last = 0;
    },
    sample(now) {
      const dt = this.last ? now - this.last : 0;
      this.last = now;
      this.frames++;
      this.lastDt = dt;
      if (!dt) return;
      if (this.hold > 0) {
        this.hold -= dt;
        return;
      }
      const span = SLOW_SECONDS * 1000;
      const S = this.samples;
      S.push([now, dt]);
      // drop the oldest frames while the rest still cover the span; judge once they cover it
      while (S.length > 3 && S[1][0] - S[1][1] <= now - span) S.shift();
      if (S.length < 3 || S[0][0] - S[0][1] > now - span) return;
      const sorted = S.map((x) => x[1]).sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      if (median <= SLOW_FRAME_MS || pinned) return;
      const i = QUALITY_ORDER.indexOf(quality);
      if (i < 0 || i >= QUALITY_ORDER.indexOf('low')) return;
      const to = QUALITY_ORDER[i + 1];
      this.drops.push({ from: quality, to, median: +median.toFixed(1), time: +(now / 1000).toFixed(1) });
      console.info(`[look] median frame ${median.toFixed(1)} ms over ${SLOW_SECONDS} s: quality ${quality} -> ${to}`);
      setQuality(to, { pin: false });
    },
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => (watchdog.last = 0));

  // ---------------------------------------------------------------- per frame
  // The screens around the camera subject: the current room, or two rooms during a slide. Areas
  // whose screens are not SCREEN_W x SCREEN_H need a bound `roomRect` getter instead.
  function roomRect() {
    const x0 = Math.floor((subject.x - SCREEN_W / 2 + 0.01) / SCREEN_W) * SCREEN_W;
    const x1 = (Math.floor((subject.x + SCREEN_W / 2 - 0.01) / SCREEN_W) + 1) * SCREEN_W;
    const z0 = Math.floor((subject.z - SCREEN_H / 2 + 0.01) / SCREEN_H) * SCREEN_H;
    const z1 = (Math.floor((subject.z + SCREEN_H / 2 - 0.01) / SCREEN_H) + 1) * SCREEN_H;
    return { x0, x1, z0, z1 };
  }

  function exposure() {
    let e = L.tone?.exposure ?? 1;
    if (flash) {
      const k = (state.time - flash.start) / flash.seconds;
      if (k >= 1 || k < 0) flash = null;
      else e *= 1 + flash.boost * (1 - k) * (1 - k);
    }
    return e;
  }

  // Options menu choices in state.settings apply when they change: `look` (a quality level, or
  // 'auto' for the device default that the watchdog may lower), `seams` (true / false),
  // `brightness` (x exposure) and `saturation` (x the grade's saturation). setDisplay() and
  // setSeams() do the same from code.
  let lastSettings = { look: state.settings?.look };
  function applySettings() {
    const S = state.settings;
    if (!S) return;
    if (S.look !== lastSettings.look) {
      lastSettings.look = S.look;
      if (QUALITY_LEVELS[S.look]) setQuality(S.look, { pin: true });
      else if (S.look === 'auto') setQuality(defaultQuality(), { pin: false });
    }
    if (S.seams !== lastSettings.seams) {
      lastSettings.seams = S.seams;
      if (typeof S.seams === 'boolean') setSeams(S.seams);
    }
    for (const k of ['brightness', 'saturation'])
      if (S[k] !== lastSettings[k]) {
        lastSettings[k] = S[k];
        display[k] = Number.isFinite(S[k]) ? S[k] : 1;
      }
  }

  function render() {
    const t0 = performance.now();
    renderer.info.reset();
    if (!lookName) applyLook('day');
    applySettings();
    const Q = QUALITY_LEVELS[quality];

    // Pixel budget: big screens (4K) draw at most Q.maxPixels and the browser scales the canvas
    // up. Blur radii scale with the buffer height, so the look is the same at any size.
    const css = renderer.domElement.getBoundingClientRect();
    const cssPixels = Math.max(1, css.width * css.height);
    let pr = Math.min(window.devicePixelRatio || 1, 2);
    if (Q.maxPixels) pr = Math.min(pr, Math.sqrt(Q.maxPixels / cssPixels));
    const rs = state.settings?.renderScale;
    if (Number.isFinite(rs) && rs > 0) pr *= rs;
    pr = Math.round(pr * 100) / 100;
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    renderer.getDrawingBufferSize(_size);
    const w = Math.max(1, _size.x);
    const h = Math.max(1, _size.y);

    camera.updateMatrixWorld();
    const hero = bound.hero;
    rig.place(hero ? { x: hero.x, z: hero.z } : subject, subject);
    const rect = bound.roomRect?.() ?? roomRect();
    rig.cullLamps(rect);
    mirror.update({
      enabled: (L.reflect ?? 0) > 0 && Q.reflect,
      strength: L.reflect ?? 0,
      blur: L.reflectBlur ?? 0,
      tint: L.reflectTint ?? [1, 1, 1],
      rect,
      floorY: GROUND_Y,
      width: w,
      height: h,
    });
    setWaterTime(state.time);

    // depth of field: the hero's feet (view depth) plus the camera preset's offset
    const blur = Number.isFinite(state.settings?.blur) ? state.settings.blur : 1;
    const dofBase = dofForCamera(bound.cameraPresetName(), bound.cameraPreset());
    const dof = blur <= 0 ? null : blur === 1 ? dofBase : { ...dofBase, farMaxBlur: dofBase.farMaxBlur * blur, nearMaxBlur: dofBase.nearMaxBlur * blur };
    _hero.set(hero ? hero.x : subject.x, GROUND_Y, hero ? hero.z : subject.z).applyMatrix4(camera.matrixWorldInverse);
    const focusDistance = -_hero.z + (dofBase.focusOffset ?? 0);
    const exp = exposure() * display.brightness;

    if (Q.post) {
      pipeline.setSize(w, h);
      renderer.toneMapping = THREE.NoToneMapping;
      pipeline.render({ look: L, quality: state.settings?.bloom === false ? { ...Q, bloom: false, glare: false } : Q, dof, focusDistance, exposure: exp, saturation: display.saturation });
    } else {
      renderer.setRenderTarget(null);
      renderer.toneMapping = Q.flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = Q.flat ? 1 : exp;
      renderer.render(scene, camera);
    }
    lastFrame = { dof, focusDistance, exposure: exp, path: Q.post ? 'post' : Q.flat ? 'flat' : 'direct', ms: performance.now() - t0 };
  }

  // Every registered look's reflection environment (environment.js's PMREM-prefiltered "orb",
  // scene.environment) is cached there by value, but only ever built lazily, the moment applyLook()
  // first wants one it has not seen before. That is a real stall the first time a room's look
  // differs from the one behind the title: PMREMGenerator.fromScene renders several passes and links
  // its own blur shader synchronously (no compileAsync path), which a browser with no parallel
  // shader compile (Firefox) has nothing to hide behind. Built here instead, one look per animation
  // frame so it never costs a frame of its own: behind the title (warmUp(), called before the player
  // can reach any room) and again whenever content registers a look afterwards. gradientEnvironment's
  // own cache (keyed by the env values and sun direction) makes every call after the first for a
  // given look a no-op, so calling this again and again (every registerLighting) costs nothing once a
  // look is warm.
  //
  // Verified with scripts/perf-stream.mjs (Firefox) that this removes every PMREM/program compile at
  // the moment a room first switches to the crypt look: 0 new WebGLPrograms link there now, and
  // look.info().cpuMs for that frame is ~2 ms. Firefox's D1-entry freeze (measured 733-850 ms) still
  // reproduces after this fix, though: it is a single very long gap between two rAF callbacks, with
  // no corresponding render or program-link cost that frame, so it is not a look/shader-compile stall
  // at all; it happens somewhere in the world-build/streaming/meshing side of entering a dungeon
  // (systems/transitions.js's warp fade, or world/meshing.js's worker pool under headless Firefox),
  // outside this module. Left to whichever lane owns that path.
  const envWarmed = new Set();
  function warmEnvironments() {
    const names = Object.keys(LIGHTING).filter((n) => LIGHTING[n].env && !envWarmed.has(n));
    if (!names.length) return;
    let i = 0;
    const step = () => {
      if (i >= names.length) return;
      const name = names[i++];
      const L = LIGHTING[name];
      gradientEnvironment(renderer, L.env, L.lights.sun.dir);
      envWarmed.add(name);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Boot warm-up (main.js, behind the title): link every shader program the current scene can
  // predict before the player can act, via KHR_parallel_shader_compile, so neither the first play
  // frame nor the first room whose look differs structurally from the start has to stall to compile.
  // renderer.compileAsync(scene, camera) finds every material already in the scene graph (the voxel
  // kinds are shared singletons used everywhere, so warming the start screen's meshes warms them
  // all) and, as a side effect of the render() call inside it that seeds the shadow map's light list,
  // primes the depth/distance materials three.js generates for shadow-casting objects. Two things the
  // outdoor start screen never has of its own are added as throwaway, invisible meshes so compile()
  // (a plain scene.traverse, visibility does not matter) finds them too: the 'fine' and 'prop' kinds
  // (dungeon floors and stone props, materials.js), which otherwise cold-compile on the first dungeon
  // entered; and the polished floor's Reflector shader, which otherwise waits for the first room with
  // reflect > 0 (a crypt).
  function warmUp() {
    const rect = { x0: 0, x1: 1, z0: 0, z1: 1 };
    mirror.update({ enabled: true, strength: 0, blur: 0, tint: [1, 1, 1], rect, floorY: GROUND_Y, width: 2, height: 2 });
    const stubs = ['fine', 'prop'].map((kind) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), getMaterial(kind));
      m.visible = false;
      scene.add(m);
      return m;
    });
    const done = renderer.compileAsync(scene, camera).catch(() => {});
    mirror.update({ enabled: false });
    for (const m of stubs) {
      scene.remove(m);
      m.geometry.dispose();
    }
    warmEnvironments();
    return done;
  }

  // content may narrow the mirror for the current room; it resets on the next screen
  on('screen-enter', () => {
    mirror.override = null;
    rig.scanLamps();
  });
  on('warp', () => {
    mirror.override = null;
  });

  initQuality();

  return {
    LIGHTING,
    rig,
    mirror,
    pipeline,
    hemi: rig.hemi,
    sun: rig.sun,
    registerLighting,
    applyLighting: (name = 'day') => applyLook(name),
    lightingName: () => lookName,
    currentLook: () => L,
    followSun(target) {
      subject.set(target.x, 0, target.z);
    },
    // hero, cameraPreset(), cameraPresetName(); optional roomRect() -> { x0, x1, z0, z1 } (world
    // x / z of the room or rooms the camera shows: polished floor and lamp culling)
    bind(opts) {
      Object.assign(bound, opts);
    },
    render,
    warmUp,
    sampleFrame: (now) => watchdog.sample(now),
    // pin: false lets the frame-time watchdog lower it again (the default pins it, like ?look=)
    setQuality: (level, { pin = true } = {}) => setQuality(level, { pin }),
    quality: () => quality,
    setMirrorRect(rect) {
      mirror.override = rect ? { ...rect } : null;
    },
    // player options: brightness multiplies the exposure, saturation the grade's saturation (the
    // grade only runs at high and medium quality)
    setDisplay({ brightness, saturation } = {}) {
      if (brightness !== undefined) display.brightness = Number.isFinite(brightness) ? brightness : 1;
      if (saturation !== undefined) display.saturation = Number.isFinite(saturation) ? saturation : 1;
      return { ...display };
    },
    display: () => ({ ...display }),
    // a wall lamp (group of point lights) with the active look's lamp values, culled with the others
    makeLampLight(overrides) {
      const lamp = makeLampLightFrom(L.lights?.lamp ?? LOOK_CRYPT.lights.lamp, overrides);
      rig.lamps.push(...lamp.userData.lights);
      return lamp;
    },
    info() {
      const Q = QUALITY_LEVELS[quality];
      return {
        quality,
        pinned,
        lighting: lookName,
        path: lastFrame.path,
        cpuMs: +lastFrame.ms.toFixed(2),
        size: [_size.x, _size.y],
        pixelRatio: renderer.getPixelRatio(),
        camera: bound.cameraPresetName(),
        dof: lastFrame.dof,
        focusDistance: +lastFrame.focusDistance.toFixed(3),
        exposure: +lastFrame.exposure.toFixed(3),
        mirror: !!mirror.mesh?.parent,
        shadowMap: rig.sun.shadow.mapSize.x,
        lamps: rig.lamps.filter((l) => l.parent && l.layers.isEnabled(0)).length,
        passes: Q.post ? pipeline.stats.passes : 1,
        // render targets of the look (approximate MB): post stack + polished floor
        targetsMB: +(((Q.post ? pipeline.memory({ ao: Q.ao, bloom: Q.bloom, glare: Q.glare }) : 0) + mirror.memory()) / 1048576).toFixed(1),
        drops: [...watchdog.drops],
        watchdog: { frames: watchdog.frames, lastFrameMs: +watchdog.lastDt.toFixed(1), samples: watchdog.samples.length, hold: Math.max(0, Math.round(watchdog.hold)) },
        materials: materialValues(),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
  };
}

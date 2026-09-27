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
import { applyMaterialLook, setFlatMaterials, setWaterTime, materialValues } from '../materials.js';
import { LOOK_DAY, LOOK_CRYPT, DOF_PRESETS, QUALITY_LEVELS, QUALITY_ORDER, dofForCamera, mergeLook, fromLegacy } from './presets.js';
import { gradientEnvironment } from './environment.js';
import { LightRig, makeLampLightFrom } from './lights.js';
import { FloorMirror } from './mirror.js';
import { LookPipeline } from './pipeline.js';

export { DOF_PRESETS, QUALITY_LEVELS, QUALITY_ORDER };

// Frame-time watchdog: drop one quality level when the median frame time stays above
// SLOW_FRAME_MS for SLOW_SECONDS (real-time loop only; never below 'low').
const SLOW_FRAME_MS = 24;
const SLOW_SECONDS = 3;
const WINDOW = 45;

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
  let lastFrame = { dof: null, focusDistance: 0, exposure: 1, path: 'post', ms: 0 };

  // ---------------------------------------------------------------- presets
  function registerLighting(name, preset) {
    const { extends: base = 'day', ...rest } = preset ?? {};
    const parent = LIGHTING[base];
    if (!parent) throw new Error(`registerLighting("${name}"): unknown base look "${base}"`);
    LIGHTING[name] = mergeLook(parent, fromLegacy(rest));
    if (lookName === name) applyLook(name, true);
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

  function initQuality() {
    const url = new URLSearchParams(window.location.search).get('look');
    if (url && QUALITY_LEVELS[url]) return setQuality(url, { pin: true });
    const saved = state.settings?.look;
    if (saved && QUALITY_LEVELS[saved]) return setQuality(saved, { pin: true });
    return setQuality(defaultQuality(), { pin: false });
  }

  const watchdog = {
    times: [],
    last: 0,
    slow: 0,
    hold: 0,
    drops: [],
    reset() {
      this.times.length = 0;
      this.slow = 0;
      this.hold = 2000; // ignore the first 2 s after a change (shader compiles)
      this.last = 0;
    },
    sample(now) {
      const dt = this.last ? now - this.last : 0;
      this.last = now;
      if (!dt || dt > 500) return; // first frame, or the tab was hidden
      if (this.hold > 0) {
        this.hold -= dt;
        return;
      }
      this.times.push(dt);
      if (this.times.length > WINDOW) this.times.shift();
      if (this.times.length < 15) return;
      const sorted = [...this.times].sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      this.slow = median > SLOW_FRAME_MS ? this.slow + dt : 0;
      if (this.slow >= SLOW_SECONDS * 1000 && !pinned) {
        const i = QUALITY_ORDER.indexOf(quality);
        if (i >= 0 && i < QUALITY_ORDER.indexOf('low')) {
          const to = QUALITY_ORDER[i + 1];
          this.drops.push({ from: quality, to, median: +median.toFixed(1), time: +(now / 1000).toFixed(1) });
          console.info(`[look] median frame ${median.toFixed(1)} ms for ${SLOW_SECONDS} s: quality ${quality} -> ${to}`);
          setQuality(to, { pin: false });
        } else this.slow = 0;
      }
    },
  };

  // ---------------------------------------------------------------- per frame
  // The screens around the camera subject: the current room, or two rooms during a slide.
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

  function render() {
    const t0 = performance.now();
    renderer.info.reset();
    if (!lookName) applyLook('day');
    const settingsLook = state.settings?.look;
    if (settingsLook && settingsLook !== quality && QUALITY_LEVELS[settingsLook]) setQuality(settingsLook, { pin: true });
    const Q = QUALITY_LEVELS[quality];

    const pr = Math.min(window.devicePixelRatio || 1, 2);
    if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
    renderer.getDrawingBufferSize(_size);
    const w = Math.max(1, _size.x);
    const h = Math.max(1, _size.y);

    camera.updateMatrixWorld();
    const hero = bound.hero;
    rig.place(hero ? { x: hero.x, z: hero.z } : subject, subject);
    const rect = roomRect();
    rig.cullLamps(rect);
    mirror.update({ enabled: (L.reflect ?? 0) > 0 && Q.reflect, strength: L.reflect ?? 0, rect, floorY: GROUND_Y, width: w, height: h });
    setWaterTime(state.time);

    // depth of field: the hero's feet (view depth) plus the camera preset's offset
    const dof = dofForCamera(bound.cameraPresetName(), bound.cameraPreset());
    _hero.set(hero ? hero.x : subject.x, GROUND_Y, hero ? hero.z : subject.z).applyMatrix4(camera.matrixWorldInverse);
    const focusDistance = -_hero.z + (dof.focusOffset ?? 0);
    const exp = exposure();

    if (Q.post) {
      pipeline.setSize(w, h);
      renderer.toneMapping = THREE.NoToneMapping;
      pipeline.render({ look: L, quality: Q, dof, focusDistance, exposure: exp });
    } else {
      renderer.setRenderTarget(null);
      renderer.toneMapping = Q.flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = Q.flat ? 1 : exp;
      renderer.render(scene, camera);
    }
    lastFrame = { dof, focusDistance, exposure: exp, path: Q.post ? 'post' : Q.flat ? 'flat' : 'direct', ms: performance.now() - t0 };
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
    bind(opts) {
      Object.assign(bound, opts);
    },
    render,
    sampleFrame: (now) => watchdog.sample(now),
    setQuality: (level) => setQuality(level, { pin: true }),
    quality: () => quality,
    setMirrorRect(rect) {
      mirror.override = rect ? { ...rect } : null;
    },
    makeLampLight: (overrides) => makeLampLightFrom(L.lights?.lamp ?? LOOK_CRYPT.lights.lamp, overrides),
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
        lamps: rig.lamps.filter((l) => l.layers.isEnabled(0)).length,
        passes: Q.post ? pipeline.stats.passes : 1,
        drops: [...watchdog.drops],
        materials: materialValues(),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
  };
}

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
import { applyMaterialLook, setFlatMaterials, setWaterTime, materialValues, setSeams } from '../materials.js';
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

const _size = new THREE.Vector2();
const _hero = new THREE.Vector3();

// The low path (no post stack) draws the dungeons' per-channel shoulder (look.tone.mapping
// 'shoulder', bible section 5) through three's custom tone mapping, with the bible's knee and ceiling.
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
  vec3 x = color * toneMappingExposure, k = vec3( 0.45 ), C = vec3( 0.87 );
  return mix( x, C - ( C - k ) * exp( - ( x - k ) / ( C - k ) ), step( k, x ) );
}`
);

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

    const pr = Math.min(window.devicePixelRatio || 1, 2);
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
    const dof = dofForCamera(bound.cameraPresetName(), bound.cameraPreset());
    _hero.set(hero ? hero.x : subject.x, GROUND_Y, hero ? hero.z : subject.z).applyMatrix4(camera.matrixWorldInverse);
    const focusDistance = -_hero.z + (dof.focusOffset ?? 0);
    const exp = exposure() * display.brightness;

    if (Q.post) {
      pipeline.setSize(w, h);
      renderer.toneMapping = THREE.NoToneMapping;
      pipeline.render({ look: L, quality: Q, dof, focusDistance, exposure: exp, saturation: display.saturation });
    } else {
      renderer.setRenderTarget(null);
      renderer.toneMapping = Q.flat ? THREE.NoToneMapping : L.tone?.mapping === 'shoulder' ? THREE.CustomToneMapping : THREE.ACESFilmicToneMapping;
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
    // hero, cameraPreset(), cameraPresetName(); optional roomRect() -> { x0, x1, z0, z1 } (world
    // x / z of the room or rooms the camera shows: polished floor and lamp culling)
    bind(opts) {
      Object.assign(bound, opts);
    },
    render,
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

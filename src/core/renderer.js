// WebGL renderer, the one scene, the camera object, and the look that draws them.
//
// Lighting is data: LIGHTING maps a preset name to a whole look (art bible sections 4 to 6):
// background, hemisphere fill, key light and shadow box, reflection environment, the values of every
// material kind, water, AO, bloom, glare, exposure, grade and the polished-floor reflection. Areas
// and screens pick a preset by name (`lighting: 'crypt'`). New looks are added from content files:
//
//   registerLighting('cave', { extends: 'crypt', lights: { hemi: { intensity: 0.8 } }, tone: { exposure: 1.3 } });
//   registerLighting('dusk', { background, sky, ground, hemi, sunColor, sun });   // prototype keys still work
//
// The presets, quality levels and post stack live in src/core/look/ (see docs/ARCHITECTURE.md, "Look").
import * as THREE from 'three';
import { createLook } from './look/index.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // the post stack tone-maps; the low quality path sets ACES
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r186 PCF: 5 Vogel taps over shadow.radius texels (soft PCF)

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4ec);

// Framing (fov, distance, pitch) is owned by core/camera.js.
export const camera = new THREE.PerspectiveCamera(44, 1, 0.5, 400);

export const look = createLook({ renderer, scene, camera });

// The rig's lights (kept as exports for code written against the prototype).
export const hemi = look.hemi;
export const sun = look.sun;

export const LIGHTING = look.LIGHTING;

export function registerLighting(name, preset) {
  return look.registerLighting(name, preset);
}

export function applyLighting(name = 'day') {
  look.applyLighting(name);
}

export const lightingName = () => look.lightingName();

// camera.js reports the camera subject here every frame. The shadow box follows the hero in the
// overworld (bound by main.js) and this subject (the room centre) in dungeons.
export function followSun(target) {
  look.followSun(target);
}

// A wall lamp with the active look's lamp values: a group of point lights (the pool on the wall and
// a wide fill) to place at the fixture with +z into the room. Lamps never cast shadows.
export const makeLampLight = (overrides) => look.makeLampLight(overrides);

export function mountRenderer(container) {
  container.appendChild(renderer.domElement);
}

export function renderScene() {
  look.render();
}

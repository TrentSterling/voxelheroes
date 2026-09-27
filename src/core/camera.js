// Camera framing and the screen-to-screen slide.
//
// The camera never rotates: it always faces north (-z) and looks down at a
// fixed pitch. How far it sits and how wide it sees comes from a named preset
// in CAMERA_PRESETS. Areas pick a preset (`camera: 'dungeon'`); screens with no
// preset use the player's choice in state.settings.camera. With zoom 1 the
// distance is fitted so one whole 16 x 11 screen fills the view.
//
// Preset fields:
//   pitch     degrees down from the horizon
//   fov       vertical field of view in degrees
//   padX      extra tiles kept visible left and right of the screen
//   padZ      extra depth (world units) kept visible top and bottom
//   zoom      multiplier on the fitted distance (<1 = closer, crops the screen)
//   distance  optional fixed distance that replaces the fit
import * as THREE from 'three';
import { camera, renderer, followSun } from './renderer.js';
import { SCREEN_W, SCREEN_H, DEG } from './constants.js';

// Type A is the prototype's framing and stays the default. B, C and D follow
// the research notes (higher, most overhead, closer) and are starting values
// for M5 to tune. 'dungeon' is the fixed dungeon camera, identical to A for now.
export const CAMERA_PRESETS = {
  A: { label: 'Type A', pitch: 60, fov: 30, padX: 0.3, padZ: 1.1, zoom: 1 },
  B: { label: 'Type B', pitch: 66, fov: 30, padX: 0.3, padZ: 1.1, zoom: 1 },
  C: { label: 'Type C', pitch: 78, fov: 30, padX: 0.3, padZ: 1.1, zoom: 1 },
  D: { label: 'Type D', pitch: 60, fov: 30, padX: 0.3, padZ: 1.1, zoom: 0.8 },
  dungeon: { label: 'Dungeon', pitch: 60, fov: 30, padX: 0.3, padZ: 1.1, zoom: 1 },
};

export const DEFAULT_PRESET = 'A';

export function registerCameraPreset(name, preset) {
  CAMERA_PRESETS[name] = { ...CAMERA_PRESETS[DEFAULT_PRESET], ...preset };
}

// The point the camera looks at: the centre of the current screen, or a point
// in between two screens while sliding.
export const camTarget = new THREE.Vector3();

let presetName = DEFAULT_PRESET;
let dist = 24;

export const cameraPreset = () => presetName;
export const cameraDistance = () => dist;

export function setCameraPreset(name = DEFAULT_PRESET) {
  if (!CAMERA_PRESETS[name]) throw new Error(`Unknown camera preset "${name}"`);
  if (name === presetName) return;
  presetName = name;
  fitCamera();
}

// Resize the canvas and fit the preset to the window's aspect ratio.
export function fitCamera() {
  const p = CAMERA_PRESETS[presetName];
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = p.fov;
  const pitch = p.pitch * DEG;
  const vf = (camera.fov * DEG) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const dW = (SCREEN_W / 2 + p.padX) / Math.tan(hf);
  const dH = ((SCREEN_H / 2) * Math.sin(pitch) + p.padZ) / Math.tan(vf);
  dist = p.distance ?? Math.max(dW, dH) * (p.zoom ?? 1);
  camera.updateProjectionMatrix();
}

export function placeCamera() {
  const pitch = CAMERA_PRESETS[presetName].pitch * DEG;
  camera.position.set(camTarget.x, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(pitch) * dist);
  camera.lookAt(camTarget);
  followSun(camTarget);
}

export function snapCamera(target) {
  camTarget.copy(target);
  tween = null;
}

// ---------------------------------------------------------------- slide
// A tween moves camTarget from where it is to `to` over `dur` seconds.
// stepCameraTween(dt) advances it and returns the linear progress 0..1 so the
// caller can move other things (the hero) in step with the camera.
export const easeInOutQuad = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

let tween = null;

export function startCameraTween(to, dur, ease = easeInOutQuad) {
  tween = { from: camTarget.clone(), to: to.clone(), t: 0, dur, ease };
}

export function stepCameraTween(dt) {
  if (!tween) return 1;
  tween.t += dt;
  const k = Math.min(1, tween.t / tween.dur);
  camTarget.lerpVectors(tween.from, tween.to, tween.ease(k));
  if (k >= 1) tween = null;
  return k;
}

export const cameraTweening = () => tween !== null;

export function initCamera() {
  window.addEventListener('resize', fitCamera);
  fitCamera();
}

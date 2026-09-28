// Camera rig and the screen-to-screen slide (art bible section 3).
//
// The camera never rotates: it always faces north (-z) and looks down at a
// fixed pitch. A preset gives the camera's pose relative to a subject point on
// the ground:
//   pitch   degrees down from the horizon
//   fov     vertical field of view in degrees
//   height  camera height above the ground, in tiles
//   lead    the look-at point sits this many tiles north of the subject
//   fixed   aim at the centre of the screen or room instead of the hero
//   follow  the subject is the hero, unclamped (gameplay spec 4.2, follow mode)
//
// The camera stands `height` tiles above the ground's top (GROUND_Y) and aims
// at a point on it. In the overworld the follow presets (A, D) keep the hero
// centred wherever he stands: the neighbouring screens are drawn, and the far
// band (world/tiles/farband.js) reaches 12 tiles past an area's east, west and
// south edges, so no void shows. The other presets (B, C) clamp the subject so
// the frame stays inside the current screen where the frame is small enough:
// the ground at the bottom edge never shows the screen to the south, and the
// frame's sides at the hero's row never show the screens east or west. The
// north is never clamped: the low presets always see far past the screen, as
// in the reference. Areas can fix a preset (`camera: 'dungeon'`); other
// screens use the player's choice in state.settings.camera.
import * as THREE from 'three';
import { camera, renderer, followSun } from './renderer.js';
import { DEG, GROUND_Y } from './constants.js';

// A, B and dungeon are measured on the reference shots; C and D are guesses
// until clean captures exist (art bible section 14). The dungeon camera is the
// bible's standard room camera (section 3, DGN_STD: fitted on the floor grid
// of the temple rooms, rms 0.33 px), aimed at the room's centre: for a 16 x 12
// room the north wall's base sits at y 157 of 720, the black south wall starts
// at y 615, and a floor tile at the centre is 73.6 px wide.
export const CAMERA_PRESETS = {
  A: { label: 'Type A', pitch: 21, fov: 44, height: 4.56, lead: 2.9, follow: true },
  B: { label: 'Type B', pitch: 43.3, fov: 43.6, height: 11.2, lead: 0 },
  C: { label: 'Type C', pitch: 60, fov: 40, height: 16, lead: 0 },
  D: { label: 'Type D', pitch: 18, fov: 44, height: 3.4, lead: 2.2, follow: true },
  dungeon: { label: 'Dungeon', pitch: 43.055, fov: 37.38, height: 9.865, lead: -0.09, fixed: true },
};

export const DEFAULT_PRESET = 'A';
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 400;

export function registerCameraPreset(name, preset) {
  CAMERA_PRESETS[name] = { ...CAMERA_PRESETS[DEFAULT_PRESET], ...preset };
}

// The subject point on the ground (y = 0) the camera is placed from: the
// clamped hero, the room centre, or a point in between while sliding.
export const camTarget = new THREE.Vector3();

let presetName = DEFAULT_PRESET;

export const cameraPreset = () => presetName;
export const currentCameraPreset = () => CAMERA_PRESETS[presetName];

export function setCameraPreset(name = DEFAULT_PRESET) {
  if (!CAMERA_PRESETS[name]) throw new Error(`Unknown camera preset "${name}"`);
  if (name === presetName) return;
  presetName = name;
  fitCamera();
}

// Resize the canvas and apply the preset's lens.
export function fitCamera() {
  const p = CAMERA_PRESETS[presetName];
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = p.fov;
  camera.near = CAMERA_NEAR;
  camera.far = CAMERA_FAR;
  camera.updateProjectionMatrix();
}

// Pose the camera for preset p around a subject point (art bible's placeRig):
// height and aim are measured from the ground's top (GROUND_Y), where the
// hero's feet and the dungeon floor are.
export function poseCamera(cam, p, subject) {
  const pitch = p.pitch * DEG;
  const lookZ = subject.z - (p.lead ?? 0);
  cam.position.set(subject.x, GROUND_Y + p.height, lookZ + p.height / Math.tan(pitch));
  cam.lookAt(subject.x, GROUND_Y, lookZ);
}

// How much ground the preset shows around its subject, for the current aspect:
// south  tiles from the subject to the ground at the frame's bottom edge
// halfW  half the frame's width at the subject's row
export function cameraFootprint(p = CAMERA_PRESETS[presetName], aspect = camera.aspect) {
  const pitch = p.pitch * DEG;
  const tv = Math.tan((p.fov * DEG) / 2);
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const back = p.height / Math.tan(pitch) - (p.lead ?? 0); // camera z minus subject z
  // Bottom-edge ray: forward (0, -sin, -cos) minus tv * up (0, cos, -sin).
  const t = p.height / (sin + tv * cos);
  const south = back + t * (-cos + tv * sin);
  // View depth of the subject point: (subject - camera) . forward.
  const depth = p.height * sin + back * cos;
  return { south, halfW: depth * tv * aspect };
}

// The subject for a hero standing at pos inside rect {x0, z0, x1, z1}.
export function subjectFor(pos, rect, p = CAMERA_PRESETS[presetName]) {
  if (p.follow && !p.fixed) return new THREE.Vector3(pos.x, 0, pos.z);
  const cx = (rect.x0 + rect.x1) / 2;
  const cz = (rect.z0 + rect.z1) / 2;
  if (p.fixed) return new THREE.Vector3(cx, 0, cz);
  const { south, halfW } = cameraFootprint(p);
  const x = rect.x1 - rect.x0 >= 2 * halfW ? THREE.MathUtils.clamp(pos.x, rect.x0 + halfW, rect.x1 - halfW) : cx;
  const zMax = rect.z1 - south;
  const z = zMax >= rect.z0 ? THREE.MathUtils.clamp(pos.z, rect.z0, zMax) : zMax;
  return new THREE.Vector3(x, 0, z);
}

// Follow the hero within the current screen (skipped while a slide runs).
export function followSubject(pos, rect) {
  if (tween) return;
  camTarget.copy(subjectFor(pos, rect));
}

export function placeCamera() {
  poseCamera(camera, CAMERA_PRESETS[presetName], camTarget);
  camera.userData.subject = camTarget;
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

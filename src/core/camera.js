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
//
// In the overworld the subject is the hero, clamped so the frame stays inside
// the current screen where the frame is small enough: the ground at the
// bottom edge never shows the screen to the south, and the frame's sides at
// the hero's row never show the screens east or west, except for the few
// tenths of a tile it takes to keep all of the hero in frame when he stands
// at an east or west edge. The north is never clamped: the low presets
// always see far past the screen, as in the reference. Fixed presets aim at
// the middle of the screen or room (for a room, the floor centre) and move
// only as far as it takes to keep the hero's feet in frame; where the frame
// is less than half as wide as the room (a phone held upright) they follow
// the hero across instead, still inside the room. Nothing past a room's walls
// is drawn, so in a room (a rect with area.rooms) the bottom edge may show
// past its south wall: a room shorter than the frame stays centred too.
// Areas can fix a preset (`camera: 'dungeon'`); other screens use the
// player's choice in state.settings.camera. A slide between screens with
// different presets blends the lens as it moves.
import * as THREE from 'three';
import { camera, renderer, followSun } from './renderer.js';
import { DEG } from './constants.js';

// A, B and dungeon are measured on the reference shots; C and D are guesses
// until clean captures exist (art bible section 14).
export const CAMERA_PRESETS = {
  A: { label: 'Type A', pitch: 21, fov: 44, height: 4.56, lead: 2.9 },
  B: { label: 'Type B', pitch: 43.3, fov: 43.6, height: 11.2, lead: 0 },
  C: { label: 'Type C', pitch: 60, fov: 40, height: 16, lead: 0 },
  D: { label: 'Type D', pitch: 18, fov: 44, height: 3.4, lead: 2.2 },
  dungeon: { label: 'Dungeon', pitch: 41.5, fov: 28, height: 12.7, lead: 0, fixed: true },
};

export const DEFAULT_PRESET = 'A';
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 400;

// The hero's centre stays at least this far (tiles) inside the frame's sides
// and bottom when the camera has to move off its preferred subject.
export const FRAME_MARGIN = 0.5;
// The widest part of the hero, for keeping all of him in frame: his head and
// hat reach about 0.6 tiles either side of his centre, HERO_HEAD tiles up;
// HERO_HALF adds a little room.
export const HERO_HEAD = 1;
export const HERO_HALF = 0.8;

export function registerCameraPreset(name, preset) {
  CAMERA_PRESETS[name] = { ...CAMERA_PRESETS[DEFAULT_PRESET], ...preset };
}

// The subject point on the ground (y = 0) the camera is placed from: the
// clamped hero, the room centre, or a point in between while sliding.
export const camTarget = new THREE.Vector3();

let presetName = DEFAULT_PRESET;

export const cameraPreset = () => presetName;
export const currentCameraPreset = () => CAMERA_PRESETS[presetName];

const LENS = ['pitch', 'fov', 'height', 'lead'];

// The lens the camera uses this frame: the preset, or a blend while a slide
// moves between screens with different presets.
function currentLens() {
  const p = CAMERA_PRESETS[presetName];
  if (!tween?.lensFrom) return p;
  const k = tween.ease(Math.min(1, tween.t / tween.dur));
  const lens = { ...p };
  for (const f of LENS) lens[f] = THREE.MathUtils.lerp(tween.lensFrom[f] ?? 0, p[f] ?? 0, k);
  return lens;
}

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

// Pose the camera for preset p around a subject point (art bible's placeRig).
export function poseCamera(cam, p, subject) {
  const pitch = p.pitch * DEG;
  const lookZ = subject.z - (p.lead ?? 0);
  cam.position.set(subject.x, p.height, lookZ + p.height / Math.tan(pitch));
  cam.lookAt(subject.x, 0, lookZ);
}

// Half the frame's width, in tiles, on the row dz tiles south of the subject
// (negative: north of it), at height y above the ground. Rows nearer the
// camera are narrower, and so is the frame higher up.
export function halfWidthAt(p = CAMERA_PRESETS[presetName], dz = 0, aspect = camera.aspect, y = 0) {
  const pitch = p.pitch * DEG;
  const back = p.height / Math.tan(pitch) - (p.lead ?? 0); // camera z minus subject z
  // View depth of the point: (point - camera) . forward (0, -sin, -cos).
  const depth = (p.height - y) * Math.sin(pitch) + (back - dz) * Math.cos(pitch);
  return depth * Math.tan((p.fov * DEG) / 2) * aspect;
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
  return { south, halfW: halfWidthAt(p, 0, aspect) };
}

// The subject for a hero standing at pos inside rect {x0, z0, x1, z1} (a
// screen object will do).
//   depth   follow presets track the hero's row; fixed presets aim at the
//           middle. Either way the ground at the frame's bottom edge stays
//           inside the rect (except a fixed preset in a room: nothing is
//           drawn past its walls), and the hero stays above that edge.
//   across  measured on the hero's row (rows nearer the camera are
//           narrower). Where the frame is wider than the rect there, it is
//           centred. Otherwise follow presets track the hero with the
//           frame's sides kept inside the rect, except that all of the
//           hero stays in frame (HERO_HALF at HERO_HEAD), which wins. Fixed
//           presets hold the middle and move only to keep the hero's feet
//           FRAME_MARGIN inside the frame, never past the rect's sides;
//           where the frame is less than half as wide as the rect (at the
//           subject's row, so this does not flip as the hero walks) they
//           track the hero like the others.
export function subjectFor(pos, rect, p = CAMERA_PRESETS[presetName], aspect = camera.aspect) {
  const { clamp } = THREE.MathUtils;
  const w = rect.x1 - rect.x0;
  const cx = (rect.x0 + rect.x1) / 2;
  const cz = (rect.z0 + rect.z1) / 2;
  const { south } = cameraFootprint(p, aspect);
  const zMax = rect.z1 - south; // any further south and the frame shows the screen below
  let z;
  if (p.fixed) {
    z = Math.max(cz, pos.z - south + FRAME_MARGIN);
    if (!rect.area?.rooms) z = Math.min(z, zMax);
  } else z = zMax >= rect.z0 ? clamp(pos.z, rect.z0, zMax) : zMax;
  const dz = pos.z - z; // the hero's row, from the subject
  const hw = halfWidthAt(p, dz, aspect); // the frame's half-width on the hero's row
  let x;
  if (p.fixed && 4 * halfWidthAt(p, 0, aspect) >= w) {
    x = w <= 2 * hw ? cx : clamp(clamp(cx, pos.x - hw + FRAME_MARGIN, pos.x + hw - FRAME_MARGIN), rect.x0 + hw, rect.x1 - hw);
  } else {
    x = w <= 2 * hw ? cx : clamp(pos.x, rect.x0 + hw, rect.x1 - hw);
    const reach = halfWidthAt(p, dz, aspect, HERO_HEAD) - HERO_HALF; // hero centre to camera, at most
    if (reach > 0) x = clamp(x, pos.x - reach, pos.x + reach);
  }
  return new THREE.Vector3(x, 0, z);
}

// Follow the hero within the current screen (skipped while a slide runs).
export function followSubject(pos, rect) {
  if (tween) return;
  camTarget.copy(subjectFor(pos, rect));
}

export function placeCamera() {
  const lens = currentLens();
  if (camera.fov !== lens.fov) {
    camera.fov = lens.fov;
    camera.updateProjectionMatrix();
  }
  poseCamera(camera, lens, camTarget);
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
// caller can move other things (the hero) in step with the camera. Given a
// preset, the tween also switches to it, blending the lens on the way.
//
// Given an anchor { from, to } (points the caller moves something along,
// linearly with that progress: the hero walking into the next screen), it is
// the anchor's offset from the subject that eases instead of the subject
// itself. The anchor's place in the frame then moves steadily from where it
// was to where it ends, so a hero who starts and ends in frame stays in
// frame, however far the camera goes; the camera starts at the hero's pace.
export const easeInOutQuad = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

let tween = null;

export function startCameraTween(to, dur, ease = easeInOutQuad, preset = null, anchor = null) {
  let lensFrom = null;
  if (preset && preset !== presetName) {
    if (!CAMERA_PRESETS[preset]) throw new Error(`Unknown camera preset "${preset}"`);
    lensFrom = { ...currentLens() };
    presetName = preset;
  }
  const a = anchor && { x0: anchor.from.x, z0: anchor.from.z, x1: anchor.to.x, z1: anchor.to.z };
  tween = { from: camTarget.clone(), to: to.clone(), t: 0, dur, ease, lensFrom, anchor: a };
}

export function stepCameraTween(dt) {
  if (!tween) return 1;
  tween.t += dt;
  // (with a hair of slack, so 30 ticks of 1/60 s make exactly 0.5 s)
  const k = tween.t >= tween.dur - 1e-6 ? 1 : tween.t / tween.dur;
  const e = tween.ease(k);
  const { from, to, anchor: a } = tween;
  if (a) {
    // anchor now, minus its offset from the subject eased from start to end
    const x = a.x0 + (a.x1 - a.x0) * k - THREE.MathUtils.lerp(a.x0 - from.x, a.x1 - to.x, e);
    const z = a.z0 + (a.z1 - a.z0) * k - THREE.MathUtils.lerp(a.z0 - from.z, a.z1 - to.z, e);
    camTarget.set(x, 0, z);
  } else camTarget.lerpVectors(from, to, e);
  if (k >= 1) tween = null;
  return k;
}

export const cameraTweening = () => tween !== null;

export function initCamera() {
  window.addEventListener('resize', fitCamera);
  fitCamera();
}

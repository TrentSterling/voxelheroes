// Camera rig and the screen-to-screen slide (art bible section 3).
//
// The camera never rotates: it always faces north (-z) and looks down at a
// fixed pitch. A preset gives the camera's pose relative to a subject point on
// the ground:
//   pitch       degrees down from the horizon
//   fov         vertical field of view in degrees
//   height      camera height above the ground, in tiles
//   lead        the look-at point sits this many tiles north of the subject
//   fixed       aim at the centre of the screen or room instead of the hero
//   follow      the hero is the subject every tick, clamped to the area (or,
//               in a room, to the room's rows; see CAMERA_PRESETS below)
//   fitWidth    scale height with the room's width: height * (room width /
//               fitWidth), at least minHeight (no built-in preset uses it
//               since the art bible measured the interior rig)
//   label       name for menus
//   selectable  offered to the player as a camera choice (A-D, true); the
//               dungeon and interior presets and every preset an area or a
//               boss room registers for itself leave it false
//
// With a hold preset (B, C) the subject is the hero, clamped so the frame
// stays inside the current screen where the frame is small enough (a follow
// preset, A or D, uses the same clamp with the whole area as its rect): the ground at the
// bottom edge never shows the screen to the south, and the frame's sides at
// the hero's row never show the screens east or west, except for the few
// tenths of a tile it takes to keep all of the hero in frame when he stands
// at an east or west edge. The north is never clamped: the low presets
// always see far past the screen, as in the reference. At a south edge the
// hero leaves the screen as soon as all of him would no longer fit above the
// frame's bottom edge (southReach; transitions.js), so he is never cut off
// there either. Fixed presets aim at the middle of the screen or room (for a
// room, the floor centre) and move only as far as it takes to keep all of
// the hero in frame (a side doorway, a bottom corner); where the frame is
// less than half as wide as the room (a phone held upright) they follow the
// hero across instead, still inside the room. Nothing past a room's walls is
// drawn, so in a room (a rect with area.rooms) the bottom edge may show past
// its south wall: a room shorter than the frame stays centred too.
// Areas can fix a preset (`camera: 'dungeon'`); other screens use the
// player's choice in state.settings.camera. A slide between screens with
// different presets (or rooms of different widths) blends the lens as it moves.
//
// "All of the hero" is his outline (HERO_OUTLINE): how far he reaches from
// his centre at each height, whichever way he faces, the sword left out.
import * as THREE from 'three';
import { camera, renderer, followSun } from './renderer.js';
import { DEG, GROUND_Y } from './constants.js';
import { TUNING } from './tuning.js';

// The poses are the art bible's (section 3, v1.8; appendix A). A, B, the
// three dungeon rigs and the interior are measured on reference shots; C and
// D are guesses until clean captures exist (art bible section 14). How each
// one moves is the gameplay spec's (4.2; TUNING.camera.follow):
//   follow  A, D: the hero is the subject every tick, clamped only to the
//           area (not the screen); screens change without a slide
//           (transitions.js followChange). In a room (the large-room and
//           interior rigs) it is clamped to the room by frame rows instead
//           (art bible section 9, roomSubjectZ).
//   hold    B, C: the subject is clamped to the current screen, and crossing
//           an edge slides (48 ticks). A screen with scroll: 'flip' holds in
//           every preset.
//   fixed   the standard dungeon room: aimed at the room centre (0.09 tile
//           south of it, lead -0.09); rooms slide.
export const CAMERA_PRESETS = {
  A: { label: 'Type A', selectable: true, pitch: 21, fov: 44, height: 4.56, lead: 2.9, follow: true },
  B: { label: 'Type B', selectable: true, pitch: 43.3, fov: 43.6, height: 11.2, lead: 0 },
  C: { label: 'Type C', selectable: true, pitch: 60, fov: 40, height: 16, lead: 0 },
  D: { label: 'Type D', selectable: true, pitch: 18, fov: 44, height: 3.4, lead: 2.2, follow: true },
  dungeon: { label: 'Dungeon', selectable: false, pitch: 43.055, fov: 37.38, height: 9.865, lead: -0.09, fixed: true },
  'dungeon-big': { label: 'Large room', selectable: false, pitch: 52.978, fov: 37.07, height: 15.103, lead: 0, follow: true },
  interior: { label: 'Interior', selectable: false, pitch: 50.278, fov: 38.54, height: 11.986, lead: 0, follow: true },
};

export const DEFAULT_PRESET = 'A';
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 400;

// The hero's outline, for keeping all of him in frame: [reach, bottom, top]
// slabs. Between heights bottom and top (tiles above the ground) no part of
// him, the sword aside, lies further than reach tiles from his centre,
// whichever way he faces or steps. Measured on the M1 hero (1/14 voxels, the
// shield out to 0.65 tile) and on the art bible's 16-voxel character box
// (feat/look-kits: its shield corner 0.57 tile out, 0.21 up while he sways);
// both fit. A hero of other proportions (the editor) sets its own with
// setHeroOutline; the camera play-test checks the real model against it.
export const HERO_OUTLINE = [
  [0.4, 0.1, 0.2], // feet and legs mid-stride
  [0.6, 0.2, 0.26], // a shield worn low
  [0.67, 0.26, 0.94], // body, arms and shield
  [0.5, 0.94, 1.14], // head and ears; hands raised
  [0.42, 1.14, 1.4], // cap
];

let heroOutline = HERO_OUTLINE;
export const currentHeroOutline = () => heroOutline;

export function setHeroOutline(slabs = HERO_OUTLINE) {
  const ok = Array.isArray(slabs) && slabs.length > 0 && slabs.every((s) => Array.isArray(s) && s.length === 3 && s.every(Number.isFinite) && s[0] >= 0 && s[1] <= s[2]);
  if (!ok) throw new Error('setHeroOutline takes [[reach, bottom, top], ...] in tiles, bottom <= top');
  heroOutline = slabs;
}

// Add or replace a preset. pitch, fov and height are required; the rest
// default to a camera that follows the hero with no lead. A new preset is not
// a player choice unless it says `selectable: true`; replacing one keeps its
// label and selectable flag unless the new definition sets them.
export function registerCameraPreset(name, preset) {
  for (const k of ['pitch', 'fov', 'height'])
    if (!Number.isFinite(preset?.[k])) throw new Error(`Camera preset "${name}" needs a number for ${k}`);
  const old = CAMERA_PRESETS[name];
  CAMERA_PRESETS[name] = { label: old?.label ?? name, selectable: old?.selectable ?? false, lead: 0, fixed: false, ...preset };
}

// The presets an options menu offers (A-D unless more are registered as selectable).
export const playerCameraPresets = () => Object.keys(CAMERA_PRESETS).filter((n) => CAMERA_PRESETS[n].selectable);

// A preset fitted to a room or screen rect: presets with fitWidth scale their
// height with its width. Others come back as they are.
export function lensFor(p, rect) {
  if (!p?.fitWidth || !rect) return p;
  const height = Math.max(p.minHeight ?? 0, (p.height * (rect.x1 - rect.x0)) / p.fitWidth);
  return height === p.height ? p : { ...p, height };
}

// The subject point on the ground (y = 0) the camera is placed from: the
// clamped hero, the room centre, or a point in between while sliding.
export const camTarget = new THREE.Vector3();

let presetName = DEFAULT_PRESET;
let lensRect = null; // the screen or room the lens is fitted to

export const cameraPreset = () => presetName;

const LENS = ['pitch', 'fov', 'height', 'lead'];

// The lens the camera uses this frame: the preset fitted to the current
// screen, or a blend while a slide moves between screens with different
// presets or widths.
function currentLens() {
  const p = lensFor(CAMERA_PRESETS[presetName], lensRect);
  if (!tween?.lensFrom) return p;
  const k = tween.ease(Math.min(1, tween.t / tween.dur));
  const lens = { ...p };
  for (const f of LENS) lens[f] = THREE.MathUtils.lerp(tween.lensFrom[f] ?? 0, p[f] ?? 0, k);
  return lens;
}

// The preset in use (fitted to the current room), for code that reads the lens.
export const currentCameraPreset = () => viewLens ?? currentLens();

// Switch preset; rect (a screen) fits presets that scale with room width.
export function setCameraPreset(name = DEFAULT_PRESET, rect = null) {
  if (!CAMERA_PRESETS[name]) throw new Error(`Unknown camera preset "${name}"`);
  if (rect) lensRect = rect;
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
// Height and aim are measured from the ground's top (GROUND_Y), where the
// hero's feet and the dungeon floor are, so every "above the ground" below
// is above GROUND_Y.
export function poseCamera(cam, p, subject) {
  const pitch = p.pitch * DEG;
  const lookZ = subject.z - (p.lead ?? 0);
  cam.position.set(subject.x, GROUND_Y + p.height, lookZ + p.height / Math.tan(pitch));
  cam.lookAt(subject.x, GROUND_Y, lookZ);
}

// The subject z at which a point y above the ground at row z shows on frame
// row `row` (0 top, 1 bottom). Moving the subject south raises the point in
// the frame, so a point kept at or above a row gives a least subject z.
export function subjectZForRow(p, row, y, z) {
  const pitch = p.pitch * DEG;
  const a = Math.atan((1 - 2 * row) * Math.tan((p.fov * DEG) / 2)); // above the view axis
  const horiz = (p.height - y) / Math.tan(pitch - a); // camera to the point, along the ground
  return z + horiz + (p.lead ?? 0) - p.height / Math.tan(pitch);
}

// A follow rig in a room (large rooms, boss arenas, interiors; art bible
// section 9): the hero, clamped so the north wall's top edge stays at or
// above frame row north / row, the black south wall's top at or below row
// south / row, and the ends of the frame's bottom row on the floor between
// the side walls. A room smaller than the view one way keeps it centred
// that way. Keeping all of the hero in frame wins over all of these.
function roomSubject(pos, rect, p, aspect) {
  const { clamp } = THREE.MathUtils;
  const { north, south, row, wall, inset } = TUNING.camera.roomClamp;
  const zMin = subjectZForRow(p, north / row, wall, rect.z0 + 1);
  const zMax = subjectZForRow(p, south / row, wall, rect.z1 - 1);
  const { south: bottom } = cameraFootprint(p, aspect);
  let z = zMin <= zMax ? clamp(pos.z, zMin, zMax) : (zMin + zMax) / 2;
  z = Math.max(z, pos.z + southReach(p) - bottom); // all of the hero above the bottom edge wins
  const hw = halfWidthAt(p, bottom, aspect); // the bottom row
  const lo = rect.x0 + inset + hw;
  const hi = rect.x1 - inset - hw;
  let x = lo <= hi ? clamp(pos.x, lo, hi) : (rect.x0 + rect.x1) / 2;
  // ... and so does all of him inside the frame's sides (a narrow frame: a phone held upright)
  const reach = sideReach(p, pos.z - z, aspect);
  x = reach > 0 ? clamp(x, pos.x - reach, pos.x + reach) : pos.x;
  return new THREE.Vector3(x, 0, z);
}

// Whether preset p follows the hero on this screen (A, D, and the room
// follow rigs) or holds (B, C, the standard room, and any flip screen).
export const followsHero = (p, screen) => !!p?.follow && !p.fixed && screen?.def?.scroll !== 'flip';

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

// How far north of the ground at the frame's bottom edge the hero's centre
// must stay for all of him to be in frame. The bottom edge is a plane
// through the camera that holds the x axis, so a point h tiles up is in
// frame out to h * cot(pitch + fov / 2) tiles past that ground line.
export function southReach(p = CAMERA_PRESETS[presetName], outline = heroOutline) {
  const slope = 1 / Math.tan((p.pitch + p.fov / 2) * DEG);
  let reach = 0;
  for (const [r, bottom] of outline) reach = Math.max(reach, r - bottom * slope);
  return reach;
}

// How far east or west of the hero the subject may sit, with the hero on the
// row dz tiles south of it, before part of him leaves the frame's side. A
// part r tiles out to the side and toward the camera lies on a nearer,
// narrower row: at worst it needs r * sqrt(1 + k^2), k = tan(fov / 2) *
// aspect * cos(pitch). Negative when the frame cannot hold him at all.
export function sideReach(p = CAMERA_PRESETS[presetName], dz = 0, aspect = camera.aspect, outline = heroOutline) {
  const k = Math.tan((p.fov * DEG) / 2) * aspect * Math.cos(p.pitch * DEG);
  const grow = Math.sqrt(1 + k * k);
  let reach = Infinity;
  for (const [r, , top] of outline) reach = Math.min(reach, halfWidthAt(p, dz, aspect, top) - r * grow);
  return reach;
}

// The subject for a hero standing at pos inside rect {x0, z0, x1, z1} (a
// screen object will do).
//   depth   follow presets track the hero's row, the frame's bottom edge
//           kept inside the rect; the hero crosses a south edge before any
//           of him drops below it (southReach, transitions.js). Fixed
//           presets aim at the middle and move south only to keep all of
//           him above the bottom edge (in a room nothing past the walls is
//           drawn, so there it may show past the rect; elsewhere it stays
//           inside like the others).
//   across  measured on the hero's row (rows nearer the camera are
//           narrower). Where the frame is wider than the rect there, it is
//           centred. Otherwise follow presets track the hero with the
//           frame's sides kept inside the rect. Fixed presets hold the
//           middle unless the frame is less than half as wide as the rect
//           (at the subject's row, so this does not flip as the hero walks),
//           where they track the hero like the others. Either way all of the
//           hero stays in frame (sideReach), which wins.
export function subjectFor(pos, rect, p = CAMERA_PRESETS[presetName], aspect = camera.aspect) {
  const { clamp } = THREE.MathUtils;
  p = lensFor(p, rect);
  const follow = followsHero(p, rect);
  if (follow && rect.area?.rooms) return roomSubject(pos, rect, p, aspect);
  const screenRect = rect;
  if (follow && rect.areaRect) rect = rect.areaRect; // follow: clamped to the area only
  const w = rect.x1 - rect.x0;
  const cx = (rect.x0 + rect.x1) / 2;
  const cz = (rect.z0 + rect.z1) / 2;
  const { south } = cameraFootprint(p, aspect);
  const zMax = rect.z1 - south; // any further south and the frame shows the screen below
  let z;
  if (p.fixed) {
    z = Math.max(cz, pos.z + southReach(p) - south);
    if (!screenRect.area?.rooms) z = Math.min(z, zMax);
  } else z = zMax >= rect.z0 ? clamp(pos.z, rect.z0, zMax) : zMax;
  // Following, all of the hero stays above the bottom edge even where the
  // area ends with no area past it (the backdrop shows there).
  if (follow) z = Math.max(z, pos.z + southReach(p) - south);
  const dz = pos.z - z; // the hero's row, from the subject
  const hw = halfWidthAt(p, dz, aspect); // the frame's half-width on the hero's row
  const hold = p.fixed && 4 * halfWidthAt(p, 0, aspect) >= w; // a fixed camera that holds the middle
  let x = w <= 2 * hw || hold ? cx : clamp(pos.x, rect.x0 + hw, rect.x1 - hw);
  const reach = sideReach(p, dz, aspect); // hero centre to subject, at most
  x = reach > 0 ? clamp(x, pos.x - reach, pos.x + reach) : pos.x;
  return new THREE.Vector3(x, 0, z);
}

// Follow the hero within the current screen (skipped while a slide runs).
export function followSubject(pos, rect) {
  if (tween) return;
  lensRect = rect;
  camTarget.copy(subjectFor(pos, rect));
}

// A local reward can reach higher than the normal character outline. Keep
// its top below the HUD for the brief presentation, then restore the rig.
let headroom = null;
export function setCameraHeadroom(target) { headroom = target; }

// Presentation fits nearby figures after the original solo target and slide
// have been calculated. It never changes transition thresholds or camTarget.
let partyFrame = null, viewLens = null, framing = null;
export function setCameraFrame(frame) {
  if (frame && (!partyFrame || frame.key !== partyFrame.key ||
      Math.hypot(frame.anchor.x - partyFrame.anchor.x, frame.anchor.z - partyFrame.anchor.z) > 4)) framing = null;
  partyFrame = frame;
}

function frameIntervals(p, points, safe, prefer) {
  let loZ = -Infinity, hiZ = Infinity;
  for (const v of points) {
    loZ = Math.max(loZ, subjectZForRow(p, safe.bottom, v.y - GROUND_Y, v.z));
    // A top ray above the horizon imposes no ground-subject upper bound.
    if (p.pitch * DEG > Math.atan((1 - 2 * safe.top) * Math.tan(p.fov * DEG / 2)))
      hiZ = Math.min(hiZ, subjectZForRow(p, safe.top, v.y - GROUND_Y, v.z));
  }
  if (headroom) hiZ = Math.min(hiZ, subjectZForRow(p, headroom.row, headroom.height, headroom.z));
  // All horizontal bounds have the same subject-z slope. Solve the least
  // southward subject that fits the width before deciding to zoom out.
  let loX0 = -Infinity, hiX0 = Infinity;
  for (const v of points) {
    const hw = halfWidthAt(p, v.z, camera.aspect, v.y - GROUND_Y);
    loX0 = Math.max(loX0, v.x - (2 * safe.right - 1) * hw);
    hiX0 = Math.min(hiX0, v.x - (2 * safe.left - 1) * hw);
  }
  const grow = 2 * (safe.right - safe.left) * Math.tan(p.fov * DEG / 2) * camera.aspect * Math.cos(p.pitch * DEG);
  loZ = Math.max(loZ, (loX0 - hiX0) / grow + 1e-7);
  if (loZ > hiZ) return null;
  const z = THREE.MathUtils.clamp(prefer.z, loZ, hiZ);
  let loX = -Infinity, hiX = Infinity;
  for (const v of points) {
    const hw = halfWidthAt(p, v.z - z, camera.aspect, v.y - GROUND_Y);
    if (hw <= 0) return null;
    loX = Math.max(loX, v.x - (2 * safe.right - 1) * hw);
    hiX = Math.min(hiX, v.x - (2 * safe.left - 1) * hw);
  }
  return loX <= hiX ? { x: THREE.MathUtils.clamp(prefer.x, loX, hiX), z, loX, hiX, loZ, hiZ } : null;
}

function fitPartyFrame(base, dt) {
  if (!partyFrame) {
    if (!framing) return { lens: base, subject: camTarget };
    const k = Math.exp(-10 * dt);
    for (const field of ['dx', 'dz', 'height', 'pitch']) framing[field] *= k;
    if (Math.max(...['dx', 'dz', 'height', 'pitch'].map(f => Math.abs(framing[f]))) < .001) framing = null;
    return framing ? { lens: { ...base, height: base.height + framing.height, pitch: base.pitch + framing.pitch },
      subject: { x: camTarget.x + framing.dx, z: camTarget.z + framing.dz } } : { lens: base, subject: camTarget };
  }
  const p = { ...base, pitch: Math.max(base.pitch, 28) };
  let best = null;
  for (const safe of partyFrame.regions) {
    let height = p.height, fit = frameIntervals(p, partyFrame.points, safe, camTarget);
    if (!fit) {
      let lo = height, hi = Math.max(height, Math.min(height * 4, 40));
      if (!frameIntervals({ ...p, height: hi }, partyFrame.points, safe, camTarget)) continue;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (frameIntervals({ ...p, height: mid }, partyFrame.points, safe, camTarget)) hi = mid;
        else lo = mid;
      }
      height = hi;
      fit = frameIntervals({ ...p, height }, partyFrame.points, safe, camTarget);
    }
    const score = 8 * (height / p.height - 1) + .2 * Math.hypot(fit.x - camTarget.x, fit.z - camTarget.z) / p.height;
    if (!best || score < best.score) best = { ...fit, height, safe, score };
  }
  if (!best) return { lens: base, subject: camTarget }; // pathological tiny viewport
  const k = 1 - Math.exp(-10 * dt);
  if (!framing) framing = { dx: best.x - camTarget.x, dz: best.z - camTarget.z, height: best.height - base.height, pitch: p.pitch - base.pitch };
  else {
    framing.dx = THREE.MathUtils.lerp(framing.dx, best.x - camTarget.x, k);
    framing.dz = THREE.MathUtils.lerp(framing.dz, best.z - camTarget.z, k);
    // Expand as needed to keep members visible; ease back when they close up.
    framing.height = Math.max(best.height - base.height, THREE.MathUtils.lerp(framing.height, best.height - base.height, k));
    framing.pitch = p.pitch - base.pitch;
  }
  const lens = { ...p, height: base.height + framing.height };
  const prefer = { x: camTarget.x + framing.dx, z: camTarget.z + framing.dz };
  const fit = frameIntervals(lens, partyFrame.points, best.safe, prefer) ?? best;
  framing.dx = fit.x - camTarget.x; framing.dz = fit.z - camTarget.z;
  camera.userData.partyFrame = { targets: partyFrame.targets, safe: best.safe, scale: lens.height / base.height };
  return { lens, subject: { x: fit.x, z: fit.z } };
}

export function placeCamera(dt = 1 / 60) {
  camera.userData.partyFrame = null;
  const base = currentLens();
  const framed = fitPartyFrame(base, dt);
  const lens = viewLens = framed.lens;
  if (camera.fov !== lens.fov) {
    camera.fov = lens.fov;
    camera.updateProjectionMatrix();
  }
  const subject = headroom ? { x: framed.subject.x, z: Math.min(framed.subject.z,
    subjectZForRow(lens, headroom.row, headroom.height, headroom.z)) } : framed.subject;
  poseCamera(camera, lens, subject);
  if (shake.t > 0) {
    const k = (shake.t / shake.dur) ** 2;
    shake.t = Math.max(0, shake.t - dt);
    if (dt > 0) shake.n++;
    camera.position.x += Math.sin(shake.n * 2.9) * shake.amp * k;
    camera.position.y += Math.sin(shake.n * 3.7 + 1) * shake.amp * 0.6 * k;
  }
  camera.userData.subject = subject;
  followSun(camTarget);
}

// A short decaying camera kick (tiles) for heavy hits; a stronger one wins over a weaker.
const shake = { t: 0, dur: 1, amp: 0, n: 0 };
export function shakeCamera(amp = 0.06, dur = 0.12) {
  if (shake.t > 0 && shake.amp * (shake.t / shake.dur) > amp) return;
  Object.assign(shake, { t: dur, dur, amp });
}

export function snapCamera(target) {
  framing = partyFrame = viewLens = null;
  camTarget.copy(target);
  tween = null;
}

// ---------------------------------------------------------------- slide
// startCameraTween(to, dur, { ease, preset, rect, anchor }) moves camTarget
// from where it is to `to` over `dur` seconds (a function in place of the
// options is the ease, as in M1's startCameraTween(to, dur, ease)).
// stepCameraTween(dt) advances it and returns the linear progress 0..1 so the
// caller can move other things (the hero) in step with the camera. Given a
// preset (and the rect it is fitted to), the tween also switches to it,
// blending the lens on the way.
//
// Given an anchor { from, to } (points the caller moves something along,
// linearly with that progress: the hero walking into the next screen), it is
// the anchor's offset from the subject that eases instead of the subject
// itself. The anchor's place in the frame then moves steadily from where it
// was to where it ends, so a hero who starts and ends in frame stays in
// frame, however far the camera goes (the frame is convex); the camera
// starts at the hero's pace.
export const easeInOutQuad = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

let tween = null;

export function startCameraTween(to, dur, opts = {}) {
  const { ease = easeInOutQuad, preset = null, rect = null, anchor = null } = typeof opts === 'function' ? { ease: opts } : opts;
  const before = currentLens();
  if (preset && !CAMERA_PRESETS[preset]) throw new Error(`Unknown camera preset "${preset}"`);
  if (preset) presetName = preset;
  if (rect) lensRect = rect;
  const after = lensFor(CAMERA_PRESETS[presetName], lensRect);
  const lensFrom = LENS.some((f) => (before[f] ?? 0) !== (after[f] ?? 0)) ? { ...before } : null;
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

// Nearby companions and friends are presentation subjects, never transition
// anchors. Stable native pose bounds exclude blades, shadows and technique FX.
import * as THREE from 'three';
import { player } from '../entities/player.js';
import { liveEntities } from '../entities/manager.js';
import { currentScreen } from '../world/world.js';
import { state } from '../core/state.js';
import { GROUND_Y } from '../core/constants.js';
import { camera } from '../core/renderer.js';
import { setCameraFrame, placeCamera } from '../core/camera.js';
import { setPartyCutaway, cutawayView } from '../core/materials.js';
import { g } from '../ui/canvas/gfx.js';
import { playShortcutBounds } from '../ui/shortcuts.js';
import { hudBounds } from '../ui/hud.js';
import { rewardWorldBounds } from '../core/presentation.js';
import { companionHintBounds } from '../ui/hud/companion.js';

const cachedBounds = new WeakMap();
let targets = [], regions = [], regionsKey = '', touchKey = '', touchRects = [], currentFrame = null;
const viewCam = new THREE.Vector3(), point = new THREE.Vector3();

function poseBounds(figure) {
  let cached = cachedBounds.get(figure);
  if (cached && (figure.poses ? cached.poses === figure.poses : cached.geometry === figure.geometry)) return cached.box;
  const box = new THREE.Box3();
  for (const model of Object.values(figure.poses ?? { active: { geometry: figure.geometry } })) {
    const geom = model.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    box.union(geom.boundingBox);
  }
  box.expandByScalar(.08);
  cached = { poses: figure.poses, geometry: figure.geometry, box };
  cachedBounds.set(figure, cached);
  return box;
}

// Cache DOM measurements on viewport changes. These are the actual touch pad
// groups; the canvas HUD supplies its own logical bounds without DOM reads.
function touchBounds() {
  const key = `${innerWidth}/${innerHeight}/${g.w}/${g.h}`;
  if (key === touchKey) return touchRects;
  touchKey = key; touchRects = [];
  const pad = document.getElementById('touch');
  if (pad && !pad.hidden && matchMedia('(pointer: coarse)').matches) {
    for (const selector of ['#stick', '.touch-buttons', '.touch-menu']) {
      const r = pad.querySelector(selector)?.getBoundingClientRect();
      if (r?.width && r.height) touchRects.push({ x: r.left / innerWidth * g.w, y: r.top / innerHeight * g.h,
        w: r.width / innerWidth * g.w, h: r.height / innerHeight * g.h });
    }
  }
  return touchRects;
}

function freeRegions() {
  const columns = new Map();
  for (const r of [...hudBounds(g), ...playShortcutBounds(g)]) {
    const side = ['vitals', 'magic', 'counters'].includes(r.region) ? 'left' : r.region === 'center' ? 'center' : 'right';
    const c = columns.get(side) ?? { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity };
    c.x = Math.min(c.x, r.x); c.y = Math.min(c.y, r.y);
    c.right = Math.max(c.right, r.x + r.w); c.bottom = Math.max(c.bottom, r.y + r.h); columns.set(side, c);
  }
  const obstacles = [...columns.values()].map(c => ({ x: c.x, y: c.y, w: c.right - c.x, h: c.bottom - c.y }));
  obstacles.push(companionHintBounds(g), ...touchBounds());
  const key = JSON.stringify([g.w, g.h, g.safe, obstacles]);
  if (key === regionsKey) return regions;
  regionsKey = key;
  const margin = 5, left = g.safe.l + margin, right = g.w - g.safe.r - margin;
  const top = g.safe.t + margin, bottom = g.h - g.safe.b - margin;
  const rs = obstacles.map(r => ({ left: Math.max(left, r.x - margin), right: Math.min(right, r.x + r.w + margin),
    top: Math.max(top, r.y - margin), bottom: Math.min(bottom, r.y + r.h + margin) }));
  const xs = [...new Set([left, right, ...rs.flatMap(r => [r.left, r.right])])].sort((a,b)=>a-b);
  const ys = [...new Set([top, bottom, ...rs.flatMap(r => [r.top, r.bottom])])].sort((a,b)=>a-b);
  const candidates = [];
  for (let l = 0; l < xs.length - 1; l++) for (let r = l + 1; r < xs.length; r++) {
    if (xs[r] - xs[l] < g.w * .12) continue;
    for (let t = 0; t < ys.length - 1; t++) for (let b = t + 1; b < ys.length; b++) {
      if (ys[b] - ys[t] < g.h * .1 || rs.some(o => xs[l] < o.right && xs[r] > o.left && ys[t] < o.bottom && ys[b] > o.top)) continue;
      candidates.push({ left: xs[l] / g.w, right: xs[r] / g.w, top: ys[t] / g.h, bottom: ys[b] / g.h });
    }
  }
  // Contained rectangles cannot offer a better fit. Keep the maximal choices.
  regions = candidates.filter((a,i) => !candidates.some((b,j) => i !== j && b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom));
  return regions;
}

export function updatePartyCamera() {
  const screen = currentScreen();
  if (!screen || ['title', 'dead', 'warp', 'ending'].includes(state.mode)) {
    targets = []; currentFrame = null; setCameraFrame(null); return;
  }
  const nearby = liveEntities().filter(e => ['companion', 'friend'].includes(e.kind) && !e.removed && e.object.visible &&
    Math.hypot(e.x - player.x, e.z - player.z) <= 6 &&
    (screen.area.rooms ? e.kind === 'companion' || e.info?.screen === screen.key : true));
  nearby.sort((a,b) => (a.kind === 'companion' ? 0 : 1) - (b.kind === 'companion' ? 0 : 1) ||
    Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  targets = [player, ...nearby.slice(0, 7)];
  if (targets.length === 1) { currentFrame = null; setCameraFrame(null); return; }
  const points = [];
  for (const e of targets) {
    const figure = (e.hero ?? e.rig).figure, box = poseBounds(figure);
    figure.updateWorldMatrix(true, false);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
      points.push(new THREE.Vector3(x, y, z).applyMatrix4(figure.matrixWorld));
  }
  const reward = rewardWorldBounds();
  if (reward) for (const x of [reward.min.x - .08, reward.max.x + .08])
    for (const y of [reward.min.y - .08, reward.max.y + .08]) for (const z of [reward.min.z - .08, reward.max.z + .08])
      points.push(new THREE.Vector3(x, y, z));
  currentFrame = { key: screen.area.rooms ? screen.key : screen.area.id,
    anchor: { x: player.x, z: player.z }, targets: targets.map(e => e === player ? 'Hero' : e.name ?? e.peerId), points, regions: freeRegions() };
  setCameraFrame(currentFrame);
}

export function renderPartyCutaway() {
  // A draw may resize the logical viewport after the simulation step. Refit
  // that changed layout without advancing the camera's easing clock.
  if (currentFrame) {
    const nextRegions = freeRegions();
    if (nextRegions !== currentFrame.regions) {
      currentFrame.regions = nextRegions; setCameraFrame(currentFrame); placeCamera(0);
    }
  }
  const probes = (targets.length ? targets : [player]).map(e => {
    const figure = (e.hero ?? e.rig).figure;
    if (e === player && targets.length <= 1) return new THREE.Vector3(player.x, GROUND_Y + .5, player.z);
    figure.updateWorldMatrix(true, false);
    return poseBounds(figure).getCenter(point).applyMatrix4(figure.matrixWorld).clone();
  });
  setPartyCutaway(probes, camera.getWorldPosition(viewCam), GROUND_Y);
}

export const partyCameraView = () => ({ targets: targets.map(e => e === player ? 'Hero' : e.name ?? e.peerId), regions, cutaway: cutawayView() });

// What the blade looks like (art bible v1.8 section 11): the small blade is
// the rig's own sword mesh; at full life the sword becomes a long flat white
// slab with a chisel point, held flat at hand height (#e8e8ec on top, no
// glow, a hard shadow, 0.18 tile thick, roughness 0.45). There is no beam.
// The spin draws a flat white sector at blade height behind the blade, up
// to 300 degrees, crisp edged. Look replaces these at M4.
//
//   updateBladeFx(p)   once per frame from player.animate
import * as THREE from 'three';
import { TUNING } from '../core/tuning.js';
import { SWORD_GRIP, V } from '../models/hero.js';
import { swordStats } from './sword.js';

const SLAB_THICK = 0.18;
const SPIN_MAX = 300; // degrees of trail shown
const HILT = 4 * V; // grip and guard before the blade starts

let slab = null;
let tip = null;
let disc = null;
let discKey = '';
let flashT = 0;

const slabMat = () => new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.45, metalness: 0 });

function build(hero) {
  const g = new THREE.Group();
  g.name = 'long-blade';
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const mat = slabMat();
  const body = new THREE.Mesh(box, mat);
  body.visible = false;
  body.castShadow = true;
  body.name = 'slab';
  g.add(body);
  // the chisel point: a wedge one blade-width long
  const wedge = new THREE.CylinderGeometry(0, 0.5, 1, 3, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  tip = new THREE.Mesh(wedge, mat);
  tip.visible = false;
  tip.castShadow = true;
  g.add(tip);
  g.position.copy(SWORD_GRIP).add(new THREE.Vector3(0, 0, HILT));
  g.userData.body = body;
  hero.swordPivot.add(g);
  slab = g;
  const dm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  disc = new THREE.Mesh(new THREE.BufferGeometry(), dm);
  disc.name = 'spin-disc';
  disc.renderOrder = 2;
  hero.root.add(disc);
}

// A short white flash along the blade when the full blade comes back (spec 7.5).
export function flashBlade(seconds = TUNING.sword.regainFlash) {
  flashT = seconds;
}

export function updateBladeFx(p, dt = 0) {
  const hero = p.hero;
  if (!hero?.swordPivot) return;
  if (!slab) build(hero);
  flashT = Math.max(0, flashT - dt);
  const s = swordStats();
  const th = p.thrust;
  const out = !!th || !!p.dashing;
  const t = TUNING.sword;
  const reachNow = th ? th.reach : p.dashing ? p.dashReach ?? s.reach : 0;
  const len = Math.max(0, reachNow - t.handOffset);
  const full = !s.small && !s.none;
  // the small blade: the rig's sword, grown out along the thrust
  if (hero.sword) {
    hero.sword.visible = out && !full && len > 0.02;
    hero.sword.scale.set(1, 1, Math.max(0.05, Math.min(1, len / t.smallLength)));
  }
  hero.swordPivot.visible = out;
  slab.visible = out && full && len > 0.02;
  slab.userData.body.visible = tip.visible = slab.visible;
  if (slab.visible) {
    const w = Math.max(0.12, s.width ?? t.width(0));
    const body = slab.userData.body;
    const blade = Math.max(0.01, len - HILT - w);
    body.scale.set(w, SLAB_THICK, blade);
    tip.scale.set(w, SLAB_THICK, w);
    tip.position.set(0, 0, blade);
    body.material.emissive.setHex(flashT > 0 ? 0xffffff : 0x000000);
    body.material.emissiveIntensity = flashT > 0 ? 0.8 : 0;
  }
  // the spin trail
  const sweep = th && th.swept > 1 ? Math.min(SPIN_MAX, th.swept) : 0;
  disc.visible = sweep > 0;
  if (disc.visible) {
    const r = Math.max(0.5, th.reach);
    const key = `${sweep.toFixed(0)}:${r.toFixed(2)}`;
    if (key !== discKey) {
      discKey = key;
      disc.geometry.dispose();
      // two segments per 90 degrees: a coarse fan with a straight-chord rim
      const segs = Math.max(2, Math.round(sweep / 45));
      disc.geometry = new THREE.CircleGeometry(r, segs, 0, (sweep * Math.PI) / 180).rotateX(-Math.PI / 2);
    }
    // the sector runs from the blade back along the way it turned
    const rootYaw = hero.root.rotation.y;
    const dir = th.turnDir || -1;
    // CircleGeometry after rotateX(-90): angle 0 along +x, counter-clockwise seen from above is toward -z
    const a0 = dir < 0 ? th.angle : th.angle - (sweep * Math.PI) / 180;
    disc.rotation.set(0, a0 - rootYaw - Math.PI / 2, 0);
    disc.position.set(0, 0.4, 0);
    disc.material.opacity = 0.55;
  }
}

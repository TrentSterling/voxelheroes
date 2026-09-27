// Particles (art bible section 11).
//
//   burst(x, y, z, colors, count, { speed, size, up, life })
//     Breaking and death: small cubes (about 0.1 to 0.15 tile) in the object's own colours that
//     scatter, bounce, lie on the ground for a moment and then vanish.
//   sparks(x, y, z, colors, count, { speed, size, up, life })
//     Hits: small glowing cubes that fly off and fade out without settling.
//   smoke(x, y, z, count, { radius, spread, life })
//     Enemies appearing and vanishing: white smoke puffs that swell, rise a little and shrink away.
//
// Each kind is one instanced mesh reused round-robin. Cubes use the character material (their
// geometry comes from the voxel mesher, so the bevel and seams apply), sparks a glow material,
// puffs the character material on a round mesh. Randomness comes from the effects stream, never
// the gameplay one.
import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import { fxRandom as rand } from '../core/random.js';
import { DenseGrid, meshVoxels } from '../core/vox.js';
import { getMaterial, makeGlowMaterial } from '../core/materials.js';

const GRAVITY = 20;
const BOUNCE = 0.35; // share of the vertical speed kept on a bounce
const REST = 0.45; // seconds a settled cube lies on the ground before it goes
const SHRINK = 0.18; // seconds to shrink away

const pColor = new THREE.Color();
const pMat = new THREE.Matrix4();
const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
const pQuat = new THREE.Quaternion();
const pEuler = new THREE.Euler();
const pPos = new THREE.Vector3();
const pScale = new THREE.Vector3();

// A pool of instances of one mesh.
class Pool {
  constructor(geometry, material, max, { shadow = true } = {}) {
    this.max = max;
    this.items = Array.from({ length: max }, () => ({ life: 0 }));
    this.next = 0;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = shadow;
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, zeroMat);
      this.mesh.setColorAt(i, pColor.set(0xffffff));
    }
    this.dirtyColor = false;
  }

  take(color) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.mesh.setColorAt(i, pColor.set(color));
    this.dirtyColor = true;
    return [this.items[i], i];
  }

  live() {
    let n = 0;
    for (const p of this.items) if (p.life > 0) n++;
    return n;
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.dirtyColor) this.mesh.instanceColor.needsUpdate = true;
    this.dirtyColor = false;
  }
}

let cubes = null;
let glints = null;
let puffs = null;

// A unit cube from the voxel mesher (it carries the face UVs and colours the voxel materials read).
function unitCube() {
  const g = new DenseGrid(1, 1, 1);
  g.set(0, 0, 0, 0xffffff);
  return meshVoxels(g, { origin: [0.5, 0.5, 0.5], scale: 1, ao: false });
}

function puffGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  return geo;
}

export function initParticles(scene) {
  cubes = new Pool(unitCube(), getMaterial('character'), 800);
  const glow = makeGlowMaterial(0xffffff, 1.6);
  glow.vertexColors = true; // instance colours carry the spark colours
  glints = new Pool(unitCube(), glow, 200, { shadow: false });
  puffs = new Pool(puffGeometry(), getMaterial('character'), 160);
  for (const p of [cubes, glints, puffs]) scene.add(p.mesh);
}

export function burst(x, y, z, colors, count, { speed = 3, size = 0.12, up = 4, life = 0.9 } = {}) {
  if (!cubes) return;
  for (let i = 0; i < count; i++) {
    const [p] = cubes.take(colors[i % colors.length]);
    const a = rand() * Math.PI * 2;
    const s = speed * (0.4 + rand() * 0.8);
    Object.assign(p, {
      x,
      y,
      z,
      vx: Math.cos(a) * s,
      vz: Math.sin(a) * s,
      vy: up * (0.5 + rand()),
      life: life * (0.6 + rand() * 0.6) + REST,
      size: size * (0.8 + rand() * 0.45),
      rx: rand() * 6,
      ry: rand() * 6,
      spin: 4 + rand() * 6,
      settled: false,
    });
  }
}

export function sparks(x, y, z, colors, count, { speed = 3, size = 0.05, up = 3, life = 0.3 } = {}) {
  if (!glints) return;
  for (let i = 0; i < count; i++) {
    const [p] = glints.take(colors[i % colors.length]);
    const a = rand() * Math.PI * 2;
    const s = speed * (0.6 + rand() * 0.8);
    const l = life * (0.7 + rand() * 0.6);
    Object.assign(p, { x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.3 + rand()), life: l, full: l, size: size * (0.7 + rand() * 0.6), rx: rand() * 6 });
  }
}

export function smoke(x, y, z, count = 8, { radius = 0.16, spread = 0.35, life = 0.55 } = {}) {
  if (!puffs) return;
  for (let i = 0; i < count; i++) {
    const [p] = puffs.take(0xf2f2f2);
    const a = i * 2.39996 + rand();
    const d = 0.08 + spread * rand();
    const l = life * (0.75 + rand() * 0.5);
    Object.assign(p, {
      x: x + Math.cos(a) * d,
      y: y + rand() * 0.25,
      z: z + Math.sin(a) * d * 0.8,
      vx: Math.cos(a) * 0.5,
      vz: Math.sin(a) * 0.4,
      vy: 0.5 + rand() * 0.5,
      life: l,
      full: l,
      size: radius * (0.7 + rand() * 0.8),
    });
  }
}

function updateCubes(dt) {
  const P = cubes;
  for (let i = 0; i < P.max; i++) {
    const p = P.items[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      P.mesh.setMatrixAt(i, zeroMat);
      continue;
    }
    const floor = GROUND_Y + p.size / 2;
    if (!p.settled) {
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.spin * dt;
      p.ry += p.spin * 0.7 * dt;
      if (p.y < floor) {
        p.y = floor;
        p.vy *= -BOUNCE;
        p.vx *= 0.55;
        p.vz *= 0.55;
        p.spin *= 0.5;
        // too slow to bounce again: lie flat on the ground for the rest of its life
        if (p.vy < 0.9 || p.life < REST) {
          p.settled = true;
          p.life = Math.min(p.life, REST + SHRINK * rand());
        }
      }
    }
    const lie = p.settled ? 0 : 1;
    const s = p.size * Math.min(1, p.life / SHRINK);
    pEuler.set(p.rx * lie, p.ry, p.rx * 0.5 * lie);
    pMat.compose(pPos.set(p.x, p.settled ? GROUND_Y + s / 2 : p.y, p.z), pQuat.setFromEuler(pEuler), pScale.set(s, s, s));
    P.mesh.setMatrixAt(i, pMat);
  }
  P.flush();
}

function updateSparks(dt) {
  const P = glints;
  for (let i = 0; i < P.max; i++) {
    const p = P.items[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      P.mesh.setMatrixAt(i, zeroMat);
      continue;
    }
    p.vy -= GRAVITY * 0.5 * dt;
    p.x += p.vx * dt;
    p.y = Math.max(GROUND_Y, p.y + p.vy * dt);
    p.z += p.vz * dt;
    p.rx += dt * 8;
    const s = p.size * (p.life / p.full);
    pEuler.set(p.rx, p.rx * 0.7, 0);
    pMat.compose(pPos.set(p.x, p.y, p.z), pQuat.setFromEuler(pEuler), pScale.set(s, s, s));
    P.mesh.setMatrixAt(i, pMat);
  }
  P.flush();
}

function updatePuffs(dt) {
  const P = puffs;
  for (let i = 0; i < P.max; i++) {
    const p = P.items[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      P.mesh.setMatrixAt(i, zeroMat);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vx *= 1 - dt * 3;
    p.vz *= 1 - dt * 3;
    const k = 1 - p.life / p.full; // 0 -> 1 over the puff's life
    const s = p.size * (k < 0.25 ? 0.5 + 2 * k : 1 - Math.max(0, (k - 0.55) / 0.45)); // swell, hold, shrink away
    pMat.compose(pPos.set(p.x, p.y, p.z), pQuat.identity(), pScale.set(s, s * 0.85, s));
    P.mesh.setMatrixAt(i, pMat);
  }
  P.flush();
}

export function updateParticles(dt) {
  if (!cubes) return;
  updateCubes(dt);
  updateSparks(dt);
  updatePuffs(dt);
}

// Number of live particles of every kind (for tests).
export const liveParticles = () => (cubes ? cubes.live() + glints.live() + puffs.live() : 0);

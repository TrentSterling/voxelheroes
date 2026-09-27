// Voxel particles: everything that breaks bursts into little bouncing cubes.
//
//   burst(x, y, z, [0xff0000, 0xffffff], 20, { speed: 3, size: 0.1, up: 4, life: 0.9 });
//
// One instanced mesh holds up to MAX_P cubes, reused round-robin.
import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import { fxRandom as rand } from '../core/random.js';

const MAX_P = 800;
const particles = Array.from({ length: MAX_P }, () => ({ life: 0 }));
let pNext = 0;
let pMesh = null;

const pColor = new THREE.Color();
const pMat = new THREE.Matrix4();
const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
const pQuat = new THREE.Quaternion();
const pEuler = new THREE.Euler();
const pPos = new THREE.Vector3();
const pScale = new THREE.Vector3();

export function initParticles(scene) {
  pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAX_P);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pMesh.frustumCulled = false;
  pMesh.castShadow = true;
  for (let i = 0; i < MAX_P; i++) {
    pMesh.setMatrixAt(i, zeroMat);
    pMesh.setColorAt(i, pColor.set(0xffffff));
  }
  scene.add(pMesh);
}

export function burst(x, y, z, colors, count, { speed = 3, size = 0.1, up = 4, life = 0.9 } = {}) {
  for (let i = 0; i < count; i++) {
    const p = particles[pNext];
    const idx = pNext;
    pNext = (pNext + 1) % MAX_P;
    const a = rand() * Math.PI * 2;
    const s = speed * (0.4 + rand() * 0.8);
    Object.assign(p, {
      x,
      y,
      z,
      vx: Math.cos(a) * s,
      vz: Math.sin(a) * s,
      vy: up * (0.5 + rand()),
      life: life * (0.6 + rand() * 0.6),
      size: size * (0.7 + rand() * 0.6),
      spin: rand() * 6,
    });
    pMesh.setColorAt(idx, pColor.set(colors[i % colors.length]));
  }
  pMesh.instanceColor.needsUpdate = true;
}

export function updateParticles(dt) {
  for (let i = 0; i < MAX_P; i++) {
    const p = particles[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      pMesh.setMatrixAt(i, zeroMat);
      continue;
    }
    p.vy -= 20 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const floor = GROUND_Y + p.size / 2;
    if (p.y < floor) {
      p.y = floor;
      p.vy *= -0.35;
      p.vx *= 0.6;
      p.vz *= 0.6;
    }
    p.spin += dt * 3;
    const s = p.size * Math.min(1, p.life / 0.25);
    pEuler.set(p.spin, p.spin * 0.7, 0);
    pMat.compose(pPos.set(p.x, p.y, p.z), pQuat.setFromEuler(pEuler), pScale.set(s, s, s));
    pMesh.setMatrixAt(i, pMat);
  }
  pMesh.instanceMatrix.needsUpdate = true;
}

// Number of live particles (for tests).
export const liveParticles = () => particles.reduce((n, p) => n + (p.life > 0 ? 1 : 0), 0);

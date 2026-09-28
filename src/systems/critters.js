// Ambient overworld life (Stardew/Zelda touch): butterflies fluttering over grass and flowers,
// small birds that hop and fly off when the hero nears, chickens wandering the village and
// scattering when he runs through, and chimney smoke over its houses. Purely cosmetic: nothing
// here is solid, none of it is an entity (entities/manager.js never sees it), so play-tests and
// collision are unaffected. Layout and behaviour are seeded from the screen key (core/voxel.js's
// rng, never Math.random), so a screen looks the same every time it is entered.
//
// Spawns on 'room-enter' for the screen just entered, clears on 'screen-leave'. Ticking is not
// wired to anything yet: add one line to src/main.js's update(), after updateParticles(dt):
//   updateCritters(dt);
import { on } from '../core/events.js';
import { GROUND_Y } from '../core/constants.js';
import { scene } from '../core/renderer.js';
import { rng } from '../core/voxel.js';
import { world } from '../world/world.js';
import { player } from '../entities/player.js';
import { burst, smoke } from './particles.js';
import { makeButterfly, makeBird, makeChicken, BUTTERFLY_COLORS, CHICKEN_VARIANTS } from '../models/critters.js';

const BIRD_FLEE = 2.5; // tiles: a bird flies off when the hero comes this close
const CHICKEN_FLEE = 1.15; // tiles: a chicken scatters when the hero runs into it
const GROUND_CHARS = ['.', ',', 'p', 'd', 's']; // grass, flowers, path, dirt, sand: open, walkable ground
const FLOWER_CHARS = ['.', ',']; // grass and flowers: where butterflies flutter
const MAX = { butterfly: 3, bird: 2, chicken: 4 };
const CHIMNEY_Y = 2.95; // tiles above the ground: just over a Mossbrook roof ridge (town.js's house(), WALL_TOP + roof rise)

let live = []; // every critter and chimney timer on the current screen

// FNV-1a: a short string (a screen key, or a screen key plus a tag) to a 32-bit seed for rng().
function seedOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clearAll() {
  for (const c of live) if (c.mesh) scene.remove(c.mesh);
  live = [];
}

function tilesWhere(screen, chars) {
  const out = [];
  for (let z = 0; z < screen.h; z++) for (let x = 0; x < screen.w; x++) if (chars.includes(screen.tiles[z][x])) out.push([x, z]);
  return out;
}

// Take up to n distinct spots out of `spots`, consuming `rand`.
function pickSpots(spots, rand, n) {
  const pool = [...spots];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

// 'H'/'h' tiles that touch, 4-connected: one cluster per house. Returns each cluster's tiles.
function houseClusters(screen) {
  const seen = new Set();
  const isHouse = (x, z) => screen.tiles[z]?.[x] === 'H' || screen.tiles[z]?.[x] === 'h';
  const clusters = [];
  for (let z = 0; z < screen.h; z++)
    for (let x = 0; x < screen.w; x++) {
      const k = `${x},${z}`;
      if (seen.has(k) || !isHouse(x, z)) continue;
      const tiles = [];
      const stack = [[x, z]];
      seen.add(k);
      while (stack.length) {
        const [cx, cz] = stack.pop();
        tiles.push([cx, cz]);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const nz = cz + dz;
          const nk = `${nx},${nz}`;
          if (seen.has(nk) || !isHouse(nx, nz)) continue;
          seen.add(nk);
          stack.push([nx, nz]);
        }
      }
      clusters.push(tiles);
    }
  return clusters;
}

function spawnButterflies(screen, rand) {
  const spots = tilesWhere(screen, FLOWER_CHARS);
  if (!spots.length) return;
  const n = Math.min(spots.length, MAX.butterfly, 2 + Math.floor(rand() * 2));
  for (const [lx, lz] of pickSpots(spots, rand, n)) {
    const ax = screen.x0 + lx + 0.5;
    const az = screen.z0 + lz + 0.5;
    const seed = rng(seedOf(`${screen.key}:bfly:${lx},${lz}`));
    const mesh = makeButterfly(Math.floor(seed() * BUTTERFLY_COLORS.length));
    mesh.position.set(ax, GROUND_Y + 0.32, az);
    scene.add(mesh);
    live.push({ kind: 'butterfly', mesh, rand: seed, ax, az, t: seed() * 10, phase: seed() * Math.PI * 2, radius: 0.3 + seed() * 0.35, speed: 0.55 + seed() * 0.5, flapT: 0 });
  }
}

function spawnBirds(screen, rand) {
  const spots = tilesWhere(screen, GROUND_CHARS);
  if (!spots.length) return;
  const n = Math.min(spots.length, MAX.bird, Math.floor(rand() * (MAX.bird + 1)));
  for (const [lx, lz] of pickSpots(spots, rand, n)) {
    const x = screen.x0 + lx + 0.5;
    const z = screen.z0 + lz + 0.5;
    const seed = rng(seedOf(`${screen.key}:bird:${lx},${lz}`));
    const mesh = makeBird();
    const yaw = seed() * Math.PI * 2;
    mesh.position.set(x, GROUND_Y, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    live.push({ kind: 'bird', mesh, rand: seed, x, z, yaw, state: 'ground', hopT: 0.6 + seed() * 1.5, hopping: 0, t: 0 });
  }
}

function spawnChickens(screen, rand) {
  const spots = tilesWhere(screen, GROUND_CHARS);
  if (!spots.length) return;
  const n = Math.min(spots.length, MAX.chicken, 2 + Math.floor(rand() * 3));
  for (const [lx, lz] of pickSpots(spots, rand, n)) {
    const x = screen.x0 + lx + 0.5;
    const z = screen.z0 + lz + 0.5;
    const seed = rng(seedOf(`${screen.key}:hen:${lx},${lz}`));
    const { mesh, colors } = makeChicken(Math.floor(seed() * CHICKEN_VARIANTS.length));
    const yaw = seed() * Math.PI * 2;
    mesh.position.set(x, GROUND_Y, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    live.push({ kind: 'chicken', mesh, rand: seed, colors, x, z, yaw, anchor: { x, z }, state: 'idle', idleT: seed() * 2, bobT: 0 });
  }
}

function spawnChimneys(screen, rand) {
  for (const tiles of houseClusters(screen)) {
    const zs = tiles.map((t) => t[1]);
    const zMid = Math.round((Math.min(...zs) + Math.max(...zs)) / 2);
    const row = tiles.filter((t) => t[1] === zMid);
    const xs = row.map((t) => t[0]);
    const x = screen.x0 + (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5;
    const z = screen.z0 + zMid + 0.5;
    const seed = rng(seedOf(`${screen.key}:chimney:${x},${z}`));
    live.push({ kind: 'chimney', rand: seed, x, y: CHIMNEY_Y, z, t: seed() * 1.5 });
  }
}

function spawnScreen(screen) {
  clearAll();
  if (screen.area.rooms) return; // indoors and dungeon rooms: no ambient life
  const rand = rng(seedOf(screen.key));
  spawnButterflies(screen, rand);
  spawnBirds(screen, rand);
  if (screen.area.id === 'v1') {
    spawnChickens(screen, rand);
    spawnChimneys(screen, rand);
  }
}

on('screen-leave', clearAll);
on('room-enter', ({ screen }) => spawnScreen(screen));

// ---------------------------------------------------------------- per-frame behaviour
function updateButterfly(c, dt) {
  c.t += dt * c.speed;
  const a = c.phase + c.t;
  const nx = c.ax + Math.cos(a) * c.radius;
  const nz = c.az + Math.sin(a * 1.3) * c.radius * 0.7;
  const dx = nx - c.mesh.position.x;
  const dz = nz - c.mesh.position.z;
  if (dx * dx + dz * dz > 1e-6) c.mesh.rotation.y = Math.atan2(dx, dz);
  c.mesh.position.set(nx, GROUND_Y + 0.32 + Math.sin(c.t * 2.4) * 0.06, nz);
  c.flapT += dt;
  if (c.flapT > 0.08) {
    c.flapT = 0;
    c.mesh.setPose(c.mesh.pose === 'up' ? 'down' : 'up');
  }
}

function updateBird(c, dt) {
  if (c.state === 'ground') {
    const near = Math.hypot(player.x - c.x, player.z - c.z) < BIRD_FLEE;
    if (near) {
      c.state = 'flee';
      c.t = 0;
      c.mesh.setPose('spread');
      const a = Math.atan2(c.x - player.x, c.z - player.z);
      c.yaw = a;
      c.vx = Math.sin(a);
      c.vz = Math.cos(a);
      return;
    }
    c.hopT -= dt;
    if (c.hopT <= 0 && !c.hopping) {
      c.hopT = 1 + c.rand() * 1.8;
      c.hopping = 0.0001;
    }
    if (c.hopping) {
      c.hopping += dt;
      const k = Math.min(1, c.hopping / 0.3);
      c.mesh.position.y = GROUND_Y + Math.sin(k * Math.PI) * 0.05;
      if (k >= 1) c.hopping = 0;
    }
    c.mesh.position.x = c.x;
    c.mesh.position.z = c.z;
  } else {
    c.t += dt;
    const speed = 2.2 + c.t * 1.6;
    c.x += c.vx * speed * dt;
    c.z += c.vz * speed * dt;
    c.mesh.position.set(c.x, GROUND_Y + Math.min(1.3, c.t * 1.7), c.z);
    c.mesh.rotation.set(-0.5, c.yaw, 0);
    if (c.t > 1.1) c.dead = true;
  }
}

function updateChicken(c, dt) {
  const near = Math.hypot(player.x - c.x, player.z - c.z) < CHICKEN_FLEE;
  if (c.state !== 'scatter' && near) {
    c.state = 'scatter';
    c.scatterT = 0.5 + c.rand() * 0.5;
    const a = Math.atan2(c.x - player.x, c.z - player.z) + (c.rand() - 0.5) * 0.6;
    c.vx = Math.sin(a);
    c.vz = Math.cos(a);
    c.yaw = a;
    burst(c.x, GROUND_Y + 0.15, c.z, c.colors, 5, { speed: 1.6, size: 0.05, up: 1.6, life: 0.3 });
  }
  if (c.state === 'scatter') {
    c.scatterT -= dt;
    const nx = c.x + c.vx * 2.6 * dt;
    const nz = c.z + c.vz * 2.6 * dt;
    if (!world.blocked(nx, nz, 0.22)) {
      c.x = nx;
      c.z = nz;
    } else {
      c.vx *= -1;
      c.vz *= -1;
    }
    if (c.scatterT <= 0) {
      c.state = 'idle';
      c.idleT = 0.6 + c.rand() * 1.2;
      c.anchor = { x: c.x, z: c.z };
    }
  } else if (c.state === 'walk') {
    const dx = c.target.x - c.x;
    const dz = c.target.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.06) {
      c.state = 'idle';
      c.idleT = 0.8 + c.rand() * 2;
    } else {
      const step = Math.min(d, 0.55 * dt);
      const nx = c.x + (dx / d) * step;
      const nz = c.z + (dz / d) * step;
      if (!world.blocked(nx, nz, 0.22)) {
        c.x = nx;
        c.z = nz;
        c.yaw = Math.atan2(dx, dz);
      } else {
        c.state = 'idle';
        c.idleT = 0.5 + c.rand();
      }
    }
  } else {
    c.idleT -= dt;
    if (c.idleT <= 0) {
      if (c.rand() < 0.6) {
        const a = c.rand() * Math.PI * 2;
        const d = 0.4 + c.rand() * 1.2;
        const tx = c.anchor.x + Math.cos(a) * d;
        const tz = c.anchor.z + Math.sin(a) * d;
        if (!world.blocked(tx, tz, 0.22)) {
          c.state = 'walk';
          c.target = { x: tx, z: tz };
        } else c.idleT = 0.4 + c.rand();
      } else c.idleT = 0.6 + c.rand() * 1.5;
    }
  }
  c.bobT += dt;
  const bob = c.state === 'idle' ? 0 : Math.abs(Math.sin(c.bobT * 10)) * 0.03;
  c.mesh.position.set(c.x, GROUND_Y + bob, c.z);
  c.mesh.rotation.y = c.yaw ?? c.mesh.rotation.y;
}

function updateChimney(c, dt) {
  c.t -= dt;
  if (c.t <= 0) {
    c.t = 1.2 + c.rand() * 0.9;
    smoke(c.x, c.y, c.z, 4, { radius: 0.13, spread: 0.16, life: 1.5 });
  }
}

export function updateCritters(dt) {
  if (!live.length) return;
  let anyDead = false;
  for (const c of live) {
    if (c.kind === 'butterfly') updateButterfly(c, dt);
    else if (c.kind === 'bird') updateBird(c, dt);
    else if (c.kind === 'chicken') updateChicken(c, dt);
    else if (c.kind === 'chimney') updateChimney(c, dt);
    if (c.dead) anyDead = true;
  }
  if (anyDead)
    live = live.filter((c) => {
      if (!c.dead) return true;
      if (c.mesh) scene.remove(c.mesh);
      return false;
    });
}

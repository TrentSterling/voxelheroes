import * as THREE from 'three';
import './style.css';
import { World, GROUND_Y } from './world.js';
import { SCREEN_W, SCREEN_H, START_SCREEN, WARPS } from './maps.js';
import { makeHero, makeSlime, makeSpitter, makeRock, makeHeart, makeGem, makeKey } from './models.js';
import { voxelMaterial } from './voxel.js';
import { initAudio, sfx, toggleMute } from './audio.js';

const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10201a);
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

const hemi = new THREE.HemisphereLight(0xe4f2ff, 0x55603a, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const world = new World(scene);

// The crypt is dim and cool; the overworld is bright midday.
function applyAmbience() {
  const dark = world.screen(S.sx, S.sy).dark;
  scene.background.setHex(dark ? 0x0b0910 : 0x10201a);
  hemi.intensity = dark ? 0.9 : 1.5;
  hemi.color.setHex(dark ? 0x9fa8d8 : 0xe4f2ff);
  sun.intensity = dark ? 1.6 : 2.4;
  sun.color.setHex(dark ? 0xffc890 : 0xfff0d0);
}

const GEO = {
  slime: makeSlime(),
  slimeBlue: makeSlime(0x3f7fe0, 0x8ab8ff),
  key: makeKey(),
  spitter: makeSpitter(),
  rock: makeRock(),
  heart: makeHeart(),
  gemGreen: makeGem(0x2fd36b),
  gemBlue: makeGem(0x3a8ff0),
};

// ---------------------------------------------------------------- particles
// Everything that breaks bursts into little cubes, 3D Dot Game Heroes style.
const MAX_P = 800;
const pMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial(),
  MAX_P
);
pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
pMesh.frustumCulled = false;
pMesh.castShadow = true;
const particles = Array.from({ length: MAX_P }, () => ({ life: 0 }));
let pNext = 0;
const pColor = new THREE.Color();
const pMat = new THREE.Matrix4();
const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < MAX_P; i++) {
  pMesh.setMatrixAt(i, zeroMat);
  pMesh.setColorAt(i, pColor.set(0xffffff));
}
scene.add(pMesh);

function burst(x, y, z, colors, count, { speed = 3, size = 0.1, up = 4, life = 0.9 } = {}) {
  for (let i = 0; i < count; i++) {
    const p = particles[pNext];
    const idx = pNext;
    pNext = (pNext + 1) % MAX_P;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    Object.assign(p, {
      x, y, z,
      vx: Math.cos(a) * s,
      vz: Math.sin(a) * s,
      vy: up * (0.5 + Math.random()),
      life: life * (0.6 + Math.random() * 0.6),
      size: size * (0.7 + Math.random() * 0.6),
      spin: Math.random() * 6,
    });
    pMesh.setColorAt(idx, pColor.set(colors[i % colors.length]));
  }
  pMesh.instanceColor.needsUpdate = true;
}

const pQuat = new THREE.Quaternion();
const pEuler = new THREE.Euler();
const pPos = new THREE.Vector3();
const pScale = new THREE.Vector3();
function updateParticles(dt) {
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

// ---------------------------------------------------------------- state
const START_HP = 6; // three hearts, in halves
const S = {
  mode: 'title', // title | play | scroll | paused | dead
  sx: START_SCREEN[0],
  sy: START_SCREEN[1],
  hp: START_HP,
  maxHp: START_HP,
  gems: 0,
  keys: 0,
  time: 0,
  deadT: 0,
};

const hero = makeHero();
scene.add(hero.root);
hero.swordPivot.rotation.order = 'YXZ';

const player = {
  x: 0,
  z: 0,
  yaw: 0,
  r: 0.3,
  speed: 4.3,
  attackT: 0,
  swingId: 0,
  invT: 0,
  kx: 0,
  kz: 0,
  knockT: 0,
  walkT: 0,
};

let enemies = [];
let shots = [];
let pickups = [];
let trans = null;

const screenOrigin = (sx, sy) => ({ x: sx * SCREEN_W, z: sy * SCREEN_H });
const screenCenter = (sx, sy) => new THREE.Vector3(sx * SCREEN_W + SCREEN_W / 2, 0, sy * SCREEN_H + SCREEN_H / 2);

// ---------------------------------------------------------------- camera
const PITCH = 60 * DEG;
const camTarget = new THREE.Vector3();
let camDist = 24;

function fitCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const vf = (camera.fov * DEG) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const dW = (SCREEN_W / 2 + 0.3) / Math.tan(hf);
  const dH = ((SCREEN_H / 2) * Math.sin(PITCH) + 1.1) / Math.tan(vf);
  camDist = Math.max(dW, dH);
  camera.updateProjectionMatrix();
}

function placeCamera() {
  camera.position.set(
    camTarget.x,
    camTarget.y + Math.sin(PITCH) * camDist,
    camTarget.z + Math.cos(PITCH) * camDist
  );
  camera.lookAt(camTarget);
  sun.position.set(camTarget.x - 7, 20, camTarget.z + 9);
  sun.target.position.copy(camTarget);
}

window.addEventListener('resize', fitCamera);
fitCamera();

// ---------------------------------------------------------------- input
const keys = new Set();
const touch = { x: 0, z: 0 };
let attackQueued = false;
const ATTACK_KEYS = new Set(['Space', 'KeyJ', 'KeyK', 'KeyZ', 'KeyX']);
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (S.mode === 'title' || (S.mode === 'dead' && S.deadT > 1.2)) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      begin();
    }
    return;
  }
  if (ATTACK_KEYS.has(e.code)) attackQueued = true;
  if (e.code === 'KeyM') setMuted();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function readInput() {
  let x = touch.x;
  let z = touch.z;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) z -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) z += 1;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z, len: Math.min(1, len) };
}

// Touch: a virtual stick on the left and a sword button on the right.
const coarse = window.matchMedia('(pointer: coarse)').matches;
if (coarse) $('touch').hidden = false;
{
  const stick = $('stick');
  const knob = $('knob');
  let id = null;
  let cx = 0;
  let cy = 0;
  const R = 44;
  const move = (e) => {
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const dead = len < 8 ? 0 : 1;
    touch.x = ((dx * k) / R) * dead;
    touch.z = ((dy * k) / R) * dead;
  };
  stick.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    stick.setPointerCapture(id);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    move(e);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    touch.x = touch.z = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  $('btn-a').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    attackQueued = true;
  });
}

$('start').addEventListener('click', () => (S.mode === 'paused' ? togglePause() : begin()));
$('mute').addEventListener('click', (e) => {
  setMuted();
  e.currentTarget.blur();
});

function setMuted() {
  const m = toggleMute();
  $('mute').textContent = m ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(m));
}

// ---------------------------------------------------------------- HUD
const HEART_ROWS = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function heartSVG(fill) {
  let rects = '';
  HEART_ROWS.forEach((row, y) =>
    row.split('').forEach((ch, x) => {
      if (ch !== 'X') return;
      const on = fill === 2 || (fill === 1 && x <= 3);
      const hi = on && x === 1 && y === 1;
      const c = hi ? '#ffb0bc' : on ? '#e8364a' : '#3b2a2f';
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    })
  );
  return `<svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

function updateHud() {
  let html = '';
  for (let i = 0; i < S.maxHp / 2; i++) {
    const v = S.hp - i * 2;
    html += heartSVG(v >= 2 ? 2 : v === 1 ? 1 : 0);
  }
  $('hearts').innerHTML = html;
  $('hearts').setAttribute('aria-label', `Health ${S.hp / 2} of ${S.maxHp / 2} hearts`);
  $('gems').textContent = String(S.gems);
  $('keys').hidden = S.keys === 0;
  $('key-count').textContent = String(S.keys);
  $('area').textContent = world.screen(S.sx, S.sy).name;
}

let bannerTimer = 0;
function showBanner(text) {
  const b = $('banner');
  b.hidden = true;
  b.textContent = text;
  void b.offsetWidth; // restart the CSS animation
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (b.hidden = true), 2300);
}

function showOverlay(title, msg, button, kicker) {
  $('overlay-title').textContent = title;
  $('overlay-msg').textContent = msg;
  $('start').textContent = button;
  document.querySelector('#overlay .kicker').textContent = kicker;
  $('overlay').hidden = false;
}

// ---------------------------------------------------------------- flow
function placePlayerAtStart() {
  S.sx = START_SCREEN[0];
  S.sy = START_SCREEN[1];
  const c = screenCenter(S.sx, S.sy);
  player.x = c.x;
  player.z = c.z;
  player.yaw = 0;
  camTarget.copy(c);
}

function begin() {
  initAudio();
  if (S.mode === 'dead') {
    S.hp = S.maxHp;
    clearScreen();
    placePlayerAtStart();
    world.regrowBushes(world.screen(S.sx, S.sy));
    applyAmbience();
    hero.root.rotation.set(0, 0, 0);
    hero.root.position.y = GROUND_Y;
  }
  $('overlay').hidden = true;
  S.mode = 'play';
  player.invT = 1;
  sfx.start();
  enterScreen();
  updateHud();
}

function togglePause() {
  if (S.mode === 'play') {
    S.mode = 'paused';
    showOverlay('Paused', 'Take a breather. The slimes will wait.', 'Resume', world.screen(S.sx, S.sy).name);
  } else if (S.mode === 'paused') {
    S.mode = 'play';
    $('overlay').hidden = true;
  }
}

function clearScreen() {
  for (const e of enemies) scene.remove(e.holder);
  for (const s of shots) scene.remove(s.mesh);
  for (const p of pickups) scene.remove(p.mesh);
  enemies = [];
  shots = [];
  pickups = [];
}

function enterScreen() {
  const screen = world.screen(S.sx, S.sy);
  screen.spawns.forEach((sp, i) => spawnEnemy(sp.type, S.sx * SCREEN_W + sp.x, S.sy * SCREEN_H + sp.z, 0.35 + i * 0.12));
  if (screen.keySpot && !world.flags.has(`key:${S.sx},${S.sy}`))
    addPickup('key', S.sx * SCREEN_W + screen.keySpot.x + 0.5, S.sy * SCREEN_H + screen.keySpot.z + 0.5);
  applyAmbience();
  showBanner(screen.name);
  updateHud();
}

function startTransition(dx, dz) {
  const next = world.screen(S.sx + dx, S.sy + dz);
  if (!next) return;
  clearScreen();
  S.mode = 'scroll';
  trans = {
    t: 0,
    dur: 0.85,
    fromCam: camTarget.clone(),
    toCam: screenCenter(S.sx + dx, S.sy + dz),
    px0: player.x,
    pz0: player.z,
    px1: player.x + dx * 1.1,
    pz1: player.z + dz * 1.1,
  };
  S.sx += dx;
  S.sy += dz;
  world.regrowBushes(next);
  sfx.scroll();
}

let warp = null;
function startWarp(dest) {
  S.mode = 'warp';
  warp = { t: 0, dest, moved: false };
  sfx.scroll();
}

function updateWarp(dt) {
  warp.t += dt;
  const fade = warp.t < 0.4 ? warp.t / 0.4 : Math.max(0, 1 - (warp.t - 0.55) / 0.4);
  $('fade').style.opacity = String(Math.min(1, fade));
  if (!warp.moved && warp.t >= 0.45) {
    warp.moved = true;
    clearScreen();
    const d = warp.dest;
    S.sx = d.sx;
    S.sy = d.sy;
    player.x = d.sx * SCREEN_W + d.x;
    player.z = d.sy * SCREEN_H + d.z;
    player.yaw = d.yaw;
    camTarget.copy(screenCenter(S.sx, S.sy));
    world.regrowBushes(world.screen(S.sx, S.sy));
    applyAmbience();
    updateHud();
  }
  animateHero(dt, false);
  if (warp.t >= 0.95) {
    $('fade').style.opacity = '0';
    warp = null;
    S.mode = 'play';
    enterScreen();
  }
}

// ---------------------------------------------------------------- enemies
const ENEMY = {
  slime: { hp: 2, r: 0.34, speed: 1.4, colors: [0xe0404a, 0xff8088, 0xb02a36] },
  spitter: { hp: 3, r: 0.36, speed: 1.6, colors: [0x8e4fd0, 0xb07ae8, 0x5d2e94] },
};

function spawnEnemy(type, tx, tz, delay) {
  const def = ENEMY[type];
  const dark = world.screen(S.sx, S.sy).dark;
  const blue = dark && type === 'slime';
  const mat = voxelMaterial.clone();
  const mesh = new THREE.Mesh(type === 'slime' ? (blue ? GEO.slimeBlue : GEO.slime) : GEO.spitter, mat);
  mesh.castShadow = true;
  const holder = new THREE.Group();
  holder.add(mesh);
  holder.scale.setScalar(0.001);
  holder.position.set(tx + 0.5, GROUND_Y, tz + 0.5);
  scene.add(holder);
  enemies.push({
    type,
    x: tx + 0.5,
    z: tz + 0.5,
    r: def.r,
    hp: def.hp,
    speed: def.speed,
    colors: blue ? [0x3f7fe0, 0x8ab8ff, 0x2a55a8] : def.colors,
    mesh,
    holder,
    mat,
    dx: 0,
    dz: 0,
    yaw: Math.random() * Math.PI * 2,
    thinkT: 0.5 + Math.random(),
    hopT: Math.random() * 3,
    kx: 0,
    kz: 0,
    stunT: 0,
    flashT: 0,
    spawnT: delay,
    spawned: false,
    state: 'walk',
    aimT: 0,
    hitSwing: -1,
  });
}

function moveBody(b, dx, dz, bounds) {
  let hit = false;
  const inside = (x, z) =>
    !bounds || (x - b.r >= bounds.x && x + b.r <= bounds.x + SCREEN_W && z - b.r >= bounds.z && z + b.r <= bounds.z + SCREEN_H);
  if (dx) {
    const nx = b.x + dx;
    if (!world.blocked(nx, b.z, b.r) && inside(nx, b.z)) b.x = nx;
    else hit = true;
  }
  if (dz) {
    const nz = b.z + dz;
    if (!world.blocked(b.x, nz, b.r) && inside(b.x, nz)) b.z = nz;
    else hit = true;
  }
  return hit;
}

const CARDINALS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function updateEnemy(e, dt) {
  if (!e.spawned) {
    e.spawnT -= dt;
    if (e.spawnT <= 0) {
      e.spawned = true;
      e.growT = 0;
      burst(e.x, GROUND_Y + 0.3, e.z, [0xffffff, 0xdddddd, 0xbbbbbb], 12, { speed: 2, up: 2, size: 0.09, life: 0.5 });
    }
    return;
  }
  if (e.growT < 1) {
    e.growT = Math.min(1, e.growT + dt * 4);
    e.holder.scale.setScalar(e.growT);
  }

  const bounds = screenOrigin(S.sx, S.sy);
  const toP = { x: player.x - e.x, z: player.z - e.z };
  const dist = Math.hypot(toP.x, toP.z);

  if (e.stunT > 0) {
    e.stunT -= dt;
    moveBody(e, e.kx * dt, e.kz * dt, bounds);
    e.kx *= 0.85;
    e.kz *= 0.85;
  } else if (e.type === 'slime') {
    e.thinkT -= dt;
    if (e.thinkT <= 0) {
      e.thinkT = 0.7 + Math.random() * 1.1;
      if (dist < 5 && Math.random() < 0.65) {
        e.dx = toP.x / dist;
        e.dz = toP.z / dist;
      } else if (Math.random() < 0.25) {
        e.dx = e.dz = 0;
      } else {
        const a = Math.random() * Math.PI * 2;
        e.dx = Math.cos(a);
        e.dz = Math.sin(a);
      }
    }
    e.hopT += dt * 8;
    const moving = e.dx || e.dz;
    const hop = moving ? Math.abs(Math.sin(e.hopT)) : 0;
    if (moving && moveBody(e, e.dx * e.speed * dt * (0.4 + hop), e.dz * e.speed * dt * (0.4 + hop), bounds)) e.thinkT = 0;
    if (moving) e.yaw = Math.atan2(e.dx, e.dz);
    e.mesh.position.y = hop * 0.18;
    const sq = moving ? 1 + Math.sin(e.hopT * 2) * 0.1 : 1 + Math.sin(S.time * 4) * 0.05;
    e.mesh.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  } else {
    // Spitter: walk in a cardinal direction, stop, face the hero, spit a rock.
    e.thinkT -= dt;
    if (e.state === 'walk') {
      if (e.thinkT <= 0) {
        e.state = 'aim';
        e.aimT = 0.55;
        const horiz = Math.abs(toP.x) > Math.abs(toP.z);
        e.yaw = horiz ? (toP.x > 0 ? 90 : -90) * DEG : toP.z > 0 ? 0 : Math.PI;
      } else {
        e.hopT += dt * 10;
        if (moveBody(e, e.dx * e.speed * dt, e.dz * e.speed * dt, bounds)) {
          const [cx, cz] = CARDINALS[Math.floor(Math.random() * 4)];
          e.dx = cx;
          e.dz = cz;
        }
        if (e.dx || e.dz) e.yaw = Math.atan2(e.dx, e.dz);
        e.mesh.position.y = Math.abs(Math.sin(e.hopT)) * 0.05;
      }
    } else {
      e.aimT -= dt;
      e.mesh.scale.setScalar(1 + Math.max(0, 0.3 - e.aimT) * 0.4);
      if (e.aimT <= 0) {
        e.mesh.scale.setScalar(1);
        if (dist < 9) fireRock(e);
        e.state = 'walk';
        e.thinkT = 1.2 + Math.random() * 1.5;
        const [cx, cz] = CARDINALS[Math.floor(Math.random() * 4)];
        e.dx = cx;
        e.dz = cz;
      }
    }
  }

  e.holder.position.set(e.x, GROUND_Y, e.z);
  e.holder.rotation.y = lerpAngle(e.holder.rotation.y, e.yaw, Math.min(1, dt * 12));

  if (e.flashT > 0) {
    e.flashT -= dt;
    e.mat.emissive.setHex(e.flashT > 0 ? 0xffffff : 0x000000);
  }

  if (dist < e.r + player.r && player.invT <= 0 && S.mode === 'play') hurtPlayer(1, e.x, e.z);
}

function damageEnemy(e) {
  e.hp -= 1;
  e.hitSwing = player.swingId;
  e.flashT = 0.14;
  e.stunT = 0.28;
  const dx = e.x - player.x;
  const dz = e.z - player.z;
  const d = Math.hypot(dx, dz) || 1;
  e.kx = (dx / d) * 9;
  e.kz = (dz / d) * 9;
  burst(e.x, GROUND_Y + 0.35, e.z, [0xffffff, 0xfff3b0], 6, { speed: 2.5, size: 0.06, life: 0.35, up: 3 });
  if (e.hp <= 0) {
    killEnemy(e);
  } else {
    sfx.hit();
  }
}

function killEnemy(e) {
  scene.remove(e.holder);
  enemies = enemies.filter((x) => x !== e);
  burst(e.x, GROUND_Y + 0.35, e.z, e.colors, 34, { speed: 3.5, size: 0.12, up: 5, life: 1.1 });
  sfx.kill();
  maybeDrop(e.x, e.z, 0.25, 0.45);
}

function fireRock(e) {
  const dx = Math.sin(e.yaw);
  const dz = Math.cos(e.yaw);
  const mesh = new THREE.Mesh(GEO.rock, voxelMaterial);
  mesh.castShadow = true;
  scene.add(mesh);
  shots.push({ x: e.x + dx * 0.55, z: e.z + dz * 0.55, vx: dx * 5.5, vz: dz * 5.5, mesh, spin: 0 });
  sfx.shoot();
}

function removeShot(s, colors = [0xb4a894, 0x8a7e6c]) {
  scene.remove(s.mesh);
  shots = shots.filter((x) => x !== s);
  burst(s.x, GROUND_Y + 0.3, s.z, colors, 8, { speed: 2, size: 0.07, life: 0.5, up: 3 });
}

function updateShots(dt) {
  const b = screenOrigin(S.sx, S.sy);
  for (const s of [...shots]) {
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.spin += dt * 12;
    s.mesh.position.set(s.x, GROUND_Y + 0.35, s.z);
    s.mesh.rotation.set(s.spin, s.spin * 0.5, 0);
    const out = s.x < b.x || s.x > b.x + SCREEN_W || s.z < b.z || s.z > b.z + SCREEN_H;
    const t = world.tile(Math.floor(s.x), Math.floor(s.z));
    if (out || (t !== '~' && world.isSolid(Math.floor(s.x), Math.floor(s.z)))) {
      removeShot(s);
      continue;
    }
    if (Math.hypot(s.x - player.x, s.z - player.z) < 0.42 && S.mode === 'play') {
      // The shield blocks shots coming from straight ahead.
      const fx = Math.sin(player.yaw);
      const fz = Math.cos(player.yaw);
      const sp = Math.hypot(s.vx, s.vz);
      const facing = -(fx * s.vx + fz * s.vz) / sp;
      if (player.attackT <= 0 && facing > 0.7) {
        sfx.block();
        removeShot(s, [0xffffff, 0xf1c232]);
      } else if (player.invT <= 0) {
        removeShot(s);
        hurtPlayer(1, s.x - s.vx, s.z - s.vz);
      }
    }
  }
}

// ---------------------------------------------------------------- pickups
function maybeDrop(x, z, heartChance, gemChance) {
  const r = Math.random();
  if (r < heartChance && S.hp < S.maxHp) addPickup('heart', x, z);
  else if (r < heartChance + gemChance) addPickup(Math.random() < 0.15 ? 'gem5' : 'gem', x, z);
}

function addPickup(type, x, z) {
  const geo = type === 'key' ? GEO.key : type === 'heart' ? GEO.heart : type === 'gem5' ? GEO.gemBlue : GEO.gemGreen;
  const mesh = new THREE.Mesh(geo, voxelMaterial);
  mesh.castShadow = true;
  scene.add(mesh);
  pickups.push({ type, x, z, mesh, t: 0, life: type === 'key' ? Infinity : 9 });
}

function updatePickups(dt) {
  for (const p of [...pickups]) {
    p.t += dt;
    p.life -= dt;
    const pop = Math.min(1, p.t * 3);
    p.mesh.position.set(p.x, GROUND_Y + 0.12 + Math.abs(Math.sin(p.t * 3)) * 0.12 * (p.t < 0.6 ? 3 : 1), p.z);
    p.mesh.rotation.y = p.t * 2.5;
    p.mesh.scale.setScalar(pop);
    p.mesh.visible = p.life > 2 || Math.floor(p.life * 8) % 2 === 0;
    const got = p.t > 0.25 && Math.hypot(p.x - player.x, p.z - player.z) < 0.6 && S.mode === 'play';
    if (got) {
      if (p.type === 'key') {
        S.keys += 1;
        world.flags.add(`key:${S.sx},${S.sy}`);
        sfx.fanfare();
        showBanner('Found a small key');
      } else if (p.type === 'heart') {
        S.hp = Math.min(S.maxHp, S.hp + 2);
        sfx.heart();
      } else {
        S.gems += p.type === 'gem5' ? 5 : 1;
        sfx.gem();
      }
      updateHud();
    }
    if (got || p.life <= 0) {
      scene.remove(p.mesh);
      pickups = pickups.filter((x) => x !== p);
    }
  }
}

// ---------------------------------------------------------------- player
const SWING = 0.24;
const RECOVER = 0.08;

function hurtPlayer(dmg, fromX, fromZ) {
  S.hp = Math.max(0, S.hp - dmg);
  player.invT = 1.1;
  const dx = player.x - fromX;
  const dz = player.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  player.kx = (dx / d) * 8;
  player.kz = (dz / d) * 8;
  player.knockT = 0.18;
  sfx.hurt();
  burst(player.x, GROUND_Y + 0.5, player.z, [0xe8364a, 0xffffff], 8, { speed: 2, size: 0.07, life: 0.4 });
  updateHud();
  if (S.hp <= 0) {
    S.mode = 'dead';
    S.deadT = 0;
    player.attackT = 0;
    sfx.over();
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function swingHitTest(angle) {
  const wa = player.yaw + angle;
  const dx = Math.sin(wa);
  const dz = Math.cos(wa);
  for (const r of [0.4, 0.7, 1.0, 1.3]) {
    const px = player.x + dx * r;
    const pz = player.z + dz * r;
    for (const e of [...enemies]) {
      if (!e.spawned || e.hitSwing === player.swingId) continue;
      if (Math.hypot(px - e.x, pz - e.z) < e.r + 0.14) damageEnemy(e);
    }
    for (const s of [...shots]) {
      if (Math.hypot(px - s.x, pz - s.z) < 0.3) {
        sfx.block();
        removeShot(s, [0xffffff, 0xf1c232]);
      }
    }
    const tx = Math.floor(px);
    const tz = Math.floor(pz);
    if (world.tile(tx, tz) === 'B' && world.cutBush(tx, tz)) {
      sfx.cut();
      burst(tx + 0.5, GROUND_Y + 0.3, tz + 0.5, [0x3c9440, 0x57b152, 0x2f7a33, 0xd8334a], 26, {
        speed: 3,
        size: 0.1,
        up: 4,
      });
      maybeDrop(tx + 0.5, tz + 0.5, 0.12, 0.3);
    }
  }
}

function updatePlayer(dt) {
  const input = readInput();

  if (player.invT > 0) player.invT -= dt;
  if (attackQueued && player.attackT <= 0) {
    player.attackT = SWING + RECOVER;
    player.swingId++;
    sfx.swing();
  }
  attackQueued = false;

  let vx = 0;
  let vz = 0;
  if (player.knockT > 0) {
    player.knockT -= dt;
    vx = player.kx;
    vz = player.kz;
  } else if (player.attackT <= 0) {
    vx = input.x * player.speed;
    vz = input.z * player.speed;
    if (input.len > 0.1) player.yaw = lerpAngle(player.yaw, Math.atan2(input.x, input.z), Math.min(1, dt * 18));
  }
  moveBody(player, vx * dt, vz * dt, null);

  // Crossing the screen edge scrolls to the next screen.
  const o = screenOrigin(S.sx, S.sy);
  if (player.x < o.x) startTransition(-1, 0);
  else if (player.x > o.x + SCREEN_W) startTransition(1, 0);
  else if (player.z < o.z) startTransition(0, -1);
  else if (player.z > o.z + SCREEN_H) startTransition(0, 1);

  if (S.mode === 'play') {
    // Warps: the crypt doorway and the stairs back out.
    const under = world.tile(Math.floor(player.x), Math.floor(player.z));
    if (WARPS[under]) startWarp(WARPS[under]);

    // Push against a locked door with a key, or a chest, to open it.
    if (input.len > 0.1 && player.attackT <= 0) {
      const fx = Math.floor(player.x + Math.sin(player.yaw) * 0.55);
      const fz = Math.floor(player.z + Math.cos(player.yaw) * 0.55);
      const ahead = world.tile(fx, fz);
      if (ahead === 'L' && S.keys > 0 && world.openDoor(fx, fz)) {
        S.keys -= 1;
        sfx.door();
        burst(fx + 0.5, GROUND_Y + 0.6, fz + 0.5, [0x7a4a26, 0x5e371b, 0x3a3a44], 30, { speed: 3, size: 0.1, up: 4 });
        updateHud();
      } else if (ahead === 'C' && world.openChest(fx, fz)) {
        S.maxHp += 2;
        S.hp = S.maxHp;
        sfx.fanfare();
        burst(fx + 0.5, GROUND_Y + 0.8, fz + 0.5, [0xf1c232, 0xffffff, 0xe8364a], 40, { speed: 2.5, size: 0.08, up: 6, life: 1.3 });
        showBanner('Heart container! Max health up');
        updateHud();
      }
    }
  }

  const moving = Math.hypot(vx, vz) > 0.2 && player.knockT <= 0;
  animateHero(dt, moving);

  if (player.attackT > 0) {
    player.attackT -= dt;
    const p = Math.min(1, (SWING + RECOVER - player.attackT) / SWING);
    if (p < 1) swingHitTest(hero.swordPivot.rotation.y);
  }
}

function animateHero(dt, moving) {
  if (moving) player.walkT += dt * 13;
  else player.walkT = 0;
  const w = Math.sin(player.walkT);
  hero.legL.rotation.x = w * 0.7;
  hero.legR.rotation.x = -w * 0.7;
  hero.armL.rotation.x = -w * 0.3;
  hero.body.position.y = Math.abs(Math.sin(player.walkT)) * 0.04;

  if (player.attackT > 0) {
    const p = Math.min(1, (SWING + RECOVER - player.attackT) / SWING);
    const k = 1 - Math.pow(1 - p, 3);
    hero.swordPivot.rotation.y = -1.9 + k * 3.5;
    hero.swordPivot.rotation.x = 0.12;
    hero.armR.rotation.x = -1.3;
    hero.armR.rotation.z = 0;
    hero.body.rotation.y = -0.35 + k * 0.7;
  } else {
    hero.swordPivot.rotation.y = -0.95;
    hero.swordPivot.rotation.x = -1.05 + w * 0.08;
    hero.armR.rotation.x = w * 0.5 - 0.3;
    hero.body.rotation.y = 0;
  }

  hero.root.position.set(player.x, GROUND_Y, player.z);
  hero.root.rotation.y = player.yaw;
  hero.root.visible = player.invT <= 0 || S.mode === 'dead' || Math.floor(player.invT * 16) % 2 === 0;
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();

function update(dt) {
  S.time += dt;
  world.update(S.time, dt);

  if (S.mode === 'play') {
    updatePlayer(dt);
    for (const e of [...enemies]) updateEnemy(e, dt);
    updateShots(dt);
    updatePickups(dt);
  } else if (S.mode === 'warp') {
    updateWarp(dt);
    updateParticles(dt);
    placeCamera();
    return;
  } else if (S.mode === 'scroll') {
    trans.t += dt;
    const k = Math.min(1, trans.t / trans.dur);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camTarget.lerpVectors(trans.fromCam, trans.toCam, ease);
    player.x = trans.px0 + (trans.px1 - trans.px0) * k;
    player.z = trans.pz0 + (trans.pz1 - trans.pz0) * k;
    animateHero(dt, true);
    if (k >= 1) {
      S.mode = 'play';
      trans = null;
      enterScreen();
    }
  } else if (S.mode === 'dead') {
    S.deadT += dt;
    const k = Math.min(1, S.deadT / 0.5);
    hero.root.rotation.z = k * (Math.PI / 2);
    hero.root.position.y = GROUND_Y + 0.25 * k;
    hero.root.visible = true;
    for (const e of enemies) {
      e.holder.rotation.y += dt * 2;
    }
    if (S.deadT > 1.2 && $('overlay').hidden) {
      showOverlay('You fell', `You collected ${S.gems} gem${S.gems === 1 ? '' : 's'}. Get back up and try again from the Crossroads.`, 'Try again', 'Game over');
    }
  } else if (S.mode === 'title') {
    // Idle on the title screen: the hero looks around.
    player.yaw = Math.sin(S.time * 0.8) * 0.6;
    animateHero(dt, false);
  }

  updateParticles(dt);
  placeCamera();
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  update(dt);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- boot
function start(data = {}) {
  placePlayerAtStart();
  if (data && data.mode && data.mode !== 'title' && world.screen(data.sx, data.sy)) {
    S.sx = data.sx;
    S.sy = data.sy;
    S.hp = Math.max(1, data.hp);
    S.gems = data.gems;
    S.maxHp = data.maxHp || START_HP;
    S.keys = data.keys || 0;
    player.x = data.px;
    player.z = data.pz;
    camTarget.copy(screenCenter(S.sx, S.sy));
    $('overlay').hidden = true;
    S.mode = 'play';
    enterScreen();
  }
  updateHud();
  placeCamera();
  frame();
}

const hot = window.claude?.hot;
try {
  hot?.snapshot?.(() => ({
    mode: S.mode === 'scroll' || S.mode === 'dead' ? 'title' : S.mode,
    sx: S.sx,
    sy: S.sy,
    hp: S.hp,
    maxHp: S.maxHp,
    keys: S.keys,
    gems: S.gems,
    px: player.x,
    pz: player.z,
  }));
} catch {
  // hot reload is optional
}
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

// Exposed for automated play-testing.
window.__voxelHeroes = { S, player, update, camTarget, screenCenter, get enemies() { return enemies; }, world };

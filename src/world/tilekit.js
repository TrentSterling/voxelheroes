// Shared pieces for tile definitions: prop factories and hook behaviours that
// more than one tileset uses (a chest works outdoors as well as in a crypt).
//
// Props are separate meshes standing on a tile (world.addProp): things that move, open, flicker or
// get cut. Models come from src/models/props.js; characters, props and pickups use the shared
// character material, the bush (a terrain-resolution model) the terrain material, flames a glow
// material.
import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import { hash3 } from '../core/vox.js';
import { getMaterial, makeGlowMaterial } from '../core/materials.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { hasFlag, setFlag } from '../core/state.js';
import { modelMesh, PoseMesh } from '../models/kit.js';
import {
  bushModel,
  doorModel,
  flameModel,
  chestBaseModel,
  chestLidModel,
  spikeBallModel,
  pushBlockModel,
  potModel,
  FLAME_Y,
} from '../models/props.js';
import { burst, sparks, smoke } from '../systems/particles.js';
import { liveEntities } from '../entities/manager.js';
import { tilesetFloor } from './tiles.js';
import { rollDrop } from '../systems/drops.js';
import { keyCount, useKey } from '../systems/keys.js';
import { grant } from '../systems/grants.js';
import { showBanner } from '../ui/banner.js';

const V = 1 / 16; // character voxel

// ---------------------------------------------------------------- props
// A cuttable bush: one of four terrain-resolution lumps, turned by a quarter.
export function bushProp(ctx) {
  const m = bushModel(Math.floor(hash3(ctx.tx, 1, ctx.tz, 8) * 4));
  const obj = modelMesh(m, getMaterial('terrain'));
  obj.rotation.y = Math.floor(hash3(ctx.tx, 2, ctx.tz, 8) * 4) * (Math.PI / 2);
  obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
  obj.userData.colors = m.colors;
  return obj;
}

// Any cached model standing on the tile centre (pots, spike balls, push blocks).
export function modelProp(make, { material = getMaterial('character'), y = 0 } = {}) {
  return (ctx) => {
    const m = make(ctx);
    const obj = modelMesh(m, material);
    obj.position.set(ctx.cx, GROUND_Y + y, ctx.cz);
    obj.userData.colors = m.colors;
    return obj;
  };
}
export const potProp = modelProp(potModel);
export const spikeBallProp = modelProp(spikeBallModel);
export const pushBlockProp = modelProp(pushBlockModel);

// Where a doorway tile's wall has its inner face, and which way the room lies: { x, z, yaw } with
// yaw 0 for a door in the north wall (the room is to the south, +z). Room areas draw their side
// walls half a tile inward (world/tiles/dungeon.js).
export function wallFace(ctx) {
  const { screen, x, z, tx, tz } = ctx;
  const w = screen.w ?? screen.tiles[0].length;
  const h = screen.h ?? screen.tiles.length;
  const inset = screen.area?.rooms ? 0.5 : 0;
  if (z === 0) return { x: tx + 0.5, z: tz + 1, yaw: 0, along: [1, 0] };
  if (z === h - 1) return { x: tx + 0.5, z: tz, yaw: Math.PI, along: [-1, 0] };
  if (x === 0) return { x: tx + 1 + inset, z: tz + 0.5, yaw: Math.PI / 2, along: [0, -1] };
  if (x === w - 1) return { x: tx - inset, z: tz + 0.5, yaw: -Math.PI / 2, along: [0, 1] };
  return { x: tx + 0.5, z: tz + 1, yaw: 0, along: [1, 0] };
}

// A locked door: a leaf one tile wide and the full wall height, flush with the wall's inner face.
// Two door tiles side by side make a pair, lock plates meeting in the middle.
export function doorProp(ctx) {
  const f = wallFace(ctx);
  // the leaf's local +x runs along `along`; the neighbour on its -x side makes it the second leaf
  const second = ctx.world.tile(ctx.tx - f.along[0], ctx.tz - f.along[1]) === ctx.ch;
  const obj = modelMesh(doorModel(second));
  obj.position.set(f.x, GROUND_Y, f.z);
  obj.rotation.y = f.yaw;
  obj.userData.colors = doorModel(false).colors;
  return obj;
}

// A flickering flame on a brazier: two glowing frames swapped at ~7 fps, gently breathing.
// Glow 1.3: bright enough to bloom, low enough that the tone curve keeps it saturated yellow and
// orange (at 2.2 it rolled off to a pale cream blob; the references' flames never burn to white).
let flameMat = null;
function flameMaterial() {
  if (!flameMat) {
    flameMat = makeGlowMaterial(0xffffff, 1.3);
    flameMat.vertexColors = true; // the flame model carries its own colours
  }
  return flameMat;
}

export function flameProp(ctx) {
  const obj = new PoseMesh({ a: flameModel(0), b: flameModel(1) }, flameMaterial());
  obj.castShadow = false;
  obj.receiveShadow = false;
  obj.userData.noShadow = true;
  obj.position.set(ctx.cx, GROUND_Y + FLAME_Y * V, ctx.cz);
  const p = hash3(ctx.tx, 3, ctx.tz, 5) * 10;
  obj.userData.tick = (t) => {
    obj.setPose(Math.floor(t * 7 + p) % 2 ? 'b' : 'a');
    const s = 1 + Math.sin(t * 11 + p) * 0.05;
    obj.scale.set(s, 1 + Math.sin(t * 8 + p * 2) * 0.08, s);
  };
  return obj;
}

export const chestFlag = (tx, tz) => `chest:${tx},${tz}`;

// A chest: base and lid, the lid hinged on its back edge.
export function chestProp(ctx) {
  const obj = new THREE.Group();
  const base = modelMesh(chestBaseModel());
  const lid = modelMesh(chestLidModel());
  lid.position.set(0, 7 * V, -6 * V);
  obj.add(base, lid);
  obj.userData.lid = lid;
  obj.userData.colors = chestBaseModel().colors;
  obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
  if (hasFlag(chestFlag(ctx.tx, ctx.tz))) lid.rotation.x = -1.9;
  obj.userData.tick = (t, dt) => {
    if (obj.userData.opening) lid.rotation.x = Math.max(-1.9, lid.rotation.x - dt * 6);
  };
  return obj;
}

// ---------------------------------------------------------------- behaviours
// onSword for plants: cut the tile to def.becomes, burst, roll a drop table.
export function cutPlant(ctx, colors, drops = 'bush') {
  const { world, tx, tz, def } = ctx;
  const cols = world.propAt(tx, tz)?.userData.colors ?? colors;
  if (!world.setTile(tx, tz, def.becomes ?? '.', { rebuild: false, reason: 'cut' })) return false;
  sfx.cut();
  burst(tx + 0.5, GROUND_Y + 0.3, tz + 0.5, cols, 26, { speed: 3, size: 0.1, up: 4 });
  rollDrop(drops, tx + 0.5, tz + 0.5);
  return true;
}

// A pot shatters: its own colours in a big burst of cubes and shards, a crack of pottery, the pot
// drop roll (drops.js 'pot': heart, coin, magic, ten coins).
export function breakPot(ctx) {
  const { world, tx, tz, def } = ctx;
  const cols = world.propAt(tx, tz)?.userData.colors ?? [0xb86a3a, 0x8a4a2a, 0xd08a50];
  if (!world.setTile(tx, tz, def.becomes ?? '.', { rebuild: false, reason: 'break' })) return false;
  sfx.shatter?.() ?? sfx.cut();
  burst(tx + 0.5, GROUND_Y + 0.35, tz + 0.5, cols, 36, { speed: 3.6, size: 0.11, up: 4.5 });
  sparks(tx + 0.5, GROUND_Y + 0.3, tz + 0.5, [0xffffff, 0xf0d0a0], 8, { speed: 3, size: 0.05, up: 3, life: 0.3 });
  rollDrop('pot', tx + 0.5, tz + 0.5);
  return true;
}

// onPush for statues and push blocks (gameplay spec 6.4: pushed like a block): leaning on it for
// PUSH_TIME slides it one tile away from the hero onto open floor (the tileset's floor char, no
// one standing there). It is back in place on the next visit to the room (regrow).
const PUSH_TIME = 0.4;
const pushing = { key: null, t: 0 };
export function pushTile(ctx) {
  const { world, tx, tz, ch, player, dt = 1 / 60 } = ctx;
  const key = `${tx},${tz}`;
  if (pushing.key !== key) Object.assign(pushing, { key, t: 0 });
  pushing.t += dt;
  if (pushing.t < PUSH_TIME) return false;
  pushing.key = null;
  const dx = tx + 0.5 - player.x;
  const dz = tz + 0.5 - player.z;
  const [sx, sz] = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
  const floor = tilesetFloor(ctx.screen.tileset) ?? '.';
  const nx = tx + sx;
  const nz = tz + sz;
  if (world.tile(nx, nz) !== floor || world.locate(nx, nz)?.screen !== ctx.screen) return false;
  for (const e of liveEntities()) if (e.solid !== false && e.kind !== 'pickup' && Math.floor(e.x) === nx && Math.floor(e.z) === nz) return false;
  world.setTile(nx, nz, ch, { reason: 'push' });
  world.setTile(tx, tz, floor, { reason: 'push' });
  sfx.push?.() ?? sfx.block();
  smoke(tx + 0.5 + sx * 0.5, GROUND_Y + 0.05, tz + 0.5 + sz * 0.5, 4, { radius: 0.1, spread: 0.3, life: 0.4 });
  emit('tile-pushed', { from: [tx, tz], to: [nx, nz], ch });
  return true;
}

// onPush for locked doors: spend a key of this dungeon to open the door and
// its twin beside it. Stays open (persisted).
export function unlockDoor(ctx) {
  const { world, tx, tz, def, ch } = ctx;
  if (keyCount() <= 0) return false;
  const to = def.becomes ?? '.';
  const opts = { rebuild: false, persist: true, reason: 'unlock' };
  world.setTile(tx, tz, to, opts);
  setFlag(`door:${tx},${tz}`);
  for (const dx of [-1, 1])
    if (world.tile(tx + dx, tz) === ch && world.setTile(tx + dx, tz, to, opts)) setFlag(`door:${tx + dx},${tz}`);
  useKey();
  sfx.door();
  burst(tx + 0.5, GROUND_Y + 0.6, tz + 0.5, doorModel(false).colors, 30, { speed: 3, size: 0.1, up: 4 });
  emit('door-opened', { tx, tz });
  return true;
}

// What a chest holds: screen.chests['x,z'] or screen.chest, as grant() takes it.
export const chestContents = (ctx) => ctx.screen.def.chests?.[`${ctx.x},${ctx.z}`] ?? ctx.screen.def.chest ?? null;

// onPush for chests: open once, fanfare, hand over the contents.
export function openChest(ctx) {
  const { world, tx, tz } = ctx;
  const flag = chestFlag(tx, tz);
  if (hasFlag(flag)) return false;
  setFlag(flag);
  const prop = world.propAt(tx, tz);
  if (prop) prop.userData.opening = true;
  const contents = chestContents(ctx);
  sfx.fanfare();
  burst(tx + 0.5, GROUND_Y + 0.8, tz + 0.5, [0xf1c232, 0xffffff, 0xe8364a], 40, { speed: 2.5, size: 0.08, up: 6, life: 1.3 });
  if (contents) grant(contents);
  else showBanner('The chest is empty');
  emit('chest-opened', { tx, tz, contents });
  return true;
}

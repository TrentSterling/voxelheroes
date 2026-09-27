// Shared pieces for tile definitions: prop factories and hook behaviours that
// more than one tileset uses (a chest works outdoors as well as in a crypt).
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { GROUND_Y, TV } from '../core/constants.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { hasFlag, setFlag } from '../core/state.js';
import { bushGeometry, doorGeometry, flameGeometry, chestGeometry, flameMaterial } from '../models/props.js';
import { burst } from '../systems/particles.js';
import { rollDrop } from '../systems/drops.js';
import { keyCount, useKey } from '../systems/keys.js';
import { grant } from '../systems/grants.js';
import { showBanner } from '../ui/banner.js';

// ---------------------------------------------------------------- props
export function bushProp(ctx) {
  const obj = new THREE.Mesh(bushGeometry(), voxelMaterial);
  obj.rotation.y = ((ctx.x * 7 + ctx.z * 3) % 4) * (Math.PI / 2);
  obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
  return obj;
}

export function doorProp(ctx) {
  const obj = new THREE.Mesh(doorGeometry(), voxelMaterial);
  obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
  return obj;
}

// A flickering flame on top of a brazier (5 terrain voxels up).
export function flameProp(ctx) {
  const obj = new THREE.Mesh(flameGeometry(), flameMaterial);
  obj.position.set(ctx.cx, GROUND_Y + 5 * TV, ctx.cz);
  const p = ctx.x * 1.7 + ctx.z * 2.3;
  obj.userData.tick = (t) => {
    obj.scale.set(1 + Math.sin(t * 13 + p) * 0.08, 1 + Math.sin(t * 9 + p * 2) * 0.2 + Math.sin(t * 23 + p) * 0.08, 1);
    obj.rotation.y = Math.sin(t * 3 + p) * 0.3;
  };
  return obj;
}

export const chestFlag = (tx, tz) => `chest:${tx},${tz}`;

export function chestProp(ctx) {
  const geo = chestGeometry();
  const obj = new THREE.Group();
  const base = new THREE.Mesh(geo.base, voxelMaterial);
  const lid = new THREE.Mesh(geo.lid, voxelMaterial);
  lid.position.set(0, 5 * TV, -2.5 * TV);
  base.castShadow = lid.castShadow = true;
  obj.add(base, lid);
  obj.userData.lid = lid;
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
  if (!world.setTile(tx, tz, def.becomes ?? '.', { rebuild: false, reason: 'cut' })) return false;
  sfx.cut();
  burst(tx + 0.5, GROUND_Y + 0.3, tz + 0.5, colors, 26, { speed: 3, size: 0.1, up: 4 });
  rollDrop(drops, tx + 0.5, tz + 0.5);
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
  burst(tx + 0.5, GROUND_Y + 0.6, tz + 0.5, [0x7a4a26, 0x5e371b, 0x3a3a44], 30, { speed: 3, size: 0.1, up: 4 });
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

// Reward models are personal presentation. Shared grants arrive quietly, so
// collecting a chest never interrupts another player's adventure.
import * as THREE from 'three';
import { scene, camera } from '../core/renderer.js';
import { setRewardBoundsReader, setRewardWorldBoundsReader } from '../core/presentation.js';
import { setCameraHeadroom } from '../core/camera.js';
import { GROUND_Y } from '../core/constants.js';
import { TUNING } from '../core/tuning.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { player } from '../entities/player.js';
import { registerPlayHook } from './flow.js';
import { modelMesh } from '../models/kit.js';
import { rewardGlintModel } from '../models/items/rewards.js';

let prize = null;
const box = new THREE.Box3(), projected = new THREE.Vector3();
setRewardWorldBoundsReader(() => prize ? box.setFromObject(prize.root) : null);
setRewardBoundsReader(() => {
  if (!prize) return null;
  camera.updateMatrixWorld();
  box.setFromObject(prize.root);
  const rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    projected.set(x, y, z).project(camera);
    const px = (projected.x + 1) / 2, py = (1 - projected.y) / 2;
    rect.left = Math.min(rect.left, px); rect.right = Math.max(rect.right, px);
    rect.top = Math.min(rect.top, py); rect.bottom = Math.max(rect.bottom, py);
  }
  return rect;
});

export function clearItemPrize() {
  // The model kit owns cached geometry and materials. Remove this instance
  // without disposing assets used by inventory, pickups or later rewards.
  prize?.root.removeFromParent();
  prize = null;
  setCameraHeadroom(null);
}

export function showItemPrize(get) {
  clearItemPrize();
  if (!['play', 'dialog'].includes(state.mode) || typeof get.model !== 'function') return;
  const model = get.model();
  if (!model?.isObject3D) return;
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longest) || longest <= 0) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const content = new THREE.Group();
  content.add(model);
  content.position.set(-center.x, -bounds.min.y, -center.z);
  const root = new THREE.Group();
  root.name = 'item-prize';
  root.userData.grant = get.id;
  root.add(content);
  // Small keys/rings need a readable silhouette too. The cap preserves the
  // voxel character of tiny props without making an orb dwarf the hero.
  root.scale.setScalar(Math.min(1.4, TUNING.hero.prize.size / longest));
  const glints = [-1, 1].map(side => {
    const mesh = modelMesh(rewardGlintModel());
    mesh.name = 'prize-glint';
    mesh.position.set(side * (size.x / 2 + .2), size.y * .6, .12);
    mesh.castShadow = false;
    root.add(mesh);
    return mesh;
  });
  prize = { root, glints, elapsed: 0, height: size.y * root.scale.y };
  positionPrize();
  scene.add(root);
}

function positionPrize() {
  const p = TUNING.hero.prize;
  const settle = 1 - Math.pow(Math.max(0, 1 - prize.elapsed / .22), 3);
  prize.root.position.set(player.x, GROUND_Y + p.height - .08 * (1 - settle) + Math.sin(prize.elapsed * Math.PI / p.time) * p.bob, player.z);
  prize.root.rotation.y = p.yaw + prize.elapsed * p.turn;
  prize.glints.forEach((mesh,i) => {
    mesh.scale.setScalar(.55 + .25 * Math.sin(prize.elapsed * 9 + i * Math.PI));
    mesh.rotation.z = prize.elapsed * (i ? -1 : 1);
  });
  setCameraHeadroom({ z: player.z, height: p.height + prize.height + p.bob,
    row: window.innerWidth < 600 ? Math.max(p.phoneTop, Math.min(p.phoneHeader, window.innerHeight * .4) / window.innerHeight) : p.top });
}

registerPlayHook({ id: 'item-prize', order: 95, update(dt) {
  if (!prize) return;
  prize.elapsed += dt;
  if (prize.elapsed >= TUNING.hero.prize.time - 1e-9) clearItemPrize();
  else positionPrize();
} });

on('screen-leave', clearItemPrize);
on('world:reset', clearItemPrize);
on('mode-change', ({ to }) => { if (['title', 'dead', 'warp', 'scroll', 'ending'].includes(to)) clearItemPrize(); });
on('hero-pose', ({ pose }) => { if (pose !== 'cheer') clearItemPrize(); });

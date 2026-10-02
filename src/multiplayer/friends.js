import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import { scene } from '../core/renderer.js';
import { makeHero } from '../models/hero.js';
import { makeGuardShield, poseShield } from '../models/hero/shield.js';
import { modelMesh } from '../models/kit.js';
import { potModel } from '../models/props.js';
import { Entity } from '../entities/entity.js';
import { addEntity } from '../entities/manager.js';
import { world, currentScreen } from '../world/world.js';

const colors = [0x2f6fd6, 0x3e9b73, 0xc87c39, 0x9769cf, 0xbd5376, 0x5c9eae, 0xc7aa4b, 0x607dc2];
export const partyColor = (rank) => colors[Math.max(0, rank) % colors.length];

export function createFriend(id, rank, onBonk) {
  const e = new Entity({ r: 0.4 });
  e.type = 'party-hero'; e.kind = 'friend'; e.peerId = id;
  e.screenScoped = false; e.swordable = true;
  const hero = makeHero(undefined, { tunic: partyColor(rank), blade: null, shield: null });
  e.guardShield = makeGuardShield();
  e.hero = hero; e.object = hero.root; e.object.visible = false;
  e.struckBy = new Set();
  e.onSword = (hit) => {
    if (!e.object.visible || e.struckBy.has(hit.swingId)) return false;
    e.struckBy.add(hit.swingId);
    if (e.struckBy.size > 64) e.struckBy.delete(e.struckBy.values().next().value);
    onBonk(id, hit);
    return true;
  };
  e.update = (dt) => {
    const data = e.info;
    if (!data) return;
    const s = world.screens.get(data.screen), here = currentScreen();
    const visible = !!s && !!here && data.hp > 0 && data.mode !== 'title' &&
      (here.area.rooms ? s === here : s.area === here.area && world.live.has(s));
    e.object.visible = visible; e.solid = visible;
    if (!visible) return;
    const k = Math.min(1, dt * 18);
    if (!e.placed || Math.hypot(e.x - data.x, e.z - data.z) > 4) { e.x = data.x; e.z = data.z; e.placed = true; }
    else { e.x += (data.x - e.x) * k; e.z += (data.z - e.z) * k; }
    e.object.position.set(e.x, GROUND_Y, e.z);
    e.object.rotation.y += Math.atan2(Math.sin(data.yaw - e.object.rotation.y), Math.cos(data.yaw - e.object.rotation.y)) * k;
    hero.setPose(data.pose || 'stand');
    poseShield(e.guardShield, hero.body, data.shield ?? 0, { guarding: !!data.guarding && data.pose === 'stand', hidden: data.pose === 'cheer' || !!data.carrying });
    if (data.carrying && !e.pot) { e.pot = modelMesh(potModel()); e.pot.position.y = 1.05; hero.root.add(e.pot); }
    if (!data.carrying && e.pot) { e.pot.removeFromParent(); e.pot = null; }
    if (data.blade && !e.blade) {
      const geometry = new THREE.BoxGeometry(0.12, 0.06, 1);
      e.blade = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xf3f3f3 }));
      hero.root.add(e.blade);
    }
    if (e.blade) {
      e.blade.visible = !!data.blade && !data.carrying;
      if (data.blade) {
        const { reach, angle } = data.blade;
        e.blade.scale.z = Math.max(0.1, reach);
        e.blade.position.set(Math.sin(angle - data.yaw) * reach / 2, 0.42, Math.cos(angle - data.yaw) * reach / 2);
        e.blade.rotation.y = angle - data.yaw;
      }
    }
  };
  e.onRemove = () => { e.blade?.geometry.dispose(); e.blade?.material.dispose(); scene.remove(hero.root); };
  return addEntity(e);
}

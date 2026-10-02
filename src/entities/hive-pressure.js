import * as THREE from 'three';
import { Entity } from './entity.js';
import { registerEntity } from './registry.js';
import { entities } from './manager.js';
import { player } from './player.js';
import { GROUND_Y } from '../core/constants.js';
import { hasFlag, setFlag } from '../core/state.js';
import { emit } from '../core/events.js';
import { currentScreen, world } from '../world/world.js';
import { modelMesh } from '../models/kit.js';
import { nurseryPumpModel } from '../models/hive-pressure.js';
import { registerRoomClearBlocker, checkRoomCleared } from '../systems/combat.js';
import { registerPlayHook } from '../systems/flow.js';
import { hero } from '../game/hero.js';
import { roomFlag } from '../world/tiles/d1.js';
import { sparks } from '../systems/particles.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui/toast.js';

export const HIVE = {
  screen: 'd2:3,1', vented: 'dungeon:d2:nursery-vented',
  valves: [0, 1, 2].map(i => `dungeon:d2:nursery-valve:${i}`),
  nodes: [[4, 3], [11, 8], [11, 3]],
  lanes: [{ x: 1.25, z: 4, w: 13.5, h: 1.35 }, { x: 1.25, z: 6.65, w: 13.5, h: 1.35 }, { x: 7.8, z: 1.25, w: 1.35, h: 9.5 }],
};
const remaining = () => HIVE.valves.map((flag, i) => !hasFlag(flag) ? i : null).filter(i => i !== null);
registerRoomClearBlocker('hive-pressure', () => entities.some(e => !e.removed && e.type === 'hive-pressure' && !hasFlag(HIVE.vented)));

class HivePressure extends Entity {
  constructor(opts) {
    super({ ...opts, r: .5 }); this.kind = 'encounter'; this.priority = 5; this.solid = true;
    this.ai = { phase: hasFlag(HIVE.vented) ? 'vented' : 'idle', t: 4, lane: 0, cycle: 0 };
    this.object = new THREE.Group(); this.object.position.set(this.x, GROUND_Y, this.z);
    this.pump = modelMesh(nurseryPumpModel()); this.object.add(this.pump);
    const screen = opts.screen ?? currentScreen();
    this.lanes = HIVE.lanes.map(lane => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(lane.w, lane.h), new THREE.MeshBasicMaterial({ color: 0xf2bb5f, transparent: true, opacity: .34, side: THREE.DoubleSide, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(screen.x0 + lane.x + lane.w / 2 - this.x, .20, screen.z0 + lane.z + lane.h / 2 - this.z);
      this.object.add(mesh); return mesh;
    });
    this.present();
  }
  onAdd() {
    const screen = world.screens.get(this.homeKey) ?? currentScreen();
    // Existing nursery keys stay earned. Older saves need not clear a new
    // lock merely to revisit a room whose mandatory reward they already won.
    if (hasFlag(roomFlag(screen, 'key')) && !HIVE.valves.some(hasFlag)) {
      HIVE.valves.forEach(setFlag); setFlag(HIVE.vented);
    }
    if (hasFlag(roomFlag(screen, 'key'))) for (const sp of screen.spawns) {
      if (sp.flag && ['skeleton', 'barrow-warden'].includes(sp.type)) setFlag(sp.flag);
    }
    HIVE.nodes.forEach(([x, z], i) => { if (hasFlag(HIVE.valves[i])) world.setTile(screen.x0 + x, screen.z0 + z, 'd', { persist: true, reason: 'nursery-valve' }); });
    if (hasFlag(HIVE.vented)) this.ai.phase = 'vented';
    this.present();
  }
  release(index) {
    if (this.homeKey !== HIVE.screen || !HIVE.valves[index] || hasFlag(HIVE.valves[index])) return false;
    setFlag(HIVE.valves[index]);
    const screen = world.screens.get(this.homeKey), [x, z] = HIVE.nodes[index];
    world.setTile(screen.x0 + x, screen.z0 + z, 'd', { persist: true, reason: 'nursery-valve' });
    sparks(screen.x0 + x + .5, GROUND_Y + .6, screen.z0 + z + .5, [0x83d4c6, 0xe4bd7b], 12); sfx.door();
    if (this.ai.lane === index) { this.ai.phase = 'idle'; this.ai.t = 2.5; }
    const left = remaining().length;
    if (!left) { setFlag(HIVE.vented); this.ai.phase = 'vented'; this.ai.t = 0; checkRoomCleared(); }
    this.present(); toast(left ? `Pressure seal broken: ${left} remain` : 'The nursery breathes again', 2.2);
    emit('hive-valve-released', { screen, valve: index, remaining: left });
    return true;
  }
  present() {
    this.lanes.forEach((mesh, i) => {
      mesh.visible = !hasFlag(HIVE.vented) && !hasFlag(HIVE.valves[i]) && this.ai.lane === i && ['warning', 'active'].includes(this.ai.phase);
      mesh.material.color.setHex(this.ai.phase === 'active' ? 0xf27d58 : 0xf2bb5f);
      mesh.material.opacity = this.ai.phase === 'active' ? .68 : .30 + .08 * Math.sin(this.ai.t * 16);
    });
    this.pump.rotation.y = this.ai.phase === 'vented' ? 0 : Math.sin(this.ai.t * 12) * .025;
  }
  update(dt) {
    if (hasFlag(HIVE.vented)) { this.ai.phase = 'vented'; this.present(); return; }
    this.ai.t -= dt;
    if (this.ai.t <= 0) {
      if (this.ai.phase === 'warning') { this.ai.phase = 'active'; this.ai.t = .85; emit('hive-pressure-burst', { screen: currentScreen(), lane: this.ai.lane }); }
      else if (this.ai.phase === 'active') { this.ai.phase = 'idle'; this.ai.t = 2.9; }
      else {
        const live = remaining();
        if (!live.length) { setFlag(HIVE.vented); this.ai.phase = 'vented'; checkRoomCleared(); }
        else { this.ai.lane = live[this.ai.cycle++ % live.length]; this.ai.phase = 'warning'; this.ai.t = 1.25; }
      }
    }
    this.present();
  }
}
registerEntity('hive-pressure', opts => new HivePressure(opts));

// The shared machine clock is driven by its room owner. Hazard contact is
// personal on every peer, including replicas, just like projectile contact.
registerPlayHook({ id: 'hive-pressure-contact', phase: 'after', order: 8, update() {
  const screen = currentScreen(); if (screen?.key !== HIVE.screen || hasFlag(HIVE.vented)) return;
  const machine = entities.find(e => !e.removed && e.type === 'hive-pressure');
  if (machine?.ai.phase !== 'active' || hasFlag(HIVE.valves[machine.ai.lane])) return;
  const lane = HIVE.lanes[machine.ai.lane], x = player.x - screen.x0, z = player.z - screen.z0;
  if (x + player.r < lane.x || x - player.r > lane.x + lane.w || z + player.r < lane.z || z - player.r > lane.z + lane.h) return;
  hero.receiveHit({ damage: 1, kind: 'hazard', source: 'hive-pressure', knockback: false, lock: false });
} });

// A lit bomb (gameplay spec 9.2, 7.11; CONTRACTS 8.1, 8.8): it sits where
// it was set down for TUNING.items.bomb.fuse s, blinking faster at the end,
// then blows up: 'explosion' { x, z, radius, damage, source, id } reaches
// enemies (their onBomb: dealDamage with source 'bomb'), tiles (onBomb: bomb
// walls, rock piles) and other bombs (they go off too). The hero inside the
// radius takes TUNING.damage.ownBomb as a hazard (never guarded), pushed
// ownBombKnock tiles.
import * as THREE from 'three';
import { GROUND_Y } from '../../core/constants.js';
import { emit } from '../../core/events.js';
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { makeCharacterMaterial, makeGlowMaterial } from '../../core/materials.js';
import { bombModel } from '../../models/items/items.js';
import { contactShadow } from '../../models/kit.js';
import { burst, smoke, sparks } from '../../systems/particles.js';
import { scene } from '../../core/renderer.js';
import { hero } from '../../game/hero.js';
import { Entity } from '../entity.js';
import { player } from '../player.js';
import { registerEntity } from '../registry.js';

let blasts = 0;
let flashGeo = null;
let flashMat = null;

export class Bomb extends Entity {
  constructor(opts) {
    super({ ...opts, r: 0.3 });
    this.kind = 'bomb';
    this.priority = 15;
    this.fuse = opts.fuse ?? TUNING.items.bomb.fuse;
    this.mat = makeCharacterMaterial();
    this.mesh = new THREE.Mesh(bombModel(0).geometry, this.mat);
    this.mesh.castShadow = true;
    this.holder = new THREE.Group();
    this.holder.add(this.mesh);
    this.holder.add(contactShadow(0.32));
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.object = this.holder;
    this.t = 0;
    this.blown = false;
  }

  update(dt) {
    this.t += dt;
    const left = this.fuse - this.t;
    const B = TUNING.items.bomb;
    // swell and blink faster near the end
    const rate = left < B.blinkFrom ? 16 : 6;
    const on = Math.floor(this.t * rate) % 2 === 0;
    this.mat.emissive.setHex(on && left < this.fuse * 0.75 ? 0x802010 : 0x000000);
    this.mesh.scale.setScalar(1 + (left < B.blinkFrom ? 0.12 * (1 - left / B.blinkFrom) : 0));
    if (Math.floor(this.t * 20) % 3 === 0) sparks(this.x, GROUND_Y + 0.85, this.z, [0xffe070, 0xff9a30], 1, { speed: 1, size: 0.04, life: 0.2, up: 1.5 });
    if (left <= 1e-9) this.explode();
  }

  // Another blast sets it off at once.
  onBomb(explosion) {
    if (explosion.source !== this) this.explode();
    return 'hit';
  }

  explode() {
    if (this.blown) return;
    this.blown = true;
    this.remove();
    const B = TUNING.items.bomb;
    const explosion = { x: this.x, z: this.z, radius: B.radius, damage: B.damage, source: this, id: `blast-${++blasts}` };
    sfx.kill();
    burst(this.x, GROUND_Y + 0.4, this.z, [0xfff0d0, 0xff9a7a, 0xed8267, 0x5a5a5a], 26, { speed: 5, size: 0.1, up: 5, life: 0.7 });
    smoke(this.x, GROUND_Y + 0.3, this.z, 12, { radius: 0.25, spread: B.radius * 0.6 });
    flash(this.x, this.z, B.radius);
    if (Math.hypot(player.x - this.x, player.z - this.z) <= B.radius + player.r)
      hero.receiveHit({ damage: TUNING.damage.ownBomb, from: this, kind: 'hazard', knockback: TUNING.damage.ownBombKnock, source: 'bomb' });
    emit('explosion', explosion);
  }
}

// The blast's glow: an additive disc of the blast radius for a moment, and a
// pink-red point light (art bible section 11).
const flashes = new Set();
function flash(x, z, radius) {
  flashGeo ??= new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
  flashMat ??= makeGlowMaterial(0xff9a7a, 1.4);
  flashMat.transparent = true;
  flashMat.depthWrite = false;
  const g = new THREE.Group();
  const disc = new THREE.Mesh(flashGeo, flashMat);
  disc.scale.setScalar(radius);
  disc.position.y = 0.05;
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 16, 10), makeGlowMaterial(0xfff0e0, 1.6));
  core.position.y = 0.4;
  const light = new THREE.PointLight(0xff7a66, 6, 2.6, 1.2);
  light.position.y = 0.8;
  g.add(disc, core, light);
  g.position.set(x, GROUND_Y, z);
  scene.add(g);
  flashes.add({ g, core, left: TUNING.items.bomb.flash });
}
export function stepBlastFlashes(dt) {
  for (const f of flashes) {
    f.left -= dt;
    const k = Math.max(0, f.left / TUNING.items.bomb.flash);
    f.core.scale.setScalar(0.6 + (1 - k) * 0.6);
    if (f.left <= 0) {
      f.g.removeFromParent();
      f.core.geometry.dispose();
      flashes.delete(f);
    }
  }
}
export const blastFlashes = () => flashes.size;

registerEntity('bomb', (opts) => new Bomb(opts));

// Enemy shots of the first slice, on the Projectile base (CONTRACTS 8.4,
// ids section 9): `archer-arrow` (archers), `trap-arrow` (arrow traps),
// `gazer-shot` (gazers: a magic shot), `turret-bolt` (turret statues:
// magic, tier 3), `serpent-orb` (boss-serpent's punishment ring) and
// `serpent-shot` (its forward volley, tier 3: spec 8.6). Damage and tiers
// come from the spawner's opts (TUNING), with these defaults.
import { DenseGrid } from '../../core/vox.js';
import { getMaterial, makeGlowMaterial } from '../../core/materials.js';
import { model } from '../../models/kit.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';

const arrowModel = () =>
  model(
    'foe-arrow',
    () => {
      const g = new DenseGrid(3, 3, 12);
      g.box(1, 1, 0, 2, 2, 10, 0x8a5a30);
      g.box(0, 1, 0, 3, 2, 2, 0xf2f2f2);
      g.box(1, 0, 0, 2, 3, 2, 0xf2f2f2);
      g.box(0, 1, 10, 3, 2, 11, 0x9aa4b4);
      g.box(1, 0, 10, 2, 3, 11, 0x9aa4b4);
      g.box(1, 1, 11, 2, 2, 12, 0xc9d3e6);
      return g;
    },
    { origin: [1.5, 1.5, 6] }
  );

const ballModel = (key, color, core, n = 6) =>
  model(
    key,
    () => {
      const g = new DenseGrid(n, n, n);
      g.ellipsoid(n / 2, n / 2, n / 2, n / 2, n / 2, n / 2, (x, y, z) => (Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2, z + 0.5 - n / 2) < n / 4 ? core : color));
      return g;
    },
    { origin: [n / 2, n / 2, n / 2] }
  );

const glows = new Map();
const glow = (c) => glows.get(c) ?? glows.set(c, makeGlowMaterial(c, 1.6)).get(c);

class Spinning extends Projectile {
  animate(dt) {
    if (this.object) this.object.rotation.z += dt * 10;
  }
}

const types = {
  'archer-arrow': () => ({ damage: 1, tier: 2, speed: 8, geometry: arrowModel().geometry, material: getMaterial('character'), r: 0.16 }),
  'trap-arrow': () => ({ damage: 1, tier: 2, speed: 8, geometry: arrowModel().geometry, material: getMaterial('character'), r: 0.16 }),
  'gazer-shot': () => ({ damage: 2, tier: 3, speed: 7, geometry: ballModel('foe-gazer-shot', 0xff6a5a, 0xffffff).geometry, material: glow(0xffffff), r: 0.2 }),
  'turret-bolt': () => ({ damage: 1, tier: 3, speed: 6, geometry: ballModel('foe-turret-bolt', 0x7ad8ff, 0xffffff).geometry, material: glow(0xffffff), r: 0.2 }),
  'serpent-orb': () => ({ damage: 1, tier: 3, speed: 5, geometry: ballModel('foe-serpent-orb', 0xb07aff, 0xffffff, 8).geometry, material: glow(0xffffff), r: 0.24 }),
  'serpent-shot': () => ({ damage: 1, tier: 3, speed: 6, geometry: ballModel('foe-serpent-shot', 0x6fd0b0, 0xfff08a, 8).geometry, material: glow(0xffffff), r: 0.24 }),
};

for (const [id, def] of Object.entries(types)) registerEntity(id, (opts) => new (id.endsWith('arrow') ? Projectile : Spinning)(opts, { owner: 'enemy', source: 'enemy', ...def() }));

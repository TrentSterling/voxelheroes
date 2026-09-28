// The full-life sword beam (fun audit, ALttP as the teacher): systems/sword.js fires one from
// every swipe while the hero is at full life, straight down the facing. It is a short, bright bolt
// with a fading energy trail, on the Projectile base (CONTRACTS 8.4): it hurts enemies through the
// usual dealDamage (source 'beam', already in game/damage.js's SOURCES), walls get onShot, and it
// pierces on through whatever it kills so one swipe can cut a line of foes.
import * as THREE from 'three';
import { GROUND_Y } from '../../core/constants.js';
import { TUNING } from '../../core/tuning.js';
import { sfx, registerSfx, tone, noise } from '../../core/audio.js';
import { makeGlowMaterial } from '../../core/materials.js';
import { burst } from '../../systems/particles.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';

// A bright, ringing zap: distinct from the swipe's whoosh and the plain sword hit.
registerSfx('beam', () => {
  tone(1760, 0.16, { to: 660, vol: 0.1, type: 'sawtooth' });
  noise(0.05, { vol: 0.12, freq: 3200, q: 1.6 });
});

const COLOR = 0xbfe8ff;
const TRAIL = [0xdff3ff, 0xffffff, 0x8fd0ff];

let bodyGeometry = null;
let tipGeometry = null;
let trailGeometry = null;

// makeGlowMaterial reads a per-vertex color (DenseGrid models bake one in);
// a plain THREE geometry has none, so this fills it with white to glow at the
// material's own color, undimmed.
function whiten(geo) {
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return geo;
}

// The bolt: a short white-blue box with a chisel tip (two meshes, like the
// full blade's slab and point in sword-fx.js), plus a translucent streak
// fading out behind it (a static shape; riding the bolt forward reads as a
// trail without rebuilding it per frame).
function boltLook() {
  const size = TUNING.sword.beam.size;
  bodyGeometry ??= whiten(new THREE.BoxGeometry(size, size, size * 1.6).translate(0, 0, size * 0.8));
  tipGeometry ??= whiten(new THREE.ConeGeometry(size * 0.7, size, 4).rotateX(Math.PI / 2).translate(0, 0, size * 1.6 + size * 0.5));
  return { body: bodyGeometry, tip: tipGeometry };
}

function trailLook() {
  if (trailGeometry) return trailGeometry;
  const size = TUNING.sword.beam.size;
  const half = size * 0.55;
  const len = size * 5;
  const pos = [half, 0, 0, -half, 0, 0, half, 0, -len, -half, 0, -len];
  const col = [1, 1, 1, 0.9, 1, 1, 1, 0.9, 1, 1, 1, 0, 1, 1, 1, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  trailGeometry = g;
  return trailGeometry;
}

export class Beam extends Projectile {
  constructor(opts) {
    const T = TUNING.sword.beam;
    super(opts, {
      owner: 'hero',
      source: 'beam',
      damage: opts.damage ?? 4,
      speed: T.speed,
      range: T.range,
      pierce: true,
      r: T.size * 0.6,
      height: 0.55,
    });
    const group = new THREE.Group();
    const mat = makeGlowMaterial(COLOR, 2.6);
    const { body, tip } = boltLook();
    const bodyMesh = new THREE.Mesh(body, mat);
    const tipMesh = new THREE.Mesh(tip, mat);
    bodyMesh.castShadow = tipMesh.castShadow = true;
    group.add(bodyMesh, tipMesh);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(trailLook(), trailMat));
    this.object = group;
    this.place();
    sfx.beam();
  }

  // A bright shatter (never the plain dust) whatever it hits: a wall, an enemy through pierce, or
  // fizzling out of range.
  onHitWall() {
    this.shatter(TRAIL);
    return false;
  }

  shatter(colors = TRAIL) {
    if (this.removed) return;
    this.remove();
    burst(this.x, GROUND_Y + this.height, this.z, colors, 10, { speed: 3, size: 0.06, life: 0.3, up: 3 });
  }
}

registerEntity('beam', (opts) => new Beam(opts));

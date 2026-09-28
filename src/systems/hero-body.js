// The hero's own body (gameplay spec 7.2): a TUNING.hero.box square (0.8 x
// 0.8; player.r is its half) moved one axis at a time against walls and solid
// bodies, with corner assist: when a corner blocks a straight move and
// sliding sideways by TUNING.hero.cornerAssist tiles or less would clear it,
// he slides around it instead of snagging. Other bodies keep
// systems/physics.js moveBody.
//
//   moveHero(p, dx, dz, { assist }) -> { hit, hitX, hitZ }
import { TUNING } from '../core/tuning.js';
import { world } from '../world/world.js';
import { bumpsEntity } from './physics.js';

const free = (p, x, z) => !world.blocked(x, z, p.r, p) && !bumpsEntity(p, x, z);

// The smallest sideways shift (either way, in 1/32 steps up to the assist
// limit) that frees a move of `d` along `axis`; 0 if none does.
function assistShift(p, axis, d, limit) {
  const step = 1 / 32;
  for (let s = step; s <= limit + 1e-9; s += step)
    for (const sign of [1, -1]) {
      const o = sign * s;
      const ok = axis === 'x' ? free(p, p.x + d, p.z + o) && free(p, p.x, p.z + o) : free(p, p.x + o, p.z + d) && free(p, p.x + o, p.z);
      if (ok) return o;
    }
  return 0;
}

function axisMove(p, axis, d, other, assist) {
  if (!d) return false;
  const nx = axis === 'x' ? p.x + d : p.x;
  const nz = axis === 'z' ? p.z + d : p.z;
  if (free(p, nx, nz)) {
    p.x = nx;
    p.z = nz;
    return false;
  }
  // corner assist: only for a straight move along this axis
  if (assist && !other) {
    const o = assistShift(p, axis, d, TUNING.hero.cornerAssist);
    if (o) {
      const k = Math.sign(o) * Math.min(Math.abs(o), Math.abs(d));
      if (axis === 'x') p.z += k;
      else p.x += k;
      return false;
    }
  }
  return true;
}

export function moveHero(p, dx, dz, { assist = true } = {}) {
  const hitX = axisMove(p, 'x', dx, dz, assist);
  const hitZ = axisMove(p, 'z', dz, dx, assist);
  return { hit: hitX || hitZ, hitX, hitZ };
}

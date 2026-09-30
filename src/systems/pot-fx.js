import { GROUND_Y } from '../core/constants.js';
import { sfx } from '../core/audio.js';
import { burst, sparks } from './particles.js';
import { rollDrop } from './drops.js';
import { world } from '../world/world.js';

export function shatterPot(x, z, height, colors, { loot = true } = {}) {
  if (sfx.shatter) sfx.shatter();
  else sfx.cut();
  burst(x, GROUND_Y + height, z, colors, 36, { speed: 3.6, size: 0.11, up: 4.5 });
  sparks(x, GROUND_Y + height, z, [0xffffff, 0xf0d0a0], 8, { speed: 3, size: 0.05, up: 3, life: 0.3 });
  if (loot) {
    const screen = world.locate(Math.floor(x), Math.floor(z))?.screen;
    const safe = screen && world.freeSpot(screen, x - screen.x0, z - screen.z0, 0.16);
    if (safe) rollDrop('pot', screen.x0 + safe.x, screen.z0 + safe.z);
  }
}

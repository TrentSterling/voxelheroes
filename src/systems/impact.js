// Impact feedback for the hero's blows: hitstop, a spark burst at the target and a small camera
// kick, heavier for a kill. Listens to 'enemy-hit' (damage.js) so every blade source (thrust, spin,
// dash, beam) gets it without touching the combat code.
import { on } from '../core/events.js';
import { hitstop } from '../core/hitstop.js';
import { shakeCamera } from '../core/camera.js';
import { sparks } from './particles.js';
import { GROUND_Y } from '../core/constants.js';

const HERO_SOURCES = new Set(['sword', 'spin', 'dash', 'beam']);

on('enemy-hit', ({ entity, hit, result }) => {
  if (!entity || !HERO_SOURCES.has(hit?.source)) return;
  const x = entity.x, z = entity.z, y = GROUND_Y + 0.4;
  if (result === 'killed') {
    hitstop(0.09);
    shakeCamera(0.09, 0.16);
    sparks(x, y, z, [0xffffff, 0xffe08a, 0xff9a3c], 16, { speed: 5, size: 0.06, up: 4, life: 0.35 });
  } else if (result === 'hit') {
    hitstop(0.055);
    shakeCamera(0.05, 0.1);
    sparks(x, y, z, [0xffffff, 0xffe08a], 9, { speed: 4, size: 0.05, up: 3, life: 0.25 });
  } else if (result === 'blocked' || result === 'immune') {
    hitstop(0.03);
    sparks(x, y, z, [0xd8e4ff, 0xffffff], 6, { speed: 3, size: 0.04, up: 2, life: 0.2 });
  }
});

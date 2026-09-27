// Explosions reach entities: every entity an 'explosion' covers gets
// onBomb(explosion). (world.js does the same for tiles with their onBomb
// hook.) A bomb only has to emit the event:
//
//   this.remove();
//   emit('explosion', { x: this.x, z: this.z, radius: 1.5, damage: 2, source: this });
//
// Enemy's default onBomb takes `damage` (default 2); pots, bomb-proof
// enemies, boss parts and other bombs (chain reactions) define their own.
// The source entity itself is skipped. The hero is not included: a blast
// that should hurt him checks the distance itself (hurtPlayer).
import { on } from '../core/events.js';
import { entitiesNear } from '../entities/manager.js';

on('explosion', (explosion) => {
  for (const e of entitiesNear(explosion.x, explosion.z, explosion.radius ?? 1)) {
    if (e === explosion.source || e.removed) continue;
    e.onBomb?.(explosion);
  }
});

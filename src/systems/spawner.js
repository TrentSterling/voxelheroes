// Screen spawns: turn a screen's map markers into entities when it is entered.
//
// A marker may name an entity type that another feature branch provides. If
// that type is not registered (yet), the marker is skipped with one warning
// instead of stopping the game.
import { hasFlag } from '../core/state.js';
import { spawn } from '../entities/manager.js';
import { hasEntityType } from '../entities/registry.js';

const warned = new Set();

export function spawnScreen(screen) {
  const ox = screen.x0;
  const oz = screen.z0;
  let enemyIndex = 0; // staggers enemy appearances
  for (const sp of screen.spawns) {
    if (sp.flag && hasFlag(sp.flag)) continue;
    if (!hasEntityType(sp.type)) {
      if (!warned.has(sp.type)) console.warn(`spawn: no entity type "${sp.type}" (marker on ${screen.name}); skipped`);
      warned.add(sp.type);
      continue;
    }
    const e = spawn(sp.type, { ...sp.opts, x: ox + sp.x + 0.5, z: oz + sp.z + 0.5, spawnIndex: enemyIndex, spawnFlag: sp.flag, screen });
    if (e.kind === 'enemy') enemyIndex++;
  }
}

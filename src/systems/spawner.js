// Screen spawns: turn a screen's map markers into entities when it is entered.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { hasFlag } from '../core/state.js';
import { spawn } from '../entities/manager.js';

export function spawnScreen(screen) {
  const ox = screen.sx * SCREEN_W;
  const oz = screen.sy * SCREEN_H;
  let enemyIndex = 0; // staggers enemy appearances
  for (const sp of screen.spawns) {
    if (sp.flag && hasFlag(sp.flag)) continue;
    const e = spawn(sp.type, { ...sp.opts, x: ox + sp.x + 0.5, z: oz + sp.z + 0.5, spawnIndex: enemyIndex, spawnFlag: sp.flag, screen });
    if (e.kind === 'enemy') enemyIndex++;
  }
}

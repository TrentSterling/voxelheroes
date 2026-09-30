import { registerItem } from './registry.js';
import { input } from '../core/input.js';
import { entities } from '../entities/manager.js';
import { hero } from '../game/hero.js';
import { TUNING } from '../core/tuning.js';
import { sfx } from '../core/audio.js';
import { prizeMesh } from '../models/items/items.js';
import { grappleModel } from '../models/items/grapple.js';

registerItem({
  id: 'grapple', name: 'Grapple', kind: 'tool', order: 30,
  icon: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#dbe8ed" d="M1 1h1v4h4V1h1v5H5v1H3V6H1z"/><path fill="#d7a954" d="M3 1h2v4H3z"/></svg>',
  getText: 'The Grapple!',
  model: prizeMesh(grappleModel),
  use(ctx) {
    if (entities.some(e => !e.removed && e.type === 'grapple-hook' && !e._partyProxy)) return false;
    const move = input.move();
    const angle = Math.round(Math.atan2(move.z, move.x) / (Math.PI / 4)) * Math.PI / 4;
    const dir = move.len > TUNING.hero.deadzone ? { x: Math.cos(angle), z: Math.sin(angle) } : hero.facingVector();
    ctx.spawn('grapple-hook', { x: ctx.player.x, z: ctx.player.z, dir });
    sfx.shoot();
    return true;
  },
});

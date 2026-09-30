// Pots are available before the sword: A lifts the pot in front, then A throws it.
// The held model belongs to the hero and survives a room transition, but never a save/load reset.
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { world } from '../world/world.js';
import { player } from '../entities/player.js';
import { spawn } from '../entities/manager.js';
import { potModel } from '../models/props.js';
import { modelMesh } from '../models/kit.js';
import { registerPlayHook } from './flow.js';
import { endSwing } from './sword.js';
import { shatterPot } from './pot-fx.js';
import { partyHooks } from '../multiplayer/adapters.js';

const ready = (p) => !p.carrying && !p.thrust && !p.dashing && !p.paralyzed() && p.lockT <= 0 && p.knockT <= 0 && p.stallT <= 0;

export function liftPot(ctx, { approved = false, loot = true } = {}) {
  const p = ctx.player;
  if (!p || !ready(p) || state.mode !== 'play') return false;
  if (!approved) {
    const routed = partyHooks.lift(ctx);
    if (routed !== null) return routed;
    if (!world.setTile(ctx.tx, ctx.tz, ctx.def.becomes ?? '.', { rebuild: false, reason: 'lift' })) return false;
  }
  const m = potModel();
  const object = modelMesh(m);
  object.position.set(0, 1.05, 0);
  p.object.add(object);
  p.carrying = { object, colors: m.colors, loot };
  p.charge = null;
  p.chargeArmed = false;
  p.attackBuffer = 0;
  p.guarding = false;
  endSwing(p);
  sfx.gem();
  emit('pot-lifted', { tx: ctx.tx, tz: ctx.tz });
  return true;
}

export function releasePot({ breakIt = false, loot = false } = {}) {
  const held = player.carrying;
  if (!held) return false;
  held.object.removeFromParent();
  player.carrying = null;
  if (breakIt) shatterPot(player.x, player.z, 0.5, held.colors, { loot: loot && held.loot !== false });
  return true;
}

export function throwPot() {
  if (!player.carrying || player.lockT > 0 || player.knockT > 0 || player.stallT > 0 || player.paralyzed() || state.mode !== 'play') return false;
  const move = input.move8();
  const dir = move.dir >= 0 ? { x: move.x, z: move.z } : { x: Math.sin(player.facingYaw()), z: Math.cos(player.facingYaw()) };
  const loot = player.carrying.loot !== false;
  releasePot();
  // Start at the hero, rather than beyond a wall that touches him. The projectile tests every step.
  const pot = spawn('thrown-pot', { x: player.x, z: player.z, dir, loot });
  sfx.swing();
  emit('pot-thrown', { x: player.x, z: player.z, dir });
  return pot;
}

registerPlayHook({
  id: 'carry-pot', phase: 'input', order: 5,
  update() {
    if (!player.carrying) return;
    if (input.pressed('sword')) {
      throwPot();
      input.consume('sword');
    }
    for (const action of ['item', 'dash', 'guard']) input.consume(action);
    player.guarding = false;
    player.charge = null;
    player.chargeArmed = false;
  },
});

on('world:reset', () => releasePot());
on('player-hurt', () => releasePot({ breakIt: true, loot: true }));
on('mode-change', ({ to }) => { if (to === 'dead' || to === 'title') releasePot(); });

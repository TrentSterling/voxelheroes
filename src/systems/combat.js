// Damage to the hero, the shield, and the room-cleared signal.
// Damage to enemies lives on the entity (Enemy.hurt / Enemy.die).
import { GROUND_Y } from '../core/constants.js';
import { state } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { setMode } from '../core/modes.js';
import { currentScreen } from '../world/world.js';
import { entities } from '../entities/manager.js';
import { player } from '../entities/player.js';
import { burst } from './particles.js';
import { isSwinging } from './sword.js';

export const HURT_INVULNERABLE = 1.1; // seconds of blinking after a hit
export const HURT_KNOCKBACK = 8;

// Something that can save the hero from dying (revive dust): fn({ amount,
// info }) returns the life units to get back up with, or 0 to pass. The first
// reviver (by id order) that answers wins. game/hero.js documents the M2 use.
const revivers = [];

export function registerReviver(id, fn) {
  if (revivers.some((r) => r.id === id)) throw new Error(`Reviver "${id}" is already registered`);
  revivers.push({ id, fn });
  revivers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Hurt the hero by dmg half-hearts, knocking them away from (fromX, fromZ).
// info (optional): { kind: 'contact' | 'projectile' | 'hazard', source,
// knockback: false for no push }; game/hero.js receiveHit fills it in.
export function hurtPlayer(dmg, fromX, fromZ, info = {}) {
  state.hp = Math.max(0, state.hp - dmg);
  player.invT = HURT_INVULNERABLE;
  if (info.knockback !== false) {
    const dx = player.x - fromX;
    const dz = player.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    player.kx = (dx / d) * HURT_KNOCKBACK;
    player.kz = (dz / d) * HURT_KNOCKBACK;
    player.knockT = 0.18;
  }
  sfx.hurt();
  burst(player.x, GROUND_Y + 0.5, player.z, [0xe8364a, 0xffffff], 8, { speed: 2, size: 0.07, life: 0.4 });
  emit('player-hurt', { amount: dmg, hp: state.hp, fromX, fromZ, kind: info.kind ?? 'contact', source: info.source ?? null });
  if (state.hp <= 0) {
    for (const r of revivers) {
      const hp = r.fn({ amount: dmg, info });
      if (hp > 0) {
        state.hp = Math.min(state.maxHp, Math.round(hp));
        emit('player-revived', { by: r.id, hp: state.hp });
        return;
      }
    }
    state.deadT = 0;
    player.attackT = 0;
    player.thrust = null;
    player.stopDash?.();
    setMode('dead');
    sfx.over();
    emit('player-died', {});
  }
}

// The shield blocks projectiles moving at the hero's face while the hero is
// not swinging.
export function shieldBlocks(vx, vz) {
  const yaw = player.facingYaw ? player.facingYaw() : player.yaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const sp = Math.hypot(vx, vz);
  const facing = -(fx * vx + fz * vz) / sp;
  return !isSwinging(player) && facing > 0.7;
}

// Enemies that keep a room from counting as cleared.
export const enemiesLeft = () =>
  entities.filter((e) => !e.removed && e.kind === 'enemy' && e.countsForClear !== false).length;

// Called after an enemy dies: the last one emits 'room-cleared'.
export function checkRoomCleared() {
  if (enemiesLeft() === 0) emit('room-cleared', { screen: currentScreen() });
}

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

// Hurt the hero by dmg half-hearts, knocking them away from (fromX, fromZ).
export function hurtPlayer(dmg, fromX, fromZ) {
  state.hp = Math.max(0, state.hp - dmg);
  player.invT = HURT_INVULNERABLE;
  const dx = player.x - fromX;
  const dz = player.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  player.kx = (dx / d) * HURT_KNOCKBACK;
  player.kz = (dz / d) * HURT_KNOCKBACK;
  player.knockT = 0.18;
  sfx.hurt();
  burst(player.x, GROUND_Y + 0.5, player.z, [0xe8364a, 0xffffff], 8, { speed: 2, size: 0.07, life: 0.4 });
  emit('player-hurt', { amount: dmg, hp: state.hp, fromX, fromZ });
  if (state.hp <= 0) {
    state.deadT = 0;
    player.attackT = 0;
    setMode('dead');
    sfx.over();
    emit('player-died', {});
  }
}

// The shield blocks projectiles moving at the hero's face while the hero is
// not swinging.
export function shieldBlocks(vx, vz) {
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
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

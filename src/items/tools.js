// The B tools of the first slice (gameplay spec 9.1, 9.2; CONTRACTS 8.8):
//
//   boomerang  thrown in 8 directions along the stick, or along the attack
//              facing when he stands still; one out at a time; unlimited
//   bombs      set down in front of him (TUNING.items.bomb.place tiles); at
//              most maxOut lit at once; ammo 'bombs', capacity by bag
//              (TUNING.items.bomb.capacity[state.items.bombBag])
//
// The hero shows the item pose on 'item-used' (game/hero.js).
import { input } from '../core/input.js';
import { state, defineState } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';
import { hero } from '../game/hero.js';
import { registerPlayHook } from '../systems/flow.js';
import { stepBlastFlashes } from '../entities/items/bomb.js';
import { boomerangModel, bombModel, prizeMesh } from '../models/items/items.js';
import { registerItem } from './registry.js';
import { setItemGate } from './inventory.js';

setItemGate(() => hero.canAct());

defineState('bombBag', () => 0); // bag upgrades bought or found (0: the first bag)

const live = (type) => entities.filter((e) => !e.removed && e.type === type).length;

const BOOMERANG_ICON =
  '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#e0b476" d="M1 1h6v2H3v4H1z"/><path fill="#d83a3a" d="M6 1h1v2H6zM1 6h2v1H1z"/></svg>';
const BOMB_ICON =
  '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#2c3a58" d="M2 3h4v1h1v2H6v1H2V6H1V4h1z"/><path fill="#5a70a0" d="M2 4h1v1H2z"/><path fill="#e8b830" d="M3 2h2v1H3z"/><path fill="#ffe070" d="M5 1h1v1H5z"/></svg>';

registerItem({
  id: 'boomerang',
  name: 'Boomerang',
  kind: 'tool',
  order: 10,
  icon: BOOMERANG_ICON,
  getText: 'The Boomerang! Throw it to stun foes and fetch far-off things.',
  model: prizeMesh(boomerangModel),
  use(ctx) {
    if (live('boomerang') > 0) return false;
    const m = input.move();
    let dir;
    if (m.len > TUNING.hero.deadzone) {
      // 8 directions along the stick
      const a = Math.round(Math.atan2(m.z, m.x) / (Math.PI / 4)) * (Math.PI / 4);
      dir = { x: Math.cos(a), z: Math.sin(a) };
    } else dir = hero.facingVector();
    const p = ctx.player;
    ctx.spawn('boomerang', { x: p.x + dir.x * 0.4, z: p.z + dir.z * 0.4, dir });
    sfx.swing();
    return true;
  },
});

const bombCap = (s = state) => TUNING.items.bomb.capacity[Math.min(TUNING.items.bomb.capacity.length - 1, s.bombBag ?? 0)];

registerItem({
  id: 'bombs',
  name: 'Bombs',
  kind: 'tool',
  order: 20,
  icon: BOMB_ICON,
  ammo: 'bombs',
  maxAmmo: bombCap,
  startAmmo: TUNING.items.bomb.start,
  getText: 'Bombs! Blast cracked walls and rock piles. Stand clear!',
  model: prizeMesh(() => bombModel(1)),
  use(ctx) {
    if (live('bomb') >= TUNING.items.bomb.maxOut) return false;
    const p = ctx.player;
    const f = hero.facingVector();
    const d = TUNING.items.bomb.place;
    let x = p.x + f.x * d;
    let z = p.z + f.z * d;
    if (world.blocked(x, z, 0.2, null)) {
      x = p.x;
      z = p.z;
    }
    if (!ctx.useAmmo(1)) return false;
    ctx.spawn('bomb', { x, z });
    sfx.cut();
    return true;
  },
});

registerPlayHook({ id: 'items-blasts', phase: 'after', order: 5, update: (dt) => stepBlastFlashes(dt) });

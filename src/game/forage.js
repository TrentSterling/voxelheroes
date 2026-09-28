// Foraging: a sword cut through a flower tile picks a wildflower (a gift townsfolk love), once per
// tile per day. state.forage = { wildflower: n } (saved); picked tiles reset each new day.
import { defineState, state } from '../core/state.js';
import { on } from '../core/events.js';
import { getTile } from '../world/tiles.js';
import { sparks } from '../systems/particles.js';
import { GROUND_Y } from '../core/constants.js';
import { toast } from '../ui/toast.js';

defineState('forage', () => ({ wildflower: 0, picked: [] }));

function pick(ctx) {
  const key = `${ctx.tx ?? ctx.x},${ctx.tz ?? ctx.z}`;
  const F = state.forage;
  if (F.picked.includes(key)) return;
  F.picked.push(key);
  F.wildflower = (F.wildflower ?? 0) + 1;
  const x = (ctx.tx ?? 0) + 0.5, z = (ctx.tz ?? 0) + 0.5;
  sparks(x, GROUND_Y + 0.3, z, [0xf2c7ff, 0xfff0a0, 0xffffff], 6, { speed: 1.5, size: 0.05, up: 2, life: 0.4 });
  toast(`Picked a wildflower (${F.wildflower})`, 1.4);
}

let hooked = false;
function hook() {
  if (hooked) return;
  for (const set of ['overworld', 'town']) {
    const def = getTile(set, ',');
    if (!def) continue;
    const before = def.onSword;
    def.onSword = (ctx) => {
      before?.(ctx);
      pick(ctx);
    };
    hooked = true;
  }
}
on('room-enter', hook);
on('new-day', () => {
  if (state.forage) state.forage.picked = [];
});

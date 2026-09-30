import { defineTileset, registerTile } from '../tiles.js';
import { land } from './overworld.js';
import './town.js';
import { fineFloor } from './dungeon.js';
import { modelProp, revealBurst } from '../tilekit.js';
import { rootStumpModel, potSupplyModel } from '../../models/village-quests.js';
import { setFlag } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { sfx } from '../../core/audio.js';
import { showDialog } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { liftPot } from '../../systems/pots.js';

registerTile('town', '%', {
  name: 'old-root-stump', prompt: 'Inspect stump', solid: true, ground: 'grass',
  build: ctx => land(ctx), prop: modelProp(rootStumpModel),
  onInteract() {
    showDialog('These roots will not yield to a blade. A bomb could open what they are hiding.', { speaker: 'Old stump' });
    return true;
  },
  onSword() { sfx.block(); return false; },
  onBomb(ctx) {
    if (!ctx.world.setTile(ctx.tx, ctx.tz, 'y', { persist: true, reason: 'tobin-cellar' })) return false;
    setFlag('village:tobin-cellar-open');
    revealBurst(ctx.tx, ctx.tz, [0x80543a, 0xc99559, 0x61402b]);
    toast('Stone steps beneath the roots. Tobin had a cellar here!', 3);
    emit('secret-found', { kind: 'root-cellar', tx: ctx.tx, tz: ctx.tz });
    return true;
  },
});

// These spare pots are an inexhaustible puzzle supply. They give no loot when
// broken, and lift directly into the hero's hands without spawning a solid
// tile under either hero. Each friend can take a spare independently.
defineTileset('root-cellar', { parent: 'dungeon', floor: '.' });
registerTile('root-cellar', '&', {
  name: 'pot-supply', prompt: 'Take a spare pot', solid: true,
  build: fineFloor, prop: modelProp(potSupplyModel),
  onInteract(ctx) {
    const lifted = liftPot(ctx, { approved: true, loot: false });
    if (lifted) toast('A spare pot. Face the bronze seal, then throw.', 2.5);
    return lifted;
  },
});

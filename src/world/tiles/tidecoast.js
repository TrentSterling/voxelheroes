import './era-workshop.js';
import './fire.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { openGuardedChest } from '../../systems/tile-actions.js';
import { land } from './overworld.js';
import { modelProp, revealBurst } from '../tilekit.js';
import { shoreBeaconModel } from '../../models/brineglass.js';
import { hasFlag, setFlag } from '../../core/state.js';
import { hasItem } from '../../items/inventory.js';
import { showDialog } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';

defineTileset('tidecoast', { parent: 'overworld', floor: '.' });
for (const [ch, name, colors] of [['e', 'shell-road', [0xd8d5b6, 0x829e9e]], ['a', 'tidal-glass', [0x5a9eb1, 0x91d1cb]], ['j', 'jetty-planks', [0xa78075, 0x5d697e]], ['u', 'copper-conduit', [0x66868d, 0xd3aa70]]]) {
  registerTile('tidecoast', ch, { name: `coast-${name}`, ground: 'path', build(ctx) {
    land(ctx, { kind: 'path' }); const { T, X0: x, Z0: z } = ctx;
    for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++) T.set(x + i, 0, z + k, colors[ch === 'u' ? +(i === 2 || i === 5) : ch === 'j' ? +(k % 3 === 0) : +((i + k) % 5 === 0)]);
  } });
}
for (const set of ['tidecoast', 'era-ruins']) for (const [ch, lit] of [['{', false], ['}', true]]) {
  registerTile(set, ch, { name: lit ? 'warm-shore-beacon' : 'cold-shore-beacon', solid: true, ground: 'path', build: land,
    prop: modelProp(() => shoreBeaconModel(lit)), prompt: 'Read beacon log',
    onInteract(ctx) {
      showDialog(ctx.area.id === 'tidecoast'
        ? lit ? ['The lens holds a small, steady sun. The beam follows an old copper line toward Mossbrook.', 'An inscription below the glass: KEEP ONE LIGHT FOR THE PEOPLE WHO COME AFTER US.']
          : ['The last keeper left this beacon cold. Its lens cracked the winter the town clocks stopped.', 'A replacement Ember Lens waits in the upper temple kiln, west of the Ember Gate. Melt the two ice blocks, then send fire into the beacon.', 'The beacon shares a copper line with Mossbrook. Follow that line through the hourgate to the Silent Year.']
        : lit ? ['The memorial lamp is warm. Its copper plate now reads: A LIGHT ARRIVED FROM THE YEAR WE LOST.', 'The little vault beside it has opened. Inside is a keeper\'s memory, saved for someone willing to bring the light back.']
          : ['The memorial is cold. Beneath it: THE SHORE BEACON WENT DARK THREE HUNDRED YEARS AGO.', 'Its copper line runs back to the Brineglass shore. A light from that year might still find us.'], { speaker: ctx.area.id === 'tidecoast' ? 'The Last Shore Light' : 'Tomorrow\'s Memorial' });
      return true;
    },
    onShot(ctx) {
      if (ctx.area.id !== 'tidecoast' || lit || ctx.hit?.source !== 'fire') return false;
      if (!hasItem('ember-lens')) { toast('The cracked lens cannot hold the flame. Find the upper temple Ember Lens.', 3); return true; }
      if (hasFlag('coast:beacon-lit')) return true;
      setFlag('coast:beacon-lit'); ctx.world.setTile(ctx.tx, ctx.tz, '}', { persist: true, reason: 'shore-beacon-lit' });
      revealBurst(ctx.tx, ctx.tz, [0xffcd81, 0x94e0d3]); toast('The shore light wakes. Its warmth is travelling toward tomorrow.', 4); return true;
    },
  });
}
registerTile('tidecoast', ':', { ...getTile('dungeon', ':'), ground: 'path', build: land });
registerTile('era-ruins', '[', { ...getTile('overworld', 'C'), name: 'sealed-beacon-vault', chestLock: () => 'Brineglass: light beacon', onPush: ctx => openGuardedChest(ctx, getTile('overworld', 'C').onPush) });

// People of the overworld slice (overworld stream; gameplay spec 5.6,
// CONTRACTS 8.12): the king in the castle courtyard, Mossbrook's shopkeeper,
// smith and innkeeper, and the sage (npc-sage, placed by the dungeon in D1's
// reward room). Plain townsfolk are the generic 'npc' with lines.
import { getMaterial } from '../../core/materials.js';
import { state, hasFlag, setFlag } from '../../core/state.js';
import { makeHero } from '../../models/hero.js';
import { grant, hasGrant } from '../../systems/grants.js';
import { openMenu } from '../../game/menus.js';
import { equipSword } from '../../game/swords.js';
import { showDialog } from '../../ui/dialog.js';
import { Npc } from '../npc.js';
import { registerEntity } from '../registry.js';
import { TOWNSFOLK } from './npc.js';
import { tickErrandMarker } from '../../game/errands.js';

// A heart event ready shows the same "!" a villager's errand does (game/errands.js); these six
// have no errand of their own, but they befriend the hero same as anyone (Npc.onInteract).
class CharmNpc extends Npc {
  update(dt) {
    super.update(dt);
    tickErrandMarker(this);
  }
}

const look = (palette) => makeHero(getMaterial('character'), { ...TOWNSFOLK, ...palette }); // a rig: it walks and poses

// ---------------------------------------------------------------- the king
// A new game with the prologue starts unarmed (CONTRACTS 8.16): the king arms
// the hero with the starter blade and the first shield.
class King extends CharmNpc {
  constructor(opts) {
    super(opts, { rig: look({ tunic: 0x8a2a3a, tunicLight: 0xaa4a5a, cap: 0xe6b43a, leg: 0x5a2a3a, extras: ['crown', 'beard'] }), name: 'King Aldric', schedule: 'always' });
  }
  async talk() {
    const sp = { speaker: this.name };
    if (!state.swords.equipped || !state.swords.owned?.length) {
      await showDialog(['{hero}! Thank the stars you came.', 'The old barrow west of Mossbrook has broken open, and worse things walk out of it every night.', 'Take this blade and this shield. They were my father\'s.'], sp);
      grant('blade-start', 1, { source: 'npc' });
      if (!state.swords.equipped) equipSword('blade-start');
      if ((state.gear.shield ?? 0) < 1) state.gear.shield = 1;
      setFlag('overworld:talked:king');
      await showDialog(['Go north through Mossbrook, then west, then south to the barrow.', 'Find what sleeps at its heart.'], sp);
      return;
    }
    // Set every time through, not only on the arming branch above: a save loaded from
    // before this flag existed, or any other way the hero ends up already armed, still
    // needs one real talk with the king to move the "Next:" objective off his name.
    setFlag('overworld:talked:king');
    if (hasFlag('boss:d1')) return showDialog(['You beat the warden of the barrow! The whole valley sleeps easier.', 'But the orb you found is only the first of four...'], sp);
    return showDialog(['The barrow lies west of Mossbrook, then south.', 'Cut the grass as you go. Coins hide everywhere.'], sp);
  }
}
registerEntity('npc-king', (opts) => new King(opts));

// ---------------------------------------------------------------- Mossbrook's services
class Shopkeeper extends CharmNpc {
  constructor(opts) {
    super(opts, { rig: look({ tunic: 0x3a6a8a, tunicLight: 0x5a8aaa, cap: 0xe8e0d0, extras: ['apron', 'bun'] }), name: 'Mags' });
    this.shop = opts.shop ?? 'v1-shop';
  }
  async talk() {
    await showDialog('Tallow, twine and everything between. Have a look.', { speaker: this.name });
    await openMenu('shop', { shop: this.shop, speaker: this.name });
  }
}
registerEntity('npc-shop', (opts) => new Shopkeeper(opts));

class Smith extends CharmNpc {
  constructor(opts) {
    super(opts, { rig: look({ tunic: 0x4a3a2e, tunicLight: 0x6a5a4e, cap: 0x3a3a44, leg: 0x3a3a44, extras: [['apron', 0x6a4a2a], ['beard', 0x3a2418]] }), name: 'Brannoc' });
  }
  async talk() {
    if (!state.swords.equipped) return showDialog('No blade? Come back when you have one to work on.', { speaker: this.name });
    await showDialog('A blade is only as good as the coin you put into it.', { speaker: this.name });
    await openMenu('smith', { speaker: this.name });
  }
}
registerEntity('npc-smith', (opts) => new Smith(opts));

class Innkeeper extends CharmNpc {
  constructor(opts) {
    super(opts, { rig: look({ tunic: 0x8a6a2a, tunicLight: 0xaa8a4a, cap: 0x6a3a2a, extras: ['apron', 'bun'] }), name: 'Wenna' });
    this.inn = opts.inn ?? 'inn-1';
  }
  talk() {
    return openMenu('inn', { inn: this.inn, speaker: this.name });
  }
}
registerEntity('npc-inn', (opts) => new Innkeeper(opts));

// ---------------------------------------------------------------- the inventor
// Gives the Sprint Boots once (gameplay spec: the inventor in V1, before D1); dash needs them.
class Inventor extends CharmNpc {
  constructor(opts) {
    super(opts, { rig: look({ tunic: 0x6a5a8a, tunicLight: 0x8a7aaa, cap: 0xc8a040, hair: 0x7a7a84, extras: ['glasses', ['beard', 0xf0f0f0]] }), name: 'Tinker Wyll' });
  }
  async talk() {
    const sp = { speaker: this.name };
    if (!state.gear.boots) {
      await showDialog(['Ah, a traveller with worn soles! Try these.', 'Sprint Boots. Press SPACE: you rev up, then off you charge, blade first.'], sp);
      grant('boots-dash', 1, { source: 'npc' });
      return;
    }
    return showDialog(['Charge into a wall and you will know about it. Pull back to brake.'], sp);
  }
}
registerEntity('npc-inventor', (opts) => new Inventor(opts));

// ---------------------------------------------------------------- the sage (CONTRACTS 8.12)
// Grants its spell once ({ source: 'npc' }), sets its flag, then only talks.
// A spell nobody has registered yet (the items stream's) is not granted.
class Sage extends CharmNpc {
  constructor(opts) {
    super(opts, { rig: look({ tunic: 0xe8e0f0, tunicLight: 0xffffff, cap: 0xa0a0c0, hair: 0xd0d0d0, extras: [['hood', 0xe8e0f0], 'beard'] }), name: 'Sage Oriel', schedule: 'always' });
    this.spell = opts.spell ?? null;
    this.flag = opts.flag ?? `overworld:sage:${this.spell}`;
  }
  async talk() {
    const sp = { speaker: this.name };
    if (this.spell && !hasFlag(this.flag) && hasGrant(this.spell)) {
      await showDialog(['You broke the warden\'s coils. Then you are ready for this.', 'Hold still, and listen.'], sp);
      grant(this.spell, 1, { source: 'npc' });
      setFlag(this.flag);
      return showDialog('Some things are only hidden. Now you can see them.', sp);
    }
    return showDialog(['Take the orb, {hero}. Three more wait in the far corners of the land.', 'The stairs behind you lead back to the light.'], sp);
  }
}
registerEntity('npc-sage', (opts) => new Sage(opts));

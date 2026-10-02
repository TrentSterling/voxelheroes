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
    if (hasFlag('campaign:complete')) {
      setFlag('overworld:celebrated');
      return showDialog(['{hero}, the city clock is moving. For the first time in years, I heard a thirteenth bell and it was only someone laughing.', 'Caldrin tried to keep one perfect morning forever. He forgot that people have to leave a moment to reach each other.', 'You brought our four borrowed hours home. The barrow, nursery, watch and shore can belong to their people again.', 'Mossbrook is waiting. Visit the Clockfair, help the friends you met, and leave a light for anyone still on the road.'], sp);
    }
    if (!state.swords.equipped || !state.swords.owned?.length) {
      await showDialog(['{hero}! Mira says the town bell has rung thirteen times. She was counting the hours we have, and the one we lost.', 'Our city clock borrowed its light from four temples. Now the barrow is awake and its keeper will not let the first hour go.', 'My father promised those lights would always find their way home. I thought it was only a story for children.', 'Take his blade and this shield. Bring back the hour of return, and find out who is keeping tomorrow from us.'], sp);
      grant('blade-start', 1, { source: 'npc' });
      if (!state.swords.equipped) equipSword('blade-start');
      // Use the normal grant so friends receive the kit too. Keep it quiet:
      // the blade remains the item held up during the king's follow-up.
      if ((state.gear.shield ?? 0) < 1) grant('shield-1', 1, { source: 'npc', fanfare: false });
      setFlag('overworld:talked:king');
      await showDialog(['Go north through Mossbrook, then west, then south to the barrow.', 'Find what sleeps at its heart.'], sp);
      return;
    }
    // Set every time through, not only on the arming branch above: a save loaded from
    // before this flag existed, or any other way the hero ends up already armed, still
    // needs one real talk with the king to move the "Next:" objective off his name.
    setFlag('overworld:talked:king');
    if ([1,2,3,4].every(n=>hasFlag('orb:'+n))) return showDialog(['Four temple lights. They were never jewels for my crown. They were hours for our clock.', 'The Fourfold Tower stands east of Pilgrim Strand. Carry them through its door; Iona will know how to free the hands.', 'If you find Caldrin inside, tell him a town cannot stay in one morning forever.'], sp);
    if (hasFlag('boss:d3')) return showDialog(['The watch kept the hour of reaching. Its trains once brought shore children to Mossbrook for the fair.', 'Go south from Sunreach to Brineglass. Its lamp was meant for the person who arrived after everyone else.', 'Mara still tends that coast. Ask her who was missing when the last train left.'], sp);
    if (hasFlag('boss:d2')) return showDialog(['The nursery kept the hour of change. Its seedlings were meant for a town willing to grow.', 'Follow Sunreach east to the Buried Watch. Someone broke its last bridge and buried the timetable.', 'Bring its light home too. There are people a clock cannot replace.'], sp);
    if (hasFlag('boss:d1')) return showDialog(['The barrow has given back the hour of return. The dead can rest without holding the living in place.', 'The forest nursery kept the next light. Its pumps still tend seedlings no one collected.', 'Go north from Barrowfield into Rootglass. I want to know who those seedlings were for.'], sp);
    return showDialog(['The barrow lies west of Mossbrook, then south. Its first light belongs to the city clock.', 'Try Wyll\'s Clockfair in the southeast corner of Mossbrook Square if your hands need practice. Clay and a bright bell are better teachers than my speeches.'], sp);
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
    super(opts, { rig: look({ tunic: 0xe8e0f0, tunicLight: 0xffffff, cap: 0xa0a0c0, hair: 0xd0d0d0, extras: [['hood', 0xe8e0f0], 'beard'] }), name: opts.name ?? 'Sage Oriel', schedule: 'always' });
    this.spell = opts.spell ?? null;
    this.flag = opts.flag ?? `overworld:sage:${this.spell}`;
    this.grantLines = opts.grantLines ?? null;
    this.afterLines = opts.afterLines ?? null;
  }
  async talk() {
    const sp = { speaker: this.name };
    if (this.spell && !hasFlag(this.flag) && hasGrant(this.spell)) {
      await showDialog(this.grantLines ?? ['You broke the warden\'s coils. Then you are ready for this.', 'Hold still, and listen.'], sp);
      if (hasFlag(this.flag)) return showDialog(this.afterLines ?? 'You already know this spell.', sp);
      grant(this.spell, 1, { source: 'npc' });
      setFlag(this.flag);
      return showDialog(this.afterLines ?? ['Some things are only hidden. Now you can see them.', 'Whisperwood lies north of Mossbrook. Find its carved stone: north, west, east, north leads to the amber hive.'], sp);
    }
    return showDialog(this.afterLines ?? ['Take the orb, {hero}. Three more wait in the far corners of the land.', 'The stairs behind you lead back to the light.'], sp);
  }
}
registerEntity('npc-sage', (opts) => new Sage(opts));

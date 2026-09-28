// 'npc': a plain townsperson built on the hero's rig in plain clothes. It
// strolls near where it stands, watches and greets the hero (entities/npc.js),
// says the lines given in the spawn table the first time and chats after that:
//
//   spawnsAt: { '5,4': { type: 'npc', name: 'Old Wren', lines: ['The smith lives up the hill.'] } }
//
// Optional fields: palette (hero rig colours, see models/hero.js), yaw, r.
// Features with their own people (smith, shopkeeper, innkeeper) subclass Npc
// (entities/npc.js) instead.
import { getMaterial } from '../../core/materials.js';
import { makeHero } from '../../models/hero.js';
import { Npc } from '../npc.js';
import { registerEntity } from '../registry.js';

export const TOWNSFOLK = {
  tunic: 0x9a6a44,
  tunicLight: 0xb8865a,
  cap: 0x5a6f9c,
  hair: 0x6e4b33,
  belt: 0x4a3223,
  leg: 0xd9cfae,
  boot: 0x4a3223,
  blade: null,
  shield: null,
};

registerEntity('npc', (opts) => new Npc(opts, { rig: makeHero(getMaterial('character'), { ...TOWNSFOLK, ...opts.palette }), wander: 2 }));

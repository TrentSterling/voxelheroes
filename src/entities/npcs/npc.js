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
import { befriend } from '../../game/npc-talk.js';
import { handleTalk, tickErrandMarker } from '../../game/errands.js';

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

// The charm layer (game/errands.js): a persistent "!" or "?" over anyone with an errand, a
// delivery due, or a heart event ready, and the errand conversation in place of the default
// chat whenever there is one to have. Falls straight through to Npc's own talk() otherwise.
class VillagerNpc extends Npc {
  update(dt) {
    super.update(dt);
    tickErrandMarker(this);
  }
  onInteract(player) {
    if (!this.out) return false;
    this.face(player.x, player.z);
    this.mind.mode = 'watch';
    this.mind.greeted = true;
    const offer = handleTalk(this);
    const r = offer ?? this.talk(player);
    if (offer) {
      Promise.resolve(r).then(() => {
        const f = befriend(this.name);
        if (f.up) this.heartUp();
      });
    }
    return true;
  }
}

registerEntity('npc', (opts) => new VillagerNpc(opts, { rig: makeHero(getMaterial('character'), { ...TOWNSFOLK, ...opts.palette }), wander: 2 }));

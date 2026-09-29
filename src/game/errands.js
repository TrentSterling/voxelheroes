// Village errands (Stardew-style): a few named Mossbrook folk each want one thing, and pay
// something worth having. Keyed by NPC name so entities/npcs/** can wire it in without the
// world/areas lane touching a line: entities/npcs/npc.js routes every plain townsfolk's talk
// through handleTalk() first, entities/npcs/slice.js adds the "!"/"?" marker to its own people.
//
//   state.errands = { Hettie: { status: 'active', found: false }, _smithDiscount: 20 }
//   handleTalk(npc)        called from onInteract; a Promise if it takes over the conversation
//                          (an offer, a turn-in, or a delivery), else null/undefined and the NPC's
//                          own talk() runs as normal (chat, gifts): even mid-errand, unsatisfied
//   tickErrandMarker(npc)  called from update(dt); shows '!' (offer/heart event/delivery due) or
//                          '?' (in progress) over the NPC's head, a little bounce on every change
//
// need.type: 'item' (forage or ammo, counted and spent), 'deliver' (carry word to another named
// npc, who hands the reward over and closes the giver's errand), 'screen' (visit a screen key
// while active), 'bush' (cut a bush tile on a screen while active), 'time' (be talked to inside
// an hour window). reward.type: 'heart-piece' | 'coins' | 'bombs' | 'smith-discount' | 'keepsake'.
import { defineState, state } from '../core/state.js';
import { on } from '../core/events.js';
import { getTile } from '../world/tiles.js';
import { ammo, useAmmo } from '../items/inventory.js';
import { grant } from '../systems/grants.js';
import { hour } from './clock.js';
import { addCoins, addHeartPiece } from './vitals.js';
import { talksWith, pendingHeartEvent } from './npc-talk.js';
import { showDialog, ask } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';

defineState('errands', () => ({}));

const ERRANDS = {
  Hettie: {
    ask: ['The Kettle looks so bare some mornings.', 'If you are out cutting grass and find wildflowers, would you bring me three?'],
    give: ['Oh, they are perfect! The room already smells better.', 'Here, I saved this for you.'],
    need: { type: 'item', item: 'wildflower', amount: 3 },
    reward: { type: 'heart-piece' },
  },
  'Old Tobin': {
    ask: ['There is a stump behind my bench that has outlived its welcome.', 'Bring me a bomb and I will see to it. If you can spare one.'],
    give: ['Hmph. About time something around here got blown up on purpose.', 'Here. Do not spend it all in one place.'],
    need: { type: 'item', item: 'bombs', amount: 1 },
    reward: { type: 'coins', amount: 40 },
  },
  Rowan: {
    ask: ['I owe Guard Oswin a word of thanks, for the timber he let me take off the castle grounds.', 'Would you carry it to him? Down Castle Road, south to Crownhold Courtyard.'],
    need: { type: 'deliver', to: 'Guard Oswin' },
    reward: { type: 'smith-discount', amount: 20 },
    arrive: ['Rowan sent you? ...Tell him the timber squares up fine.', 'Here, tell the smith Guard Oswin sends his thanks too. Ask for the soldier\'s rate.'],
    thanks: 'Word came back already? You are faster than the post.',
  },
  Nell: {
    ask: ['I lost my locket out past the West Gate, somewhere on the crossing before the barrow.', 'Little gold thing, shaped like a leaf. Would you look, if you are headed that way?'],
    give: ['You found it! I thought it was gone for good.', 'Keep the ribbon. It matches your eyes, or it would, under that helmet.'],
    need: { type: 'screen', key: 'ow-3-2:1,1' },
    reward: { type: 'keepsake', name: 'A faded ribbon', line: 'Something to remember the day you found what was lost.' },
  },
  Rook: {
    ask: ['Lost my lucky dice weeks ago, somewhere in the brush by this gate.', 'Cut through the bushes around here if you get a chance.'],
    give: ['My dice! I have been rolling pebbles for weeks.', 'Here, take these. I have a spare bag of something louder anyway.'],
    need: { type: 'bush', screen: 'v1:0,1' },
    reward: { type: 'bombs', amount: 3 },
  },
  'Sister Anwe': {
    ask: ['I light a candle for the barrow\'s dead every evening.', 'Come back at dusk and sit with me a while, if you would.'],
    give: ['Thank you for sitting with me.', 'Take this, for the road. The dead do not need coin.'],
    need: { type: 'time', from: 17.5, to: 21.5 },
    reward: { type: 'coins', amount: 25 },
  },
};

// ---------------------------------------------------------------- need checks
function count(item) {
  return item === 'wildflower' ? (state.forage?.wildflower ?? 0) : ammo(item);
}

function consume(item, amount) {
  if (item === 'wildflower') state.forage.wildflower = Math.max(0, (state.forage?.wildflower ?? 0) - amount);
  else useAmmo(item, amount);
}

function satisfied(def, rec) {
  const n = def.need;
  if (n.type === 'item') return count(n.item) >= n.amount;
  if (n.type === 'screen' || n.type === 'bush') return !!rec.found;
  if (n.type === 'time') return hour() >= n.from && hour() < n.to;
  return false; // 'deliver' resolves at the target, never at the giver
}

function deliveryTargetEntry(npcName) {
  return Object.entries(ERRANDS).find(([giver, def]) => def.need.type === 'deliver' && def.need.to === npcName && state.errands[giver]?.status === 'active');
}

// ---------------------------------------------------------------- rewards
function applyReward(name, reward) {
  if (reward.type === 'heart-piece') {
    addHeartPiece(1);
    toast(`${name} gave you a piece of heart`, 2.4);
  } else if (reward.type === 'coins') {
    addCoins(reward.amount, 'errand');
    toast(`${name} gave you ${reward.amount} coins`, 2.2);
  } else if (reward.type === 'bombs') {
    grant('bombs', reward.amount, { source: 'npc', fanfare: false });
    toast(`${name} gave you ${reward.amount} bombs`, 2.2);
  } else if (reward.type === 'smith-discount') {
    state.errands._smithDiscount = (state.errands._smithDiscount ?? 0) + reward.amount;
    toast(`${name}'s word is worth ${reward.amount} coins off, next time you see the smith`, 2.6);
  } else if (reward.type === 'keepsake') {
    toast(`${reward.name}. ${reward.line}`, 3.2);
  }
}

// A discount promised by an errand pays off on the next smith upgrade, whichever it is.
on('sword-upgrade', ({ cost }) => {
  const d = state.errands?._smithDiscount;
  if (!d) return;
  const refund = Math.min(d, cost);
  addCoins(refund, 'errand');
  toast(`Rowan's word saved you ${refund} coins`, 2.4);
  state.errands._smithDiscount = 0;
});

// ---------------------------------------------------------------- found flags (screen / bush)
on('room-enter', ({ screen }) => {
  for (const [name, def] of Object.entries(ERRANDS)) {
    if (def.need.type !== 'screen' || def.need.key !== screen.key) continue;
    const rec = state.errands[name];
    if (rec?.status === 'active') rec.found = true;
  }
});

let bushHooked = false;
on('room-enter', () => {
  if (bushHooked) return;
  for (const set of ['overworld', 'town']) {
    const def = getTile(set, 'B');
    if (!def) continue;
    const before = def.onSword;
    def.onSword = (ctx) => {
      before?.(ctx);
      for (const [name, edef] of Object.entries(ERRANDS)) {
        if (edef.need.type !== 'bush' || edef.need.screen !== ctx.screen?.key) continue;
        const rec = state.errands[name];
        if (rec?.status === 'active') rec.found = true;
      }
    };
    bushHooked = true;
  }
});

// ---------------------------------------------------------------- the conversation
async function runOffer(npc, def) {
  const sp = { speaker: npc.name };
  const intro = talksWith(npc.name) === 0 && npc.lines ? (Array.isArray(npc.lines) ? npc.lines : [npc.lines]) : [];
  const pick = await ask([...intro, ...def.ask], ["I'll help", 'Not now'], sp);
  if (pick === 0) state.errands[npc.name] = { status: 'active', found: false };
  return true;
}

// Only called once satisfied() is true (handleTalk checks first): while it is still short, the
// "?" marker is the whole story and the NPC's own chat (and gifts) carry on as normal.
async function runProgress(npc, def, rec) {
  const sp = { speaker: npc.name };
  if (def.need.type === 'item') consume(def.need.item, def.need.amount);
  await showDialog(def.give, sp);
  applyReward(npc.name, def.reward);
  rec.status = 'done';
  npc.bubble.emote('♥', 1.8);
  return true;
}

async function runDeliveryTarget(npc, [giverName, def]) {
  const sp = { speaker: npc.name };
  await showDialog(def.arrive, sp);
  applyReward(giverName, def.reward);
  state.errands[giverName].status = 'done';
  npc.bubble.emote('✦', 1.8);
  return true;
}

// Called from onInteract, before the default talk: a Promise while it owns this conversation
// (offering, turning in, or a delivery), else null/undefined so the caller falls back to the
// NPC's own talk(), which is also what happens while an accepted errand is still short: the
// hero can still chat and give gifts, the "?" marker is the only nag.
export function handleTalk(npc) {
  const asTarget = deliveryTargetEntry(npc.name);
  if (asTarget) return runDeliveryTarget(npc, asTarget);
  const def = ERRANDS[npc.name];
  if (!def) return null;
  const rec = state.errands[npc.name];
  if (!rec || rec.status === 'none') return runOffer(npc, def);
  if (rec.status === 'active' && satisfied(def, rec)) return runProgress(npc, def, rec);
  if (rec.status === 'done' && def.thanks && !rec.thanked) {
    rec.thanked = true;
    return showDialog(def.thanks, { speaker: npc.name }).then(() => true);
  }
  return null;
}

// ---------------------------------------------------------------- the overhead marker
function markerFor(npc) {
  if (deliveryTargetEntry(npc.name)) return '!';
  const def = ERRANDS[npc.name];
  if (def) {
    const rec = state.errands[npc.name];
    if (!rec || rec.status === 'none') return '!';
    if (rec.status === 'active') return satisfied(def, rec) ? '!' : '?';
  }
  return npc.name && pendingHeartEvent(npc) ? '!' : null;
}

// Called from update(dt): a persistent icon (long life, so it survives many frames) that reasserts
// itself the moment a greet bark or a delivered errand clears it, each return popping in fresh.
export function tickErrandMarker(npc) {
  const sym = markerFor(npc);
  const showing = npc.bubble.mark === sym;
  if (sym && !showing) npc.bubble.emote(sym, 9999);
  else if (!sym && npc._errandMarked) npc.bubble.e = null;
  npc._errandMarked = !!sym;
}

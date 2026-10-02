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
import { defineState, state, hasFlag, setFlag } from '../core/state.js';
import { on } from '../core/events.js';
import { getTile } from '../world/tiles.js';
import { ammo, useAmmo, hasItem } from '../items/inventory.js';
import { grant } from '../systems/grants.js';
import { hour } from './clock.js';
import { addCoins } from './vitals.js';
import { talksWith, pendingHeartEvent } from './npc-talk.js';
import { showDialog, ask } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { entities, spawn } from '../entities/manager.js';
import { world } from '../world/world.js';

defineState('errands', () => ({}),{fromJSON(value){
  const records=JSON.parse(JSON.stringify(value));
  // Older saves paid Rook for cutting any bush. Offer the new adventure
  // without removing that earlier reward or resetting anyone else's quest.
  if(records.Rook&&records.Rook.quest!=='rook-dice')records.Rook={status:'none',found:false,quest:'rook-dice'};
  return records;
}});

const ERRANDS = {
  Hettie: {
    ask: ['The Kettle looks so bare some mornings.', 'If you are out cutting grass and find wildflowers, would you bring me three?'],
    give: ['Oh, they are perfect! The room already smells better.', 'Here, I saved this for you.'],
    need: { type: 'item', item: 'wildflower', amount: 3 },
    reward: { type: 'heart-piece' },
  },
  'Old Tobin': {
    ask: ['Those roots beside me hide my old cellar. My wife\'s medallion is still down there.', 'Blast the stump, then bring it back. The cellar\'s bronze seal rings for clay, never steel; I left spare pots by the stairs.'],
    give: ['Her medallion. I had almost forgotten the green in it.', 'That piece of heart was meant for the road. Keep it. And here, for making an old man remember.'],
    need: { type: 'flag', flag: 'errand:tobin:keepsake' },
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
    ask: ['I lost my locket out past the West Gate, somewhere on the crossing before the barrow.', 'Little gold thing, shaped like a leaf. I caught my ribbon in the bushes west of the path. Would you look there?'],
    give: ['You found it! I thought it was gone for good.', 'Keep the ribbon. It matches your eyes, or it would, under that helmet.'],
    need: { type: 'search', key: 'ow-3-2:1,1', x: 2, z: 9 },
    reward: { type: 'heart-piece' },
  },
  Rook: {
    quest:'rook-dice',
    ask: ['The bones in Briar Den stole my lucky dice. Its steps hide in the northwest brush at this gate.', 'Clear the hunter\'s bench and keep the bow. Two targets across the pit lower the bridge; my dice are in the vault beyond.'],
    give: ['My dice! Those bones will have to roll pebbles now.', 'Keep the bow. This quiver holds thirty arrows, and I packed three bombs for your next adventure.'],
    need: { type: 'flag', flag: 'errand:rook:dice' },
    progress: () => !hasItem('bow') ? 'Find the hunter\'s bow in Briar Den' : !hasFlag('rook:bridge') ? 'Shoot both far-bank targets' : 'Recover the dice from the vault',
    reward: { type: 'bundle', rewards: [{ type:'grant', id:'arrow-bag-1', label:'30-arrow quiver' }, { type:'bombs', amount:3 }] },
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
  if (n.type === 'screen' || n.type === 'bush' || n.type === 'search') return !!rec.found;
  if (n.type === 'time') return hour() >= n.from && hour() < n.to;
  if (n.type === 'flag') return hasFlag(n.flag);
  return false; // 'deliver' resolves at the target, never at the giver
}

function deliveryTargetEntry(npcName) {
  return Object.entries(ERRANDS).find(([giver, def]) => def.need.type === 'deliver' && def.need.to === npcName && state.errands[giver]?.status === 'active');
}

// ---------------------------------------------------------------- rewards
function applyReward(name, reward) {
  if (reward.type === 'bundle') {
    for(const part of reward.rewards)applyReward(name,part);
  } else if (reward.type === 'grant') {
    grant(reward.id,1,{source:'npc'});
  } else if (reward.type === 'heart-piece') {
    grant('heart-piece', 1, { source: 'npc', fanfare: false });
    toast(`${name} gave you a piece of heart`, 2.4);
  } else if (reward.type === 'coins') {
    addCoins(reward.amount, 'errand');
    toast(`${name} gave you ${reward.amount} coins`, 2.2);
  } else if (reward.type === 'bombs') {
    grant('bombs', reward.amount, { source: 'npc', fanfare: false, startAmmo: reward.amount });
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
function placeFind(name, need, screen) {
  if (state.errands[name]?.status !== 'active' || state.errands[name]?.found || hasFlag(`errand:${name}:found`)) return;
  if (screen.tiles[need.z]?.[need.x] === 'B') clearFindBush(need, screen);
  if (entities.some(e => !e.removed && e.type === 'quest-locket' && e.giver === name)) return;
  spawn('quest-locket', { x: screen.x0 + need.x + 0.5, z: screen.z0 + need.z + 0.5,
    giver: name, life: Infinity, netId: `quest:${name}:locket`, spawnFlag: `errand:${name}:found` });
}
function clearFindBush(need, screen) {
  // Regrowth must not bury the revealed object when the player comes back.
  const tile = getTile(screen.tileset, 'B');
  if (tile) {
    world.setTile(screen.x0 + need.x, screen.z0 + need.z, tile.becomes ?? '.', { rebuild: false, reason: 'quest-find' });
  }
}
on('room-enter', ({ screen }) => {
  for (const [name, def] of Object.entries(ERRANDS)) {
    if (def.need.type === 'search' && def.need.key === screen.key && hasFlag(`errand:${name}:revealed`)) placeFind(name, def.need, screen);
  }
});
on('room-enter', () => {
  if (bushHooked) return;
  const seen = new Set();
  for (const set of ['overworld', 'town']) {
    const def = getTile(set, 'B');
    if (!def || seen.has(def)) continue;
    seen.add(def);
    const before = def.onSword;
    def.onSword = (ctx) => {
      before?.(ctx);
      for (const [name, edef] of Object.entries(ERRANDS)) {
        const rec = state.errands[name];
        if (rec?.status !== 'active') continue;
        if (edef.need.type === 'bush' && edef.need.screen === ctx.screen?.key) rec.found = true;
        const n = edef.need;
        if (n.type === 'search' && n.key === ctx.screen?.key && n.x === ctx.x && n.z === ctx.z && ctx.world.tile(ctx.tx, ctx.tz) !== 'B') {
          if (!hasFlag(`errand:${name}:revealed`) && !rec.found) toast('A gold leaf catches the light. Pick it up!', 2.8);
          setFlag(`errand:${name}:revealed`); placeFind(name, n, ctx.screen);
        }
      }
    };
    bushHooked = true;
  }
});

export function findErrandObject(name) {
  const rec = state.errands[name];
  if (rec?.status !== 'active' || !ERRANDS[name]) return false;
  const first = !rec.found;
  rec.found = true; setFlag(`errand:${name}:found`);
  if (first) toast(`${name}'s locket found. Bring it back to Mossbrook.`, 3);
  return true;
}

const NOTES = {
  Hettie: ['Flowers for the Kettle', 'Mossbrook Square', 'Gather three wildflowers from the meadows, then bring them to Hettie.'],
  'Old Tobin': ['Beneath the roots', 'Mossbrook Square', 'Blast the stump beside Tobin, enter his root cellar, and ring the bronze seal with a thrown pot. Take the medallion from the revealed chest, then return to him.'],
  Rowan: ['A word for the guard', 'Mossbrook Square', 'Talk to Guard Oswin in Crownhold Courtyard, south of the village.'],
  Nell: ['The lost gold leaf', 'Mossbrook Square', 'Search the bushes west of the path at Barrow Crossing. Pick up the gold locket and return to Nell.'],
  Rook: ['The hunter\'s dice', 'West Gate / Briar Den', 'Cut the northwest stair-bush at West Gate. Clear the bench for a bow, shoot both far-bank targets, and recover Rook\'s dice from the vault.'],
  'Sister Anwe': ['A candle at dusk', 'Chapel Green', 'Talk to Anwe at Chapel Green between 5:30 pm and 9:30 pm.'],
};
const rewardText = reward => reward.type==='bundle'?reward.rewards.map(rewardText).join(' + '):reward.type==='grant'?reward.label:reward.type === 'heart-piece' ? 'A piece of heart' : reward.type === 'smith-discount' ? `${reward.amount} coins off at the smith` : `${reward.amount} ${reward.type}`;

// Derived from saved campaign state; the journal never completes a task itself.
export function errandEntries() {
  return Object.entries(ERRANDS).map(([giver, def]) => {
    const rec = state.errands[giver], n = def.need, [title, where, detail] = NOTES[giver];
    const status = rec?.status === 'done' ? 'done' : rec?.status === 'active' ? (satisfied(def, rec) ? 'ready' : 'active') : 'offer';
    let progress = status === 'offer' ? `Talk to ${giver} to accept` : status === 'done' ? 'Completed' : status === 'ready' ? `Return to ${giver}` : 'In progress';
    if (status === 'active' && n.type === 'item') progress = `${Math.min(count(n.item), n.amount)} / ${n.amount} ${n.item === 'wildflower' ? 'wildflowers' : n.item}`;
    if (status === 'active' && n.type === 'deliver') progress = `Deliver to ${n.to}`;
    if (status === 'active' && n.type === 'search') progress = hasFlag(`errand:${giver}:revealed`) ? 'Locket revealed; pick it up' : 'Search the crossing bushes';
    if (status === 'active' && n.type === 'time') progress = 'Return at dusk';
    if (status === 'active' && n.type === 'flag') progress = def.progress?.() ?? (hasFlag('village:tobin-cellar-open') ? 'Retrieve the cellar keepsake' : 'Blast the stump beside Tobin');
    return { id: `errand:${giver}`, giver, title, where, detail, status, progress, reward: rewardText(def.reward) };
  });
}

// ---------------------------------------------------------------- the conversation
async function runOffer(npc, def) {
  const sp = { speaker: npc.name };
  const intro = talksWith(npc.name) === 0 && npc.lines ? (Array.isArray(npc.lines) ? npc.lines : [npc.lines]) : [];
  const pick = await ask([...intro, ...def.ask], ["I'll help", 'Not now'], sp);
  if (pick === 0) state.errands[npc.name] = { status: 'active', found: false, ...(def.quest?{quest:def.quest}:{}) };
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

// What townsfolk say beyond their spawn-table lines: a personality per person (picked from the name,
// or opts.personality), with barks for walking past them, idling, being startled and being hit,
// and chat that warms up with friendship. Friendship lives in state.friends (saved):
//
//   befriend('Hettie')        -> { hearts, up }   one point per conversation, a heart per 3 points
//   heartsOf('Hettie')        -> 0..5
//   chatLine(npc)             the next line for a repeat conversation (rotates, by hearts)
//   bark(npc, 'greet')        a line for the speech bubble, or null
import { defineState, state } from '../core/state.js';

defineState('friends', () => ({}));

const MAX_HEARTS = 5;
const POINTS_PER_HEART = 3;

export const PERSONALITIES = {
  cheery: {
    greet: ['Morning, {hero}!', 'Lovely day for it!', 'Oh, hello again!', 'There you are!'],
    idle: ['La la la...', 'What a sky today.', 'Smell that bread?', 'Mm, fresh air.'],
    startled: ['Eek! Careful!', 'Whoa there!', 'Not so close with that!'],
    ouch: ['Ow! That smarts!', 'Hey! I felt that!'],
    chat: [
      ['Welcome to Mossbrook! Everyone waves here, you will get used to it.', 'If you are ever hungry, the inn does a fine stew.'],
      ['I saved you a smile, {hero}. Also a biscuit, but I ate that.', 'The chapel bell rings at dusk. I count the rings.'],
      ['You are the best thing to happen to this village since the new well.', 'Come by whenever. You are family now.'],
    ],
  },
  grumpy: {
    greet: ['Hmph.', 'You again.', 'Mind the flowers.', 'Keep walking.'],
    idle: ['Back in my day...', 'Too much noise.', 'Hmph. Weather.', 'Kids these days.'],
    startled: ['Watch that blade, fool!', 'Oi! Point it elsewhere!', 'Do you mind?!'],
    ouch: ['OW! Why I ought to...', 'You will pay for that!'],
    chat: [
      ['What do you want? I am busy doing nothing.', 'Do not trample the grass. It took years.'],
      ['Fine. You are not the worst. The worst was the last one.', 'The barrow was quiet when I was young. Quiet, I tell you.'],
      ['...I suppose you have earned a word. Thank you. For the monsters.', 'Do not tell anyone I said that.'],
    ],
  },
  gossip: {
    greet: ['Psst, {hero}!', 'Have you heard?', 'Oh! Come here, come here.', 'News, news!'],
    idle: ['...and then she said...', 'Did you see that?', 'I heard things.', 'Ooh, scandal.'],
    startled: ['Goodness! Swinging swords in the square?', 'I am telling everyone about this!'],
    ouch: ['Assault! In broad daylight!', 'Ow! Everyone will hear of this!'],
    chat: [
      ['The smith sings to his anvil when he thinks nobody is listening.', 'And the innkeeper once had a pet slime. Named it Gerald.'],
      ['They say the barrow warden is a great coiled serpent. Big as a barn!', 'Also, the guards cheat at cards. Tell no one.'],
      ['You are my favourite source, {hero}. Tell me everything you see out there.', 'I will make you famous. Well, more famous.'],
    ],
  },
  dreamy: {
    greet: ['Oh... hello.', 'Do you hear the wind?', 'You shine a little.', 'Mm? Oh, it is you.'],
    idle: ['The clouds look like sheep.', 'Hm hm hmm...', 'I wonder where rivers sleep.', '...'],
    startled: ['Oh! You startled the butterflies.', 'Eep. Too sharp, too sharp.'],
    ouch: ['That... hurt my feelings too.', 'Ow. Rude, but poetic.'],
    chat: [
      ['Sometimes I lie in the grass and let the bees decide where I go.', 'They never decide. Bees are indecisive.'],
      ['I dreamt of a tower of glass in the far north. You were climbing it.', 'You looked tired, but happy.'],
      ['When you leave, the village feels a size smaller.', 'Come back safe, {hero}. Please.'],
    ],
  },
  worker: {
    greet: ['Hey.', 'Busy day.', 'Afternoon.', 'Can\'t stop, sorry!'],
    idle: ['Right, where was I...', 'Heave... ho.', 'Almost done. Almost.', 'Need more twine.'],
    startled: ['Careful! I nearly dropped this!', 'Whoa! Not near the goods!'],
    ouch: ['Agh! My back!', 'Ow! I have work to do!'],
    chat: [
      ['Fences do not fix themselves. Neither do roofs. Or anything.', 'If you find good timber out there, I pay fair.'],
      ['You work hard too, I can tell. Calloused hands, both of us.', 'Take a break sometimes. I never do. Do as I say.'],
      ['I carved you something. It is a... well, it is a stick. A nice stick.', 'You are always welcome at my bench, {hero}.'],
    ],
  },
};
const KINDS = Object.keys(PERSONALITIES);

export function personalityOf(npc) {
  if (npc.personality && PERSONALITIES[npc.personality]) return npc.personality;
  let h = 0;
  for (const ch of npc.name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return KINDS[h % KINDS.length];
}

const fill = (s) => s.replace(/\{hero\}/g, state.profile?.name || 'Hero'); // as ui/dialog.js

function friend(name) {
  const F = state.friends ?? (state.friends = {});
  return (F[name] ??= { pts: 0, talks: 0 });
}

export const heartsOf = (name) => Math.min(MAX_HEARTS, Math.floor(friend(name).pts / POINTS_PER_HEART));

export function befriend(name, pts = 1) {
  const f = friend(name);
  const before = heartsOf(name);
  f.pts = Math.max(0, f.pts + pts);
  f.talks += pts > 0 ? 1 : 0;
  const hearts = heartsOf(name);
  return { hearts, up: hearts > before, down: hearts < before };
}

export function talksWith(name) {
  return friend(name).talks;
}

export function chatLine(npc) {
  const P = PERSONALITIES[personalityOf(npc)];
  const tier = Math.min(P.chat.length - 1, Math.floor(heartsOf(npc.name) / 2));
  const lines = P.chat[tier];
  const i = friend(npc.name).talks % lines.length;
  return fill(lines[i]);
}

export function bark(npc, kind) {
  const list = (npc.barks?.[kind]) ?? PERSONALITIES[personalityOf(npc)][kind];
  if (!list?.length) return null;
  npc.barkN = (npc.barkN ?? 0) + 1;
  return fill(list[(npc.barkN + (npc.seed ?? 0)) % list.length]);
}

export const heartString = (n) => (n > 0 ? ' ' + '♥'.repeat(n) : '');

// ---------------------------------------------------------------- gifts (once a day each)
// What can be given: wildflowers (cut from flower tiles, game/forage.js), a pouch of 10 coins, a bomb.
export const GIFTS = {
  wildflower: { label: 'Wildflower', has: () => (state.forage?.wildflower ?? 0) > 0, take: () => state.forage.wildflower--, name: 'a wildflower' },
  coins: { label: '10 coins', has: () => (state.coins ?? 0) >= 10, take: () => (state.coins -= 10), name: 'ten coins' },
  bomb: { label: 'A bomb', has: () => (state.inventory?.ammo?.bombs ?? 0) > 0, take: () => state.inventory.ammo.bombs--, name: 'a bomb' },
};
const TASTE = {
  cheery: { wildflower: 'love', coins: 'like', bomb: 'dislike' },
  grumpy: { coins: 'love', bomb: 'like', wildflower: 'dislike' },
  gossip: { wildflower: 'love', coins: 'like', bomb: 'dislike' },
  dreamy: { wildflower: 'love', coins: 'neutral', bomb: 'dislike' },
  worker: { bomb: 'love', coins: 'like', wildflower: 'neutral' },
};
const GIFT_POINTS = { love: 3, like: 2, neutral: 1, dislike: -1 };
const REACTIONS = {
  love: { cheery: 'Oh! {gift}! I love these! You are wonderful!', grumpy: '...{gift}. Hmph. Fine. It is perfect.', gossip: '{gift}? For me? Wait until everyone hears!', dreamy: '{gift}... it smells like a morning I once had.', worker: '{gift}! Now THAT will clear the stumps. Thank you!' },
  like: 'Thank you, {hero}. That is kind.',
  neutral: 'Oh. {gift}. Thanks, I suppose.',
  dislike: { cheery: 'Oh... um. {gift}. That is... something!', grumpy: '{gift}? Take your weeds elsewhere.', gossip: 'A bomb? Are you trying to start a scandal?', dreamy: '{gift}... it makes the air feel sharp.', worker: 'I have no use for {gift}, sorry.' },
};

export const giftableNow = (npc) => friend(npc.name).giftDay !== (state.clock?.day ?? 1) && Object.values(GIFTS).some((g) => g.has());
export const giftChoices = () => Object.entries(GIFTS).filter(([, g]) => g.has());

// Give gift `id` to npc: -> { line, taste, up }
export function giveGift(npc, id) {
  const g = GIFTS[id];
  if (!g?.has()) return null;
  g.take();
  const p = personalityOf(npc);
  const taste = TASTE[p]?.[id] ?? 'neutral';
  const f = friend(npc.name);
  f.giftDay = state.clock?.day ?? 1;
  const r = befriend(npc.name, GIFT_POINTS[taste]);
  f.talks -= GIFT_POINTS[taste] > 0 ? 1 : 0; // a gift is not a conversation
  const tpl = typeof REACTIONS[taste] === 'string' ? REACTIONS[taste] : REACTIONS[taste][p];
  const line = fill(tpl.replace('{gift}', g.name).replace(/^./, (c) => c.toUpperCase()));
  return { line, taste, ...r };
}

// ---------------------------------------------------------------- heart events
// At 2 and 4 hearts the next conversation is a scene with a present: coins, then a heart piece.
const HEART_EVENTS = {
  2: {
    cheery: ['You know what, {hero}? You make this place brighter.', 'Here. I have been saving these for someone who deserved them.'],
    grumpy: ['...Sit. No, not there. There.', 'My old travelling purse. Take it before I change my mind.'],
    gossip: ['I have a secret, and it is about you. Everyone likes you!', 'Also, I found this purse by the well. Finders keepers, now it is yours.'],
    dreamy: ['I dreamt you would come today. I made you a gift in the dream.', 'And look, it came true. Mostly coins.'],
    worker: ['Good work deserves good pay. You have been working on all of us.', 'Take this. Earned, every coin.'],
  },
  4: {
    cheery: ['I made you something special. It holds a little of my luck.'],
    grumpy: ['This was my wife\'s. She would have liked you. Keep it close.'],
    gossip: ['This is the most precious thing I have ever heard about. I mean, owned.'],
    dreamy: ['I found this glowing in the grass where the fireflies sleep. It is yours.'],
    worker: ['Carved it myself, from the oldest oak. It beats like a heart. Strange, eh?'],
  },
};

export function pendingHeartEvent(npc) {
  const f = friend(npc.name);
  const done = (f.events ??= []);
  const h = heartsOf(npc.name);
  for (const at of [2, 4]) if (h >= at && !done.includes(at)) return at;
  return null;
}

export function heartEventLines(npc, at) {
  friend(npc.name).events.push(at);
  return (HEART_EVENTS[at][personalityOf(npc)] ?? HEART_EVENTS[at].cheery).map(fill);
}

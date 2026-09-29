// What townsfolk say beyond their spawn-table lines: a personality per person (picked from the name,
// or opts.personality), with barks for walking past them, idling, being startled and being hit,
// and chat that warms up with friendship. Friendship lives in state.friends (saved):
//
//   befriend('Hettie')        -> { hearts, up }   one point per conversation, a heart per 3 points
//   heartsOf('Hettie')        -> 0..5
//   chatLine(npc)             the next line for a repeat conversation (rotates, by hearts)
//   bark(npc, 'greet')        a line for the speech bubble, or null
import { defineState, state, hasFlag } from '../core/state.js';
import { hour } from './clock.js';

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

// A few named folk are pinned to a personality here instead of left to the name hash (fun audit:
// Sage Oriel hashed to grumpy and greeted the hero with "Keep walking", a poor fit for a robed
// mystic who hands out spells).
const NAMED_PERSONALITY = { 'Sage Oriel': 'dreamy' };

export function personalityOf(npc) {
  if (npc.personality && PERSONALITIES[npc.personality]) return npc.personality;
  if (NAMED_PERSONALITY[npc.name]) return NAMED_PERSONALITY[npc.name];
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
  if (kind === 'greet') {
    const ctx = contextGreet(npc);
    if (ctx) return ctx;
    const beat = storyLine(npc);
    if (beat) return beat;
  }
  const list = (npc.barks?.[kind]) ?? PERSONALITIES[personalityOf(npc)][kind];
  if (!list?.length) return null;
  npc.barkN = (npc.barkN ?? 0) + 1;
  return fill(list[(npc.barkN + (npc.seed ?? 0)) % list.length]);
}

// ---------------------------------------------------------------- ambient reactions (charm)
// A greeting that notices the world instead of just the weather: hurt and needing a bed, the
// barrow's warden dead, sent by the king, a fat purse, a blade that has grown, the golden hour, or
// a fresh morning. Checked highest priority first, rolled once per NPC per day so the village does
// not repeat itself by afternoon, and even then only some of the time, so most hellos stay
// personal. Every context has 3+ lines a personality can draw from, not one line repeated forever.
const CONTEXT = [
  {
    when: () => state.hp > 0 && state.hp <= (state.maxHp ?? 1) * 0.34,
    lines: {
      cheery: ['Oh, {hero}! You are hurt. Sit a moment, at least.', 'Careful now, that barrow leaves its mark.', 'You look worn thin. The inn has a bed with your name on it.'],
      grumpy: ['You are bleeding on my step. Go see Wenna.', 'Hmph. Looks like the barrow won that round.', 'Sit down before you fall down, fool.'],
      gossip: ['Oh my, look at the state of you! What happened out there?', 'You are limping! Everyone will want to know what got you.', 'That is going to leave a story, and a scar.'],
      dreamy: ['You carry the barrow\'s bruises today. I can see it in your eyes.', 'Rest, {hero}. Even the moon takes a night off.', 'You look tired in a way sleep alone will not fix.'],
      worker: ['You are hurt. No shame in mending before you swing again.', 'Even a cracked axe handle gets fixed before the next tree.', 'Go see Wenna. A hero bleeding out in my square is bad for business.'],
    },
  },
  {
    when: () => hasFlag('boss:d1'),
    lines: {
      cheery: ['You did it! The whole valley sleeps easier because of you.', 'Mossbrook throws you a feast in its heart, even if nobody has cooked one yet.', 'The children play barrow-warden now. You are already a legend.'],
      grumpy: ['Heard the barrow went quiet. ...Good. Fine work, I suppose.', 'Suppose I will stop bolting my door at night. Suppose.', 'Do not let it go to your head. ...Too late, probably.'],
      gossip: ['Everyone is talking about the barrow! You are the whole conversation.', 'They say the warden was as big as a barn! Is that true? Tell me everything!', 'You are the only thing anyone talks about at the well these days.'],
      dreamy: ['I slept without the old dream, the one with the coils. Thank you for that.', 'The barrow used to hum at night. It is quiet now. I miss it a little, and I do not.', 'I dreamt of the coils again, but this time they were still.'],
      worker: ['Barrow is done, they say. One less thing between us and a quiet winter.', 'Fewer nights boarding the windows now. That is worth something.', 'Whatever you did out there, it held. Good work holds.'],
    },
  },
  {
    when: () => (state.coins ?? 0) >= 100,
    lines: {
      cheery: ['Look at that purse! Somebody has been busy.', 'Coins like that could buy the whole market twice over!', 'Save a little for the inn, {hero}. You have earned a soft bed.'],
      grumpy: ['Coins jingling like that, you are either very good or very loud. Probably both.', 'Do not flash that around. Mossbrook has pickpockets too, you know.', 'All that coin and still wearing that? Go see Brannoc.'],
      gossip: ['Ooh, listen to those coins! Do tell me where they came from.', 'A purse that heavy? Do tell me where you have been!', 'People will start asking you for loans. Mark my words.'],
      dreamy: ['I heard your coins before I saw you. A little song, all their own.', 'Coins pile up like autumn leaves around you lately.', 'I wonder what all that gold dreams about, jingling in the dark.'],
      worker: ['That is a fair haul. Spend some of it on something that lasts.', 'Spend it on steel, not trinkets. Steel outlasts trinkets.', 'That is a season\'s wages, right there in your pocket.'],
    },
  },
  {
    when: () => (state.swords?.owned?.length ?? 0) > 1 || Object.values(state.swords?.bought ?? {}).some((b) => Object.keys(b).length),
    lines: {
      cheery: ['That blade of yours has grown since I last saw it!', 'It catches the light so nicely now!', 'Brannoc does good work. You picked the right smith.'],
      grumpy: ['Hmph. At least the smith is putting his hours to use on you.', 'Least the coin went somewhere useful, for once.', 'Sharper blade, same reckless swing, I bet.'],
      gossip: ['Is that a new edge on your sword? Everyone will want to know where you got it.', 'A new edge, is it? Everyone at the well will want to know the price.', 'You will need a bigger sheath at this rate.'],
      dreamy: ['Your blade catches the light differently now. Sharper dreams, maybe.', 'It hums different now, like it remembers being worked.', 'Steel dreams too, I think. Yours dreams of the barrow.'],
      worker: ['Good steel, that. Keep it fed and it will keep you standing.', 'Good steel deserves good care. Keep it oiled.', 'That is coin well spent. Not every smith earns his keep.'],
    },
  },
  {
    when: () => hour() >= 17.5 && hour() < 20,
    lines: {
      cheery: ['The evening light always makes the square look kinder.', 'The lanterns come on soon. My favorite part of the day.', 'Supper is nearly ready, if you are hungry, {hero}.'],
      grumpy: ['Getting dark. Mind the road, or do not, see if I care.', 'Almost curfew. Do not make me come find you.', 'The barrow gets bolder after dark. Should you not be out there instead?'],
      gossip: ['Dusk is the best time to hear things. Everyone talks slower.', 'Dusk is when the real gossip starts. Stay a while.', 'Everyone slows down at this hour. Easier to catch them talking.'],
      dreamy: ['The light goes gold right about now. I could watch it forever.', 'The sky goes the color of a bruised peach. I love it.', 'Something about dusk makes the village feel like it is holding its breath.'],
      worker: ['Almost done for the day. My back agrees with the hour.', 'Packing up the tools. Same time tomorrow.', 'Last light of the day. Make it count.'],
    },
  },
  {
    when: () => hour() >= 7 && hour() < 11,
    lines: {
      cheery: ['Morning, {hero}! The bread is fresh and so is the day.', 'Dew is still on the grass. Best time to be out.', 'Good morning! The square always smells like Wenna\'s baking this early.'],
      grumpy: ['Morning already. Hmph.', 'Too early for this. Say your piece.', 'The rooster woke me before you did, at least.'],
      gossip: ['You are up early! Did something happen overnight?', 'Morning gossip is the freshest gossip.', 'Barely light out and you are already causing a stir.'],
      dreamy: ['I like mornings. The village has not decided what it is doing yet.', 'The mist off the pasture looks like it is thinking.', 'Everything is quiet before the day starts arguing with itself.'],
      worker: ['Early start. I respect that.', 'Best work gets done before the heat.', 'Morning. Already three things need fixing.'],
    },
  },
  {
    when: () => talksWith('King Aldric') > 0,
    lines: {
      cheery: ['The king sent for you himself! Mossbrook is lucky to have you.', 'Word is the king trusts you. That says plenty.', 'Ever since Crownhold called on you, this village walks a little taller.'],
      grumpy: ['So the king picked you. Could have done worse, I suppose.', 'Royalty sending errands to the likes of us. Strange days.', 'Heard the king armed you himself. Do not waste the steel.'],
      gossip: ['You spoke with the king? What is he like? Tell me everything!', 'The whole village knows Crownhold sent for you. You are famous now.', 'Fancy, talking to royalty and still stopping to chat with me.'],
      dreamy: ['I dreamt of a crown once. It looked heavier than it should.', 'The king\'s blade suits you. It looks like it was waiting for someone.', 'Funny, being chosen by a king and still smelling like the pasture.'],
      worker: ['King\'s business, is it? Explains the hurry.', 'Royal errands do not fix fences, but fair enough.', 'The king picked well, for what it is worth from me.'],
    },
  },
];

function contextGreet(npc) {
  if (!npc.name) return null;
  const f = friend(npc.name);
  const today = state.clock?.day ?? 1;
  if (f.ctxDay === today) return null;
  const hit = CONTEXT.find((c) => c.when());
  if (!hit || npc.next() < 0.4) return null;
  f.ctxDay = today;
  const list = hit.lines[personalityOf(npc)] ?? hit.lines.cheery;
  return fill(list[Math.floor(npc.next() * list.length)]);
}

// ---------------------------------------------------------------- a small story, per villager
// One quiet, personal beat further into a friendship, shown as an idle-bark bubble the first time
// talksWith(name) crosses each threshold, instead of a plain mood mutter (fun audit: named
// villagers had errands and gossip but no throughline of their own once you kept coming back).
const STORY_AT = [1, 3, 6];
const STORY = {
  Hettie: [
    'The Kettle was near empty most mornings, before you started stopping by.',
    'I keep your table clear now. Force of habit, I suppose. A good one.',
    'My mother ran this kettle before me. She would have liked you. Loud, but kind.',
  ],
  'Old Tobin': [
    'That bench was my father\'s. Mind it, and I might forgive you the noise.',
    'Used to think adventurers were all wind and no work. Adjusting that, slowly.',
    'Do not tell anyone, but I look forward to you scaring off the crows.',
  ],
  Nell: [
    'That locket you found? It was my mother\'s. I do not say that to just anyone.',
    'I have not lost a single thing since you started looking out for me. Funny, that.',
    'Do not spread it around, but you are the best gossip Mossbrook has had in years.',
  ],
  Rowan: [
    'These fences will outlive both of us, if I set them true.',
    'Guard Oswin still asks after you. Made a good impression at Crownhold.',
    'I do not say thanks often. So: thanks. For the timber, and the rest.',
  ],
  Rook: [
    'Found my dice, found my luck. Been rolling well since.',
    'Come by the bushes sometime, I will teach you the game. Loser buys.',
    'You have got good hands, for someone who swings a sword for a living.',
  ],
  'Sister Anwe': [
    'I light one more candle now. For whoever you have not saved yet.',
    'Sitting with me at dusk, most heroes would not bother. You did.',
    'The barrow\'s dead sleep easier since you came. So do I.',
  ],
  Cobb: [
    'Still carrying flour up this hill. Some things a king cannot fix.',
    'The castle kitchens finally noticed the good flour. Small victories.',
    'You always nod when you pass. Most folk headed to see the king do not.',
  ],
  'Guard Oswin': [
    'The king still asks after you, when you are not around.',
    'Rowan\'s word reached me. The timber squares up fine, tell him.',
    'Ten years at this gate, and you are the first thing worth watching for.',
  ],
  'Guard Pell': [
    'Nights are easier on this gate since the barrow quieted down.',
    'Oswin will not stop talking about you. It is getting old. In a good way.',
    'Watch yourself out there. I would rather write good news home than bad.',
  ],
  'Farmer Dobb': [
    'Wife still has not forgiven me for the pots you broke. Worth it, for the coins under them.',
    'Crops came in heavy this season. Feels like the land noticed you cleared the barrow.',
    'You are welcome at my table, if you ever tire of inn stew.',
  ],
  Pip: [
    'I timed you! You are almost as fast as a slime now. Almost.',
    'When I grow up I am going to fight monsters too. Mum says not until I am eight.',
    'You are my favorite adventurer. You are also the only one I know, but still.',
  ],
  Tam: [
    'Told you there were coins under those bushes. Told you.',
    'I have a system for finding good bushes now. I will not share it.',
    'You cut bushes different than everyone else. Like you mean it.',
  ],
  'Old Wick': [
    'Still say that blade comes back to your hand. Someday you will find it and prove me right.',
    'Barrow stories used to just be stories. Not anymore, thanks to you.',
    'I have got more legends where that came from, if you ever want to listen.',
  ],
  'Warden Cray': [
    'That door still opens on its own sometimes. I have stopped asking why.',
    'The keys you find in there only work in there. Learned that one the hard way.',
    'Barrowfield is a little less strange with you passing through it.',
  ],
  'King Aldric': [
    'My father\'s blade suits you better than it ever suited me.',
    'Crownhold sleeps easier with you out there. So do I, if I am honest.',
    'Four orbs, they say. You have one. I have every faith in the rest.',
  ],
  Mags: [
    'Business has been good since the roads got safer. Thank you for that, quietly.',
    'I set aside the good twine for you now. Do not tell the others.',
    'Tallow and twine do not thank you enough. So: thank you.',
  ],
  Brannoc: [
    'Every blade I work gets a little of my care into it. Yours has had plenty by now.',
    'You come back for more work than most. Good. Keeps my hands busy.',
    'A smith is only as good as the hero swinging his steel. You make me look good.',
  ],
  Wenna: [
    'You sleep less than anyone I have ever kept a room for.',
    'I keep the good blanket ready for you now. Force of habit.',
    'Fall asleep out there and you wake up here. That is the whole promise. I keep it.',
  ],
  'Tinker Wyll': [
    'Those boots held up better than I hoped. You are hard on equipment, in a good way.',
    'I have got three more ideas half built. None of them are boots. You will see.',
    'Most folk think I talk to myself out here. You are the only one who answers.',
  ],
  'Sage Oriel': [
    'The orb chose you, not the other way around. I have seen that happen only a handful of times.',
    'The barrow\'s coils are quiet now. I can finally hear myself think down here.',
    'Three more orbs wait in corners even I have not mapped. You will find them.',
  ],
};

function storyLine(npc) {
  const beats = STORY[npc.name];
  if (!beats) return null;
  const f = friend(npc.name);
  const step = f.storyStep ?? 0;
  if (step >= beats.length || step >= STORY_AT.length) return null;
  if (talksWith(npc.name) !== STORY_AT[step]) return null;
  f.storyStep = step + 1;
  return fill(beats[step]);
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

// Shared state: every field more than one stream reads or writes, declared
// once so the HUD, menus and saves can use it before the stream that fills it
// lands. docs/CONTRACTS.md ("State") has the full table with owners; the
// owner is the only stream that changes a field's shape or default.
//
// Units: life in half-heart units (2 per heart), magic in whole gems, money in
// coins, times in seconds. Core fields declared in core/state.js: hp, maxHp
// (life units), coins, keys (small keys per key group), flags, tileEdits.
// Declared elsewhere: inventory (items/inventory.js), respawn and pos
// (systems/flow.js), camera (feat/world's per-slot camera choice).
//
// Writers go through the APIs (game/vitals.js for life, magic and coins;
// game/swords.js for swords; game/dungeons.js for dungeon progress; ...), so
// events fire. Reading state directly is always fine.
import { defineState } from '../core/state.js';

const setField = { toJSON: (s) => [...s], fromJSON: (a) => new Set(Array.isArray(a) ? a : []) };

// ---- life and magic (vitals.js)
defineState('heartPieces', () => 0); // heart pieces collected in all (every 4th adds a heart)
defineState('magic', () => 0); // current magic, whole gems
defineState('maxMagic', () => 0); // magic containers + learned spells + the class's start
defineState('tokens', () => 0); // sword tokens (rare drops, chests) for the token trader

// ---- who the hero is (progress.js; the ui's new-game flow fills it)
defineState('profile', () => ({
  name: '', // at most TUNING.profile.nameMax characters
  class: null, // 'life' | 'balanced' | 'magic'; null: an M1-style game (3 hearts, no magic)
  trait: null, // 'might' (+1 strength) | 'focus' (spells cost 1 less) | null
  model: 'hero', // cosmetic model id (the hero editor, M6)
  difficulty: 'normal', // 'normal' | 'hard' | 'one-hit'
  plus: 0, // new game+ round
}));

// ---- gear (hero): passive equipment, not on the B ring
defineState('gear', () => ({
  shield: 1, // shield tier 1-6 (0: none); each new shield replaces the last
  boots: null, // null | 'boots-dash' | 'boots-swamp' (swamp boots also dash)
  ring: null, // null | 'ring-quarter' | 'ring-half' (the better one applies)
}));

// ---- swords (swords.js)
defineState('swords', () => ({
  owned: ['blade-start'],
  equipped: 'blade-start',
  bought: {}, // { swordId: { length: 2, strength: 1, ... } } levels bought at a smith
  spent: {}, // { swordId: coins spent on it } (counts against its budget)
}));

// ---- items (items stream; the inventory itself is state.inventory)
defineState('bags', () => ({ bombs: 0, arrows: 0 })); // capacity level: index into TUNING.items.bomb/arrow.capacity
defineState('bottles', () => []); // one entry per bottle owned: 'empty' | 'potion-life' | 'potion-magic' | 'elixir'
defineState('effects', () => ({}), { persist: false }); // timed effects: { reflect: seconds left, ... } (effects.js)

// ---- dungeons (dungeons.js). Maps, boss keys, bosses and orbs are flags
// (dungeon:<id>:map, dungeon:<id>:bosskey, boss:<dungeon id>, orb:<n>: the
// gameplay spec's Appendix B); only the colored keys need counts.
defineState('colorKeys', () => ({ red: 0, blue: 0, green: 0, master: false }));

// ---- where the hero has been (places.js)
defineState('visited', () => new Set(), setField); // screen ids 'area:i,j' entered at least once
defineState('visitedAreas', () => new Set(), setField); // area ids entered at least once
defineState('cardsSeen', () => new Set(), setField); // loading cards shown (the gallery)

// ---- bestiary (bestiary.js)
defineState('bestiary', () => ({ seen: {}, defeated: {}, book: {} })); // counts per enemy type (book: hits with the book)

// ---- shops (shops.js)
defineState('shops', () => ({})); // { shopId: { entryId: bought count } } for limited stock

// ---- records
defineState('playTime', () => 0); // seconds in play mode (watch.js)
defineState('deaths', () => 0); // times the hero fell: +1 on 'player-died' (watch.js); a revive is not a death

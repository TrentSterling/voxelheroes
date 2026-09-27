// Who the hero is: class, trait, name, difficulty (state.profile), and the
// new-game flow the title screens (ui) finish with.
//
//   startNewGame({ name: 'Ada', class: 'balanced', trait: 'focus', difficulty: 'normal' })
//     -> a fresh game with the class's life and magic, in play; 'new-game' { profile }
//
// Classes (gameplay spec 7.12, TUNING.progression.classes): life 5 hearts and
// 3 magic, balanced 4 hearts and 4 magic, magic 3 hearts and 5 magic. Traits:
// might (+1 strength on every sword), focus (spells cost 1 less, never below
// 1). Difficulty: normal, hard (double damage to the hero, 50% more enemies,
// rare spawns twice as likely), one-hit (any hit kills). A game started
// without a profile (the M1 title's Enter) keeps 3 hearts and no magic.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { newGame, startGame } from '../systems/flow.js';
import { UNITS_PER_HEART, syncVitals } from './vitals.js';
import './fields.js';

export const CLASSES = Object.keys(TUNING.progression.classes); // ['life', 'balanced', 'magic']
export const TRAITS = ['might', 'focus'];
export const DIFFICULTIES = ['normal', 'hard', 'one-hit'];

// { life: units, magic: gems } a class starts with.
export function classStats(id) {
  const c = TUNING.progression.classes[id];
  return c ? { life: c[0], magic: c[1] } : null;
}

// Names: letters, digits, spaces, apostrophes and hyphens, trimmed to
// TUNING.profile.nameMax characters.
export function cleanName(name) {
  return String(name ?? '')
    .replace(/[^\p{L}\p{N} '\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TUNING.profile.nameMax);
}

export const heroName = () => state.profile.name || 'Hero';
export const difficulty = () => state.profile.difficulty;
export const hasTrait = (t) => state.profile.trait === t;
export const isOneHit = () => state.profile.difficulty === 'one-hit';
export const damageMultiplier = () => (state.profile.difficulty === 'hard' ? TUNING.damage.hardMultiplier : 1);

// Write the profile and give the class's starting life and magic. Throws on
// an unknown class, trait or difficulty.
export function applyProfile({ name, class: cls = null, trait = null, difficulty: diff = 'normal', model = 'hero' } = {}) {
  if (cls !== null && !CLASSES.includes(cls)) throw new Error(`Unknown class "${cls}" (${CLASSES.join(', ')})`);
  if (trait !== null && !TRAITS.includes(trait)) throw new Error(`Unknown trait "${trait}" (${TRAITS.join(', ')})`);
  if (!DIFFICULTIES.includes(diff)) throw new Error(`Unknown difficulty "${diff}" (${DIFFICULTIES.join(', ')})`);
  state.profile = { ...state.profile, name: cleanName(name), class: cls, trait, difficulty: diff, model };
  if (cls) {
    const c = classStats(cls);
    state.maxHp = Math.max(UNITS_PER_HEART, c.life);
    state.hp = state.maxHp;
    state.maxMagic = c.magic;
    state.magic = c.magic;
    syncVitals('new-game');
  }
  return { ...state.profile };
}

// Title flow's last step: reset everything, apply the profile, start playing.
export function startNewGame(profile = {}) {
  newGame();
  const p = applyProfile(profile);
  startGame();
  emit('new-game', { profile: p });
  return p;
}

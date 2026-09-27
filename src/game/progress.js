// Who the hero is: class, trait, name, difficulty (state.profile), and the
// new-game flow the title screens (ui) finish with.
//
//   startNewGame({ name: 'Ada', class: 'balanced', trait: 'focus', difficulty: 'normal', model: 'hero' })
//     -> a fresh game with the class's life and magic, in play; 'new-game' { profile, prologue }
//   startNewGame({ ..., prologue: true })   the spec's prologue (P2.6): no sword, no
//     shield, at the spot the overworld registered with registerPrologue
//   registerPrologue({ spot, respawn })     overworld: where a new game starts (the
//     castle) and its first respawn point (default: the spot)
//
// Classes (gameplay spec 7.12, TUNING.progression.classes): life 5 hearts and
// 3 magic, balanced 4 hearts and 4 magic, magic 3 hearts and 5 magic. Traits:
// might (+1 strength on every sword), focus (spells cost 1 less, never below
// 1). Difficulty: normal, hard (double damage to the hero, 50% more enemies,
// rare spawns twice as likely), one-hit (any hit kills). `model` names the
// hero's look (state.profile.model, 'hero' for now). A game started without
// a profile (the M1 title's Enter) keeps 3 hearts and no magic, starts at
// START with the starter sword and shield 1, and does not play the prologue.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { newGame, startGame } from '../systems/flow.js';
import { UNITS_PER_HEART, syncVitals } from './vitals.js';
import { goToSpot, setRespawn } from './places.js';
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

// ---------------------------------------------------------------- the prologue
let prologue = null;

export function registerPrologue({ spot, respawn = spot } = {}) {
  if (prologue) throw new Error('A prologue is already registered');
  if (!spot?.area) throw new Error('registerPrologue: a spot with an area is needed');
  prologue = { spot, respawn };
}

export const prologueSpot = () => (prologue ? { ...prologue.spot } : null);
let warnedPrologue = false;

// Title flow's last step: reset everything, apply the profile, start
// playing. With prologue: true the hero starts unarmed (swords.owned [],
// equipped null, gear.shield 0) at the registered prologue spot, with his
// respawn point there; the king's grants arm him (blade-start, shield-1).
export function startNewGame({ prologue: withPrologue = false, ...profile } = {}) {
  newGame();
  const p = applyProfile(profile);
  if (withPrologue) {
    state.swords.owned = [];
    state.swords.equipped = null;
    state.gear.shield = 0;
  }
  startGame();
  if (withPrologue) {
    if (prologue && goToSpot(prologue.spot, { fade: false })) setRespawn(prologue.respawn);
    else if (!warnedPrologue) {
      warnedPrologue = true;
      console.warn('startNewGame: no prologue registered (overworld: registerPrologue); starting at START');
    }
  }
  emit('new-game', { profile: p, prologue: !!withPrologue });
  return p;
}

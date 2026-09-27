// Save slots for the file-select, pause-menu and inn screens (ui stream).
//
//   saveSlot(2)          -> true when written; 'saved' { slot, ok }
//   loadSlot(2)          -> true when loaded (then play resumes); 'loaded' { slot }
//   slotSummary(2)       -> null for an empty slot, else { slot, time, ok, name, class,
//                           hearts, maxHearts, magic, coins, playTime, deaths, orbs, area }
//                           (ok: false when this version cannot load it)
//   slotSummaries()      -> one per slot, SLOT_COUNT of them
//   eraseSlot(2)
//
// Slots are localStorage entries (core/save.js); systems/flow.js applies
// them. Where a loaded game resumes is flow's: flow.loadGame(data) keeps
// resuming where the save was made (the test hook's load and the default
// play-test use it), and loadSlot applies the gameplay spec (11) through it:
// loadGame(data, { at: respawnSpot('load'), refill: true }), the respawn
// point or the entrance of the dungeon it was saved in, with full life and
// magic (the ui adds those options in M2; docs/CONTRACTS.md, "Save slots").
import { SAVE_VERSION } from '../core/state.js';
import { emit } from '../core/events.js';
import { readSlot, deleteSlot, SLOT_COUNT } from '../core/save.js';
import { saveToSlot, loadFromSlot } from '../systems/flow.js';
import { UNITS_PER_HEART } from './vitals.js';

export { SLOT_COUNT };

export function saveSlot(slot) {
  const ok = saveToSlot(slot);
  emit('saved', { slot, ok });
  return ok;
}

export function loadSlot(slot) {
  const ok = loadFromSlot(slot);
  if (ok) emit('loaded', { slot });
  return ok;
}

export const eraseSlot = (slot) => deleteSlot(slot);

export function slotSummary(slot) {
  const saved = readSlot(slot);
  if (!saved?.data) return null;
  const { version = 1, fields = {} } = saved.data;
  const flags = Array.isArray(fields.flags) ? fields.flags : [];
  const pos = fields.pos ?? null;
  return {
    slot,
    time: saved.time ?? null,
    ok: Number.isInteger(version) && version >= 1 && version <= SAVE_VERSION,
    name: fields.profile?.name || 'Hero',
    class: fields.profile?.class ?? null,
    hearts: (fields.hp ?? 0) / UNITS_PER_HEART,
    maxHearts: (fields.maxHp ?? 0) / UNITS_PER_HEART,
    magic: fields.maxMagic ?? 0,
    coins: fields.coins ?? fields.gems ?? 0,
    playTime: fields.playTime ?? 0,
    deaths: fields.deaths ?? 0,
    orbs: flags.filter((f) => /^orb:\d+$/.test(f)).length,
    area: pos?.area ?? null,
  };
}

export const slotSummaries = () => Array.from({ length: SLOT_COUNT }, (_, i) => slotSummary(i + 1));

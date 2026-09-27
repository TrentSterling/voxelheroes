// What falls out of defeated enemies and cut bushes.
//
// A drop table is a list of entries tried in order against one random roll:
//   { chance, type, when }  type: entity name or () => name; when: () => boolean
// Chances add up. An entry whose `when` fails is left out of that roll, so
// its chance becomes "nothing" and the entries after it keep theirs: each
// entry's odds are its own chance whatever order the entries were added in.
// Features add their loot without editing this file:
//
//   addDrop('enemy', { chance: 0.1, type: 'arrows', when: () => hasItem('bow') });
import { state } from '../core/state.js';
import { random } from '../core/random.js';
import { spawn } from '../entities/manager.js';

const gemRoll = () => (random() < 0.15 ? 'gem5' : 'gem');
const hurt = () => state.hp < state.maxHp;
// A heart when the hero is hurt, otherwise a gem (the prototype's odds).
const heartOrGem = () => (hurt() ? 'heart' : gemRoll());

export const DROP_TABLES = {
  enemy: [
    { chance: 0.25, type: heartOrGem },
    { chance: 0.45, type: gemRoll },
  ],
  bush: [
    { chance: 0.12, type: heartOrGem },
    { chance: 0.3, type: gemRoll },
  ],
};

export function registerDropTable(name, entries) {
  DROP_TABLES[name] = entries;
}

export function addDrop(table, entry) {
  (DROP_TABLES[table] ??= []).push(entry);
}

// Roll a table at (x, z); spawns the drop and returns its type, or null.
export function rollDrop(table, x, z) {
  const entries = typeof table === 'string' ? DROP_TABLES[table] : table;
  if (!entries) return null;
  const r = random();
  let acc = 0;
  for (const d of entries) {
    if (d.when && !d.when()) continue;
    acc += d.chance;
    if (r < acc) {
      const type = typeof d.type === 'function' ? d.type() : d.type;
      if (type) spawn(type, { x, z });
      return type ?? null;
    }
  }
  return null;
}

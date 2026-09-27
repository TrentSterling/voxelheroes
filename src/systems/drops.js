// What falls out of defeated enemies, cut bushes and broken pots.
//
// A drop table is a list of entries tried in order against one random roll:
//   { chance, type, when, else }  type: entity name or () => name; when: () => boolean
// Chances add up. An entry whose `when` fails gives its chance to `else`
// (an entity name, such as 'coin-1': spec 8.7's arrows and bombs that drop
// only for a hero who owns the bow or bombs) or, with no `else`, to
// nothing; the entries after it keep their odds either way. A type no
// stream has registered yet (a pickup from a branch not merged) is skipped
// with one warning, like a map marker.
//
// Tables in M2 (gameplay spec 8.7; foes-overworld registers them with
// registerDropTable): 'pack-a' to 'pack-e' (enemies name theirs in their
// def), 'bush' and 'pot'. The M1 tables 'enemy' and 'bush' stay until then.
//
//   registerDropTable('pack-a', [{ chance: 0.2, type: 'heart' }, { chance: 0.1, type: 'arrows-5', when: () => hasItem('bow'), else: 'coin-1' }]);
//   rollDrop('pack-a', x, z)   -> the type spawned, or null
//
// Only foes-overworld changes these tables; other streams do not addDrop
// to the spec's packs.
import { state } from '../core/state.js';
import { random } from '../core/random.js';
import { spawn } from '../entities/manager.js';
import { hasEntityType } from '../entities/registry.js';

const warned = new Set();

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
    const ok = !d.when || d.when();
    if (!ok && !d.else) continue;
    acc += d.chance;
    if (r < acc) {
      const type = ok ? (typeof d.type === 'function' ? d.type() : d.type) : d.else;
      if (!type) return null;
      if (!hasEntityType(type)) {
        if (!warned.has(type)) console.warn(`rollDrop: no entity type "${type}"; skipped`);
        warned.add(type);
        return null;
      }
      spawn(type, { x, z });
      return type;
    }
  }
  return null;
}

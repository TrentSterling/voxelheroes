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
import { TUNING } from '../core/tuning.js';
import { hasItem } from '../items/inventory.js';

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

// The spec's packs (gameplay spec 8.7): [roll, [type, weight, when?]...].
// Arrows and bombs drop only for a hero who owns the bow or bombs; otherwise
// their weight goes to coin-1.
const ownsBow = () => hasItem('bow');
const ownsBombs = () => hasItem('bombs');
const PACKS = {
  'pack-a': [0.5, [['heart', 30], ['coin-1', 40], ['coin-10', 10], ['magic', 10], ['arrows-5', 5, ownsBow], ['bomb-1', 5, ownsBombs]]],
  'pack-b': [0.6, [['arrows-5', 30, ownsBow], ['coin-1', 25], ['heart', 25], ['coin-10', 20]]],
  'pack-c': [1.0, [['magic', 100]]],
  'pack-d': [0.6, [['coin-10', 40], ['heart', 30], ['magic', 20], ['coin-100', 10]]],
  'pack-e': [0.7, [['coin-100', 60], ['coin-10', 40]]],
  bush: [TUNING.drops.bushRoll, [['coin-1', 50], ['heart', 30], ['arrows-5', 10, ownsBow], ['bomb-1', 10, ownsBombs]]],
  pot: [TUNING.drops.potRoll, [['heart', 40], ['coin-1', 30], ['magic', 20], ['coin-10', 10]]],
};
function packTable([roll, rows]) {
  const total = rows.reduce((s, r) => s + r[1], 0);
  return rows.map(([type, w, when]) => (when ? { chance: (roll * w) / total, type, when, else: 'coin-1' } : { chance: (roll * w) / total, type }));
}

export function registerDropTable(name, entries) {
  DROP_TABLES[name] = entries;
}

export function addDrop(table, entry) {
  (DROP_TABLES[table] ??= []).push(entry);
}

for (const [name, pack] of Object.entries(PACKS)) if (name !== 'bush') registerDropTable(name, packTable(pack));
// 'bush' keeps M1's table until the overworld's bushes move to the spec's
// pack (the gate scenarios cut M1 bushes); the pack is here for them.
registerDropTable('bush-pack', packTable(PACKS.bush));

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

// The bestiary (pause menu): every enemy kind, and how often the hero has
// seen and beaten it. The foes streams add one entry per enemy type from the
// enemy's own file:
//
//   registerBestiary({ id: 'hopper', name: 'Hopper', band: 1, hp: 3, text: 'Charges along rows.', where: 'overworld' });
//
//   bestiaryEntries()     -> [{ ...entry, seen, defeated, book, recorded }] in registry order
//   recordBookHit(type)   the book item (items stream) counts a hit; an entry is
//                         recorded once it has `bookHits` of them (default 3)
//
// Sightings count from 'enemy-spawned' and wins from 'enemy-killed' (by
// entity type), for every enemy, listed or not. Counts are saved in
// state.bestiary.
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import './fields.js';

const entries = new Map();
let order = 0;

export function registerBestiary(def) {
  if (!def?.id) throw new Error('registerBestiary: an entry needs an id (the enemy type)');
  if (entries.has(def.id)) throw new Error(`Bestiary entry "${def.id}" is already registered`);
  const full = { name: def.id, band: null, hp: null, text: '', where: null, bookHits: 3, order: def.order ?? 100 + order++, ...def };
  entries.set(def.id, full);
  return full;
}

export const getBestiaryEntry = (id) => entries.get(id) ?? null;

const count = (table, id) => state.bestiary[table]?.[id] ?? 0;

export function bestiaryEntries() {
  return [...entries.values()]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((e) => ({ ...e, seen: count('seen', e.id), defeated: count('defeated', e.id), book: count('book', e.id), recorded: count('book', e.id) >= e.bookHits }));
}

export function recordBookHit(type) {
  const book = (state.bestiary.book ??= {});
  book[type] = (book[type] ?? 0) + 1;
  return book[type];
}

function bump(table, type) {
  if (!type) return;
  const t = (state.bestiary[table] ??= {});
  t[type] = (t[type] ?? 0) + 1;
}

on('enemy-spawned', ({ entity }) => bump('seen', entity?.type));
on('enemy-killed', ({ entity }) => bump('defeated', entity?.type));

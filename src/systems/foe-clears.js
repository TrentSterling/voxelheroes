// When cleared screens and rooms stay empty (gameplay spec 5.5, 6.5;
// CONTRACTS 8.5), for the items-and-foes stream:
//   overworld  a screen whose enemies were all killed stays empty until its
//              area is loaded again; a screen that had a rare spawn never counts
//   dungeon    a cleared room stays clear until the hero leaves the floor (or
//              the dungeon) or TUNING.enemy.roomClearMemory s pass
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { registerClearRule, forgetCleared } from '../game/clears.js';
import { areaKind } from '../game/places.js';

// Only areas that name their kind (every new area does, CONTRACTS 9): the M1
// fixture areas keep M1's behaviour until M3 (contracts-m2 checks it).
const kindOf = (area) => (typeof area === 'object' && area?.kind) || null;
registerClearRule('foes-overworld', ({ area, rare }) => (kindOf(area) === 'overworld' ? !rare : undefined));
registerClearRule('foes-dungeon', ({ area }) => (kindOf(area) === 'dungeon' ? true : undefined));

const floorOf = (screen) => (screen?.area?.rooms ? `${screen.area.id}:${Math.floor(screen.ly / 11)}` : screen?.area?.id ?? null);
let floor = null;

on('area-enter', ({ area }) => {
  const id = typeof area === 'string' ? area : area?.id;
  forgetCleared((key, rec) => rec.area === id && areaKind(id) === 'overworld');
});
on('dungeon-leave', () => forgetCleared((key, rec) => areaKind(rec.area) === 'dungeon'));
on('screen-leave', () => {
  const now = state.time;
  forgetCleared((key, rec) => areaKind(rec.area) === 'dungeon' && now - rec.at > TUNING.enemy.roomClearMemory);
});
on('screen-enter', ({ screen }) => {
  // a floor change forgets the floor's rooms; old clears run out
  const f = floorOf(screen);
  if (floor && f !== floor && areaKind(screen?.area) === 'dungeon') forgetCleared((key, rec) => areaKind(rec.area) === 'dungeon');
  floor = f;
});

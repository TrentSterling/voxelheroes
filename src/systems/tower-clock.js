import { hasFlag } from '../core/state.js';

export const CLOCK_ANCHORS = [
  { id: 'return', char: '1', name: 'Return', source: 'boomerang', x: 4, z: 7, colour: 0x96d8cb, goal: 'Throw the boomerang into the Return anchor on the west side.', hud: 'Return anchor west: boomerang.' },
  { id: 'break', char: '2', name: 'Break', source: 'bomb', x: 17, z: 7, colour: 0xe5bc7b, goal: 'Place a bomb beside the Break anchor on the east side. Step clear of the blast.', hud: 'Break anchor east: bomb.' },
  { id: 'draw', char: '3', name: 'Draw', source: 'grapple', x: 7, z: 11, colour: 0x8cb9dc, goal: 'Hook the Draw anchor southwest of the clock with the grapple.', hud: 'Draw anchor southwest: grapple.' },
  { id: 'kindle', char: '4', name: 'Kindle', source: 'fire', x: 14, z: 11, colour: 0xe8a2b1, goal: 'Fire the wand into the Kindle anchor southeast of the clock.', hud: 'Kindle anchor southeast: fire.' },
];
export const clockAnchorFlag = id => `tower:clock:${id}`;
export const clockAnchorCount = () => CLOCK_ANCHORS.filter(a => hasFlag(clockAnchorFlag(a.id))).length;
export const clockUnwound = () => clockAnchorCount() === CLOCK_ANCHORS.length;
export function clockGoal() {
  const a = CLOCK_ANCHORS.find(a => !hasFlag(clockAnchorFlag(a.id)));
  return a ? { text: `Clock anchors ${clockAnchorCount()}/4. ${a.goal}`, short: `Clock ${clockAnchorCount()}/4: ${a.hud}` }
    : { text: 'The four borrowed hours are released. Take the northern stair to the memory floors.', short: 'Clock unwound: climb north.' };
}
export function clockJournalEntry() {
  const done = hasFlag('tower:trial'), entered = hasFlag('dungeon:tower-trial:entered');
  return { id: 'fourfold-clock', title: 'Four Borrowed Hours', giver: 'Sage Iona', where: 'Fourfold Tower: First Reflection',
    status: done ? 'done' : entered ? 'active' : 'offer',
    detail: done ? 'The city clock can move again. Return, Break, Draw and Kindle released its stolen hours. The memories above still hold the keeper.' : entered ? `${clockGoal().text} Reflections keep attacking while you work; the anchors also block their shots. The powder supply stands south of the clock.` : 'The four temples once lent their lights to the city clock. Carry all four lights to the tower east of Pilgrim Strand. The keeper has bound its hands to four tool anchors.',
    progress: done ? 'The first clock unwound' : `Anchors ${clockAnchorCount()}/4`, reward: 'The northern memory stair' };
}

// The "Next:" objective (fun audit: the game never says what to do). Always
// one clear next goal, ALttP-style, derived from progress flags other
// streams already keep (the king's grant, the dungeon stream's flags). This
// file holds no state of its own: a HUD widget (ui/hud/objective.js) reads
// it the way any other widget reads state, so nothing has to remember to
// push an update when a flag changes.
//
//   objectiveText()   the line to show, e.g. 'Find King Aldric at Crownhold, south of Mossbrook.'
//   objectiveId()     the current step's id ('open' once every step is done); a HUD
//                      widget's key, or anything that wants to key a flourish off
//                      reaching a new step rather than diffing text
//
// The sage's own flag (entities/npcs/slice.js, CONTRACTS 8.12) only ever sets
// once a spell is registered for him to grant (the items stream's), so a
// build without one yet must not leave the goal stuck waiting on a
// conversation that can never finish; the dungeon's own 'complete' flag (the
// orb in hand) moves the story on either way.
import { hasFlag } from '../core/state.js';
import { hasBossKey, bossDefeated, isComplete } from './dungeons.js';

const STEPS = [
  { id: 'meet-king', done: () => hasFlag('overworld:talked:king'), text: 'Find King Aldric at Crownhold, south of Mossbrook.' },
  { id: 'enter-d1', done: () => hasFlag('dungeon:d1:entered'), text: 'Head west to Barrowfield and enter the Old Barrow.' },
  { id: 'big-key', done: () => hasBossKey('d1'), text: "Find the Old Barrow's big key." },
  { id: 'beat-boss', done: () => bossDefeated('d1'), text: 'Defeat the serpent at the heart of the barrow.' },
  { id: 'claim-orb', done: () => isComplete('d1'), text: 'Take the orb back to the sage.' },
];

const OPEN_GOAL = 'Hunt for heart pieces, or see what the smith can do with your coins.';

// The first step not yet done, or null once every step is (the open goal).
export function currentStep() {
  return STEPS.find((s) => !s.done()) ?? null;
}

export const objectiveId = () => currentStep()?.id ?? 'open';
export const objectiveText = () => currentStep()?.text ?? OPEN_GOAL;

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
import { hasBossKey, bossDefeated, isComplete, hasMap } from './dungeons.js';
import { hasItem } from '../items/inventory.js';

const STEPS = [
  { id: 'meet-king', done: () => hasFlag('overworld:talked:king'), text: 'Find King Aldric at Crownhold, south of Mossbrook.' },
  { id: 'enter-d1', done: () => hasFlag('dungeon:d1:entered'), text: 'Head west to Barrowfield and enter the Old Barrow.' },
  { id: 'big-key', done: () => hasBossKey('d1'), text: "Find the Old Barrow's big key." },
  { id: 'beat-boss', done: () => bossDefeated('d1'), text: 'Defeat the serpent at the heart of the barrow.' },
  { id: 'claim-orb', done: () => isComplete('d1'), text: 'Take the orb back to the sage.' },
  { id: 'enter-d2', done: () => hasFlag('dungeon:d2:entered'), text: 'Head north from Mossbrook through Whisperwood: north, west, east, north.' },
  { id: 'hive-key', done: () => hasBossKey('d2'), text: 'Blast through the hive’s eastern seams to find the amber big key.' },
  { id: 'hive-boss', done: () => bossDefeated('d2'), text: 'Overturn the Amber Queen with a bomb, then strike her open crown.' },
  { id: 'hive-orb', done: () => isComplete('d2'), text: 'Claim the second orb beyond the Amber Crown.' },
  { id: 'enter-d3', done: () => hasFlag('dungeon:d3:entered'), text: 'Head east from Mossbrook Mill Pond. Bomb Dustfall Road and find the temple northeast of the oasis.' },
  { id: 'watch-key', done: () => hasBossKey('d3'), text: 'Cross the upper watch with the grapple and hook the eastern crown chest.' },
  { id: 'watch-boss', done: () => bossDefeated('d3'), text: 'Shatter the colossus’s feet, then arms, then core. Sidestep its pale lasers.' },
  { id: 'watch-orb', done: () => isComplete('d3'), text: 'Take the third orb beyond Colossus Court, then speak with the sage.' },
  { id: 'enter-d4', done: () => hasFlag('dungeon:d4:entered'), text: 'Grapple across Post Islands east of the oasis. Follow Brineglass Coast north to the temple.' },
  { id: 'tide-key', done: () => hasBossKey('d4'), text: 'Light the upper temple bowls, melt the western ice hall, and claim the tide crown.' },
  { id: 'tide-boss', done: () => bossDefeated('d4'), text: 'Follow Nacre between banks. Burn the tentacles, grapple across, and strike each opening.' },
  { id: 'tide-orb', done: () => isComplete('d4'), text: 'Take the fourth orb beyond Undertow Court, then speak with Sage Neru.' },
  { id: 'enter-tower', done: () => hasFlag('dungeon:tower-trial:entered'), text: 'Follow Pilgrim Strand east. Burn the old trees and enter the Fourfold Tower with all four orbs.' },
  { id: 'tower-trial', done: () => hasFlag('tower:trial'), text: 'Endure the first reflection for two minutes. Move between its shots and collect the wisps.' },
  { id: 'tower-sight', done: () => hasItem('spell-truesight'), text: 'Speak with Sage Iona on the amber floor to learn Truesight. Rest at the western well.' },
  { id: 'tower-hive', done: () => bossDefeated('tower-hive'), text: 'Wake the amber eyes for the crown key, then overturn the queen rematch with bombs.' },
  { id: 'tower-watch', done: () => bossDefeated('tower-watch'), text: 'Push the sand memory block onto its plate. Break the colossus again for the Dawn Blade.' },
  { id: 'tower-tide', done: () => bossDefeated('tower-tide'), text: 'Light the tide memory bowls and follow Nacre across its channel. The crown stair is above.' },
  { id: 'tower-mask', done: () => hasFlag('tower:mask-broken'), text: 'Cast Truesight in the Hollow Throne. Strike the one reflection with a shadow.' },
  { id: 'tower-crown', done: () => hasFlag('campaign:complete'), text: 'Defeat the Hollow Crown. Leave lightning marks and dash out of its charged-shot line.' },
  { id: 'homecoming', done: () => hasFlag('overworld:celebrated'), text: 'The four lights are restored. Return to King Aldric at Crownhold for your homecoming.' },
];
const BARROW_STEPS = {
  map: { id: 'barrow-map', text: 'Find the map chest in the hall north of the entrance.' },
  keys: { id: 'barrow-first-keys', text: 'Win a key east of the entrance; another waits by the push block.' },
  tool: { id: 'barrow-tool', text: 'Cross Pit Walk, head east, then north to the guarded boomerang.' },
  eye: { id: 'barrow-eye', text: 'Return to Eye Hall; throw the boomerang at its stone eye.' },
  bones: { id: 'barrow-bones', text: 'Through Dark Hall and Blade Gallery: clear Crossed Bones for a key.' },
  eyes: { id: 'big-key', text: 'Light all four eyes in one window to reach the big key.' },
};

const OPEN_GOAL = 'Hunt for heart pieces, see what the smith can do with your coins, or help villagers with their errands.';

// The first step not yet done, or null once every step is (the open goal).
export function currentStep() {
  const story = STEPS.find((s) => !s.done()) ?? null;
  if (story?.id === 'tide-key') {
    if (!hasMap('d4')) return { id: 'tide-map', text: 'Earn a patrol key west of the entrance. The map waits north of that room.' };
    if (!hasItem('fire-wand')) return { id: 'tide-wand', text: 'Open the lock east of Glass Junction, then clear Ember Cache for the fire wand.' };
    if (!hasFlag('dungeon:d4:door:C-3:n')) return { id: 'tide-stairs', text: 'The counterweight and twin ember bowls yield keys. Open Glass Junction north to climb.' };
    return story;
  }
  if (story?.id === 'watch-boss' && !hasFlag('dungeon:d3:door:F2:B-3:n')) return { id: 'watch-upper-lock', text: 'Use the counterweight key north of The Missing Bridge, then wake the entrance shortcut.' };
  if (story?.id === 'watch-key') {
    if (!hasMap('d3')) return { id: 'watch-map', text: 'Clear Shield Patrol west of the entrance, then find the map north of it.' };
    if (!hasItem('grapple')) return { id: 'watch-grapple', text: 'Open the lock east of Divided Hall. The grapple waits in Chain Vault.' };
    return story;
  }
  if (story?.id === 'hive-boss' && !hasFlag('dungeon:d2:door:B-3:n')) {
    if (!hasFlag('dungeon:d2:keytaken:B-4')) return { id: 'hive-patrol-key', text: 'Clear Crossfire Nursery, north of the eastern breach, for another key.' };
    if (!hasFlag('dungeon:d2:keytaken:B-2')) return { id: 'hive-eyes', text: 'Open Mossbridge’s lock, then wake the three eyes in the western room.' };
    return { id: 'hive-crown-door', text: 'Use the third small key north of Mossbridge to reach the crown.' };
  }
  if (story?.id === 'hive-key') {
    if (!hasMap('d2')) return { id: 'hive-map', text: 'Find the map north of Rootglass Mouth; a patrol key waits east.' };
    if (!hasItem('bombs')) return { id: 'hive-bombs', text: 'Open the first lock north of the map. The powder cache is west.' };
    return story;
  }
  if (story?.id !== 'big-key') return story;
  if (!hasMap('d1')) return BARROW_STEPS.map;
  if (!hasFlag('dungeon:d1:door:I-4:n') && !hasItem('boomerang')) return BARROW_STEPS.keys;
  if (!hasItem('boomerang')) return BARROW_STEPS.tool;
  if (!hasFlag('dungeon:d1:keytaken:G-4')) return BARROW_STEPS.eye;
  if (!hasFlag('dungeon:d1:keytaken:E-3')) return BARROW_STEPS.bones;
  return BARROW_STEPS.eyes;
}

export const objectiveId = () => currentStep()?.id ?? 'open';
export const objectiveText = () => currentStep()?.text ?? OPEN_GOAL;

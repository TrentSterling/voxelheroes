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
import { defineState, state, hasFlag } from '../core/state.js';
import { currentScreen } from '../world/world.js';
import { hasBossKey, bossDefeated, isComplete, hasMap } from './dungeons.js';
import { hasItem } from '../items/inventory.js';
import { eraJournalEntry, archiveJournalEntry } from '../systems/era-story.js';
import { beaconJournalEntry } from '../systems/beacon-story.js';
import { barrowJournalEntry } from '../systems/barrow-story.js';
import { departureJournalEntry } from '../systems/departure-story.js';
import { clockJournalEntry, clockGoal } from '../systems/tower-clock.js';
import { FAIR, fairJournalEntry, fairGoal, fairMachine, fairScore } from '../systems/clockfair.js';
import { errandEntries } from './errands.js';

// A player's chosen task is personal. Its progress still comes from the shared
// adventure, so another player's turn-in immediately removes a completed pin.
export const questEntries = () => [eraJournalEntry(), archiveJournalEntry(), departureJournalEntry(), barrowJournalEntry(), beaconJournalEntry(), clockJournalEntry(), fairJournalEntry(), ...errandEntries()];
const findQuest = id => questEntries().find(entry => entry.id === id);
defineState('trackedQuest', () => null, {
  fromJSON: value => typeof value === 'string' && findQuest(value) ? value : null,
  toJSON: () => trackedQuestId(),
});
export const trackedQuestId = () => {
  const entry = findQuest(state.trackedQuest);
  return entry && entry.status !== 'done' ? entry.id : null;
};
export function trackQuest(id) {
  if (id === null) { state.trackedQuest = null; return true; }
  const entry = findQuest(id);
  if (!entry || entry.status === 'done') return false;
  state.trackedQuest = id;
  return true;
}

const goal = (questId, step, text, short = text) => ({ id: `${questId}:${step}`, questId, text, short });
const inPast = screen => screen?.area.id === 'mossbrook-past';
const inFuture = screen => screen?.area.id === 'mossbrook-future';
const gateStep = (id, screen, era) => screen?.ly === 1 && (inPast(screen) || inFuture(screen))
  ? goal(id, `gate-${era}`, `Go north to the copperwalk, then west to the square hourgate. Choose ${era}.`, `North; west to hourgate: ${era}.`)
  : goal(id, `gate-${era}`, screen?.lx > 0 && (inPast(screen) || inFuture(screen))
  ? `Follow the copperwalk west to the square hourgate. Choose ${era}.`
  : `Use the square hourgate and choose ${era}.`, `Hourgate: ${era}.`);

function engineStep(id, screen) {
  if (inPast(screen) && screen.ly === 1) return goal(id, 'engine-north', 'Go north to the copperwalk, then west to the square. Clear its scavengers and start the water engine.', 'North; west to the square water engine.');
  if (inPast(screen)) return screen.lx > 0
    ? goal(id, 'engine-west', 'Follow the copperwalk west. Clear the square scavengers and start the water engine.', 'West to the square water engine.')
    : goal(id, 'engine', 'Clear the engine scavengers, then start the copper water engine.', 'Clear scavengers; start the engine.');
  return gateStep(id, screen, 'First Bloom');
}
function bellStep(screen) {
  const id = 'era-bell';
  if (hasFlag('era:homecoming')) return null;
  if (!hasFlag('era:bell')) return goal(id, 'meet', 'Find Mira beside the eastern hourgate in Mossbrook Square.', 'Meet Mira at the Mossbrook hourgate.');
  if (!hasFlag('era:water-restored')) return engineStep(id, screen);
  if (!hasFlag('era:dawn-seed')) {
    if (!inFuture(screen)) return gateStep(id, screen, 'Silent Year');
    if (screen.ly === 1) return goal(id, 'garden-north', 'Go north to the copperwalk, then west to the square. Cross the restored bridge to the Dawn Seed chest.', 'North; west to the square garden.');
    return screen.lx > 0
      ? goal(id, 'garden-west', 'Follow the copperwalk west to the square. Cross the restored bridge to the Dawn Seed chest.', 'West to the square garden.')
      : goal(id, 'seed', 'Cross the restored bridge and open the garden seed chest.', 'Cross the bridge; collect the Dawn Seed.');
  }
  if (screen?.key === 'v1:1,1') return goal(id, 'home', 'Bring the Dawn Seed to Mira in Mossbrook Square. You can talk to her here while she travels with you too.', 'Talk to Mira here about the Dawn Seed.');
  if (inPast(screen) || inFuture(screen)) return gateStep(id, screen, 'Mossbrook / today');
  return goal(id, 'home-road', 'Return to Mossbrook Square and bring the Dawn Seed to Mira.', 'Return the Dawn Seed to Mira.');
}
function archiveStep(screen) {
  const id = 'era-archive';
  if (hasFlag('era:voices-returned')) return null;
  if (!hasFlag('era:water-restored')) return engineStep(id, screen);
  if (!hasFlag('era:archive-powered')) {
    if (!inPast(screen)) return gateStep(id, screen, 'First Bloom');
    if (screen.ly === 1) return goal(id, 'workshop-north', 'Go north to the First Bloom copperwalk, then east to the Singing Workshop. Clear the belt thieves and tune its valve.', 'North; east to the Singing Workshop.');
    if (screen.lx < 2) return goal(id, 'workshop-east', 'Follow the First Bloom copperwalk east to the Singing Workshop. Clear the belt thieves and tune its valve.', 'East to the Singing Workshop.');
    return goal(id, 'valve', 'Defeat the workshop belt thieves, then tune the pressure valve.', 'Clear belt thieves; tune the valve.');
  }
  if (!hasFlag('era:copper-memory')) {
    if (!inFuture(screen)) return gateStep(id, screen, 'Silent Year');
    if (screen.ly === 1) return goal(id, 'archive-north', 'Go north to the Silent Year copperwalk, then east to the Archive of Voices.', 'North; east to the Archive of Voices.');
    if (screen.lx < 2) return goal(id, 'archive-east', 'Follow the Silent Year copperwalk east to the Archive of Voices.', 'East to the Archive of Voices.');
    return goal(id, 'memory', 'Clear the archive sentries and open the glowing memory chest.', 'Clear sentries; collect Copper Memory.');
  }
  if (!inFuture(screen)) return gateStep(id, screen, 'Silent Year');
  if (screen.ly === 1) return goal(id, 'tern-north', 'Go north to the copperwalk, then bring the Copper Memory west to caretaker Tern in the Silent Year square.', 'North; west to Tern with Copper Memory.');
  if (screen.lx > 0) return goal(id, 'tern-west', 'Bring the Copper Memory west to caretaker Tern in the Silent Year square.', 'West to Tern with Copper Memory.');
  return goal(id, 'choir', 'Talk to Tern here about the Copper Memory and hear the lost choir.', 'Talk to Tern about Copper Memory.');
}
function questStep(id, screen) {
  if (id === 'clockfair') {
    const a=fairMachine()?.ai,here=screen?.key===FAIR.screen;
    const text=a?.phase==='running'?`Clay at the lit bell: ${fairScore(a.mask)}/6.`:here?'Read the fair board for another round.':'Southeast fair arch; read the fair board.';
    return goal(id,'bells',fairGoal(),text);
  }
  if (id === 'era-bell') return bellStep(screen);
  if (id === 'era-archive') return archiveStep(screen);
  const entry = findQuest(id);
  if (!entry || entry.status === 'done') return null;
  if (id === 'last-departure') {
    if (!hasFlag('era:departure-powered')) {
      if (!hasFlag('era:water-restored')) return engineStep(id, screen);
      if (!hasFlag('era:archive-powered')) return inPast(screen)
        ? goal(id, 'workshop', screen.ly === 1 ? 'Go north to the copperwalk, then east to tune the Singing Workshop before repairing the station signal.' : 'Tune the Singing Workshop east of the copperwalk before repairing the station signal.', screen.ly === 1 ? 'North; east to the workshop valve.' : 'East to the workshop pressure valve.') : gateStep(id, screen, 'First Bloom');
      if (!inPast(screen)) return gateStep(id, screen, 'First Bloom');
      return goal(id, 'signal', screen.ly === 1 ? 'Clear the station thieves, then repair the signal beside young Tern.' : 'Take the First Bloom copperwalk south to Tern\'s first departure. Clear its thieves and repair the signal.', screen.ly === 1 ? 'Clear thieves; repair the station signal.' : 'Copperwalk: south to the station.');
    }
    if (!inFuture(screen)) return gateStep(id, screen, 'Silent Year');
    if (screen.ly !== 1) return goal(id, 'platform', 'Take the Silent Year copperwalk south to the Last Platform.', 'Copperwalk: south to the Last Platform.');
    return hasFlag('era:departure-tag') ? goal(id, 'home', 'Answer the northern station signal with the Departure Tag. Help Tern call his courier home.', 'Bring the tag to the northern signal.')
      : goal(id, 'tag', 'Dodge the bell courier\'s marked notes, strike its open shutters, and cross the restored platform to its departure chest.', 'Defeat courier; cross to departure chest.');
  }
  if (id === 'shore-light') {
    if (!hasItem('ember-lens')) return goal(id, 'kiln', 'Find the optional kiln west of the upper Ember Gate in Brineglass Temple. Defeat its skaters and claim the Ember Lens.', 'Upper temple: kiln west of Ember Gate.');
    if (!hasFlag('coast:beacon-lit')) return goal(id, 'beacon', 'Walk south from Hookshore Landing. Melt the ice and fire into the shore beacon.', 'South of Hookshore: relight the beacon.');
    if (!inFuture(screen)) return gateStep(id, screen, 'Silent Year');
    if (screen.ly === 1) return goal(id, 'memory-north', 'Go north to the copperwalk, then west to the square. Open the vault beside the warm memorial southeast of Tern.', 'North; west to the memorial vault.');
    return goal(id, 'memory', screen.lx > 0 ? 'Follow the copperwalk west to the square, then open the vault beside the warm memorial southeast of Tern.' : 'Open the vault beside the warm memorial southeast of Tern.', 'Silent Year: open the memorial vault.');
  }
  if (id === 'barrow-echo') {
    if (screen?.key !== 'd1:2,4') return goal(id, 'find', 'Find Crossed Bones in the Old Barrow, beyond Dark Hall and Blade Gallery.', 'Old Barrow: find Crossed Bones.');
    if (entry.status === 'ready') return goal(id, 'chest', 'Open the eastern memory chest in Crossed Bones.', 'Open the eastern memory chest.');
    return goal(id, 'bell', entry.detail, hasFlag('dungeon:d1:echo-cleared') ? 'Throw a pot at the copper bell.' : 'Pot the bell; defeat both waves.');
  }
  if (id === 'fourfold-clock') {
    if (screen?.area.id !== 'tower-trial') return goal(id, 'find', entry.detail, 'Four lights: tower east of Pilgrim Strand.');
    const next = clockGoal(); return goal(id, entry.progress, next.text, next.short);
  }
  if (entry.status === 'offer') return goal(id, 'offer', `Talk to ${entry.giver} at ${entry.where} to accept this errand.`, `Talk to ${entry.giver}: ${entry.where}.`);
  if (entry.status === 'ready') return goal(id, 'return', `Return to ${entry.giver} at ${entry.where} with your find.`, `Return to ${entry.giver}.`);
  return goal(id, entry.progress, `${entry.progress}. ${entry.detail}`, `${entry.giver}: ${entry.progress === 'In progress' ? entry.detail : entry.progress}.`);
}

function localEraStep(screen) {
  if (!inPast(screen) && !inFuture(screen)) return null;
  if (screen.ly === 1 && !hasFlag('era:departure-home')) return questStep('last-departure', screen);
  // A memory in hand is a nearby turn-in; otherwise finish the garden first
  // in the square and the archive first along its eastern route.
  const preferArchive = screen.lx > 0 || hasFlag('era:copper-memory') && !hasFlag('era:voices-returned');
  const first = preferArchive ? archiveStep(screen) : bellStep(screen);
  const second = preferArchive ? bellStep(screen) : archiveStep(screen);
  if (first || second) return first || second;
  if (screen.ly === 1) return gateStep('era-return', screen, 'Mossbrook / today');
  return goal('era-return', 'home', screen.lx > 0
    ? 'The garden and choir are restored. Follow the copperwalk west and take the hourgate to Mossbrook / today.'
    : 'The garden and choir are restored. Take the hourgate to Mossbrook / today to continue the four-temple adventure.',
    screen.lx > 0 ? 'West to hourgate; return to Mossbrook.' : 'Hourgate: Mossbrook / today.');
}

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
  { id: 'tower-trial', done: () => hasFlag('tower:trial'), text: 'Unwind the four tool anchors of the city clock while the reflections attack.' },
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
  const screen = currentScreen(), pinned = trackedQuestId();
  if (pinned) return questStep(pinned, screen);
  if (screen?.key === FAIR.screen) return questStep('clockfair',screen);
  const local = localEraStep(screen);
  if (local) return local;
  const story = STEPS.find((s) => !s.done()) ?? null;
  if (story?.id === 'tower-trial') return { ...story, ...clockGoal() };
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
    if (!hasFlag('dungeon:d2:keytaken:B-4')) return { id: 'hive-patrol-key', text: 'Bomb the nursery’s three brass seals and clear its guards for another key.' };
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
export const objectiveHudText = () => currentStep()?.short ?? objectiveText();

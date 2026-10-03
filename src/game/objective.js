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
import { entities } from '../entities/manager.js';
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
    return goal(id, 'bell', entry.detail, hasFlag('dungeon:d1:echo-cleared') ? 'Throw a pot at the copper bell.' : 'Clay bell; both waves.');
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

function barrowStep(screen) {
  const key=screen?.key, route=(step,text,short) => ({...BARROW_STEPS[step],text,short});
  if (!hasMap('d1')) {
    if (key==='d1:3,8') return route('map','Defeat the bats and open the map chest on the northern copper runner.','Bats; north map chest.');
    if (key==='d1:4,9') return route('map','Collect the battle key, then go west and north to Map Hall.','Battle key; west, north.');
    return {...BARROW_STEPS.map,short:'North: map chest.'};
  }
  if (!hasItem('boomerang')) {
    if (key==='d1:2,8' && !hasFlag('dungeon:d1:puzzle:I-3')) return route('keys','Push the block east along copper to the statue, then stand below it and push north onto the plate.','Copper: east, then north.');
    if (!hasFlag('dungeon:d1:door:I-4:n')) {
      if (key==='d1:2,8' && hasFlag('dungeon:d1:keytaken:I-3')) return route('keys','Return east to Map Hall. Use one of your earned small keys at its north door.','East; north key door.');
      if (key==='d1:3,8' && hasFlag('dungeon:d1:keytaken:I-3')) return route('keys','Use an earned small key at the north door, then follow Pit Walk east.','North lock; bridge east.');
      if (key==='d1:3,8' && hasFlag('dungeon:d1:keytaken:J-5')) return route('keys','A second key waits west in Block Hall. Then use a key at Map Hall\'s north door.','West block key; north lock.');
      return {...BARROW_STEPS.keys,short:'East battle; west block.'};
    }
    if (key==='d1:3,7') return route('tool','Follow the pale bridge east to Gazer Walk, then north to the guarded boomerang.','Bridge east; then north.');
    if (key==='d1:4,7') return route('tool','Sidestep the coral shots. The boomerang waits in the room north of Gazer Walk.','Sidestep; north to tool.');
    if (key==='d1:4,6') return route('tool','Defeat the shielded guardians. Open the central boomerang chest, then rest at the western hourstone.','Guardians; chest; rest.');
    return {...BARROW_STEPS.tool,short:'Bridge east; north to tool.'};
  }
  if (!hasFlag('dungeon:d1:keytaken:G-4')) {
    if (key==='d1:4,6') return route('eye','Rest at the western hourstone. Go south, west, then north to Eye Hall.','Rest; south, west, north.');
    if (key==='d1:4,7') return route('eye','The boomerang interrupts the gazers. Go west across Pit Walk, then north to Eye Hall.','Boomerang; west, north.');
    if (key==='d1:3,7') return route('eye','Follow the pale bridge north to Eye Hall.','Bridge north to Eye Hall.');
    if (key==='d1:3,6') return route('eye','Throw the boomerang north at the stone eye to the right of the key door. Collect the key in the west.','Boomerang at north eye.');
    return {...BARROW_STEPS.eye,short:'Eye Hall: boomerang eye.'};
  }
  if (!hasFlag('dungeon:d1:keytaken:E-3')) {
    if (key==='d1:3,6') return route('bones','Rest at the western hourstone, then use a small key at the west door. Cross Dark Hall and go north through Blade Gallery.','Rest; west lock; north twice.');
    if (key==='d1:2,6') return route('bones','Follow the copper trail north to Blade Gallery, then north again to Crossed Bones.','Copper path north twice.');
    if (key==='d1:2,5') return route('bones','Keep to the repaired center path, clear of the corner blades. Crossed Bones lies north.','Center path; bell north.');
    if (key==='d1:2,4') return route('bones','Throw clay at the northern copper bell to interrupt it. Defeat both waves and collect the battle key.','Clay bell; both waves.');
    return {...BARROW_STEPS.bones,short:'Dark Hall north to bell.'};
  }
  if (key==='d1:2,4') return route('eyes','Take the fourth key east to Hall of Eyes. Light all four eyes with quick, close boomerang throws.','East: four timed eyes.');
  if (key==='d1:3,4') return route('eyes','Stand close to the north wall. Throw at each copper-marked eye before the five-second lights fade.','Close throws: 4 eyes in 5s.');
  if (key==='d1:4,4') return route('eyes','Open the central chest for the boss key. Return west, then unlock the north door.','Boss key; west, then north.');
  return {...BARROW_STEPS.eyes,short:'Four eye throws in 5s.'};
}

const OPEN_GOAL = 'Hunt for heart pieces, see what the smith can do with your coins, or help villagers with their errands.';

function hiveRoomStep(screen,story) {
  if (!['hive-key','hive-boss'].includes(story?.id)) return null;
  const goal=(id,text,short)=>({id,text,short});
  if(screen?.area.id==='d2-boss') {
    const q=entities.find(e=>!e.removed&&e.type==='boss-queen');
    if(!q)return null;
    if(q.ai.phase==='flipped')return goal('hive-queen-flipped','The crown is overturned. Close in and strike before the queen takes flight.','Overturned crown: strike!');
    if(q.ai.phase==='rest')return goal('hive-queen-rest','The crown is open. Strike it, or plant a bomb and move clear of its fuse.','Open crown: sword or bomb.');
    if(q.ai.phase==='volley')return goal('hive-queen-volley','Move sideways through the amber volley. Strike nearby drones while you wait for her crown to open.','Sidestep amber; cut drones.');
    return goal('hive-queen-flight','Cut nearby drones and wait out flight. Bomb the landing crown, then move clear of the blast.','Cut drones; bomb her landing.');
  }
  if(screen?.area.id!=='d2'||!hasItem('bombs'))return null;
  const nurseryTaken=hasFlag('dungeon:d2:keytaken:B-4');
  if(screen.key==='d2:3,1') {
    if(nurseryTaken)return goal('hive-nursery-return','The nursery is quiet. Return south to the gallery; the amber crown key waits beyond its eastern seam.','Nursery quiet; south to gallery.');
    const seals=[0,1,2].filter(i=>!hasFlag(`dungeon:d2:nursery-valve:${i}`)).length;
    if(seals)return goal(`hive-pressure-${seals}`,'Bomb the three brass seals to quiet their marked floor lanes. Clear the wardens for the nursery key.',`Brass seals: ${seals}. Bomb; move clear.`);
    if(!hasFlag('dungeon:d2:key:B-4'))return goal('hive-nursery-guards','The irrigation is quiet. Defeat the remaining wardens to release the small key.','Seals open; defeat wardens.');
    return goal('hive-nursery-pickup','Collect the small key from the nursery floor, then return south to the gallery.','Collect key; return south.');
  }
  if(story.id!=='hive-key')return null;
  if(screen.key==='d2:2,2')return goal('hive-first-seam','Blast the eastern stone seam. The next small key waits north of the gallery; the crown key waits east.','Bomb east; nursery north.');
  if(screen.key==='d2:3,2')return nurseryTaken
    ?goal('hive-amber-seam','Blast this gallery\'s eastern stone seam, then open the amber crown-key chest.','Bomb east; amber key chest.')
    :goal('hive-nursery-north','Enter the northern nursery. Bomb its brass seals and defeat its wardens for another small key.','Nursery north: seals and wardens.');
  if(screen.key==='d2:4,2')return goal('hive-amber-chest','Open the central chest for the amber crown key, then return west to the gallery.','Open amber key chest.');
  return null;
}

function watchRoomStep(screen,story) {
  if(!['watch-key','watch-boss'].includes(story?.id))return null;
  const goal=(id,text,short)=>({id,text,short});
  if(screen?.area.id==='d3-boss'){
    const b=entities.find(e=>!e.removed&&e.type==='boss-colossus');if(!b)return null;
    if(b.ai.phase==='leap')return goal('watch-leap','Leave the marked landing circle. Wait for the core to land, then strike while it is low.','Leave landing; then strike core.');
    const part=b.stage===1?'feet':b.stage===2?'arms':'core';
    return goal(`watch-${part}`,'Strike the glowing '+part+'. Sidestep the coral laser lane; your shield blocks the golden round waves.','Strike '+part+'; dodge coral, guard gold.');
  }
  if(screen?.area.id!=='d3')return null;
  const hook=hasItem('grapple'),counterweight=hasFlag('dungeon:d3:keytaken:C-1');
  const routes={
    'd3:2,3':!hasMap('d3')?['watch-map','Clear Shield Patrol west, then open Watch Charts north of it.','Patrol west; map north.']:!hook?['watch-grapple','The grapple waits beyond the eastern lock in Divided Hall. The second key is west of Watch Charts.','Divided Hall north; grapple east.']:['watch-stair','Go north to Broken Stair. Hook its far post and take the northern stair to the upper landing.','Broken Stair north; hook its post.'],
    'd3:1,3':['watch-patrol','Break the shield patrol with a flank, a thrown pot or returning wood. Collect its key, then take the northern map room.','Defeat patrol; key, then north.'],
    'd3:1,2':!hasMap('d3')?['watch-map-chest','Open the central map chest. The counterweight key waits in the western room.','Open map; counterweight west.']:!counterweight?['watch-counterweight-route','The western counterweight releases another key. Then return east through Divided Hall to the grapple vault.','Counterweight west; grapple east.']:['watch-divided-route','Return east to Divided Hall. Its eastern lock leads to the grapple vault.','East to Divided Hall.'],
    'd3:0,2':!counterweight?['watch-counterweight','Push the square block east along its rail onto the matching plate. Collect the key from the northern floor.','Push block east; collect key north.']:['watch-counterweight-return','The counterweight key is yours. Return east through Watch Charts and Divided Hall.','Key earned; return east.'],
    'd3:2,2':!hook?['watch-grapple','Open this hall\'s eastern lock. Defeat the Chain Vault guards and open its central grapple chest.','Spend patrol key east; grapple cache.']:!counterweight?['watch-counterweight-route','Find the counterweight key west of Watch Charts before climbing the upper watch.','Counterweight west of Watch Charts.']:['watch-stair','Head north to Broken Stair. Cast at the far striped post and climb the northern stair.','North: hook post; climb stair.'],
    'd3:3,2':!hook?['watch-grapple-cache','Use cover and returning wood against the vault guards. Open the central chest for the grapple.','Defeat vault guards; open grapple.']:['watch-first-cast','Rest at the western platform clock. Test the chain south in First Cast, or return west and north to Broken Stair.','Rest west; First Cast south.'],
    'd3:3,3':['watch-first-cast','Face east from the western bank and hook the striped post. The optional coin island is east.','Hook east across the channel.'],
    'd3:4,3':['watch-island','Hook the northern chest from the southern bank. Open it, then hook the southern post to return.','Hook chest north; return post south.'],
    'd3:2,1':['watch-stair','Cast north at the striped post from the southern bank, then take the stair beyond it. The blue-eye detour is west.','Hook north; climb northern stair.'],
    'd3:2,7':hasBossKey('d3')?['watch-upper-return','The crown is yours. Cross north, unlock the upper door, and wake the antechamber shortcut.','North; upper lock and shortcut.']:['watch-upper-crossing','A longer chain waits west. Cross the northern bridge, then follow the eastern arsenal to the crown.','Sun Dial west; crown northeast.'],
    'd3:1,7':hasItem('sun-dial')?['watch-dial-return','The Sun Dial extends new casts to eight tiles. Return east, then cross north toward the crown.','Dial earned; east, then north.']:['watch-dial-guards','Hook the brass shutters open or strike after their volley. Clear the guards and open the Sun Dial chest.','Hook shutters; strike; open cache.'],
    'd3:2,6':hasBossKey('d3')?['watch-upper-lock','Hook the northern post and spend the counterweight key at the northern door.','Hook north; unlock upper door.']:['watch-missing-bridge','Hook the far northern post. The eastern ledge leads into Crossing Arsenal and onward to the crown.','Hook north; eastern arsenal ledge.'],
    'd3:3,6':['watch-arsenal','Defeat the sentry on this bank, hook the opposite striped post, then clear the other sentry to open both shutters.','Clear each bank; hook the other.'],
    'd3:4,6':hasBossKey('d3')?['watch-crown-return','Return to the southern post, head west to the missing bridge and open its northern lock.','Hook south; west to upper lock.']:['watch-crown-chest','Cast north from the southern bank at the distant crown chest. Open it for the Colossus key.','Hook crown chest north; open it.'],
    'd3:2,5':hasFlag('dungeon:d3:portal')?['watch-court','Rest at the western platform clock. The shortcut is awake; the Colossus waits through the northern crown door.','Rest clock west; Colossus north.']:['watch-shortcut','Rest at the western platform clock and step on the central plate to wake the shortcut. Then open the northern crown door.','Rest west; plate; Colossus north.'],
  };
  const row=routes[screen.key];return row?goal(...row):null;
}

// The first step not yet done, or null once every step is (the open goal).
export function currentStep() {
  const screen = currentScreen(), pinned = trackedQuestId();
  if (pinned) return questStep(pinned, screen);
  if (screen?.key === FAIR.screen) return questStep('clockfair',screen);
  const local = localEraStep(screen);
  if (local) return local;
  const story = STEPS.find((s) => !s.done()) ?? null;
  if (story?.id === 'meet-king') {
    const routes = {
      'v1:1,1': ['Follow the south road from Mossbrook Square to King Aldric at Crownhold.', 'South to King Aldric.'],
      'v1:1,2': ['Keep south along Mossbrook Lane. King Aldric waits beyond the castle road.', 'South along the castle road.'],
      'ow-4-3:1,0': ['Follow the paved road south through Crownhold\'s open gate to King Aldric.', 'South through the castle gate.'],
      'ow-4-3:1,1': ['Speak with King Aldric beside the four-hour mosaic for your sword and shield.', 'Talk to King Aldric: sword and shield.'],
    };
    const route = routes[screen?.key];
    if (route) return {...story, text:route[0], short:route[1]};
  }
  if (story?.id === 'enter-d1') {
    if (screen?.key === 'ow-4-3:1,1' || screen?.key === 'ow-4-3:1,0' || screen?.key === 'v1:1,2') return {...story, text:'Return north to Mossbrook Square, then follow the west road to Barrowfield.', short:'North to Mossbrook; then west.'};
    if (screen?.key === 'v1:1,1' && !state.gear.boots) return {...story, text:'Tinker Wyll gives Sprint Boots at the northeast corner of the square. Then head west to Barrowfield.', short:'Wyll northeast: Sprint Boots; then west.'};
    if (screen?.key === 'v1:0,1' || screen?.key === 'ow-3-2:2,1') return {...story,text:'Follow the road west to Barrow Crossing, then turn south to the Old Barrow.',short:'West to the crossing; then south.'};
    if (screen?.key === 'ow-3-2:1,1') return {...story,text:'The Old Barrow is south of this crossing. Face the drawn bow with your shield, or step out of its line.',short:'South to the Old Barrow.'};
    if (screen?.key === 'ow-3-2:1,2') return {...story,text:'Clear the approach, drink from the spring west of the path, then enter the northern barrow door.',short:'Clear approach; spring; northern door.'};
  }
  if (story?.id === 'tower-trial') return { ...story, ...clockGoal() };
  if(isComplete('d2')&&screen?.key==='d2:0,0')return {id:'hive-homecoming',text:'Take the southern stairs into Whisperwood. Follow the south exits home to Mossbrook; the next temple lies east.',short:'South stairs; home to Mossbrook.'};
  const hive=hiveRoomStep(screen,story);if(hive)return hive;
  if(story?.id==='enter-d3'){
    let route;
    if(screen?.area.id==='lost-woods')route=['Leave Amber Gate by its south path. At earlier forks, the small southwest arch returns to Carved Stone.','South exit to Whisperwood.'];
    else if(screen?.area.id==='forest')route=['Follow the woodland road south to Mossbrook, then head east through Mill Pond to Sunreach.','South to Mossbrook; then east.'];
    else route={
      'v1:1,0':['Return south to Mossbrook Square, then take the eastern Mill Pond road.','Square south; Mill Pond east.'],
      'v1:1,1':['Follow the eastern road through Mill Pond to Sunreach. Your earned bombs clear Dustfall Road.','Mill Pond east; Sunreach beyond.'],
      'v1:2,1':['Leave Mill Pond east for Dustfall Road. Bomb its central fallen stones and continue to the oasis.','East to Dustfall; bomb the stones.'],
      'sunreach:0,1':['Bomb the two central road stones and move clear of the fuse. The oasis and its all-night inn are east.','Bomb stones; oasis east.'],
      'sunreach:1,1':['Rest at the inn, then follow the northern dry river and turn east to the Buried Watch.','Rest here; Watch north, then east.'],
      'sunreach:1,0':['Cross the dry river and follow its eastern road. The buried temple entrance is beyond the next patrols.','Cross river; Watch east.'],
      'sunreach:2,0':['Clear the approach, then enter the buried temple in the northern stone facade.','Clear approach; temple north.'],
    }[screen?.key];
    if(route)return {...story,text:route[0],short:route[1]};
  }
  if(isComplete('d3')&&screen?.key==='d3:0,5')return {id:'watch-homecoming',text:'Take the southern stairs into Sunreach. Brineglass lies south of Post Islands; the grapple opens its road.',short:'South stairs; shore beyond islands.'};
  const watch=watchRoomStep(screen,story);if(watch)return watch;
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
  if (story?.id==='beat-boss' && screen?.key==='d1:3,3') return {...story,text:'Rest at the western hourstone, then unlock the northern boss door. Its coil guard yields only at the tail.',short:'Hourstone; north to serpent.'};
  if (story?.id==='beat-boss' && screen?.area.id==='d1-boss') {
    const b=entities.find(e=>!e.removed&&e.type==='boss-serpent');
    return {...story,text:b?.segments.length?'Circle behind the glowing tail. Sidestep the coral charge lane and strike during its rest.':'The head is exposed. Sidestep its charge, then strike while it rests.',short:b?.segments.length?'Glowing tail; dodge coral.':'Head exposed; dodge, strike.'};
  }
  if (isComplete('d1') && screen?.key==='d1:3,1') return {id:'barrow-homecoming',text:'Take the southern stairs back to Barrowfield. Return east to Mossbrook; the next temple lies north through Whisperwood.',short:'South stairs; home east.'};
  if (story?.id !== 'big-key') return story;
  return barrowStep(screen);
}

export const objectiveId = () => currentStep()?.id ?? 'open';
export const objectiveText = () => currentStep()?.text ?? OPEN_GOAL;
export const objectiveHudText = () => currentStep()?.short ?? objectiveText();

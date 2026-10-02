import { hasFlag, setFlag } from '../core/state.js';
import { world, currentScreen } from '../world/world.js';
import { registerPlayHook } from './flow.js';
import { grant, registerGrant } from './grants.js';
import { departureProp } from '../models/departure.js';
import { modelMesh } from '../models/kit.js';

export const DEPARTURE = { started: 'era:departure', powered: 'era:departure-powered', tag: 'era:departure-tag', claimed: 'era:departure-claimed', home: 'era:departure-home' };
registerGrant('departure-tag', () => { if (!hasFlag(DEPARTURE.tag)) setFlag(DEPARTURE.tag); },
  { name: 'Departure Tag', fanfare: true, model: () => modelMesh(departureProp('tag')), text: 'Departure Tag. One passenger still waiting.' });
registerGrant('departure-chime', () => {
  if (hasFlag(DEPARTURE.home)) return;
  setFlag(DEPARTURE.home); grant('magic-container', 1, { fanfare: false, source: 'departure-home' });
}, { name: 'Homeward Chime', fanfare: true, model: () => modelMesh(departureProp('lit')), text: 'Homeward Chime! One more magic gem.' });

registerPlayHook({ id: 'departure-causality', phase: 'after', update() {
  const s = currentScreen();
  if (s?.key === 'mossbrook-past:1,1' && hasFlag(DEPARTURE.powered) && world.tile(s.x0+6,s.z0+4) === 'S')
    world.setTile(s.x0+6,s.z0+4,'J',{persist:true,reason:'departure-signal-restored'});
  if (s?.key === 'mossbrook-future:1,1' && hasFlag(DEPARTURE.powered)) {
    if (world.tile(s.x0+3,s.z0+4) === 'S') world.setTile(s.x0+3,s.z0+4,'E',{persist:true,reason:'departure-signal-restored'});
    for (const [x,z] of [[2,5],[10,5],[3,10],[12,10]]) if (world.tile(s.x0+x,s.z0+z) === 'Z')
      world.setTile(s.x0+x,s.z0+z,'Y',{persist:true,reason:'departure-signal-restored'});
    for (const z of [8,9,10]) for (const x of [7,8]) if (world.tile(s.x0+x,s.z0+z) === '~')
      world.setTile(s.x0+x,s.z0+z,'j',{persist:true,reason:'departure-platform-restored'});
  }
  if (s?.key === 'v1:1,1' && hasFlag(DEPARTURE.home)) for (const [x,z] of [[13,10],[14,10],[13,11]]) {
    if (world.tile(s.x0+x,s.z0+z) === '.') world.setTile(s.x0+x,s.z0+z,'Y',{persist:true,reason:'departure-town-lights'});
  }
} });

export function departureJournalEntry() {
  const done = hasFlag(DEPARTURE.home), tag = hasFlag(DEPARTURE.tag), powered = hasFlag(DEPARTURE.powered), started = hasFlag(DEPARTURE.started);
  return { id: 'last-departure', title: 'The Last Departure', giver: 'Tern', where: 'First Bloom station', status: done ? 'done' : tag ? 'ready' : started ? 'active' : 'offer',
    detail: done ? 'Tern no longer keeps the last passenger waiting. Three station lights shine in present-day Mossbrook.' : tag ? 'Bring the Departure Tag to the station signal in the Silent Year. Tern has one last instruction for the courier.' : powered ? 'Visit the Last Platform, south of the Silent Year copperwalk. Defeat the Waiting Bell Courier, then open its departure chest across the restored platform.' : 'Find Tern in his first spring, south of the First Bloom copperwalk. Restore the square engine and workshop, clear the station thieves, and repair its signal. The future still has a passenger waiting.',
    progress: done ? 'The last passenger is home' : tag ? 'Return the Departure Tag' : powered ? 'The future platform is lit' : started ? 'Repair the past signal' : 'Tern has a first day', reward: 'One permanent magic gem + town lights' };
}

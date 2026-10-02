import { hasFlag, setFlag } from '../core/state.js';
import { hasItem } from '../items/inventory.js';
import { currentScreen, world } from '../world/world.js';
import { registerPlayHook } from './flow.js';
import { grant, registerGrant } from './grants.js';
import { modelMesh } from '../models/kit.js';
import { emberLensModel } from '../models/brineglass.js';

registerGrant('beacon-memory', () => {
  if (hasFlag('coast:beacon-memory')) return;
  setFlag('coast:beacon-memory'); grant('magic-container', 1, { fanfare: false, source: 'shore-beacon' });
}, { name: 'Keeper Memory', fanfare: true, model: () => modelMesh(emberLensModel()), text: 'Keeper Memory! One more permanent magic gem. A light reached tomorrow.' });

registerPlayHook({ id: 'shore-beacon-causality', phase: 'after', update() {
  if (!hasFlag('coast:beacon-lit')) return;
  const s = currentScreen();
  if (s?.key === 'tidecoast:0,2' && world.tile(s.x0 + 8, s.z0 + 5) === '{') world.setTile(s.x0 + 8, s.z0 + 5, '}', { persist: true, reason: 'shore-beacon-lit' });
  if (s?.key !== 'mossbrook-future:0,0') return;
  if (world.tile(s.x0 + 12, s.z0 + 12) === '{') world.setTile(s.x0 + 12, s.z0 + 12, '}', { persist: true, reason: 'shore-beacon-arrived' });
  if (world.tile(s.x0 + 13, s.z0 + 12) === '[') world.setTile(s.x0 + 13, s.z0 + 12, 'C', { persist: true, reason: 'shore-beacon-vault' });
  for (const [x, z] of [[11, 12], [12, 13], [13, 13]]) if (world.tile(s.x0 + x, s.z0 + z) === '.') world.setTile(s.x0 + x, s.z0 + z, 'a', { persist: true, reason: 'shore-beacon-path' });
} });

export function beaconJournalEntry() {
  const done = hasFlag('coast:beacon-memory'), lit = hasFlag('coast:beacon-lit'), lens = hasItem('ember-lens');
  return { id: 'shore-light', title: 'A Light for Tomorrow', giver: 'The Shore Keeper', where: 'Brineglass Coast', status: done ? 'done' : lit ? 'ready' : lens ? 'active' : 'offer',
    detail: done ? 'A keeper\'s shore light warmed a memorial three hundred years later. Someone in the Silent Year will know they were remembered.' : lit ? 'Use the Mossbrook hourgate to visit the Silent Year. The warm memorial and its opened vault stand southeast of caretaker Tern.' : lens ? 'Walk south from Hookshore Landing to the Last Shore Light. Melt the ice and fire into the cold beacon. Then visit the Silent Year.' : 'Find the optional kiln west of the upper Ember Gate in Brineglass Temple. Defeat its Tideglass Skaters and collect the Ember Lens. Its fire can restore the old shore beacon.',
    progress: done ? 'A future warmed' : lit ? 'Visit the Silent Year memorial' : lens ? 'Relight the shore beacon' : 'Find the upper temple kiln', reward: 'Ember Lens + a permanent magic gem' };
}

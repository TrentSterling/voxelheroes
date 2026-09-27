// Per-tick bookkeeping for the contract modules, as play hooks (they run in
// play mode only): life, magic and coin changes made outside game/vitals.js
// become events, timed effects count down, play time and deaths are counted.
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { registerPlayHook } from '../systems/flow.js';
import { syncVitals } from './vitals.js';
import { tickEffects } from './effects.js';
import './fields.js';

registerPlayHook({ id: 'contracts-vitals', phase: 'input', order: 0, update: () => syncVitals('direct') });

registerPlayHook({
  id: 'contracts-records',
  phase: 'after',
  order: 0,
  update(dt) {
    state.playTime += dt;
    tickEffects(dt);
  },
});

on('player-died', () => {
  state.deaths += 1;
});

// Autosave (gameplay spec: "Save slots"; the autosave option, game/settings.js):
// writes the active slot after the hero settles into a new screen or area, and
// again when he sleeps at the inn. Debounced off 'room-enter' (world:
// transitions.js, already fired once a screen's spawns are in, never on a
// transition's own first frame) so a quick slide across several screens saves
// once; the debounce only counts down during play (registerPlayHook runs in
// 'play' mode only, systems/flow.js), so it also never lands mid-warp. Off
// when the autosave setting is off; storage failures are swallowed already
// (core/save.js writeSlot).
import { on } from '../core/events.js';
import { getSetting } from '../game/settings.js';
import { saveToSlot, registerPlayHook } from './flow.js';

const SETTLE = 0.6; // seconds of settled play before a room-enter save lands

let pending = 0;

function attempt() {
  pending = 0;
  if (getSetting('autosave')) saveToSlot();
}

on('room-enter', () => {
  pending = SETTLE;
});

on('inn-rest', attempt);

registerPlayHook({
  id: 'autosave',
  phase: 'after',
  update(dt) {
    if (pending <= 0) return;
    pending -= dt;
    if (pending <= 0) attempt();
  },
});

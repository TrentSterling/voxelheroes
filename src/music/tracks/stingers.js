// One-shot cues over the loop (game/music.js playStinger). Both are plain
// D major so they never clash with the overworld/title key; the dungeon and
// boss tracks change key under them without trouble since a stinger is only
// on screen for a second or two.
import { registerStinger } from '../../game/music.js';
import { playOnce, playNote } from '../engine.js';
import { freq } from '../theory.js';

// The boss-defeated fanfare: a rising D major arpeggio into a held chord.
registerStinger({
  id: 'victory',
  name: 'Victory',
  play(out) {
    playOnce(out, (ctx, dest, t) => {
      playNote(ctx, dest, freq('D5'), t, 0.16, { type: 'square', vol: 0.18, attack: 0.004, release: 0.05 });
      playNote(ctx, dest, freq('F#5'), t + 0.15, 0.16, { type: 'square', vol: 0.18, attack: 0.004, release: 0.05 });
      playNote(ctx, dest, freq('A5'), t + 0.3, 0.16, { type: 'square', vol: 0.18, attack: 0.004, release: 0.05 });
      playNote(ctx, dest, freq('D6'), t + 0.45, 0.6, { type: 'square', vol: 0.2, attack: 0.005, release: 0.15 });
      playNote(ctx, dest, freq('F#5'), t + 0.45, 0.6, { type: 'triangle', vol: 0.08, attack: 0.005, release: 0.15 });
      playNote(ctx, dest, freq('A5'), t + 0.45, 0.6, { type: 'triangle', vol: 0.08, attack: 0.005, release: 0.15 });
    });
  },
});

// The item-get jingle: a quick two-note lift into a bright held chord.
registerStinger({
  id: 'item',
  name: 'Item Get',
  play(out) {
    playOnce(out, (ctx, dest, t) => {
      playNote(ctx, dest, freq('E5'), t, 0.09, { type: 'square', vol: 0.13, attack: 0.003, release: 0.03 });
      playNote(ctx, dest, freq('G5'), t + 0.08, 0.09, { type: 'square', vol: 0.13, attack: 0.003, release: 0.03 });
      playNote(ctx, dest, freq('C6'), t + 0.16, 0.32, { type: 'square', vol: 0.15, attack: 0.004, release: 0.1 });
      playNote(ctx, dest, freq('E6'), t + 0.16, 0.32, { type: 'triangle', vol: 0.07, attack: 0.004, release: 0.1 });
    });
  },
});

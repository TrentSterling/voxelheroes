// Open Country: the overworld loop (bright, adventurous). D major, a I-V-vi-IV
// road-trip progression under a 16-bar melody that answers itself (phrase A
// bars 1-8, phrase B bars 9-16 climbs to a high D6 before settling back to
// the top of the loop).
import { registerMusic } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, compileDrums, playNote, playPad, playDrum, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 132;
const SD = stepDur(BPM);

// D - A - Bm - G, twice with a turnaround (G - A) so bar 7-8 lifts into the loop.
const CHORDS = [
  ['D4', 'F#4', 'A4'],
  ['A3', 'C#4', 'E4'],
  ['B3', 'D4', 'F#4'],
  ['G3', 'B3', 'D4'],
  ['D4', 'F#4', 'A4'],
  ['A3', 'C#4', 'E4'],
  ['G3', 'B3', 'D4'],
  ['A3', 'C#4', 'E4'],
];

const BASS_8 = [
  'D2 . . D2 . . A2 . D2 . . D2 . . A2 F#2',
  'A1 . . A1 . . E2 . A1 . . A1 . . E2 C#2',
  'B1 . . B1 . . F#2 . B1 . . B1 . . F#2 D2',
  'G1 . . G1 . . D2 . G1 . . G1 . . D2 B1',
  'D2 . . D2 . . A2 . D2 . . D2 . . A2 F#2',
  'A1 . . A1 . . E2 . A1 . . A1 . . E2 C#2',
  'G1 . . G1 . . D2 . G1 . . G1 . . D2 F#1',
  'A1 . . A1 . . E2 . A1 . . A1 . . E2 E2',
];

// Phrase A: a rising open-road call, then a settling answer.
const PHRASE_A = [
  'D5 . F#5 . A5 . . . G5 . F#5 . E5 . . .',
  'E5 . D5 . C#5 . . . D5 . E5 . F#5 . . .',
  'F#5 . A5 . B5 . . . A5 . F#5 . D5 . . .',
  'E5 . . . D5 . . . C#5 . D5 . E5 . . .',
  'D5 . F#5 . A5 . . . G5 . F#5 . E5 . . .',
  'E5 . D5 . C#5 . . . D5 . E5 . F#5 . . .',
  'G4 . A4 . B4 . C#5 . D5 . E5 . F#5 . G5 .',
  'A5 . . . . . F#5 . . . D5 . . . . .',
];
// Phrase B: a bouncier variation, climbing to the loop's high point (D6)
// before it drops back to the pickup that opens phrase A again.
const PHRASE_B = [
  'D5 . . A4 . A4 . F#4 . . D5 . . A4 . F#4',
  'C#5 . . E5 . E5 . D5 . . C#5 . . E5 . D5',
  'D5 . . F#5 . F#5 . A5 . . F#5 . . D5 . B4',
  'B4 . . D5 . D5 . E5 . . D5 . . B4 . G4',
  'D5 . F#5 . A5 . . . G5 . F#5 . E5 . . .',
  'E5 . D5 . C#5 . . . D5 . E5 . F#5 . . .',
  'G5 . A5 . B5 . C#6 . D6 . . . . . . .',
  'F#5 . . . D5 . . . A4 . . . . . . .',
];

const DRUM_BAR = 'K . H . S . H . K . H . S . H O';
const DRUM_FILL = 'K . H . S . H . K K S . K S H O';
const DRUMS = compileDrums([...Array(7).fill(DRUM_BAR), DRUM_FILL, ...Array(7).fill(DRUM_BAR), DRUM_FILL]);

const BASS = compileVoice([...BASS_8, ...BASS_8]);
const LEAD = compileVoice([...PHRASE_A, ...PHRASE_B]);

function onStep(step, t, chans, ctx) {
  if (step % 16 === 0) {
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
    for (const n of chord) playPad(ctx, chans.harmony, freq(n), t, SD * 15);
  }
  const b = BASS.at(step);
  if (b) playNote(ctx, chans.bass, freq(b.note), t, b.dur * SD * 0.9, { type: 'triangle', vol: 0.2, attack: 0.005, release: 0.04 });
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.86, { type: 'square', vol: 0.15, attack: 0.006, release: 0.05 });
  const d = DRUMS.at(step);
  if (d) playDrum(ctx, chans.drums, t, d);
}

const CONFIG = { bpm: BPM, swing: 0.06, levels: { lead: 1, bass: 0.85, harmony: 0.8, drums: 0.75 }, onStep };
registerRenderable('overworld', CONFIG);

registerMusic({
  id: 'overworld',
  name: 'Open Country',
  play(out) {
    return startLoop(out, CONFIG);
  },
});

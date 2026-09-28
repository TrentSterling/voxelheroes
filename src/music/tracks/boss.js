// Boss: driving. E minor, a i-bVI-bVII-i stomp (Em - C - D - Em) taken at
// speed: a pulsing octave bass instead of a held drone, short stabbed chords
// instead of a pad, a double-kick drum pattern, and a lead that arpeggiates
// harder each 4-bar pass (A, its syncopated answer B, then both again with
// extra notes) until the last bar sweeps down to hand the loop back to bar 1.
import { registerMusic } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, compileDrums, playNote, playDrum, bar, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 156;
const SD = stepDur(BPM);

const CHORDS = [
  ['E4', 'G4', 'B4'],
  ['C4', 'E4', 'G4'],
  ['D4', 'F#4', 'A4'],
  ['E4', 'G4', 'B4'],
];

// A pulsing octave ostinato under each chord, with a two-note run into the next.
const pulse = (lo, hi, tail) => {
  const spec = {};
  for (let s = 0; s <= 12; s += 2) spec[s] = s % 4 === 0 ? lo : hi;
  spec[14] = tail[0];
  spec[15] = tail[1];
  return bar(spec);
};
const BASS_4 = [pulse('E1', 'E2', ['G1', 'B1']), pulse('C1', 'C2', ['D1', 'E1']), pulse('D1', 'D2', ['E1', 'F#1']), pulse('E1', 'E2', ['G1', 'B1'])];

const PHRASE_A = [
  bar({ 0: 'E5', 4: 'G5', 8: 'B5', 12: 'G5' }),
  bar({ 0: 'C5', 4: 'E5', 8: 'G5', 12: 'E5' }),
  bar({ 0: 'D5', 4: 'F#5', 8: 'A5', 12: 'F#5' }),
  bar({ 0: 'B4', 4: 'E5', 8: 'D5', 12: 'B4' }),
];
const PHRASE_B = [
  bar({ 2: 'E5', 6: 'G5', 10: 'B5', 14: 'E6' }),
  bar({ 2: 'C5', 6: 'E5', 10: 'G5', 14: 'C6' }),
  bar({ 0: 'D5', 3: 'F#5', 6: 'A5', 9: 'D6', 12: 'C6', 14: 'A5' }),
  bar({ 0: 'B5', 4: 'G5', 8: 'E5', 12: 'B4' }),
];
const PHRASE_A2 = [
  bar({ 0: 'E5', 2: 'G5', 4: 'G5', 8: 'B5', 12: 'G5', 14: 'E5' }),
  bar({ 0: 'C5', 2: 'E5', 4: 'E5', 8: 'G5', 12: 'E5', 14: 'C5' }),
  bar({ 0: 'D5', 2: 'F#5', 4: 'F#5', 8: 'A5', 12: 'F#5', 14: 'D5' }),
  bar({ 0: 'B4', 4: 'E5', 6: 'D5', 8: 'D5', 12: 'B4', 14: 'G4' }),
];
const PHRASE_B2 = [
  bar({ 0: 'E5', 2: 'G5', 4: 'B5', 6: 'E6', 8: 'B5', 10: 'G5', 12: 'E5', 14: 'B4' }),
  bar({ 0: 'C5', 2: 'E5', 4: 'G5', 6: 'C6', 8: 'G5', 10: 'E5', 12: 'C5', 14: 'G4' }),
  bar({ 0: 'D5', 2: 'F#5', 4: 'A5', 6: 'D6', 8: 'C#6', 10: 'B5', 12: 'A5', 14: 'F#5' }),
  bar({ 0: 'D5', 2: 'B4', 4: 'G4', 6: 'E4', 10: 'B4', 14: 'E5' }),
];

const DRUM_BAR = bar({ 0: 'K', 2: 'H', 3: 'K', 4: 'H', 6: 'S', 8: 'K', 9: 'K', 10: 'H', 12: 'S', 14: 'H', 15: 'O' });
const DRUM_FILL = bar({ 0: 'K', 2: 'K', 4: 'S', 6: 'K', 8: 'K', 10: 'K', 12: 'S', 14: 'H', 15: 'O' });

const BASS = compileVoice([...BASS_4, ...BASS_4, ...BASS_4, ...BASS_4]);
const LEAD = compileVoice([...PHRASE_A, ...PHRASE_B, ...PHRASE_A2, ...PHRASE_B2]);
const DRUMS = compileDrums([...Array(3).fill(DRUM_BAR), DRUM_FILL, ...Array(3).fill(DRUM_BAR), DRUM_FILL, ...Array(3).fill(DRUM_BAR), DRUM_FILL, ...Array(3).fill(DRUM_BAR), DRUM_FILL]);

function onStep(step, t, chans, ctx) {
  if (step % 16 === 0) {
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
    for (const n of chord) playNote(ctx, chans.harmony, freq(n), t, SD * 2, { type: 'sawtooth', vol: 0.05, attack: 0.003, release: 0.05 });
  }
  const b = BASS.at(step);
  if (b) playNote(ctx, chans.bass, freq(b.note), t, b.dur * SD * 0.85, { type: 'square', vol: 0.17, attack: 0.003, release: 0.03 });
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.75, { type: 'sawtooth', vol: 0.13, attack: 0.004, release: 0.04 });
  const d = DRUMS.at(step);
  if (d) playDrum(ctx, chans.drums, t, d, 1);
}

const CONFIG = { bpm: BPM, levels: { lead: 1, bass: 0.85, harmony: 0.6, drums: 0.9 }, onStep };
registerRenderable('boss', CONFIG);

registerMusic({
  id: 'boss',
  name: 'Boss',
  play(out) {
    return startLoop(out, CONFIG);
  },
});

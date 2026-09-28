// Title: a short, calm D major theme (I-IV-V-I), half the overworld's tempo
// and none of its drums, so the name card has something dignified behind it
// without stepping on the adventure the overworld track sets up once play
// starts. Nothing in ui/screens/title.js calls playMusic('title') yet; this
// only supplies the sound for whenever that hook is added.
import { registerMusic } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, playNote, playPad, bar, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 66;
const SD = stepDur(BPM);

const CHORDS = [
  ['D4', 'F#4', 'A4'],
  ['D4', 'F#4', 'A4'],
  ['G3', 'B3', 'D4'],
  ['G3', 'B3', 'D4'],
  ['A3', 'C#4', 'E4'],
  ['A3', 'C#4', 'E4'],
  ['D4', 'F#4', 'A4'],
  ['D4', 'F#4', 'A4'],
];

// A whole bar held on one bass note, for CHORDS' roots.
const HOLD = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, '-']));
const sustain = (note) => bar({ 0: note, ...HOLD });
const BASS_BARS = ['D2', 'D2', 'G1', 'G1', 'A1', 'A1', 'D2', 'D2'].map(sustain);

const LEAD_BARS = [
  bar({ 0: 'A4', 8: 'D5' }),
  bar({ 0: 'F#5', 8: 'E5' }),
  bar({ 0: 'D5', 8: 'G5' }),
  bar({ 0: 'F#5', 8: 'D5' }),
  bar({ 0: 'E5', 8: 'C#5' }),
  bar({ 0: 'D5', 8: 'B4' }),
  bar({ 0: 'C#5', 8: 'B4' }),
  bar({ 0: 'A4' }),
];

const BASS = compileVoice(BASS_BARS);
const LEAD = compileVoice(LEAD_BARS);

function onStep(step, t, chans, ctx) {
  if (step % 16 === 0) {
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
    for (const n of chord) playPad(ctx, chans.harmony, freq(n), t, SD * 15, { type: 'sine', vol: 0.05, attack: 0.15, release: 0.3 });
  }
  const b = BASS.at(step);
  if (b) playNote(ctx, chans.bass, freq(b.note), t, b.dur * SD * 0.95, { type: 'sine', vol: 0.12, attack: 0.08, release: 0.2 });
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.85, { type: 'triangle', vol: 0.14, attack: 0.02, release: 0.2 });
}

const CONFIG = { bpm: BPM, levels: { lead: 1, bass: 0.8, harmony: 0.9 }, onStep };
registerRenderable('title', CONFIG);

registerMusic({
  id: 'title',
  name: 'Title',
  play(out) {
    return startLoop(out, CONFIG);
  },
});

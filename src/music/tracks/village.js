// Mossbrook's theme: warm, unhurried, a little Stardew. G major, a I-vi-IV-V
// turn that never leaves home, soft triangle/sine voices, a shaker instead
// of drums. Phrase A (bars 1-8) is the porch-swing tune; phrase B (bars
// 9-16) answers a touch higher before settling back to the loop point.
import { registerMusic } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, compileDrums, playNote, playPad, playDrum, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 92;
const SD = stepDur(BPM);

const CHORDS = [
  ['G3', 'B3', 'D4'],
  ['E3', 'G3', 'B3'],
  ['C3', 'E3', 'G3'],
  ['D3', 'F#3', 'A3'],
];

const BASS_4 = [
  'G1 . D2 . G1 . B1 . G1 . D2 . G1 . . .',
  'E1 . B1 . E1 . G1 . E1 . B1 . E1 . . .',
  'C2 . G2 . C2 . E2 . C2 . G2 . C2 . . .',
  'D2 . A2 . D2 . F#2 . D2 . A2 . D2 . . .',
];

const PHRASE_A = [
  'D5 . B4 . G4 . . . A4 . B4 . . . . .',
  'E5 . . . D5 . B4 . . . G4 . . . . .',
  'C5 . E5 . G5 . . . E5 . C5 . . . . .',
  'D5 . . . C5 . B4 . A4 . . . . . . .',
  'D5 . B4 . G4 . . . A4 . B4 . . . . .',
  'E5 . . . D5 . B4 . . . G4 . . . . .',
  'G4 . A4 . B4 . C5 . . . . . . . . .',
  'B4 . . . . . A4 . . . G4 . . . . .',
];
const PHRASE_B = [
  'G4 . B4 . D5 . . . B4 . G4 . . . . .',
  'G4 . . . B4 . D5 . . . B4 . . . . .',
  'E5 . D5 . C5 . . . D5 . E5 . G5 . . .',
  'F#5 . . . E5 . D5 . . . . . . . . .',
  'D5 . B4 . G4 . . . A4 . B4 . . . . .',
  'E5 . . . D5 . B4 . . . G4 . . . . .',
  'E5 . G5 . A5 . G5 . E5 . D5 . . . . .',
  'B4 . . . A4 . . . G4 . . . . . . .',
];

// A soft shaker, four gentle taps a bar; nothing that would feel like combat.
const SHAKER = '. . P . . . P . . . P . . . P .';
const DRUMS = compileDrums(Array(16).fill(SHAKER));

const BASS = compileVoice([...BASS_4, ...BASS_4, ...BASS_4, ...BASS_4]);
const LEAD = compileVoice([...PHRASE_A, ...PHRASE_B]);

function onStep(step, t, chans, ctx) {
  if (step % 16 === 0) {
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
    for (const n of chord) playPad(ctx, chans.harmony, freq(n), t, SD * 15, { type: 'sine', vol: 0.045 });
  }
  const b = BASS.at(step);
  if (b) playNote(ctx, chans.bass, freq(b.note), t, b.dur * SD * 0.85, { type: 'sine', vol: 0.16, attack: 0.01, release: 0.06 });
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.8, { type: 'triangle', vol: 0.15, attack: 0.012, release: 0.08 });
  const d = DRUMS.at(step);
  if (d) playDrum(ctx, chans.drums, t, d, 0.6);
}

const CONFIG = { bpm: BPM, swing: 0.09, levels: { lead: 1, bass: 0.8, harmony: 0.9, drums: 0.6 }, onStep };
registerRenderable('village', CONFIG);

registerMusic({
  id: 'village',
  name: 'Mossbrook',
  play(out) {
    return startLoop(out, CONFIG);
  },
});

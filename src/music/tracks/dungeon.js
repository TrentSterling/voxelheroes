// Hollow Barrow: tense, sparse, echoey. A slow i-bVII-bVI-V drone in D minor
// (D2 - C2 - Bb1 - A1, four bars each) under a phrygian-flavoured lead
// (D Eb F G Ab Bb C: the flat second and sixth are what make it feel wrong)
// that mostly rests, so a single note lands in a long silence, wet with a
// feedback delay so it seems to come from another room.
import { registerMusic } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, compileDrums, playNote, playDrum, createEcho, bar, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 80;
const SD = stepDur(BPM);
const BAR_SECONDS = SD * 16;

// One drone note held for 4 bars (64 steps) at a time; a slow descent that
// loops after 16 bars.
const DRONE = ['D2', 'C2', 'Bb1', 'A1'];

const LEAD_BARS = [
  bar({}),
  bar({ 6: 'D5' }),
  bar({ 0: 'Eb5' }),
  bar({ 2: 'Bb4', 6: 'C5', 10: 'D5' }),
  bar({}),
  bar({ 5: 'Eb5' }),
  bar({ 0: 'F5' }),
  bar({ 2: 'Ab4', 6: 'Bb4', 10: 'C5' }),
  bar({ 3: 'D5', 7: 'Eb5', 11: 'F5' }),
  bar({ 0: 'Eb5', 4: 'D5', 8: 'C5', 12: 'Bb4' }),
  bar({}),
  bar({ 6: 'Ab4' }),
  bar({ 0: 'G4', 4: 'Ab4', 8: 'Bb4', 12: 'C5' }),
  bar({ 0: 'D5', 3: 'C5', 6: 'Bb4', 9: 'Ab4', 12: 'G4' }),
  bar({}),
  bar({ 8: 'D5' }),
];

// A distant low thud closing every 4-bar phrase but one, and a single drip
// (a soft tick, not a hat) partway through the quiet stretch.
const DRUM_BARS = [
  bar({}),
  bar({}),
  bar({}),
  bar({ 14: 'K' }),
  bar({}),
  bar({}),
  bar({}),
  bar({ 14: 'K' }),
  bar({}),
  bar({}),
  bar({ 8: 'P' }),
  bar({}),
  bar({}),
  bar({}),
  bar({}),
  bar({ 14: 'K' }),
];

const LEAD = compileVoice(LEAD_BARS);
const DRUMS = compileDrums(DRUM_BARS);

function onStep(step, t, chans, ctx) {
  if (step % 64 === 0) {
    const note = DRONE[Math.floor(step / 64) % DRONE.length];
    playNote(ctx, chans.bass, freq(note), t, BAR_SECONDS * 4 * 0.97, { type: 'sine', vol: 0.1, attack: 0.6, release: 2.2 });
  }
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.5 + 0.4, { type: 'sine', vol: 0.13, attack: 0.01, release: 0.5 });
  const d = DRUMS.at(step);
  if (d) playDrum(ctx, chans.drums, t, d, 0.7);
}

const CONFIG = {
  bpm: BPM,
  levels: { lead: 1, bass: 1, drums: 0.8 },
  setup(chans, ctx, bus) {
    const echo = createEcho(ctx, bus, { time: 0.34, feedback: 0.4, mix: 0.32, damp: 1500 });
    chans.lead.connect(echo);
    chans.drums.connect(echo);
  },
  onStep,
};
registerRenderable('dungeon', CONFIG);

registerMusic({
  id: 'dungeon',
  name: 'Down Below',
  play(out) {
    return startLoop(out, CONFIG);
  },
});

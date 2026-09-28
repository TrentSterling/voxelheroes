// The Hollow Barrow (D1, dungeons/d1.js: registerMusic({ id: 'dungeon-1' }),
// docs/CONTRACTS.md 8.13). That file names the track; this one gives it its
// play() via setMusicPlayer, since a dungeon owns its id but src/music/*
// owns the sound (works whichever file's top-level code runs first). A
// cousin of Down Below (crypt.js's 'dungeon'): G minor instead of D minor, a
// touch faster and busier since this is the real crawl with a boss at the
// end of it, not the M1 test dungeon.
import { setMusicPlayer } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, compileDrums, playNote, playDrum, createEcho, bar, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 86;
const SD = stepDur(BPM);
const BAR_SECONDS = SD * 16;

// i - bVII - bVI - V, the same shape as Down Below, transposed and reordered.
const DRONE = ['G1', 'F1', 'Eb1', 'D1'];

const LEAD_BARS = [
  bar({ 6: 'G5' }),
  bar({ 0: 'Ab5' }),
  bar({ 4: 'Bb4', 10: 'C5' }),
  bar({ 2: 'D5', 8: 'Eb5', 12: 'F5' }),
  bar({}),
  bar({ 6: 'Ab5' }),
  bar({ 0: 'Bb4' }),
  bar({ 3: 'C5', 7: 'D5', 11: 'Eb5' }),
  bar({ 0: 'F5', 4: 'Eb5', 8: 'D5', 12: 'C5' }),
  bar({}),
  bar({ 8: 'Bb4' }),
  bar({ 2: 'Ab4', 6: 'Bb4', 10: 'C5', 14: 'D5' }),
  bar({ 0: 'Eb5', 3: 'D5', 6: 'C5', 9: 'Bb4', 12: 'Ab4' }),
  bar({}),
  bar({ 6: 'G4' }),
  bar({ 10: 'G5' }),
];

const DRUM_BARS = [
  bar({}),
  bar({}),
  bar({ 14: 'K' }),
  bar({}),
  bar({ 8: 'P' }),
  bar({}),
  bar({ 14: 'K' }),
  bar({}),
  bar({}),
  bar({ 6: 'P' }),
  bar({}),
  bar({ 14: 'K' }),
  bar({}),
  bar({ 8: 'P' }),
  bar({}),
  bar({ 14: 'K' }),
];

const LEAD = compileVoice(LEAD_BARS);
const DRUMS = compileDrums(DRUM_BARS);

function onStep(step, t, chans, ctx) {
  if (step % 64 === 0) {
    const note = DRONE[Math.floor(step / 64) % DRONE.length];
    playNote(ctx, chans.bass, freq(note), t, BAR_SECONDS * 4 * 0.97, { type: 'sine', vol: 0.11, attack: 0.5, release: 2 });
  }
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.5 + 0.35, { type: 'sine', vol: 0.14, attack: 0.008, release: 0.45 });
  const d = DRUMS.at(step);
  if (d) playDrum(ctx, chans.drums, t, d, 0.75);
}

const CONFIG = {
  bpm: BPM,
  levels: { lead: 1, bass: 1, drums: 0.85 },
  setup(chans, ctx, bus) {
    const echo = createEcho(ctx, bus, { time: 0.3, feedback: 0.36, mix: 0.3, damp: 1600 });
    chans.lead.connect(echo);
    chans.drums.connect(echo);
  },
  onStep,
};
registerRenderable('dungeon-1', CONFIG);

setMusicPlayer('dungeon-1', (out) => startLoop(out, CONFIG));

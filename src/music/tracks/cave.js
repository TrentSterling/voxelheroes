// Hollow Cave: the secret under Cliff Hollow. Quieter and lower than the
// dungeon, A minor's own i-bVII-bVI-v descent (A1 - G1 - F1 - E1), bell-like
// plucks in A minor pentatonic over a longer, wetter echo, so it reads as a
// bigger, wetter space than a corridor. A slow drip of soft percussion
// stands in for the dungeon's distant thud.
import { registerMusic } from '../../game/music.js';
import { startLoop, registerRenderable, compileVoice, compileDrums, playNote, playDrum, createEcho, bar, stepDur } from '../engine.js';
import { freq } from '../theory.js';

const BPM = 72;
const SD = stepDur(BPM);
const BAR_SECONDS = SD * 16;

const DRONE = ['A1', 'G1', 'F1', 'E1'];

const LEAD_BARS = [
  bar({}),
  bar({}),
  bar({ 4: 'C5' }),
  bar({}),
  bar({}),
  bar({ 10: 'E5' }),
  bar({}),
  bar({ 2: 'D5', 9: 'C5' }),
  bar({}),
  bar({}),
  bar({ 6: 'G5' }),
  bar({}),
  bar({}),
  bar({ 12: 'E5', 14: 'D5' }),
  bar({}),
  bar({ 8: 'A4' }),
];

const DRUM_BARS = [
  bar({}),
  bar({ 8: 'P' }),
  bar({}),
  bar({ 4: 'P' }),
  bar({}),
  bar({}),
  bar({ 12: 'P' }),
  bar({}),
  bar({ 6: 'P' }),
  bar({}),
  bar({}),
  bar({ 2: 'P', 10: 'P' }),
  bar({}),
  bar({}),
  bar({ 8: 'P' }),
  bar({}),
];

const LEAD = compileVoice(LEAD_BARS);
const DRUMS = compileDrums(DRUM_BARS);

function onStep(step, t, chans, ctx) {
  if (step % 64 === 0) {
    const note = DRONE[Math.floor(step / 64) % DRONE.length];
    playNote(ctx, chans.bass, freq(note), t, BAR_SECONDS * 4 * 0.97, { type: 'sine', vol: 0.08, attack: 0.9, release: 2.6 });
  }
  const l = LEAD.at(step);
  if (l) playNote(ctx, chans.lead, freq(l.note), t, l.dur * SD * 0.4 + 0.3, { type: 'triangle', vol: 0.11, attack: 0.006, release: 0.4 });
  const d = DRUMS.at(step);
  if (d) playDrum(ctx, chans.drums, t, d, 0.55);
}

const CONFIG = {
  bpm: BPM,
  levels: { lead: 1, bass: 1, drums: 0.7 },
  setup(chans, ctx, bus) {
    const echo = createEcho(ctx, bus, { time: 0.5, feedback: 0.45, mix: 0.36, damp: 1200 });
    chans.lead.connect(echo);
    chans.drums.connect(echo);
  },
  onStep,
};
registerRenderable('cave', CONFIG);

registerMusic({
  id: 'cave',
  name: 'Hollow Cave',
  play(out) {
    return startLoop(out, CONFIG);
  },
});

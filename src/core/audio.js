// Tiny WebAudio synth for retro sound effects. Nothing plays until the
// player presses a key or taps, which is when initAudio() runs.
//
// Play a sound with sfx.name(). A feature adds its own sounds from its own
// file with registerSfx('bomb', () => { noise(...); tone(...); }), built from
// the exported tone() and noise() voices.
//
// Levels: voices go through an effects bus, music (M6; game/music.js is the
// stub) through a music bus, both into the master gain. setVolumes({ master,
// music, sfx }) takes 0..1 each and setMuted(on) silences everything; the
// options (game/settings.js) drive both. Mute is kept while no context exists
// yet and applied when it is created.
import { emit } from './events.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
export let muted = false;
const BASE = 0.5; // master gain at volume 1 (the prototype's level)
const levels = { master: 1, music: 1, sfx: 1 };

function applyLevels() {
  if (!ctx) return;
  master.gain.value = muted ? 0 : BASE * levels.master;
  sfxBus.gain.value = levels.sfx;
  musicBus.gain.value = levels.music;
}

export function initAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.connect(master);
      applyLevels();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  return setMuted(!muted);
}

export function setMuted(on) {
  muted = !!on;
  applyLevels();
  emit('audio-muted', { muted });
  return muted;
}

export const isMuted = () => muted;

// setVolumes({ master: 0.8, sfx: 1 }): any subset, each clamped to 0..1.
export function setVolumes(v = {}) {
  for (const k of Object.keys(levels)) if (Number.isFinite(v[k])) levels[k] = Math.max(0, Math.min(1, v[k]));
  applyLevels();
  emit('audio-levels-changed', { ...levels });
  return { ...levels };
}

export const volumes = () => ({ ...levels });

// The node music voices connect to (null before the first key press or tap).
export const musicOutput = () => musicBus;

// The master bus's actual gain (0 while muted or before the first key press
// or tap): play-tests use this to confirm mute silences the real output,
// since a track's own channel keeps ramping regardless of mute.
export const outputGain = () => master?.gain.value ?? 0;

export function tone(freq, dur, { type = 'square', vol = 0.12, to = null, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function noise(dur, { vol = 0.2, freq = 2000, q = 1, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

export const sfx = {
  swing: () => {
    noise(0.12, { vol: 0.22, freq: 2600, q: 0.9 }); // the whoosh
    tone(1760, 0.07, { to: 2640, vol: 0.035, type: 'triangle' }); // a short ring off the blade
  },
  fall: () => tone(900, 0.45, { to: 140, vol: 0.09, type: 'triangle' }), // the whistle down a pit
  push: () => noise(0.35, { vol: 0.22, freq: 260, q: 0.8 }), // stone scraping on stone
  shatter: () => {
    noise(0.16, { vol: 0.3, freq: 1800, q: 1.4 }); // the crack
    [0.03, 0.07, 0.12].forEach((d, i) => tone(1400 + i * 380, 0.05, { vol: 0.05, type: 'triangle', delay: d })); // shards
  },
  dashRev: () => [0, 0.06, 0.12].forEach((d) => noise(0.05, { vol: 0.12, freq: 420, q: 1.2, delay: d })),
  hit: () => tone(330, 0.12, { to: 110, vol: 0.14 }),
  kill: () => {
    noise(0.3, { vol: 0.3, freq: 900 });
    tone(520, 0.18, { to: 90, vol: 0.1, type: 'sawtooth' });
  },
  hurt: () => tone(160, 0.25, { to: 70, vol: 0.16, type: 'sawtooth' }),
  cut: () => noise(0.18, { vol: 0.22, freq: 1400, q: 2 }),
  block: () => tone(1400, 0.08, { vol: 0.08, type: 'triangle', to: 1800 }),
  shoot: () => tone(260, 0.1, { to: 520, vol: 0.08 }),
  gem: () => {
    tone(988, 0.08, { vol: 0.08 });
    tone(1319, 0.14, { vol: 0.08, delay: 0.07 });
  },
  heart: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, { vol: 0.07, delay: i * 0.05, type: 'triangle' })),
  door: () => {
    noise(0.35, { vol: 0.25, freq: 500, q: 1 });
    tone(196, 0.3, { to: 98, vol: 0.1, type: 'sawtooth' });
  },
  fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.4 : 0.12, { vol: 0.08, delay: i * 0.1, type: 'square' })),
  scroll: () => noise(0.4, { vol: 0.06, freq: 600, q: 0.5 }),
  start: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { vol: 0.07, delay: i * 0.08 })),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { vol: 0.09, delay: i * 0.18, type: 'triangle' })),
};

export function registerSfx(name, fn) {
  if (sfx[name]) throw new Error(`Sound "${name}" is already registered`);
  sfx[name] = fn;
}

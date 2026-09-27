// Tiny WebAudio synth for retro sound effects. Nothing plays until the
// player presses a key or taps, which is when initAudio() runs.
//
// Play a sound with sfx.name(). A feature adds its own sounds from its own
// file with registerSfx('bomb', () => { noise(...); tone(...); }), built from
// the exported tone() and noise() voices.
let ctx = null;
let master = null;
export let muted = false;

export function initAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export const isMuted = () => muted;

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
  o.connect(g).connect(master);
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
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  swing: () => noise(0.14, { vol: 0.25, freq: 3200, q: 0.8 }),
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

// Shared chiptune engine for src/music/tracks/*.js. A track file is data
// (chords, a bass line, drums, a lead phrase written in a tiny tracker
// notation) plus one startLoop(out, {...}) call; this file is the only place
// that touches raw WebAudio nodes, so every track sounds and behaves the
// same way (lookahead timing, fade-out on stop, no CPU spent when there is
// no `out` yet).
//
// Notation: a bar is a string of 16 space-separated 16th-note steps. A token
// is a note name ('C4', 'F#3'), '.' (rest) or '-' (hold: extends the
// previous note). parseBar/compileVoice turn a list of bar strings into an
// O(1)-lookup-by-step table; onStep(step, ...) below indexes into it with no
// per-tick allocation.
//
//   const lead = compileVoice([
//     'C5 . E5 . G5 - - . A4 . . . G4 - - .',
//     ...
//   ]);
//   startLoop(out, { bpm: 120, levels: { lead: 0.5 }, setup, onStep(step, t, chans, ctx) {
//     const e = lead.at(step % lead.totalSteps);
//     if (e) playNote(ctx, chans.lead, freq(e.note), t, e.dur * stepDur(120), { type: 'square' });
//   }});
//
// A lookahead timer (the standard WebAudio scheduling pattern) polls every
// POLL_MS and schedules any step due in the next LOOKAHEAD seconds, so
// timing survives tab throttling; nothing is scheduled on an audio callback.
const LOOKAHEAD = 0.12;
const POLL_MS = 30;

export const stepDur = (bpm, stepsPerBeat = 4) => 60 / bpm / stepsPerBeat;

// ---------------------------------------------------------------- notation
// One 16-step bar -> [{ step, note, dur }], dur in steps. A bar with a
// trailing hold past step 15 is legal (a note can tie into the next bar's
// first token only by the caller repeating '-' there instead).
export function parseBar(str) {
  const toks = str.trim().split(/\s+/);
  if (toks.length !== 16) throw new Error(`music bar needs 16 steps, got ${toks.length}: "${str}"`);
  const events = [];
  let cur = null;
  for (let i = 0; i < 16; i++) {
    const tok = toks[i];
    if (tok === '-') {
      if (cur) cur.dur++;
      continue;
    }
    cur = null;
    if (tok === '.') continue;
    cur = { step: i, note: tok, dur: 1 };
    events.push(cur);
  }
  return events;
}

// A bar built from a sparse map of { step: token }, the rest filled with
// rests: bar({ 0: 'D5', 6: '-', 10: 'F5' }). Safer than hand-counting 16
// tokens for a bar that is mostly silence (dungeon, cave, boss, stingers).
export const bar = (spec = {}) => {
  const toks = Array(16).fill('.');
  for (const step in spec) toks[step] = spec[step];
  return toks.join(' ');
};

// A list of bar strings -> a table with O(1) at(step); totalSteps = bars.length * 16.
export function compileVoice(bars) {
  const totalSteps = bars.length * 16;
  const table = new Array(totalSteps).fill(null);
  bars.forEach((bar, i) => {
    for (const e of parseBar(bar)) table[i * 16 + e.step] = e;
  });
  return { totalSteps, at: (step) => table[((step % totalSteps) + totalSteps) % totalSteps] };
}

// A drum bar: tokens are one-letter hit codes ('K' kick, 'S' snare, 'H'
// closed hat, 'O' open hat, 'P' soft perc/shaker, '.' rest); no holds.
export function parseDrumBar(str) {
  const toks = str.trim().split(/\s+/);
  if (toks.length !== 16) throw new Error(`drum bar needs 16 steps, got ${toks.length}: "${str}"`);
  return toks.map((t) => (t === '.' ? null : t));
}

export function compileDrums(bars) {
  const totalSteps = bars.length * 16;
  const table = bars.flatMap((bar) => parseDrumBar(bar));
  return { totalSteps, at: (step) => table[((step % totalSteps) + totalSteps) % totalSteps] };
}

// ---------------------------------------------------------------- voices
// A single melodic note: fast attack, a held sustain, a short release, so
// notes speak clearly without clicking. `freq` of 0/null is a caller bug
// (compileVoice never emits a rest as a note), so this just no-ops on it.
export function playNote(ctx, dest, freq, start, dur, { type = 'square', vol = 0.16, attack = 0.008, release = 0.06, detune = 0, pan = null } = {}) {
  if (!freq || dur <= 0) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (detune) o.detune.setValueAtTime(detune, start);
  const sustain = Math.max(0.02, dur - attack - release);
  const end = start + attack + sustain + release;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.setValueAtTime(vol, start + attack + sustain);
  g.gain.linearRampToValueAtTime(0, end);
  let node = g;
  if (pan !== null && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  o.connect(g);
  node.connect(dest);
  o.start(start);
  o.stop(end + 0.02);
  o.onended = () => {
    try {
      o.disconnect();
      g.disconnect();
      if (node !== g) node.disconnect();
    } catch {
      /* already torn down */
    }
  };
}

// A sustained pad note for chords (slower attack/release, a touch quieter
// per voice since chords stack three of them).
export function playPad(ctx, dest, freq, start, dur, opts = {}) {
  playNote(ctx, dest, freq, start, dur, { type: 'triangle', vol: 0.05, attack: 0.05, release: 0.12, ...opts });
}

export function playKick(ctx, dest, t, vol = 0.5) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.2);
  o.onended = () => {
    try {
      o.disconnect();
      g.disconnect();
    } catch {
      /* already torn down */
    }
  };
}

function noiseHit(ctx, dest, t, dur, { vol = 0.2, hp = 1200, lp = null, decay = dur } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  let node = src;
  if (hp) {
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    node.connect(f);
    node = f;
  }
  if (lp) {
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = lp;
    node.connect(f2);
    node = f2;
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  node.connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
  src.onended = () => {
    try {
      src.disconnect();
      g.disconnect();
    } catch {
      /* already torn down */
    }
  };
}

export const playSnare = (ctx, dest, t, vol = 0.3) => noiseHit(ctx, dest, t, 0.15, { vol, hp: 900 });
export const playHat = (ctx, dest, t, { vol = 0.14, open = false } = {}) => noiseHit(ctx, dest, t, open ? 0.2 : 0.05, { vol, hp: 6500 });
export const playPerc = (ctx, dest, t, vol = 0.1) => noiseHit(ctx, dest, t, 0.09, { vol, hp: 2200, lp: 6000 });

export function playDrum(ctx, dest, t, code, vol = 1) {
  if (code === 'K') playKick(ctx, dest, t, 0.5 * vol);
  else if (code === 'S') playSnare(ctx, dest, t, 0.3 * vol);
  else if (code === 'H') playHat(ctx, dest, t, { vol: 0.14 * vol });
  else if (code === 'O') playHat(ctx, dest, t, { vol: 0.12 * vol, open: true });
  else if (code === 'P') playPerc(ctx, dest, t, 0.1 * vol);
}

// A feedback delay for the dungeon/cave tracks' echo: connect a voice's own
// bus to the returned node in ADDITION to its normal dry connection.
export function createEcho(ctx, dest, { time = 0.32, feedback = 0.34, mix = 0.3, damp = 1800 } = {}) {
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const damper = ctx.createBiquadFilter();
  damper.type = 'lowpass';
  damper.frequency.value = damp;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  delay.connect(damper).connect(fb).connect(delay);
  delay.connect(wet).connect(dest);
  return delay;
}

// ---------------------------------------------------------------- the loop
// out: the music bus (or a per-track channel game/music.js hands the track;
// null before the first key press or tap, in which case this is a no-op that
// returns a stop() doing nothing). levels: per-channel gain (e.g. { lead:
// 0.5, bass: 0.35, drums: 0.3 }); onStep(step, time, chans, ctx) schedules
// whatever starts at that 16th-note step. setup(chans, ctx, bus) runs once,
// for a track that wants extra routing (createEcho) before the loop starts.
export function startLoop(out, { bpm, stepsPerBeat = 4, swing = 0, levels = {}, setup, onStep }) {
  if (!out || !onStep) return () => {};
  const ctx = out.context;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  const chans = {};
  for (const [name, vol] of Object.entries(levels)) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(bus);
    chans[name] = g;
  }
  setup?.(chans, ctx, bus);
  const dur = stepDur(bpm, stepsPerBeat);
  let step = 0;
  let nextTime = ctx.currentTime + 0.08;
  let stopped = false;
  function tick() {
    if (stopped) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const swung = step % 2 === 1 ? nextTime + swing * dur : nextTime;
      try {
        onStep(step, swung, chans, ctx);
      } catch {
        // a broken step must not stop the loop or the game
      }
      step++;
      nextTime += dur;
    }
  }
  tick();
  const timer = setInterval(tick, POLL_MS);
  return function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    try {
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.08);
    } catch {
      // a dead/closed context must not throw on stop
    }
    setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* already gone */
      }
    }, 220);
  };
}

// A track's loop config (bpm, levels, setup, onStep: whatever startLoop
// takes besides `out`), kept so a one-off script can render it offline (an
// OfflineAudioContext has no real clock, so startLoop's lookahead timer
// cannot drive it; renderOffline below schedules the whole duration up
// front instead). Gameplay never reads this; index.js exposes it as
// window.__voxelHeroesMusic for that tooling only.
const renderable = new Map();
export const registerRenderable = (id, config) => renderable.set(id, config);
export const getRenderable = (id) => renderable.get(id) ?? null;
export const renderableIds = () => [...renderable.keys()];

// Same voices and patterns as startLoop, but every step for `duration`
// seconds is scheduled immediately (safe: nothing here has to keep up with
// real time the way the lookahead timer does).
export function renderOffline(out, { bpm, stepsPerBeat = 4, levels = {}, setup, onStep }, duration) {
  const ctx = out.context;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  const chans = {};
  for (const [name, vol] of Object.entries(levels)) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(bus);
    chans[name] = g;
  }
  setup?.(chans, ctx, bus);
  const dur = stepDur(bpm, stepsPerBeat);
  const steps = Math.ceil(duration / dur);
  for (let step = 0; step < steps; step++) onStep(step, step * dur, chans, ctx);
}

// A one-shot stinger's own tiny bus (fresh each play, no scheduler): play(t)
// gets (ctx, dest, now) and schedules directly; nothing to stop.
export function playOnce(out, play) {
  if (!out || !play) return;
  const ctx = out.context;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  try {
    play(ctx, bus, ctx.currentTime + 0.02);
  } catch {
    // a broken stinger must not stop the game
  }
  setTimeout(() => {
    try {
      bus.disconnect();
    } catch {
      /* already gone */
    }
  }, 4000);
}

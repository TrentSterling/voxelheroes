// Music. M6 writes the tunes; M2 only names them, so areas, dungeons and
// bosses can already say what should play (a stub that tracks the current
// track and fires 'music-change').
//
//   registerMusic({ id: 'overworld', name: 'Open Country', play(out) { ...voices on out...; return stop; } })
//   setMusicPlayer(id, play) gives an already-named track (dungeons/<id>.js
//                            registers 'dungeon-1' with no play of its own,
//                            docs/CONTRACTS.md 8.13) its sound from src/music/*,
//                            in either load order.
//   registerStinger({ id, name, play(out) { ...one-shot... } }) / playStinger(id, { duck }?)
//                            a short cue over the loop (a fanfare, an item
//                            jingle); duck (seconds) dips the loop while it
//                            plays. No stop: it is a fire-and-forget one-shot.
//   playMusic(id)            switch tracks, crossfading TUNING.load.musicFade
//                            seconds each way; 'music-change' { id, from }.
//                            Unknown ids throw.
//   stopMusic()              fade to silence ('music-change' with id null)
//   currentMusic()           the id that should be playing (null: none)
//   areaMusic(area)          the track an area (or area id) plays: area.music, else its
//                            dungeon's music, else null
//   playAreaMusic(area)      play it (null: stopMusic)
//
// The hero entering another area plays that area's track; a boss fight
// switches to 'boss' on 'boss-intro' and fires the 'victory' stinger on
// 'boss-defeated' (the area change that follows picks its own track back
// up). 'item-get' (grants marked fanfare, not every routine pickup) fires
// the 'item' stinger. An area or dungeon that names a track nobody
// registered is silent, with one warning per id.
//
// play(out)/registerStinger's play(out) get a private channel gain wired
// into the music bus from core/audio.js (null until the first key press or
// tap; a track called with a null out is expected to no-op and return
// nothing to stop). A track's play() returns a stop function; a track
// without play() is silent.
import { emit, on } from '../core/events.js';
import { musicOutput } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { currentScreen } from '../world/world.js';
import { getArea } from '../world/areas.js';
import { onAreaChange } from './places.js';
import { dungeonOfArea } from './dungeons.js';

const tracks = new Map();
const stingers = new Map();
const pendingPlayers = new Map(); // id -> play, for setMusicPlayer called before registerMusic
let current = null;
let stopCurrent = null;
let currentChannel = null; // this play's own gain into the music bus, for the crossfade

export function registerMusic(def) {
  if (!def?.id) throw new Error('registerMusic: a track needs an id');
  if (tracks.has(def.id)) throw new Error(`Music "${def.id}" is already registered`);
  const full = { name: def.id, ...def };
  if (pendingPlayers.has(def.id)) {
    full.play = pendingPlayers.get(def.id);
    pendingPlayers.delete(def.id);
  }
  tracks.set(def.id, full);
  return full;
}

// Attaches play() to a track named elsewhere (docs/CONTRACTS.md 8.13: a
// dungeon or boss registers its own id; src/music/* supplies the sound).
// Works whichever file's top-level code runs first.
export function setMusicPlayer(id, play) {
  const t = tracks.get(id);
  if (t) t.play = play;
  else pendingPlayers.set(id, play);
}

export function registerStinger(def) {
  if (!def?.id) throw new Error('registerStinger: a stinger needs an id');
  if (stingers.has(def.id)) throw new Error(`Stinger "${def.id}" is already registered`);
  const full = { name: def.id, ...def };
  stingers.set(def.id, full);
  return full;
}

export const getMusic = (id) => tracks.get(id) ?? null;
export const allMusic = () => [...tracks.values()];
export const getStinger = (id) => stingers.get(id) ?? null;
export const allStingers = () => [...stingers.values()];
export const currentMusic = () => current;

// The playing track's own channel gain (0 before its crossfade-in finishes,
// or with nothing playing): play-tests use this to confirm a track is
// actually audible, not just named current.
export const currentGain = () => currentChannel?.gain.value ?? 0;

// A fresh gain node between a track and the shared music bus, so switching
// tracks can fade this one out while the next fades in, instead of a hard
// cut. null (no context yet) means "no fade, no bus": the caller passes
// musicOutput() itself (also null) straight to play().
function makeChannel(bus) {
  if (!bus) return null;
  const g = bus.context.createGain();
  g.gain.value = 0;
  g.connect(bus);
  return g;
}

function fadeChannel(g, to, seconds) {
  if (!g) return;
  try {
    const t = g.context.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(to, t + Math.max(0.01, seconds));
  } catch {
    // a closed/dead context must not throw
  }
}

function retire(stop, channel, seconds) {
  if (!channel) {
    try {
      stop?.();
    } catch {
      // a broken track must not stop the game
    }
    return;
  }
  fadeChannel(channel, 0, seconds);
  setTimeout(
    () => {
      try {
        stop?.();
      } catch {
        // a broken track must not stop the game
      }
      try {
        channel.disconnect();
      } catch {
        // already gone
      }
    },
    seconds * 1000 + 40
  );
}

export function playMusic(id) {
  if (id === null || id === undefined) return stopMusic();
  const t = tracks.get(id);
  if (!t) throw new Error(`Unknown music "${id}" (${[...tracks.keys()].join(', ')})`);
  if (current === id) return id;
  const from = current;
  const fade = TUNING.load.musicFade;
  const oldStop = stopCurrent;
  const oldChannel = currentChannel;
  current = id;
  const bus = musicOutput();
  const channel = makeChannel(bus);
  currentChannel = channel;
  try {
    stopCurrent = t.play?.(channel ?? bus) ?? null;
  } catch {
    stopCurrent = null;
  }
  if (channel) fadeChannel(channel, 1, fade);
  retire(oldStop, oldChannel, fade);
  emit('music-change', { id, from });
  return id;
}

export function stopMusic() {
  if (current === null) return null;
  const from = current;
  const fade = TUNING.load.musicFade;
  retire(stopCurrent, currentChannel, fade);
  stopCurrent = null;
  currentChannel = null;
  current = null;
  emit('music-change', { id: null, from });
  return null;
}

// playStinger('item', { duck: 1.1 }) dips the loop's channel for `duck`
// seconds (0: no duck) while the one-shot plays over it.
export function playStinger(id, { duck = 0 } = {}) {
  const s = stingers.get(id);
  if (!s) throw new Error(`Unknown stinger "${id}" (${[...stingers.keys()].join(', ')})`);
  const bus = musicOutput();
  if (duck > 0 && currentChannel) {
    fadeChannel(currentChannel, 0.35, 0.08);
    setTimeout(() => fadeChannel(currentChannel, 1, 0.3), duck * 1000);
  }
  try {
    s.play?.(bus);
  } catch {
    // a broken stinger must not stop the game
  }
  return id;
}

const warned = new Set();

// The track an area plays (an area or its id): its music, else its
// dungeon's, else null (silence).
export function areaMusic(area) {
  const a = typeof area === 'string' ? getArea(area) : area;
  if (!a) return null;
  const id = a.music ?? dungeonOfArea(a.id)?.music ?? null;
  if (id && !tracks.has(id)) {
    if (!warned.has(id)) console.warn(`music: area "${a.id}" names track "${id}", which nobody registered; silent`);
    warned.add(id);
    return null;
  }
  return id;
}

export function playAreaMusic(area = currentScreen()?.area) {
  const id = areaMusic(area);
  return id ? playMusic(id) : stopMusic();
}

onAreaChange((area) => playAreaMusic(area));

// A boss fight takes over the music; the area change after 'boss-defeated'
// (the reward room, the portal out) picks its own track back up through
// onAreaChange above, so this only needs to clear 'boss' and land the fanfare.
on('boss-intro', () => {
  try {
    playMusic('boss');
  } catch {
    // an unregistered 'boss' track must not stop the fight
  }
});

on('boss-defeated', () => {
  try {
    playStinger('victory', { duck: 0.6 });
  } catch {
    // a missing stinger must not stop the reward
  }
  stopMusic();
});

// item-get is grants.js's fanfare list (chests, key upgrades, heart pieces),
// not every routine pickup, so a jingle here reads as a moment, not noise.
on('item-get', () => {
  try {
    playStinger('item', { duck: 1.1 });
  } catch {
    // a missing stinger must not stop the grant
  }
});

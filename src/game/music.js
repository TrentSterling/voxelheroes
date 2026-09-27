// Music. M6 writes the tunes; M2 only names them, so areas, dungeons and
// bosses can already say what should play (a stub that tracks the current
// track and fires 'music-change').
//
//   registerMusic({ id: 'overworld', name: 'Open Country', play(out) { ...voices on out...; return stop; } })
//   playMusic('boss')        switch tracks; 'music-change' { id, from }. Unknown ids throw.
//   stopMusic()              silence ('music-change' with id null)
//   currentMusic()           the id that should be playing (null: none)
//   playAreaMusic(area)      the area's track: area.music, else its dungeon's music, else none
//
// The hero entering another area plays that area's track (bosses call
// playMusic('boss') and playAreaMusic() after). An area or dungeon that
// names a track nobody registered is silent, with one warning per id: each
// stream registers its own tracks (a dungeon its 'dungeon-<n>' placeholder
// in dungeons/<id>.js, the overworld its area tracks in music/*). play(out) gets the music bus
// from core/audio.js (null until the first key press or tap) and returns a
// stop function; a track without play() is silent. The fade between tracks
// is TUNING.load.musicFade (for M6).
import { emit } from '../core/events.js';
import { musicOutput } from '../core/audio.js';
import { currentScreen } from '../world/world.js';
import { onAreaChange } from './places.js';
import { dungeonOfArea } from './dungeons.js';

const tracks = new Map();
let current = null;
let stopCurrent = null;

export function registerMusic(def) {
  if (!def?.id) throw new Error('registerMusic: a track needs an id');
  if (tracks.has(def.id)) throw new Error(`Music "${def.id}" is already registered`);
  const full = { name: def.id, ...def };
  tracks.set(def.id, full);
  return full;
}

export const getMusic = (id) => tracks.get(id) ?? null;
export const allMusic = () => [...tracks.values()];
export const currentMusic = () => current;

function stopVoices() {
  try {
    stopCurrent?.();
  } catch {
    // a broken track must not stop the game
  }
  stopCurrent = null;
}

export function playMusic(id) {
  if (id === null || id === undefined) return stopMusic();
  const t = tracks.get(id);
  if (!t) throw new Error(`Unknown music "${id}" (${[...tracks.keys()].join(', ')})`);
  if (current === id) return id;
  const from = current;
  stopVoices();
  current = id;
  try {
    stopCurrent = t.play?.(musicOutput()) ?? null;
  } catch {
    stopCurrent = null;
  }
  emit('music-change', { id, from });
  return id;
}

export function stopMusic() {
  if (current === null) return null;
  const from = current;
  stopVoices();
  current = null;
  emit('music-change', { id: null, from });
  return null;
}

const warned = new Set();

export function areaMusic(area) {
  if (!area) return null;
  const id = area.music ?? dungeonOfArea(area.id)?.music ?? null;
  if (id && !tracks.has(id)) {
    if (!warned.has(id)) console.warn(`music: area "${area.id}" names track "${id}", which nobody registered; silent`);
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

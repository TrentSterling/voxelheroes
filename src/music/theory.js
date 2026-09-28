// Note name -> frequency (equal temperament, A4 = 440). 'C4' is middle C.
// Tracks write real note names so a chord progression reads like a chord
// progression instead of a wall of numbers.
const SEMITONE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const NOTE_RE = /^([A-G][#b]?)(-?\d+)$/;

export function freq(name) {
  if (!name) return 0;
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`music: bad note name "${name}"`);
  const [, pc, oct] = m;
  const semitone = SEMITONE[pc];
  if (semitone === undefined) throw new Error(`music: bad pitch class "${pc}"`);
  const midi = (Number(oct) + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

// freqs(['D4', 'F#4', 'A4']) for a chord voiced with playPad.
export const freqs = (names) => names.map(freq);

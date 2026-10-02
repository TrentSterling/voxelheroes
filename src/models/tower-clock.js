import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// Original low clock pedestals. The tool marks read from above and from the
// dungeon camera; a later boxel pass can replace these cached silhouettes.
export function clockAnchorModel(kind, colour, lit = false) {
  return model(`clock-anchor:${kind}:${lit}`, () => {
    const g = new DenseGrid(20, 20, 20), dark = 0x343e56, brass = 0xb78c65;
    g.box(1, 0, 1, 19, 4, 19, dark); g.box(3, 4, 3, 17, 7, 17, brass);
    g.box(5, 7, 5, 15, 11, 15, 0x796980);
    g.box(3, 11, 3, 17, 14, 17, brass); g.box(4, 14, 4, 16, 16, 16, dark);
    const ink = lit ? 0xe1f5d2 : colour;
    if (kind === 'return') { g.box(5, 16, 6, 8, 18, 14, ink); g.box(7, 16, 5, 15, 18, 8, ink); }
    if (kind === 'break') { g.box(6, 16, 7, 14, 19, 14, ink); g.box(10, 17, 5, 13, 20, 8, brass); }
    if (kind === 'draw') { g.box(8, 16, 5, 11, 18, 15, ink); g.box(10, 16, 5, 15, 18, 8, ink); g.box(13, 16, 7, 16, 18, 12, ink); }
    if (kind === 'kindle') { g.box(7, 16, 7, 13, 18, 14, ink); g.box(9, 18, 5, 12, 20, 11, ink); }
    if (lit) for (const x of [3, 15]) for (const z of [3, 15]) g.box(x, 8, z, x + 2, 11, z + 2, ink);
    return g;
  });
}

export function cityClockModel() {
  return model('fourfold-city-clock', () => {
    const g = new DenseGrid(48, 4, 48);
    for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) {
      const d = Math.hypot(x - 23.5, z - 23.5);
      if (d < 23) g.set(x, 0, z, 0x394254);
      if (d > 18 && d < 22) g.box(x, 1, z, x + 1, 3, z + 1, 0xb9906c);
      if (d < 17) g.set(x, 1, z, 0x71627d);
      if (d > 17 && d < 23 && (x % 8 < 2 || z % 8 < 2)) g.set(x, 3, z, 0x98ccc2);
    }
    g.box(21, 1, 21, 27, 4, 27, 0xe4c38d); return g;
  });
}
export function cityClockHand(colour) {
  return model(`fourfold-clock-hand:${colour}`, () => {
    const g = new DenseGrid(5, 3, 22); g.box(1, 0, 1, 4, 3, 19, colour); g.box(0, 0, 1, 5, 3, 5, 0xe4c38d); return g;
  });
}

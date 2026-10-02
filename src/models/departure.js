import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// Original station silhouettes; quick native boxels for the later art pass.
export function departureProp(kind = 'signal') {
  return model(`departure:${kind}`, () => {
    const g = new DenseGrid(20, 28, 20), brass = 0xd7a76a, dark = 0x30445b, mint = 0x94dace, plum = 0x966783;
    if (kind === 'tag') {
      g.box(4, 4, 8, 16, 20, 12, brass); g.box(6, 6, 11, 14, 17, 13, plum);
      g.box(8, 19, 8, 12, 24, 12, dark); g.box(8, 9, 12, 12, 14, 14, mint);
    } else if (kind === 'bench') {
      g.box(1, 6, 3, 19, 9, 16, plum); g.box(2, 0, 4, 5, 6, 15, dark); g.box(15, 0, 4, 18, 6, 15, dark);
      g.box(1, 9, 3, 19, 16, 5, brass); g.box(3, 10, 4, 17, 14, 6, mint);
    } else {
      g.box(3, 0, 3, 17, 4, 17, dark); g.box(8, 4, 8, 12, 22, 12, brass);
      g.box(3, 17, 7, 17, 22, 13, plum); g.box(4, 18, 12, 8, 21, 14, kind === 'lit' ? mint : 0x657085);
      g.box(12, 18, 12, 16, 21, 14, kind === 'lit' ? 0xf5cf82 : 0x657085);
      g.box(6, 22, 6, 14, 27, 14, brass); g.box(8, 23, 12, 12, 26, 15, kind === 'lit' ? 0xaff1d4 : dark);
    }
    return g;
  });
}

export function departureCourierModel(open = false) {
  return model(`departure-courier:${open}`, () => {
    const g = new DenseGrid(24, 30, 24), brass = 0xba8f64, pale = 0xe4bd88, dark = 0x30435c;
    g.box(4, 0, 5, 10, 4, 19, dark); g.box(14, 0, 5, 20, 4, 19, dark);
    g.box(7, 4, 7, 17, 10, 17, 0x617f86);
    for (let y = 9; y < 25; y++) {
      const inset = y > 21 ? 6 : y > 17 ? 4 : 2;
      g.box(inset, y, inset + 1, 24 - inset, y + 1, 23 - inset, y % 5 === 0 ? pale : brass);
    }
    g.box(8, 25, 8, 16, 28, 16, dark); g.box(10, 28, 10, 14, 30, 14, pale);
    g.box(7, 12, 21, 17, 19, 23, dark);
    g.box(open ? 9 : 10, open ? 12 : 14, 22, open ? 15 : 14, open ? 19 : 17, 24, open ? 0xf2a6bd : 0x91daca);
    if (open) {
      g.box(0, 11, 18, 5, 21, 22, 0x966783); g.box(19, 11, 18, 24, 21, 22, 0x966783);
    } else g.box(5, 11, 22, 19, 20, 24, brass);
    return g;
  });
}

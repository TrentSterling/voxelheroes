import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// A municipal brass pollinator overgrown with leaves. Poses are quick native
// voxel cels: lifted wings signal the dive; spread petals signal recovery.
export function pollinatorModel(pose = 'hover') {
  return model(`nursery-pollinator:${pose}`, () => {
    const g = new DenseGrid(30, 22, 22);
    g.box(11, 5, 5, 19, 12, 17, 0x836644);
    g.box(12, 7, 3, 18, 13, 8, 0xd8b579);
    g.box(13, 7, 15, 17, 12, 20, 0xe9d9a3);
    g.box(12, 9, 19, 14, 11, 21, 0x75ddca);
    g.box(16, 9, 19, 18, 11, 21, 0x75ddca);
    g.box(14, 12, 9, 16, 16, 12, 0x5b7356);
    g.box(12, 15, 8, 18, 17, 14, 0xecb3a0);
    g.box(14, 16, 9, 16, 19, 12, 0xf3d4a3);
    for (const side of [-1, 1]) {
      for (let reach = 1; reach <= 11; reach++) {
        const x = side < 0 ? 14 - reach : 15 + reach;
        const y = pose === 'tell' ? 7 + reach : pose === 'dive' ? 7 + Math.floor(reach / 4) : 8 + Math.floor(reach / 3);
        const z0 = 5 + Math.floor(reach / 3), z1 = 18 - Math.floor(reach / 4);
        g.box(x, y, z0, x + 1, y + 2, z1, reach > 8 ? 0xb4d4a3 : 0x69a58c);
        g.box(x, y + 2, 11, x + 1, y + 3, 13, 0xe3c685);
      }
      const leg = side < 0 ? 11 : 18;
      g.box(leg, pose === 'rest' ? 0 : 3, 9, leg + 1, 6, 15, 0x6b6047);
    }
    return g;
  }, { origin: [15, 0, 11] });
}

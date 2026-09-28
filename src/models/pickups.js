// Pickup models (art bible section 10): 16 voxels per tile, facing +z, standing on y = 0. The
// pickup entities bounce and spin them.
import { DenseGrid } from '../core/vox.js';
import { CP } from './palette.js';
import { model } from './kit.js';

// Heart (recovers one heart): 7 wide, 6 tall, 3 deep, with a highlight.
export function heart() {
  const g = new DenseGrid(8, 7, 3);
  const rows = ['.XX.XX..', 'XHXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X....'];
  rows.forEach((r, i) =>
    [...r].forEach((c, x) => {
      if (c !== '.') g.box(x, 6 - i, 0, x + 1, 7 - i, 3, c === 'H' ? CP.heartHi : CP.heart);
    })
  );
  g.paint(0, 0, 0, 8, 7, 1, (x, y, z, c) => (c === CP.heartHi ? c : CP.heartLo)); // darker back
  return g;
}

// Gem (currency): a cut crystal 6 wide, 10 tall, 3 deep; lighter left facets, darker right ones.
export function gem(color = CP.gemGreen, lo = CP.gemGreenLo) {
  const g = new DenseGrid(6, 10, 3);
  for (let y = 0; y < 10; y++) {
    const hw = y < 5 ? Math.min(3, 1 + (y >> 1)) : Math.max(1, 3 - ((y - 5) >> 1)); // half width, voxels
    for (let x = 3 - hw; x < 3 + hw; x++) {
      const left = x < 3;
      const edge = x === 3 - hw;
      const c = edge && y >= 3 && y <= 7 ? CP.gemHi : left ? color : lo;
      g.box(x, y, 0, x + 1, y + 1, 3, c);
    }
  }
  return g;
}

// Small key: a gold bow with a hole on top, a shaft and two teeth, 5 wide, 10 tall, 2 deep.
export function smallKey() {
  const g = new DenseGrid(5, 10, 2);
  g.box(0, 6, 0, 5, 10, 2, CP.keyGold); // bow
  g.box(2, 7, 0, 3, 9, 2, null); // its hole
  g.box(0, 8, 1, 1, 10, 2, CP.keyGoldHi);
  g.box(1, 0, 0, 3, 6, 2, CP.keyGold); // shaft
  g.box(1, 0, 0, 2, 6, 1, CP.keyGoldLo);
  g.box(3, 0, 0, 5, 1, 2, CP.keyGold); // teeth
  g.box(3, 2, 0, 4, 3, 2, CP.keyGold);
  return g;
}

// Coin: a round disc 6 wide, 8 tall, with an inset face.
export function coin() {
  const g = new DenseGrid(6, 8, 2);
  g.box(1, 0, 0, 5, 8, 2, CP.coin);
  g.box(0, 1, 0, 6, 7, 2, CP.coin);
  g.box(2, 2, 1, 4, 6, 2, CP.coinLo);
  g.set(1, 5, 1, CP.coinHi);
  return g;
}

export const GEM_MODELS = {
  1: () => model('gem:green', () => gem(CP.gemGreen, CP.gemGreenLo)),
  5: () => model('gem:blue', () => gem(CP.gemBlue, CP.gemBlueLo)),
};
export const heartModel = () => model('heart', heart);
export const gemModel = (value = 1) => (GEM_MODELS[value] ?? GEM_MODELS[1])();
export const keyModel = () => model('small-key', smallKey);
export const coinModel = () => model('coin', coin);

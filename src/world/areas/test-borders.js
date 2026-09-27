// Test areas for travel between areas (the 'areas' scenario). Three small
// outdoor areas touch the way overworld areas of the 7 x 5 lattice will:
// walking between screens of one area slides, walking across into another
// area fades to black, holds for the loading card and fades in. They sit in
// the world feature's test columns (470-479, see "Global regions" in
// docs/ARCHITECTURE.md) and are reached only by teleport.
//
//   global screen  x 470            x 471             x 472
//   y 0            Hedge Corner     Hedge Gate      | Far Hedge North
//   y 1            Hedge Hollow     Hedge Crossing  | Far Hedge South
//                  ---------------------------------+
//   y 2            Low Field West   Low Field East
//
//   Hedgerows (2 x 2 screens), Far Hedges (1 x 2) east of it, Low Fields
//   (2 x 1) south of it. Gaps in the tree border: columns 6-9 on the north
//   and south edges, rows 4-6 on the east and west edges.
import { registerArea } from '../areas.js';

// A 16 x 11 field ringed by trees, open on the named sides ('n', 's', 'e',
// 'w'), with a few marks: { 'x,z': char }.
function field(open, marks = {}) {
  const rows = [];
  for (let z = 0; z < 11; z++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const gapNS = x >= 6 && x <= 9;
      const gapEW = z >= 4 && z <= 6;
      const wall =
        (z === 0 && !(open.includes('n') && gapNS)) ||
        (z === 10 && !(open.includes('s') && gapNS)) ||
        (x === 0 && !(open.includes('w') && gapEW)) ||
        (x === 15 && !(open.includes('e') && gapEW));
      row += marks[`${x},${z}`] ?? (wall ? 'T' : '.');
    }
    rows.push(row);
  }
  return rows;
}

const common = { tileset: 'overworld', lighting: 'day' };

registerArea({
  ...common,
  id: 'test-hedgerows',
  name: 'Hedgerows',
  origin: [470, 0],
  start: [0, 0],
  screens: {
    '0,0': { name: 'Hedge Corner', rows: field('es', { '3,2': 'B', '11,3': ',', '4,7': 'R', '12,8': 'B' }) },
    '1,0': { name: 'Hedge Gate', rows: field('wes', { '2,2': ',', '12,2': 'R', '4,8': 'B', '11,8': ',' }) },
    '0,1': { name: 'Hedge Hollow', rows: field('nes', { '3,3': 'R', '12,2': 'B', '3,8': ',', '12,7': ',' }) },
    '1,1': { name: 'Hedge Crossing', rows: field('nwes', { '3,2': 'B', '12,2': 'B', '3,8': 'R', '12,8': 'R' }) },
  },
});

registerArea({
  ...common,
  id: 'test-far-hedges',
  name: 'Far Hedges',
  origin: [472, 0],
  screens: {
    '0,0': { name: 'Far Hedge North', rows: field('ws', { '4,3': 'R', '11,2': ',', '12,7': 'B' }) },
    '0,1': { name: 'Far Hedge South', rows: field('nw', { '4,7': 'B', '11,3': 'R', '12,8': ',' }) },
  },
});

registerArea({
  ...common,
  id: 'test-low-fields',
  name: 'Low Fields',
  origin: [470, 2],
  screens: {
    '0,0': { name: 'Low Field West', rows: field('ne', { '3,3': ',', '11,7': 'R', '4,8': 'B' }) },
    '1,0': { name: 'Low Field East', rows: field('nw', { '12,3': 'B', '4,7': ',', '11,8': 'R' }) },
  },
});

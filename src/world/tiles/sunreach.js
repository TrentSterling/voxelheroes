import './overworld.js';
import { defineTileset, registerTile } from '../tiles.js';
import { land } from './overworld.js';

defineTileset('sunreach', { parent: 'overworld', floor: 's' });
for (const [ch, name] of [['a', 'oasis-paving'], ['j', 'caravan-slab'], ['f', 'transit-rail'], ['o', 'sun-mosaic']]) {
  registerTile('sunreach', ch, { name: `sunreach-${name}`, ground: 'sand', build(ctx) {
    const y = land(ctx), { T, X0: x, Z0: z } = ctx;
    if (ch === 'a') T.box(x, y, z, x + 8, y + 1, z + 8, (X,Y,Z) => (Math.floor((X-x)/4)+Math.floor((Z-z)/4))%2 ? 0x9ba48e : 0xdcc398);
    if (ch === 'j') { T.box(x + 1, y, z + 1, x + 7, y + 1, z + 7, 0xbda37c); T.box(x + 2, y, z + 3, x + 6, y + 1, z + 4, 0x786d61); }
    if (ch === 'f') { T.box(x + 1, y, z, x + 7, y + 1, z + 8, 0x586a72); for (const i of [1,6]) T.box(x+i,y,z,x+i+1,y+1,z+8,0xd7b376); }
    if (ch === 'o') for(let i=1;i<7;i++)for(let k=1;k<7;k++)if(Math.abs(i-3.5)+Math.abs(k-3.5)<3.5)T.set(x+i,y,z+k,i<4?0x5c8f99:0xe9d49c);
  } });
}

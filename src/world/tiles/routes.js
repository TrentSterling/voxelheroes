import { registerTile, getTile } from '../tiles.js';
// A bombable obstruction opens the road in place; caves use the separate warp tile.
registerTile('overworld', '!', {name:'fallen-road-stone',solid:true,ground:'sand',becomes:'s',
  build:ctx=>getTile('overworld','k').build(ctx),prop:ctx=>getTile('overworld','k').prop(ctx),
  onBomb:ctx=>getTile('overworld','k').onBomb(ctx),
});

import { registerTile } from '../tiles.js';
import { fineFloor } from './dungeon.js';
import { land } from './overworld.js';
import { GROUND_Y } from '../../core/constants.js';
import { modelMesh } from '../../models/kit.js';
import { grapplePostModel } from '../../models/items/grapple.js';

const prop = ctx => {
  const object = modelMesh(grapplePostModel());
  object.position.set(ctx.cx, GROUND_Y, ctx.cz);
  return object;
};
registerTile('dungeon', '&', { name: 'grapple-post', solid: true, grapple: true, build: fineFloor, prop });
registerTile('overworld', '&', { name: 'grapple-post', solid: true, grapple: true, ground: 'sand', build: land, prop });

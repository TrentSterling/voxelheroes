import { Entity } from './entity.js';
import { registerEntity } from './registry.js';
import { modelMesh } from '../models/kit.js';
import { tabletModel } from '../models/d1/props.js';
import { GROUND_Y } from '../core/constants.js';
import { showDialog } from '../ui/dialog.js';

class ForestStone extends Entity {
  constructor(opts) {
    super({ ...opts, r: 0.4 });
    this.solid = true;
    this.prompt = 'Read stone';
    this.object = modelMesh(tabletModel());
    this.object.position.set(this.x, GROUND_Y, this.z);
  }
  onInteract() {
    showDialog(['Four winds lead to the amber crown.', 'NORTH. WEST. EAST. NORTH.', 'A wrong turn returns to the first wind. The little path southwest leads home.'], { speaker: 'Carved Stone' });
    return true;
  }
}
registerEntity('forest-stone', opts => new ForestStone(opts));

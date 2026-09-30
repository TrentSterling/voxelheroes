import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { TUNING } from '../../core/tuning.js';
import { modelMesh } from '../../models/kit.js';
import { fireBoltModel } from '../../models/items/fire-wand.js';
registerEntity('fire-bolt',opts=>new Projectile(opts,{owner:'hero',source:'fire',damage:TUNING.items.fireWand.damage,speed:TUNING.items.fireWand.speed,range:8,r:.22,object:modelMesh(fireBoltModel())}));

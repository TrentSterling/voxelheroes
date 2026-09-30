import { registerEntity } from '../registry.js';
import { Projectile } from '../projectile.js';
import { TUNING } from '../../core/tuning.js';
import { modelMesh } from '../../models/kit.js';
import { hunterArrowModel } from '../../models/items/hunter.js';

class HeroArrow extends Projectile {
  constructor(opts){
    super(opts,{owner:'hero',source:'arrow',damage:TUNING.items.arrow.damage,speed:TUNING.items.arrow.speed,
      height:.75,r:.13,range:18,object:modelMesh(hunterArrowModel())});
  }
  update(dt){
    const steps=Math.max(1,Math.ceil(Math.hypot(this.vx,this.vz)*dt/.12));
    for(let i=0;i<steps&&!this.removed;i++)super.update(dt/steps);
  }
}
registerEntity('hero-arrow',opts=>new HeroArrow(opts));

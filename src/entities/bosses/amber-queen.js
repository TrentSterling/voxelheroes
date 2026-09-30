import { Enemy } from '../enemy.js';
import { Entity } from '../entity.js';
import { Projectile } from '../projectile.js';
import { spawn, entities } from '../manager.js';
import { registerEntity } from '../registry.js';
import { currentScreen, world } from '../../world/world.js';
import { GROUND_Y } from '../../core/constants.js';
import { random } from '../../core/random.js';
import { sfx } from '../../core/audio.js';
import { bossDefeated, defeatBoss } from '../../game/dungeons.js';
import { registerBestiary } from '../../game/bestiary.js';
import { dropCoins } from '../../game/pickups.js';
import { player } from '../player.js';
import { modelMesh } from '../../models/kit.js';
import { tombstoneModel } from '../../models/foes/foes.js';
import { amberQueenModel, amberDroneModel, amberShotModel } from '../../models/foes/amber-queen.js';
import { startBossIntro } from './serpent.js';
import { toast } from '../../ui/toast.js';
import { hasItem, giveItem, addAmmo, selectItem } from '../../items/inventory.js';
import { bombModel } from '../../models/items/items.js';

const CARD = { id: 'boss-queen', name: 'Vespera', title: 'The Amber Queen', hint: 'Strike her open crown. A bomb flips her and scatters the swarm.' };

class Queen extends Enemy {
  constructor(opts) {
    super({ ...opts, crowned: false }, { hp: 45, r: 0.9, speed: 3, height: 0.65, contactDamage: 2, drops: false, poses: { folded: amberQueenModel(false), open: amberQueenModel(true) } });
    this.boss = true; this.flying = true; this.dungeon = opts.dungeon ?? 'd2'; this.refight = !!opts.refight;
    this.introDone = !!opts.skipIntro; this.segments = [];
    this.ai = { phase: 'flight', t: 3.5, clock: 0, broodT: 0.8, volley: 0, shotT: 0 };
  }
  onAdd() { if (bossDefeated(this.dungeon) && !this.refight) this.remove(); }
  onRemove() { for (const d of this.segments) d.remove(); }
  canBeHit(hit) { return this.flashT <= 0 && super.canBeHit(hit); }
  guards(hit) { return hit.source !== 'bomb' && this.ai.phase !== 'rest' && this.ai.phase !== 'flipped'; }
  onBlocked(hit) { if (hit.swingId !== undefined) this.hitSwing = hit.swingId; sfx.block(); }
  hurt(hit) {
    if (hit.source === 'bomb') {
      this.ai.phase = 'flipped'; this.ai.t = 4;
      for (const d of this.segments) d.remove();
      this.segments = []; this.ai.broodT = 5;
      toast('Crown overturned! Strike now.', 2);
    }
    const result = super.hurt({ ...hit, tiles: 0, stun: 0 });
    this.flashT = 0.3;
    return result;
  }
  setPhase(phase, seconds) { this.ai.phase = phase; this.ai.t = seconds; }
  think(dt) {
    if (!this.introDone) { this.introDone = true; startBossIntro(this, CARD); }
    const a = this.ai, r = currentScreen();
    a.clock += dt; a.t -= dt; a.broodT -= dt;
    this.segments = this.segments.filter(d => !d.removed);
    if (a.phase !== 'flipped' && a.broodT <= 0 && !this.segments.length) {
      for (let i=0; i<8; i++) this.segments.push(spawn('queen-drone', { x: this.x, z: this.z, head: this, index: i, spawnDelay: 0 }));
      a.broodT = 7;
    }
    if (a.t <= 0) {
      if (a.phase === 'flight') this.setPhase('gather', 0.7);
      else if (a.phase === 'gather') this.setPhase('rest', 1.5);
      else if (a.phase === 'rest') { this.setPhase('volley', 2.2); a.volley = 3; a.shotT = 0; }
      else this.setPhase('flight', this.refight ? 2.6 : 3.5);
    }
    if (r && (a.phase === 'flight' || a.phase === 'gather')) {
      const cx = (r.x0+r.x1)/2, cz = r.z0+7;
      const tx = cx + (a.phase === 'flight' ? Math.sin(a.clock*0.7)*6 : 0);
      const tz = cz + (a.phase === 'flight' ? Math.sin(a.clock*1.4)*3 : 0);
      const dx=tx-this.x, dz=tz-this.z, d=Math.hypot(dx,dz)||1, step=Math.min(d,dt*4);
      this.x += dx/d*step; this.z += dz/d*step;
    }
    const target = this.targetHero() ?? player;
    this.yaw = a.phase === 'flipped' ? 0 : Math.atan2(target.x-this.x,target.z-this.z);
    this.mesh.setPose(a.phase === 'rest' || a.phase === 'flipped' ? 'open' : 'folded');
    this.mesh.rotation.z = a.phase === 'flipped' ? Math.PI : 0;
    this.mesh.position.y = a.phase === 'flipped' ? 1.8 : a.phase === 'rest' ? 0.08 : 0.65 + Math.sin(a.clock*9)*0.09;
    if (a.phase === 'volley') {
      a.shotT -= dt;
      if (a.volley > 0 && a.shotT <= 0) {
        a.volley--; a.shotT = 0.65;
        const angle=Math.atan2(target.z-this.z,target.x-this.x);
        for(let i=0;i<4;i++) {
          const n=angle+(i-1.5)*0.22;
          spawn('queen-shot', { x:this.x+Math.cos(n)*1.1,z:this.z+Math.sin(n)*1.1,dir:{x:Math.cos(n),z:Math.sin(n)},speed:this.refight?6.2:5.2 });
        }
        sfx.shoot();
      }
    }
  }
  die(hit) {
    const r=currentScreen(), safe=world.freeSpot(r,this.x-r.x0,this.z-r.z0,player.r,{body:player});
    const x=safe?r.x0+safe.x:player.x,z=safe?r.z0+safe.z:player.z;
    super.die(hit);
    for (const e of [...entities]) if(e.type==='queen-shot') e.remove();
    const pay=defeatBoss(this.dungeon,{refight:this.refight});
    if(pay.heartContainer) spawn('heart-container',{x,z});
    dropCoins(x,z,Math.min(pay.coins,120));
  }
}
registerEntity('boss-queen', opts=>new Queen(opts));

class Drone extends Enemy {
  constructor(opts) {
    super({...opts,crowned:false},{hp:1,r:0.24,speed:4,contactDamage:1,drops:false,height:0.5,model:amberDroneModel()});
    this.head=opts.head; this.index=opts.index??0; this.countsForClear=false; this.flying=true;
    this.ai={phase:'orbit',t:0,dx:0,dz:0};
  }
  think(dt) {
    if(!this.head || this.head.removed){this.remove();return;}
    const a=this.ai,q=this.head, clock=q.ai.clock;
    a.t-=dt;
    const squad=Math.floor(clock/(q.hp<23?1.6:2.3))%3;
    if(a.phase==='orbit' && this.index%3===squad && a.t<=0 && q.ai.phase!=='flipped') {
      const p=this.targetHero() ?? player,dx=p.x-this.x,dz=p.z-this.z,d=Math.hypot(dx,dz)||1;
      a.dx=dx/d;a.dz=dz/d;a.phase='aim';a.t=0.5;
    }
    if(a.phase==='aim') { this.mat.emissive.setHex(0x994321); if(a.t<=0){a.phase='rush';a.t=0.65;} }
    else if(a.phase==='rush') { this.walk(a.dx*5*dt,a.dz*5*dt); if(a.t<=0){a.phase='orbit';a.t=2.6;} }
    else {
      const angle=clock+this.index*Math.PI/4, tx=q.x+Math.cos(angle)*2.7,tz=q.z+Math.sin(angle)*2.7;
      const dx=tx-this.x,dz=tz-this.z,d=Math.hypot(dx,dz)||1,step=Math.min(d,dt*4.2);
      this.walk(dx/d*step,dz/d*step);
      if(this.flashT<=0)this.mat.emissive.setHex(0);
    }
    this.yaw=Math.atan2(a.dx,a.dz);
  }
  die(hit){const x=this.x,z=this.z;super.die(hit);if(random()<0.5)spawn('heart',{x,z});}
}
registerEntity('queen-drone',opts=>new Drone(opts));
registerEntity('queen-shot',opts=>new Projectile(opts,{owner:'enemy',damage:1,tier:2,r:0.2,speed:5.2,object:modelMesh(amberShotModel())}));

class QueenStone extends Entity {
  constructor(opts){super({...opts,r:0.45});this.dungeon=opts.dungeon??'d2';this.solid=true;this.swordable=true;this.object=modelMesh(tombstoneModel());this.object.position.set(this.x,GROUND_Y,this.z);}
  onAdd(){if(!bossDefeated(this.dungeon))this.remove();}
  canBeHit(){return !entities.some(e=>!e.removed&&e.type==='boss-queen');}
  start(){if(!this.canBeHit())return false;const r=currentScreen();spawn('boss-queen',{x:(r.x0+r.x1)/2,z:r.z0+4,dungeon:this.dungeon,refight:true});return true;}
  onSword(){return this.start();} onInteract(){return this.start();}
}
registerEntity('queen-tombstone',opts=>new QueenStone(opts));

class BombSupply extends Entity {
  constructor(opts){super({...opts,r:0.32});this.solid=true;this.prompt='Refill bombs';this.object=modelMesh(bombModel(0));this.object.position.set(this.x,GROUND_Y+0.25,this.z);}
  onInteract(){if(!hasItem('bombs')){toast('Find the powder cache first.',2);return true;}giveItem('bombs');addAmmo('bombs',10);selectItem('bombs');sfx.gem();toast('Bombs refilled. Stand clear of the blast!',2);return true;}
}
registerEntity('bomb-supply',opts=>new BombSupply(opts));
registerBestiary({id:'boss-queen',name:CARD.name,hp:45,text:CARD.hint,where:'dungeon'});
registerBestiary({id:'queen-drone',name:'Amber Drone',hp:1,text:'Winds up, then flies straight. Scatter the brood with a bomb beneath its queen.',where:'dungeon'});

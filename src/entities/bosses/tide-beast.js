import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import { Entity } from '../entity.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { spawn,entities } from '../manager.js';
import { player } from '../player.js';
import { currentScreen,world } from '../../world/world.js';
import { GROUND_Y } from '../../core/constants.js';
import { getMaterial } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { modelMesh } from '../../models/kit.js';
import { tombstoneModel } from '../../models/foes/foes.js';
import { tideBeastModel,tideTentacleModel,tideInkModel } from '../../models/foes/tide-beast.js';
import { startBossIntro } from './serpent.js';
import { bossDefeated,defeatBoss } from '../../game/dungeons.js';
import { dropCoins } from '../../game/pickups.js';
import { registerBestiary } from '../../game/bestiary.js';
import { burst } from '../../systems/particles.js';

const CARD={id:'boss-beast',name:'Nacre',title:'The Undertow Keeper',hint:'Follow the next ripple. One strike drives Nacre under. Burn tentacles, cross with the grapple, and guard the ink with a magic shield.'};
// Alternate banks so the channel and its hooks are part of the fight.
const BANKS=[[5.5,5.5],[15.5,10.5],[5.5,10.5],[15.5,5.5]];
const ROOTS=[[4.5,8.5],[16.5,8.5],[4.5,11.5],[16.5,4.5]];

function ripple() {
  const group=new THREE.Group(),geo=new THREE.BoxGeometry(.45,.025,.14);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,m=new THREE.Mesh(geo,getMaterial('prop'));
    m.position.set(Math.cos(a)*1.3,.04,Math.sin(a)*1.3);m.rotation.y=-a+Math.PI/2;group.add(m);
  }
  return group;
}

class Beast extends Enemy {
  constructor(opts) {
    super({...opts,crowned:false},{hp:105,r:1.05,speed:0,contactDamage:2,drops:false,model:tideBeastModel()});
    this.boss=true;this.dungeon=opts.dungeon??'d4';this.refight=!!opts.refight;this.immune=['fire'];
    this.introDone=!!opts.skipIntro;this.segments=[];
    this.ai={phase:'buried',t:1,clock:0,site:0,shots:0,shotT:0};
    this.marks=ripple();this.holder.add(this.marks);this.mesh.visible=false;this.harmless=true;
  }
  onAdd() {
    if(bossDefeated(this.dungeon)&&!this.refight){this.remove();return;}
    for(let i=0;i<4;i++)this.segments.push(spawn('beast-tentacle',{x:this.x,z:this.z,head:this,index:i,spawnDelay:0}));
  }
  canBeHit(hit){return this.ai.phase==='surface'&&super.canBeHit(hit);}
  setPhase(phase,t){this.ai.phase=phase;this.ai.t=t;}
  surface(){this.setPhase('surface',this.refight?2.1:2.8);this.ai.shots=this.refight?5:3;this.ai.shotT=.3;}
  hurt(hit){
    const result=super.hurt({...hit,tiles:0,stun:0});
    if(!this.removed&&(hit.damage??0)>0)this.setPhase('dive',.4);
    return result;
  }
  think(dt){
    if(!this.introDone){this.introDone=true;startBossIntro(this,CARD);}
    const a=this.ai,r=currentScreen();a.clock+=dt;a.t-=dt;
    if(a.t<=0){
      if(a.phase==='buried')this.setPhase('ripple',this.refight?.55:.85);
      else if(a.phase==='ripple')this.surface();
      else if(a.phase==='surface')this.setPhase('dive',.4);
      else {a.site=(a.site+1)%BANKS.length;this.setPhase('buried',this.refight?.55:.85);}
    }
    const [x,z]=BANKS[a.site];this.x=r.x0+x;this.z=r.z0+z;
    const target=this.targetHero()??player;this.yaw=Math.atan2(target.x-this.x,target.z-this.z);
    this.harmless=a.phase!=='surface';this.mesh.visible=a.phase==='surface'||a.phase==='dive';
    this.mesh.position.y=a.phase==='dive'?-(1-a.t/.4)*2.1:Math.sin(a.clock*5)*.05;
    this.shadow.visible=this.mesh.visible;
    this.marks.visible=a.phase==='ripple';this.marks.scale.setScalar(1+Math.sin(a.clock*12)*.12);
    if(a.phase==='surface'){
      a.shotT-=dt;
      if(a.shots>0&&a.shotT<=0){
        a.shots--;a.shotT=this.refight?.22:.32;
        const dx=target.x-this.x,dz=target.z-this.z,d=Math.hypot(dx,dz)||1;
        spawn('beast-ink',{x:this.x+dx/d*1.2,z:this.z+dz/d*1.2,dir:{x:dx/d,z:dz/d},speed:this.refight?7:6});sfx.shoot();
      }
    }
  }
  die(hit){
    const r=currentScreen(),safe=world.freeSpot(r,this.x-r.x0,this.z-r.z0,player.r,{body:player});
    const x=safe?r.x0+safe.x:player.x,z=safe?r.z0+safe.z:player.z;
    for(const e of this.segments)if(e&&!e.removed)e.remove();
    super.die(hit);
    for(const e of [...entities])if(e.type==='beast-ink')e.remove();
    const pay=defeatBoss(this.dungeon,{refight:this.refight});if(pay.heartContainer)spawn('heart-container',{x,z});dropCoins(x,z,pay.coins);
  }
}

class Tentacle extends Enemy {
  constructor(opts){
    super({...opts,crowned:false},{hp:5,r:.5,speed:2.5,contactDamage:2,drops:false,model:tideTentacleModel()});
    this.head=opts.head;this.index=opts.index;this.flying=true;this.countsForClear=false;
    this.spawned=true;this.growT=1;this.holder.scale.setScalar(1);
    this.ai={phase:'root',t:1+this.index*.5,dx:0,dz:1,clock:0};
    this.marks=ripple();this.marks.scale.setScalar(.4);this.holder.add(this.marks);
  }
  canBeHit(hit){return this.ai.phase!=='buried'&&super.canBeHit(hit);}
  hurt(hit){return super.hurt({...hit,tiles:0,stun:hit.source==='grapple'?1:0});}
  die(){
    // A severed tentacle withdraws, then regrows. Body HP is independent.
    burst(this.x,GROUND_Y+.7,this.z,this.colors,22,{speed:3,size:.09,life:.7,up:4});sfx.kill();
    this.hp=this.maxHp;this.frozenT=0;this.stunT=0;this.ai.phase='buried';this.ai.t=4.5;this.harmless=true;
  }
  think(dt){
    const h=this.head;if(!h||h.removed){this.remove();return;}
    const a=this.ai,r=currentScreen(),[rx,rz]=ROOTS[this.index];a.clock+=dt;a.t-=dt;
    if(a.phase==='buried'||a.phase==='root'){
      const tx=r.x0+rx,tz=r.z0+rz,k=Math.min(1,dt*6);this.x+=(tx-this.x)*k;this.z+=(tz-this.z)*k;
      if(a.t<=0){const p=this.targetHero()??player,dx=p.x-this.x,dz=p.z-this.z,d=Math.hypot(dx,dz)||1;a.dx=dx/d;a.dz=dz/d;a.phase='tell';a.t=.7;}
    }else if(a.phase==='tell'){
      if(a.t<=0){a.phase='lunge';a.t=.6;}
    }else if(a.phase==='lunge'){
      this.walk(a.dx*5*dt,a.dz*5*dt);if(a.t<=0){a.phase='root';a.t=2+this.index*.15;}
    }
    this.yaw=Math.atan2(a.dx,a.dz);this.mesh.visible=a.phase!=='buried';this.shadow.visible=this.mesh.visible;
    this.mesh.position.y=Math.sin(a.clock*7)*.07;this.harmless=a.phase!=='lunge';
    this.marks.visible=a.phase==='tell';
    if(this.flashT<=0)this.mat.emissive.setHex(a.phase==='tell'?0x315767:0);
  }
}

class Stone extends Entity {
  constructor(opts){super({...opts,r:.45});this.dungeon=opts.dungeon??'d4';this.solid=true;this.swordable=true;this.object=modelMesh(tombstoneModel());this.object.position.set(this.x,GROUND_Y,this.z);}
  onAdd(){if(!bossDefeated(this.dungeon))this.remove();}
  start(){if(entities.some(e=>!e.removed&&e.type==='boss-beast'))return false;const r=currentScreen();spawn('boss-beast',{x:r.x0+5.5,z:r.z0+5.5,dungeon:this.dungeon,refight:true});return true;}
  onInteract(){return this.start();}onSword(){return this.start();}
}
registerEntity('boss-beast',opts=>new Beast(opts));
registerEntity('beast-tentacle',opts=>new Tentacle(opts));
registerEntity('beast-tombstone',opts=>new Stone(opts));
registerEntity('beast-ink',opts=>new Projectile(opts,{owner:'enemy',damage:2,tier:3,r:.24,speed:6,object:modelMesh(tideInkModel())}));
registerBestiary({id:'boss-beast',name:CARD.name,hp:105,text:CARD.hint,where:'dungeon'});
registerBestiary({id:'beast-tentacle',name:'Undertow Tentacle',hp:5,text:'Regrows after being cut. Fire clears a crossing; its wounds never hurt Nacre.',where:'dungeon'});

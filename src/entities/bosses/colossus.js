import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import { Entity } from '../entity.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { spawn, entities } from '../manager.js';
import { player } from '../player.js';
import { currentScreen, world } from '../../world/world.js';
import { GROUND_Y } from '../../core/constants.js';
import { sfx } from '../../core/audio.js';
import { modelMesh } from '../../models/kit.js';
import { tombstoneModel } from '../../models/foes/foes.js';
import { colossusModel, colossusPartModel, colossusShotModel } from '../../models/foes/colossus.js';
import { startBossIntro } from './serpent.js';
import { bossDefeated, defeatBoss } from '../../game/dungeons.js';
import { dropCoins } from '../../game/pickups.js';
import { registerBestiary } from '../../game/bestiary.js';
import { toast } from '../../ui/toast.js';

const CARD={id:'boss-colossus',name:'Rook',title:'The Sandbound Colossus',hint:'Strike the glowing feet, then arms, then core. Sidestep pale lasers; guard round slam waves.'};
class Colossus extends Enemy {
  constructor(opts){
    super({...opts,crowned:false},{hp:15,r:.8,speed:1.3,contactDamage:2,drops:false,poses:{body:colossusModel(),core:colossusModel(true)}});
    this.boss=true;this.dungeon=opts.dungeon??'d3';this.refight=!!opts.refight;this.stage=1;this.segments=[];
    this.introDone=!!opts.skipIntro;this.spawnT=0;
    this.ai={phase:'idle',t:1.5,clock:0,shotT:0,attack:0,dx:0,dz:1,sweep:0,hopX:0,hopZ:0};
    this.marks=new THREE.Group();
    const geometry=new THREE.BoxGeometry(.18,.025,.4);
    const laserInk=new THREE.MeshBasicMaterial({color:0xff9483,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});
    const waveInk=new THREE.MeshBasicMaterial({color:0xffcf86,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});
    // Watch rails reach 3/16 tile. These marks sit above that floor, including
    // on replicas; the old 0.025 offset was buried by the station ground kit.
    for(let i=0;i<12;i++){const mark=new THREE.Mesh(geometry,laserInk);mark.position.set(0,.23,1.5+i*.7);this.marks.add(mark);}
    this.holder.add(this.marks);this.marks.visible=false;
    this.waveMarks=new THREE.Group();this.landingMarks=new THREE.Group();
    for(let i=0;i<16;i++){
      const angle=i*Math.PI*2/16;
      for(const [group,ink,radius]of[[this.waveMarks,waveInk,2.2],[this.landingMarks,laserInk,1.8]]){
        const mark=new THREE.Mesh(geometry,ink);mark.position.set(Math.sin(angle)*radius,.23,Math.cos(angle)*radius);mark.rotation.y=angle;group.add(mark);
      }
    }
    this.holder.add(this.waveMarks,this.landingMarks);this.waveMarks.visible=this.landingMarks.visible=false;
  }
  onAdd(){
    if(bossDefeated(this.dungeon)&&!this.refight){this.remove();return;}
    for(let i=0;i<4;i++)this.segments.push(spawn('colossus-part',{x:this.x,z:this.z,head:this,index:i,spawnDelay:0}));
  }
  remainingHp(){return this.hp+this.segments.reduce((n,e)=>n+(e&&!e.removed?e.hp:0),0);}
  guards(){return this.stage!==3;}
  onBlocked(){sfx.block();}
  setPhase(phase,t){this.ai.phase=phase;this.ai.t=t;}
  wave(count=12){
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count;spawn('colossus-wave',{x:this.x+Math.cos(a)*1.1,z:this.z+Math.sin(a)*1.1,dir:{x:Math.cos(a),z:Math.sin(a)},speed:this.stage===3?5.4:4});}
    sfx.shatter();
  }
  think(dt,{toP,dist}){
    if(!this.introDone){this.introDone=true;startBossIntro(this,CARD);}
    const a=this.ai;a.clock+=dt;a.t-=dt;a.shotT-=dt;
    if(this.stage===1&&this.segments.slice(0,2).every(e=>!e||e.removed)){
      this.stage=2;this.mesh.position.y=.5;this.setPhase('idle',.8);toast('Feet shattered. Strike the glowing arms.',2.5);
    }
    if(this.stage===2&&this.segments.slice(2).every(e=>!e||e.removed)){
      this.stage=3;this.mesh.setPose('core');this.mesh.position.y=0;this.setPhase('idle',1);toast('The core is loose. Watch its high leap.',2.5);
    }
    const target=this.targetHero()??player, dx=target.x-this.x,dz=target.z-this.z,d=Math.hypot(dx,dz)||1;
    if(a.phase==='idle'){
      this.walk(dx/d*dt*(this.stage===1?1.3:this.stage===2?2.1:3.2),dz/d*dt*(this.stage===1?1.3:this.stage===2?2.1:3.2));
      this.yaw=Math.atan2(dx,dz);
      if(a.t<=0){
        a.dx=dx/d;a.dz=dz/d;a.sweep=Math.atan2(dz,dx);a.attack++;
        if(this.stage===3&&a.attack%3===0){
          const r=currentScreen();a.hopX=Math.max(r.x0+2,Math.min(r.x1-2,target.x));a.hopZ=Math.max(r.z0+2,Math.min(r.z1-2,target.z));
          this.setPhase('leap',.9);this.airborne=true;
        }else this.setPhase(a.attack%2?'laser-tell':'slam-tell',this.refight?.55:.9);
      }
    }else if(a.phase==='laser-tell'){
      this.yaw=Math.atan2(a.dx,a.dz);
      if(a.t<=0){this.setPhase('laser',this.stage===3?1.4:.8);a.shotT=0;}
    }else if(a.phase==='laser'){
      if(a.shotT<=0){
        a.shotT=this.refight?.1:.16;
        spawn('colossus-laser',{x:this.x+a.dx*1.4,z:this.z+a.dz*1.4,dir:{x:a.dx,z:a.dz},speed:16});
        const n=a.sweep-a.clock*.65;spawn('colossus-laser',{x:this.x+Math.cos(n)*1.4,z:this.z+Math.sin(n)*1.4,dir:{x:Math.cos(n),z:Math.sin(n)},speed:4});
        sfx.shoot();
      }
      if(a.t<=0)this.setPhase('idle',this.refight?.6:1.2);
    }else if(a.phase==='slam-tell'){
      this.mesh.position.y=(this.stage===1?1.2:this.stage===2?.5:0)+Math.sin(Math.max(0,a.t)/.9*Math.PI)*.18;
      if(a.t<=0){this.wave();this.setPhase('idle',this.refight?.6:1.3);}
    }else if(a.phase==='leap'){
      this.mesh.position.y=Math.sin(Math.max(0,a.t)/.9*Math.PI)*2.5;
      this.x+=(a.hopX-this.x)*Math.min(1,dt*5);this.z+=(a.hopZ-this.z)*Math.min(1,dt*5);
      if(a.t<=0){this.airborne=false;this.mesh.position.y=0;this.wave(16);this.setPhase('idle',1.3);}
    }
    this.harmless=a.phase==='laser-tell'||a.phase==='slam-tell';
    if(a.phase!=='leap'&&a.phase!=='slam-tell')this.mesh.position.y=this.stage===1?1.2:this.stage===2?.5:Math.max(0,Math.sin(a.clock*7))*.15;
  }
  update(dt){super.update(dt);this.present();}
  present(){
    const a=this.ai,yaw=this.holder.rotation.y;
    this.marks.visible=this.spawned&&a.phase==='laser-tell';
    this.marks.rotation.y=Math.atan2(a.dx,a.dz)-yaw;
    this.waveMarks.visible=this.spawned&&a.phase==='slam-tell';
    this.landingMarks.visible=this.spawned&&a.phase==='leap';
    const dx=a.hopX-this.x,dz=a.hopZ-this.z;
    this.landingMarks.position.set(Math.cos(yaw)*dx-Math.sin(yaw)*dz,0,Math.sin(yaw)*dx+Math.cos(yaw)*dz);
    this.landingMarks.rotation.y=-yaw;
  }
  die(hit){
    const r=currentScreen(),safe=world.freeSpot(r,this.x-r.x0,this.z-r.z0,player.r,{body:player});
    const x=safe?r.x0+safe.x:player.x,z=safe?r.z0+safe.z:player.z;
    for(const part of this.segments)if(part&&!part.removed)part.remove();
    super.die(hit);
    for(const e of [...entities])if(e.type==='colossus-laser'||e.type==='colossus-wave')e.remove();
    const pay=defeatBoss(this.dungeon,{refight:this.refight});if(pay.heartContainer)spawn('heart-container',{x,z});dropCoins(x,z,Math.min(120,pay.coins));
  }
}
class Part extends Enemy {
  constructor(opts){
    const arm=opts.index>=2;
    super({...opts,crowned:false},{hp:arm?7:8,r:arm?.55:.65,speed:0,contactDamage:2,drops:false,model:colossusPartModel(arm)});
    this.head=opts.head;this.index=opts.index;this.boss=true;this.countsForClear=false;this.spawned=true;this.growT=1;this.holder.scale.setScalar(1);
  }
  guards(){return this.head?.stage!==(this.index<2?1:2);}
  onBlocked(){sfx.block();}
  update(dt){
    const h=this.head;if(!h||h.removed){this.remove();return;}
    const arm=this.index>=2,side=this.index%2?-1:1,offset=side*(arm?1.65:.85),front=arm?.1:1;
    this.x=h.x+Math.cos(h.yaw)*offset+Math.sin(h.yaw)*front;
    this.z=h.z-Math.sin(h.yaw)*offset+Math.cos(h.yaw)*front;
    this.yaw=h.yaw;this.harmless=h.harmless;this.mesh.position.y=arm?(h.stage===1?1.05:.2):0;
    super.update(dt);
    if(this.flashT<=0)this.mat.emissive.setHex(this.guards()?0x000000:0x16443e);
  }
}
class Stone extends Entity {
  constructor(opts){super({...opts,r:.45});this.dungeon=opts.dungeon??'d3';this.solid=true;this.swordable=true;this.object=modelMesh(tombstoneModel());this.object.position.set(this.x,GROUND_Y,this.z);}
  onAdd(){if(!bossDefeated(this.dungeon))this.remove();}
  start(){if(entities.some(e=>!e.removed&&e.type==='boss-colossus'))return false;const r=currentScreen();spawn('boss-colossus',{x:(r.x0+r.x1)/2,z:r.z0+4,dungeon:this.dungeon,refight:true});return true;}
  onInteract(){return this.start();}onSword(){return this.start();}
}
registerEntity('boss-colossus',opts=>new Colossus(opts));
registerEntity('colossus-part',opts=>new Part(opts));
registerEntity('colossus-tombstone',opts=>new Stone(opts));
registerEntity('colossus-laser',opts=>new Projectile(opts,{owner:'enemy',damage:2,tier:Infinity,reflectable:false,deflectable:false,r:.22,speed:16,object:modelMesh(colossusShotModel())}));
registerEntity('colossus-wave',opts=>new Projectile(opts,{owner:'enemy',damage:2,tier:2,reflectable:false,deflectable:false,r:.32,speed:4,object:modelMesh(colossusShotModel(true))}));
registerBestiary({id:'boss-colossus',name:CARD.name,hp:45,text:CARD.hint,where:'dungeon'});

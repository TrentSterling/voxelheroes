import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import { Entity } from '../entity.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { spawn,entities } from '../manager.js';
import { player } from '../player.js';
import { currentScreen,world } from '../../world/world.js';
import { hasFlag,setFlag } from '../../core/state.js';
import { GROUND_Y } from '../../core/constants.js';
import { sfx } from '../../core/audio.js';
import { modelMesh,model } from '../../models/kit.js';
import { DenseGrid } from '../../core/vox.js';
import { falseLightModel,hollowCrownModel,crownTailModel,crownShotModel,crownWispModel } from '../../models/foes/crown.js';
import { startBossIntro } from './serpent.js';
import { bossDefeated,defeatBoss,completeDungeon } from '../../game/dungeons.js';
import { effectActive } from '../../game/effects.js';
import { dropCoins } from '../../game/pickups.js';
import { refill } from '../../game/vitals.js';
import { registerBestiary } from '../../game/bestiary.js';
import { toast } from '../../ui/toast.js';

const MASK={id:'boss-bishop',name:'Veyl',title:'Keeper of False Light',hint:'Cast Truesight. Only the real body has a shadow; strike it before it disappears. Wisps drop life and magic.'};
const CROWN={id:'boss-king',name:'Caldrin',title:'The Hollow Crown',hint:'Leave the marked lightning squares. Guard storms with the Bastion Shield. Dash sideways out of the bright charged shot.'};
const SITES=[[5,4],[16,10],[5,10],[16,4],[11,7]];
const cleanup=()=>{for(const e of [...entities])if(['crown-shot','crown-charge','crown-storm','crown-lightning','crown-wisp','bishop-copy'].includes(e.type))e.remove();};
function fireAt(e,type='crown-shot',spread=0,speed=5){
 const p=e.targetHero()??player,a=Math.atan2(p.z-e.z,p.x-e.x)+spread;
 spawn(type,{x:e.x+Math.cos(a)*(e.r+.15),z:e.z+Math.sin(a)*(e.r+.15),dir:{x:Math.cos(a),z:Math.sin(a)},speed});
}
class Bishop extends Enemy{
 constructor(opts){
  super({...opts,crowned:false},{hp:75,r:.6,shadow:1.15,speed:0,contactDamage:1,drops:false,model:falseLightModel()});
  this.boss=true;this.trial=!!opts.trial;this.dungeon=opts.dungeon??'tower-crown';this.introDone=!!opts.skipIntro;this.segments=[];
  this.ai={phase:'appear',t:.8,clock:0,turn:0,addT:8};this.shadow.visible=false;this.mesh.castShadow=false;
 }
 onAdd(){
  if((this.trial&&bossDefeated(this.dungeon))||(!this.trial&&hasFlag('tower:mask-broken'))){this.remove();return;}
  this.populate();this.placeBodies();
 }
 onRemove(){for(const e of this.segments)e?.remove();}
 populate(){const count=this.trial||this.hp>50?2:this.hp>25?3:4;while(this.segments.length<count)this.segments.push(spawn('bishop-copy',{x:this.x,z:this.z,head:this,index:this.segments.length+1,spawnDelay:0}));}
 placeBodies(){const s=currentScreen();for(const[i,e]of[this,...this.segments].entries()){const p=SITES[(this.ai.turn+i)%SITES.length];e.x=s.x0+p[0];e.z=s.z0+p[1];e.yaw=Math.atan2(player.x-e.x,player.z-e.z);}}
 present(){const visible=!this.trial&&effectActive('truesight')&&this.ai.phase!=='vanish';this.shadow.visible=visible;this.mesh.castShadow=visible;this.mesh.visible=this.ai.phase!=='vanish';}
 guards(hit){return this.trial||!hit.truesight||this.ai.phase!=='hold';}
 onBlocked(hit){if(hit.swingId!==undefined)this.hitSwing=hit.swingId;sfx.block();}
 canBeHit(hit){return this.flashT<=0&&super.canBeHit(hit);}
 vanish(){this.ai.phase='vanish';this.ai.t=.55;this.ai.turn=(this.ai.turn+2)%SITES.length;this.populate();this.placeBodies();}
 hurt(hit){super.hurt({...hit,tiles:0,stun:0});if(!this.removed){this.flashT=.25;this.vanish();}}
 think(dt){
  if(!this.introDone){this.introDone=true;startBossIntro(this,this.trial?{...MASK,title:'The First Reflection',hint:'Endure for two minutes. Move between the reflections, deflect their shots, and collect the wisps. This body cannot yet be hurt.'}:MASK);}
  const a=this.ai;a.clock+=dt;a.t-=dt;a.addT-=dt;
  if(this.trial&&a.clock>=120){cleanup();this.remove();this.markDone();defeatBoss(this.dungeon,{refight:true});setFlag('tower:trial');toast('The first reflection fades. Climb north and seek Sage Iona.',4);return;}
  if(a.addT<=0){a.addT=8;const live=entities.filter(e=>e.type==='crown-wisp');if(live.length<4){const s=currentScreen();spawn('crown-wisp',{x:s.x0+11,z:s.z0+9,index:Math.floor(a.clock/8),spawnDelay:0});}}
  if(a.t<=0){
   if(a.phase==='vanish'){a.phase='appear';a.t=.75;}
   else if(a.phase==='appear'){for(const e of[this,...this.segments])fireAt(e,'crown-shot',0,this.trial?4.5:5.5);a.phase='hold';a.t=this.trial?3:2.5;}
   else this.vanish();
  }
  this.harmless=a.phase!=='hold';const p=this.targetHero()??player;this.yaw=Math.atan2(p.x-this.x,p.z-this.z);this.present();
 }
 die(hit){cleanup();super.die(hit);setFlag('tower:mask-broken');const s=currentScreen();spawn('boss-king',{x:s.x0+11,z:s.z0+5,dungeon:this.dungeon,spawnDelay:0});}
}
class Copy extends Enemy{
 constructor(opts){super({...opts,crowned:false},{hp:1,r:.6,speed:0,contactDamage:1,drops:false,model:falseLightModel()});this.head=opts.head;this.index=opts.index;this.boss=true;this.countsForClear=false;this.spawned=true;this.growT=1;this.holder.scale.setScalar(1);this.shadow.visible=false;this.mesh.castShadow=false;}
 guards(){return true;}onBlocked(){sfx.block();}
 present(){this.shadow.visible=false;this.mesh.visible=this.head?.ai.phase!=='vanish';}
 think(){if(!this.head||this.head.removed){this.remove();return;}this.harmless=this.head.ai.phase!=='hold';this.present();}
}
class Wisp extends Enemy{
 constructor(opts){super({...opts,crowned:false},{hp:3,r:.3,speed:2.3,contactDamage:1,drops:false,height:.4,model:crownWispModel()});this.index=opts.index??0;this.countsForClear=false;this.flying=true;}
 think(dt,{toP,dist}){const d=dist||1;this.walk(toP.x/d*dt*2.3,toP.z/d*dt*2.3);this.mesh.position.y=.4+Math.sin(this.x+this.z)*.1;}
 die(hit){const x=this.x,z=this.z;super.die(hit);spawn(this.index%2?'magic':'heart',{x,z});}
}
class King extends Enemy{
 constructor(opts){
  super({...opts,crowned:false},{hp:140,r:1.6,speed:1.4,contactDamage:2,drops:false,model:hollowCrownModel()});
  this.boss=true;this.dungeon=opts.dungeon??'tower-crown';this.introDone=!!opts.skipIntro;
  this.tailMesh=modelMesh(crownTailModel(),this.mat);this.tailMesh.position.set(0,.1,-1.3);this.tailMesh.rotation.y=Math.PI;this.holder.add(this.tailMesh);
  this.ai={phase:'stalk',t:1.6,clock:0,attack:0,dx:0,dz:1,shotT:0,shots:0};
  this.line=new THREE.Group();const geo=new THREE.BoxGeometry(.14,.03,.45);
  for(let i=0;i<13;i++){const m=new THREE.Mesh(geo,this.mat);m.position.set(0,.02,2.5+i*.8);this.line.add(m);}this.holder.add(this.line);this.line.visible=false;
 }
 onAdd(){if(!hasFlag('tower:mask-broken')||hasFlag('campaign:complete'))this.remove();}
 canBeHit(hit){return this.flashT<=0&&super.canBeHit(hit);}
 hurt(hit){super.hurt({...hit,tiles:0,stun:0});if(!this.removed){this.flashT=.2;this.ai.shots=3;this.ai.shotT=.3;}}
 setPhase(phase,t){this.ai.phase=phase;this.ai.t=t;}
 lightning(){const s=currentScreen(),p=this.targetHero()??player;const points=[[p.x,p.z],[s.x0+5,s.z0+5],[s.x0+16,s.z0+10],[s.x0+5,s.z0+10],[s.x0+16,s.z0+5]];if(this.hp<47)points.push([s.x0+11,s.z0+12],[s.x0+11,s.z0+3]);for(const[x,z]of points)spawn('crown-lightning',{x:Math.floor(x)+.5,z:Math.floor(z)+.5});}
 think(dt){
  if(!this.introDone){this.introDone=true;startBossIntro(this,CROWN);}
  const a=this.ai,p=this.targetHero()??player,dx=p.x-this.x,dz=p.z-this.z,d=Math.hypot(dx,dz)||1;
  a.clock+=dt;a.t-=dt;a.shotT-=dt;
  if(a.shots>0&&a.shotT<=0){a.shots--;a.shotT=.3;fireAt(this,'crown-shot',(a.shots-1)*.14,6);}
  if(a.phase==='stalk'){
   this.walk(dx/d*dt*(this.hp<47?2:1.4),dz/d*dt*(this.hp<47?2:1.4));this.yaw=Math.atan2(dx,dz);
   if(a.t<=0){a.attack++;a.dx=dx/d;a.dz=dz/d;if(d<3.5&&a.attack%2)this.setPhase('tail-tell',.8);else if(this.hp<47&&a.attack%3===0)this.setPhase('charge-tell',1.15);else if(a.attack%2===0){this.lightning();this.setPhase('lightning',1.4);}else this.setPhase('storm-tell',.8);}
  }else if(a.t<=0){
   if(a.phase==='tail-tell'){for(let i=0;i<9;i++){const angle=Math.atan2(a.dz,a.dx)+(i-4)*.3;spawn('crown-storm',{x:this.x+Math.cos(angle)*1.8,z:this.z+Math.sin(angle)*1.8,dir:{x:Math.cos(angle),z:Math.sin(angle)},speed:5,range:3});}this.setPhase('recover',1.1);}
   else if(a.phase==='charge-tell'){spawn('crown-charge',{x:this.x+a.dx*1.8,z:this.z+a.dz*1.8,dir:{x:a.dx,z:a.dz},speed:11});sfx.shoot();this.setPhase('recover',1.4);}
   else if(a.phase==='storm-tell'){for(let i=0;i<10;i++){const angle=i*Math.PI*2/10;spawn('crown-storm',{x:this.x+Math.cos(angle)*1.8,z:this.z+Math.sin(angle)*1.8,dir:{x:Math.cos(angle),z:Math.sin(angle)},speed:4.3});}this.setPhase('recover',1.2);}
   else this.setPhase('stalk',this.hp<47?1:1.6);
  }
  this.harmless=a.phase.endsWith('tell')||a.phase==='lightning';this.line.visible=a.phase==='charge-tell';
  if(a.phase.endsWith('tell'))this.yaw=Math.atan2(a.dx,a.dz);
  this.tailMesh.rotation.y=Math.PI+(a.phase==='tail-tell'?Math.sin(a.clock*11)*.5:Math.sin(a.clock*3)*.12);
 }
 die(hit){const s=currentScreen(),safe=world.freeSpot(s,this.x-s.x0,this.z-s.z0,player.r,{body:player});cleanup();super.die(hit);defeatBoss(this.dungeon,{refight:true});completeDungeon(this.dungeon);setFlag('campaign:complete');dropCoins(s.x0+(safe?.x??11),s.z0+(safe?.z??9),1000);}
}
class Lightning extends Projectile{
 constructor(opts){
  const group=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0xc596eb}),tile=new THREE.Mesh(new THREE.BoxGeometry(1.35,.03,1.35),new THREE.MeshBasicMaterial({color:0x664676}));group.add(tile);
  const beam=new THREE.Mesh(new THREE.BoxGeometry(.25,3,.25),mat);beam.position.y=1.5;beam.visible=false;group.add(beam);
  super(opts,{owner:'enemy',damage:2,tier:6,r:.72,speed:0,reflectable:false,deflectable:false,passWalls:true,object:group});this.ai={phase:'tell',t:1.1};this.harmless=true;
 }
 update(dt){this.ai.t-=dt;if(this.ai.phase==='tell'){if(this.ai.t<=0){this.ai.phase='strike';this.ai.t=.25;this.harmless=false;this.object.children[1].visible=true;sfx.shatter();}return;}super.update(dt);if(this.ai.t<=0)this.remove();}
}
class Well extends Entity{
 constructor(opts){super({...opts,r:.55});this.solid=true;this.prompt='Rest';this.object=modelMesh(model('tower-well',()=>{const g=new DenseGrid(22,13,22);g.box(0,0,0,22,9,22,0x8c8797);g.box(3,5,3,19,10,19,0x527079);g.box(5,10,5,17,12,17,0x9addd5);return g;}));this.object.position.set(this.x,GROUND_Y,this.z);}
 onInteract(){refill();sfx.gem();toast('Life and magic restored. The cleared memories stay open.',3);return true;}
}
registerEntity('boss-bishop',opts=>new Bishop(opts));registerEntity('bishop-copy',opts=>new Copy(opts));registerEntity('crown-wisp',opts=>new Wisp(opts));
registerEntity('boss-king',opts=>new King(opts));registerEntity('crown-lightning',opts=>new Lightning(opts));registerEntity('tower-well',opts=>new Well(opts));
for(const[type,tier,large,speed]of[['crown-shot',6,false,5],['crown-storm',6,false,4.3],['crown-charge',Infinity,true,11]])registerEntity(type,opts=>new Projectile(opts,{owner:'enemy',damage:large?4:2,tier,r:large?.5:.25,speed,reflectable:!large,deflectable:!large,object:modelMesh(crownShotModel(large))}));
registerBestiary({id:'boss-bishop',name:MASK.name,hp:75,text:MASK.hint,where:'dungeon'});registerBestiary({id:'boss-king',name:CROWN.name,hp:140,text:CROWN.hint,where:'dungeon'});

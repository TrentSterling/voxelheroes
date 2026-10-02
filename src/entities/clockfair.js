import * as THREE from 'three';
import { Entity } from './entity.js';
import { Projectile } from './projectile.js';
import { registerEntity } from './registry.js';
import { entities, spawn } from './manager.js';
import { player } from './player.js';
import { world, currentScreen } from '../world/world.js';
import { GROUND_Y } from '../core/constants.js';
import { setFlag, hasFlag } from '../core/state.js';
import { modelMesh } from '../models/kit.js';
import { fairModel } from '../models/clockfair.js';
import { FAIR, fairRequest, fairBest, fairScore } from '../systems/clockfair.js';
import { partyHooks } from '../multiplayer/adapters.js';
import { grant } from '../systems/grants.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../core/audio.js';

const clearNotes=()=>{for(const e of [...entities])if(e.type==='fair-note')e.remove();};
class FairClock extends Entity {
  constructor(opts){
    super({...opts,r:.45});this.kind='encounter';this.priority=5;this.solid=true;
    this.ai={serial:fairRequest(),phase:'idle',elapsed:0,mask:0,target:0,lit:true,beat:2.8,shotT:3.5,warning:false,dx:0,dz:1};
    this.object=new THREE.Group();this.object.position.set(this.x,GROUND_Y,this.z);this.object.add(modelMesh(fairModel('clock')));
    this.cue=new THREE.Group();for(let n=1;n<8;n++){const p=new THREE.Mesh(new THREE.BoxGeometry(.10,.025,.35),new THREE.MeshBasicMaterial({color:0xe7bc7b}));p.position.set(0,.05,n*.55);this.cue.add(p);}this.object.add(this.cue);this.present();
  }
  start(serial){clearNotes();this.ai={serial,phase:'running',elapsed:0,mask:0,target:0,lit:true,beat:2.8,shotT:3.5,warning:false,dx:0,dz:1};this.present();toast('Six bells. Seventy seconds. Watch for the light.',3);}
  ring(index){
    const a=this.ai;if(a.phase!=='running'||!a.lit||a.target!==index||a.mask&(1<<index))return false;
    a.mask|=1<<index;a.lit=false;a.beat=.35;sfx.gem();toast(`Bell ${index+1} rings: ${fairScore(a.mask)}/6`,1.6);this.present();return true;
  }
  finish(won){
    const a=this.ai;a.phase=won?'won':'timeout';a.warning=false;clearNotes();this.present();
    if(!won){toast('The last note fades. The board offers another round.',3);return;}
    const time=Math.ceil(a.elapsed*10),best=fairBest();if(best===null||time/10<best)setFlag(`fair:time:${time}`);
    if(!hasFlag(FAIR.medal)){setFlag(FAIR.medal);grant('fair-medal',1,{source:'fair-medal',fanfare:false});toast('Six bells together! First medal: 60 coins.',3);}
    else toast(`Six bells! ${ (time/10).toFixed(1) } seconds. Best: ${fairBest().toFixed(1)}.`,3);
  }
  stock(){
    const s=world.screens.get(this.homeKey)??currentScreen();
    for(const[x,z]of FAIR.pots){const tx=s.x0+x,tz=s.z0+z;if(world.tile(tx,tz)!=='o')continue;
      const occupied=[player,...entities].some(e=>!e.removed&&(e===player||e.solid||['friend','companion'].includes(e.kind))&&Math.hypot(e.x-tx-.5,e.z-tz-.5)<(e.r??.3)+.75);
      if(!occupied)world.setTile(tx,tz,'v',{rebuild:false,reason:'fair-clay-stock'});
    }
  }
  present(){this.cue.visible=this.ai.phase==='running'&&this.ai.warning;this.cue.rotation.y=Math.atan2(this.ai.dx,this.ai.dz);}
  update(dt){
    this.stock();const request=fairRequest();if(request>this.ai.serial)this.start(request);const a=this.ai;
    if(a.phase!=='running'){this.present();return;}
    a.elapsed+=dt;if(a.mask===63){this.finish(true);return;}if(a.elapsed>=FAIR.duration){this.finish(false);return;}
    a.beat-=dt;if(a.beat<=0){
      if(a.lit){a.lit=false;a.beat=.65;}
      else{if(a.mask&(1<<a.target))for(let n=1;n<=6;n++){const i=(a.target+n)%6;if(!(a.mask&(1<<i))){a.target=i;break;}}a.lit=true;a.beat=2.8;}
    }
    a.shotT-=dt;if(a.shotT<=0){
      if(!a.warning){const p=partyHooks.target(this)??player,d=Math.hypot(p.x-this.x,p.z-this.z)||1;a.dx=(p.x-this.x)/d;a.dz=(p.z-this.z)/d;a.warning=true;a.shotT=.8;}
      else{for(const spread of[-.13,0,.13]){const yaw=Math.atan2(a.dz,a.dx)+spread;spawn('fair-note',{x:this.x+Math.cos(yaw)*.65,z:this.z+Math.sin(yaw)*.65,dir:{x:Math.cos(yaw),z:Math.sin(yaw)}});}a.warning=false;a.shotT=4;}
    }
    this.present();
  }
  onRemove(){clearNotes();}
}
class FairNote extends Projectile {
  constructor(opts){super(opts,{source:'fair-note',tier:1,damage:1,speed:4.2,range:15,object:modelMesh(fairModel('clock',true))});this.object.scale.setScalar(.12);}
}
registerEntity('fair-clock',opts=>new FairClock(opts));
registerEntity('fair-note',opts=>new FairNote(opts));

// An authored, replicated encounter: a quiet beat between two distinct waves,
// with a telegraphed bell volley the player can silence using real pottery.
import * as THREE from 'three';
import { Entity } from './entity.js';
import { registerEntity } from './registry.js';
import { entities, spawn } from './manager.js';
import { player } from './player.js';
import { GROUND_Y } from '../core/constants.js';
import { hasFlag, setFlag } from '../core/state.js';
import { emit } from '../core/events.js';
import { currentScreen, world } from '../world/world.js';
import { modelMesh } from '../models/kit.js';
import { echoBellModel } from '../models/barrow-echo.js';
import { checkRoomCleared, enemiesLeft, registerRoomClearBlocker } from '../systems/combat.js';
import { sparks } from '../systems/particles.js';
import { sfx } from '../core/audio.js';

export const ECHO = { cleared: 'dungeon:d1:echo-cleared', muted: 'dungeon:d1:echo-muted', memory: 'dungeon:d1:echo-memory' };
registerRoomClearBlocker('barrow-echo', () => entities.some(e => !e.removed && e.type === 'barrow-bell' && e.ai.phase !== 'done'));

class BarrowBell extends Entity {
  constructor(opts) {
    super({...opts,r:.7});this.kind='encounter';this.priority=5;this.spawnOptions.waves??=[];
    this.ai={phase:hasFlag(ECHO.cleared)?'done':'fight',wave:0,wait:0,pulse:4,tell:0,muted:0,angle:0};
    this.object=new THREE.Group();this.object.position.set(this.x,GROUND_Y,this.z);
    this.bell=modelMesh(echoBellModel());this.object.add(this.bell);
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.95,1.15,24),new THREE.MeshBasicMaterial({color:0xedaf68,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));
    this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.025;this.object.add(this.ring);this.present();
  }
  present() {
    this.ring.visible=this.ai.tell>0;
    this.ring.scale.setScalar(1+(1.1-this.ai.tell)*.4);
    this.bell.rotation.z=this.ai.tell>0?Math.sin(this.ai.tell*25)*.04:0;
  }
  silence() {
    this.ai.muted=4;this.ai.tell=0;this.ai.pulse=4.5;setFlag(ECHO.muted);
    sparks(this.x,GROUND_Y+1,this.z,[0x80d8d2,0xe9c982],10);sfx.gem();this.present();
    emit('barrow-bell-muted',{screen:currentScreen(),seconds:4});
  }
  reinforce() {
    const s=currentScreen(),wave=this.spawnOptions.waves[this.ai.wave];
    for(const [index,foe] of wave.entries()) {
      const target=this.targetHero()??player;
      const spot=world.freeSpot(s,foe.x,foe.z,.35,{occupied:(x,z)=>Math.hypot(x-player.x,z-player.z)<2||Math.hypot(x-target.x,z-target.z)<2||entities.some(e=>!e.removed&&e.kind==='enemy'&&Math.hypot(e.x-x,e.z-z)<.9)});
      if(!spot)continue;
      spawn(foe.type,{x:s.x0+spot.x,z:s.z0+spot.z,screen:s,crowned:false,spawnDelay:.4,netId:`${this.netId}:wave:${this.ai.wave}:${index}`});
    }
    this.ai.wave++;this.ai.phase='fight';this.ai.pulse=3.5;
    emit('barrow-wave',{screen:s,wave:this.ai.wave+1});
  }
  volley() {
    for(const offset of [-.65,-.22,.22,.65]) {
      const angle=this.ai.angle+offset,dir={x:Math.sin(angle),z:Math.cos(angle)};
      spawn('turret-bolt',{x:this.x+dir.x*1.25,z:this.z+dir.z*1.25,dir,damage:1,speed:3.8,tier:2});
    }
    this.ai.tell=0;this.ai.pulse=4.5;sfx.shoot();
  }
  update(dt) {
    if(this.ai.phase==='done'){this.present();return;}
    if(this.ai.phase==='reinforcements') {
      this.ai.wait-=dt;
      if(this.ai.wait<=0)this.reinforce();
    } else if(enemiesLeft()===0) {
      if(this.ai.wave<this.spawnOptions.waves.length) {this.ai.phase='reinforcements';this.ai.wait=1.5;this.ai.tell=0;}
      else {this.ai.phase='done';this.ai.tell=0;setFlag(ECHO.cleared);this.present();checkRoomCleared();return;}
    }
    this.ai.muted=Math.max(0,this.ai.muted-dt);
    if(this.ai.muted===0&&this.ai.phase==='fight') {
      if(this.ai.tell>0){this.ai.tell-=dt;if(this.ai.tell<=0)this.volley();}
      else {
        this.ai.pulse-=dt;
        if(this.ai.pulse<=0){const target=this.targetHero()??player;this.ai.angle=Math.atan2(target.x-this.x,target.z-this.z);this.ai.tell=1.1;}
      }
    }
    this.present();
  }
}
registerEntity('barrow-bell',opts=>new BarrowBell(opts));

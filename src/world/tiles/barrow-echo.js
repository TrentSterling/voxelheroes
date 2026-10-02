import { defineTileset, registerTile } from '../tiles.js';
import { fineFloor } from './dungeon.js';
import { FPT } from '../terrain.js';
import { entities } from '../../entities/manager.js';
import { state } from '../../core/state.js';
import { heal, restoreMagic } from '../../game/vitals.js';
import { roomClearBlocked } from '../../systems/combat.js';
import { modelProp } from '../tilekit.js';
import { barrowHourstoneModel } from '../../models/d1/hourstone.js';
import { toast } from '../../ui/toast.js';
import { sparks } from '../../systems/particles.js';
import { GROUND_Y } from '../../core/constants.js';

// Keep the new glyphs local; other dungeons use some of them as spawn markers.
defineTileset('barrow',{parent:'dungeon',floor:'.'});
// Eight quick terrain variants retain the dungeon kit's geometry and seams.
for(const [ch,name] of [['e','barrow-dark-cobble'],['o','barrow-copper-rosette'],['p','barrow-cracked-slab'],['u','barrow-repair-channel'],['m','barrow-clock-rubble'],['i','barrow-bell-plinth'],['+','barrow-sight-mosaic'],['=','barrow-iris-border']]) {
  registerTile('barrow',ch,{
    name,solid:ch==='i'||ch==='m',blocksShots:ch==='i'||ch==='m',pushableFloor:ch!=='i'&&ch!=='m',detailHeight:ch==='m'?10:ch==='i'?5:0,
    build(ctx) {
      fineFloor(ctx);
      const {F,FX0:x,FZ0:z}=ctx;
      if(ch==='e')F.box(x+1,1,z+1,x+FPT,2,z+FPT,(X,Y,Z)=>(Math.floor((X-x)/4)+Math.floor((Z-z)/4))%2?0x4a5567:0x62667a);
      if(ch==='o')for(let a=2;a<14;a++)for(let b=2;b<14;b++){const d=Math.hypot(a-7.5,b-7.5);if((d>4&&d<6)||a===7||b===7)F.set(x+a,1,z+b,0xd6a866);}
      if(ch==='p')for(let a=1;a<15;a++){const b=4+Math.floor(a/3)+(a%3===0?1:0);F.set(x+a,1,z+b,0x404854);}
      if(ch==='u'){F.box(x+5,1,z,x+11,2,z+16,0x40525d);F.box(x+5,2,z,x+6,3,z+16,0xb88559);F.box(x+10,2,z,x+11,3,z+16,0xb88559);for(let b=1;b<16;b+=4)F.box(x+6,2,z+b,x+10,3,z+b+1,0x75b3ae);}
      if(ch==='+'){F.box(x+1,1,z+1,x+15,2,z+15,0x425b65);for(let a=2;a<14;a++)for(let b=2;b<14;b++)if(Math.abs(a-7.5)+Math.abs(b-7.5)>5&&Math.abs(a-7.5)+Math.abs(b-7.5)<7)F.set(x+a,1,z+b,0xa7bdb1);F.box(x+7,1,z+5,x+9,2,z+11,0xb48a60);}
      if(ch==='='){F.box(x+1,1,z+1,x+15,2,z+15,0x53616b);for(let b=3;b<16;b+=6)F.box(x,1,z+b,x+16,2,z+b+1,0xac835d);for(let a=3;a<16;a+=6)F.box(x+a,1,z,x+a+1,2,z+16,0x7d938e);}
      if(ch==='m'){const D=ctx.D;D.box(x+3,1,z+3,x+13,6,z+13,0x596273);D.box(x+5,6,z+5,x+11,9,z+11,0xb68558);}
      if(ch==='i'){const D=ctx.D;D.box(x+1,1,z+1,x+15,3,z+15,0x536277);D.box(x+3,3,z+3,x+13,4,z+13,0xc19a64);}
    },
    onShot:ch==='i'?ctx=>{
      if(ctx.projectile?.source!=='pot')return;
      entities.find(e=>!e.removed&&e.type==='barrow-bell'&&e.homeKey===ctx.screen.key)?.silence();
    }:undefined,
  });
}

// Simple masonry and copper traces make the first temple's routes readable.
for (const [ch, name] of [[':', 'barrow-limestone'], [';', 'barrow-ashstone'], [',', 'barrow-root-stone'], ['-', 'barrow-copper-trace']]) {
  registerTile('barrow', ch, { name, pushableFloor:true, build(ctx) {
    fineFloor(ctx);
    const { F, FX0:x, FZ0:z } = ctx;
    const stone = ch === ':' ? [0x92958a, 0xaeb19e] : ch === ',' ? [0x637a6c, 0x7f8f76] : [0x414f5f, 0x566273];
    F.box(x+1,1,z+1,x+16,2,z+16,(X,Y,Z) => stone[(Math.floor((X-x)/8)+Math.floor((Z-z)/8))%2]);
    if (ch === ':' || ch === ';') {
      F.box(x+1,1,z+8,x+16,2,z+9,ch===':'?0x727f78:0x323c4b);
      F.box(x+8,1,z+1,x+9,2,z+8,ch===':'?0x727f78:0x323c4b);
    }
    if (ch === ',') for (let a=1; a<16; a++) F.set(x+a,1,z+3+Math.floor(a/4),0xa7ae80);
    if (ch === '-') {
      F.box(x+6,1,z+1,x+10,2,z+16,0xc8935d);
      F.box(x+1,1,z+6,x+16,2,z+10,0xc8935d);
      F.box(x+7,1,z+7,x+9,2,z+9,0xf0d199);
    }
  }});
}

registerTile('barrow', 'f', { name:'barrow-hourstone', solid:true,
  build:fineFloor, prop:modelProp(barrowHourstoneModel), prompt:'Rest hourstone',
  onInteract(ctx) {
    if (roomClearBlocked() || entities.some(e => !e.removed && e.kind==='enemy' && e.countsForClear!==false)) {
      toast('Defeat the room guards.', 2.5); return true;
    }
    const restored=heal(state.maxHp,'barrow-hourstone') + restoreMagic(state.maxMagic,'barrow-hourstone');
    if (restored) sparks(ctx.tx+.5,GROUND_Y+.7,ctx.tz+.5,[0x89d8d0,0xd8b777],16);
    toast(restored ? 'Hearts & magic restored.' : 'Hearts & magic full.', 2.5);
    return true;
  },
});

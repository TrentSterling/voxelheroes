import './fire.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { fineFloor, buildWall } from './dungeon.js';
import { modelProp } from '../tilekit.js';
import { tidewellModel } from '../../models/brineglass.js';
import { state } from '../../core/state.js';
import { entities } from '../../entities/manager.js';
import { heal,restoreMagic } from '../../game/vitals.js';
import { toast } from '../../ui/toast.js';
import { sparks } from '../../systems/particles.js';
import { GROUND_Y } from '../../core/constants.js';

defineTileset('brineglass', { parent: 'dungeon', floor: '.' });
registerTile('brineglass','R',{name:'keeper-tidewell',solid:true,build:fineFloor,prop:modelProp(tidewellModel),prompt:'Rest tidewell',onInteract(ctx){
  if(entities.some(e=>!e.removed&&e.kind==='enemy'&&e.countsForClear!==false)){toast('Clear the room first.',2.5);return true;}
  const restored=heal(state.maxHp,'keeper-tidewell')+restoreMagic(state.maxMagic,'keeper-tidewell');
  if(restored)sparks(ctx.tx+.5,GROUND_Y+.7,ctx.tz+.5,[0x83f7ed,0xffd79a],16);
  toast(restored?'Hearts & magic restored.':'Hearts & magic full.',2.5);return true;
}});
for(const[ch,name]of [['b','salt-courses'],['i','drained-slate'],['k','fired-clay'],['d','chart-checker'],['q','brass-border'],['m','tide-compass']]){
  registerTile('brineglass',ch,{name:`brineglass-${name}`,pushableFloor:true,build(ctx){
    fineFloor(ctx);const {F,FX0:x,FZ0:z,owner}=ctx;
    // New base materials stay on the ordinary floor plane. The old raised
    // accent kit is still used at railways, vents and weathered fragments.
    F.box(x,0,z,x+16,1,z+16,(X,Y,Z)=>{
      const lx=X-x,lz=Z-z;
      if(ch==='b')return Z%8===0||(X+(Math.floor(Z/8)%2)*8)%16===0?0x627c81:Math.floor(Z/8)%2?0x96adb0:0xa4b9b5;
      if(ch==='i')return lx===0||lz===0?0x364954:(Math.floor(X/32)+Math.floor(Z/16))%2?0x506572:0x586d76;
      if(ch==='k')return lx===0||lz===0?0x573f45:(Math.floor(X/16)+Math.floor(Z/16))%2?0x9e7462:0xb48b70;
      if(ch==='d')return lx===0||lz===0?0x486277:(Math.floor(X/32)+Math.floor(Z/32))%2?0x728e9e:0xa1b6ba;
      if(ch==='q')return lx<2||lz<2||lx>13||lz>13?0x719398:lx===4||lx===11?0xc4a477:0x4b6672;
      const cx=(owner?.x0??ctx.tx)+(owner?.w??16)/2,cz=(owner?.z0??ctx.tz)+(owner?.h??12)/2;
      const dx=(X+.5)/16-cx,dz=(Z+.5)/16-cz,r=Math.hypot(dx,dz);
      const rim=Math.abs(r-2.25)<.1||Math.abs(r-1.85)<.07;
      const rose=(Math.abs(dx)<.08||Math.abs(dz)<.08||Math.abs(Math.abs(dx)-Math.abs(dz))<.065)&&r<1.6;
      return rim||rose?0xd7bb87:lx===0||lz===0?0x415663:0x617987;
    });
  }});
}
for (const [ch, name] of [['e', 'salt-stone'], ['a', 'sea-glass'], ['j', 'wet-grate'], ['u', 'heat-pipe'], ['o', 'shell-mosaic'], ['p', 'broken-ceramic']]) {
  registerTile('brineglass', ch, { name: `brineglass-${name}`, pushableFloor: true, build(ctx) {
    fineFloor(ctx); const { F, FX0: x, FZ0: z } = ctx;
    if (ch === 'e') F.box(x + 1, 1, z + 1, x + 16, 2, z + 16, (X, Y, Z) => (Math.floor((X - x) / 6) + Math.floor((Z - z) / 5)) % 2 ? 0x89aeb2 : 0xb0c8bf);
    if (ch === 'a') { F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x427d97); for (const i of [3, 7, 11]) F.box(x + i, 1, z + 2, x + i + 2, 2, z + 14, 0x77c5c9); }
    if (ch === 'j') { F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x354f65); for (let i = 2; i < 15; i += 3) F.box(x + 1, 2, z + i, x + 15, 3, z + i + 1, 0x83a9b1); }
    if (ch === 'u') { F.box(x + 5, 1, z, x + 11, 2, z + 16, 0x3c647c); for (const i of [5, 10]) F.box(x + i, 2, z, x + i + 1, 3, z + 16, 0xd89965); }
    if (ch === 'o') for (let i = 1; i < 15; i++) for (let k = 1; k < 15; k++) if (Math.abs(Math.hypot(i - 7.5, k - 10) - 6) < .8 || k > 7 && (i + k) % 5 === 0) F.set(x + i, 1, z + k, 0xe7cf9b);
    if (ch === 'p') for (let i = 1; i < 15; i++) F.box(x + i, 1, z + 3 + Math.floor(i / 3), x + i + 1, 2, z + 5 + Math.floor(i / 3), 0x384f65);
  } });
}
registerTile('brineglass', 'W', { ...getTile('dungeon', 'W'), name: 'brineglass-lantern-wall', detailHeight: 34, build(ctx) {
  buildWall(ctx);
  if (ctx.z === 0 && ctx.x % 3 === 1) {
    const { D, FX0: x, FZ0: z } = ctx;
    D.box(x + 4, 4, z + 12, x + 12, 30, z + 16, 0x5492a7); D.box(x + 2, 13, z + 12, x + 14, 16, z + 16, 0xd8ac75);
  }
} });

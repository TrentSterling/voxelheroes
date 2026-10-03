import './fire.js';
import { defineTileset,registerTile } from '../tiles.js';
import { fineFloor } from './dungeon.js';
import { GOLD } from '../palette.js';
import { shadeHex } from '../../core/vox.js';

defineTileset('tower-memory',{parent:'dungeon',floor:'.'});
// Shared construction, with the amber, sand, tide and ash floor palettes.
// These marks stay on the base plane so they cannot obscure attack tells.
for(const[ch,name]of[['b','memory-courses'],['i','memory-slate'],['j','memory-grate'],['q','memory-brass'],['e','memory-mosaic'],['m','borrowed-hour-seal']]){
  registerTile('tower-memory',ch,{name,pushableFloor:true,build(ctx){
    fineFloor(ctx);const {F,FX0:x,FZ0:z,owner}=ctx,p=owner?.def?.palette??owner?.area?.palette??GOLD;
    const gold=p.ledge,dark=p.grout,base=p.floor,light=p.floorRing;
    const cx=(owner?.x0??ctx.tx)+(owner?.w??16)/2,cz=(owner?.z0??ctx.tz)+(owner?.h??12)/2;
    F.box(x,0,z,x+16,1,z+16,(X,Y,Z)=>{
      const lx=X-x,lz=Z-z;
      if(ch==='b')return Z%8===0||(X+(Math.floor(Z/8)%2)*8)%16===0?dark:Math.floor(Z/8)%2?light:shadeHex(light,1.12);
      if(ch==='i')return lx===0||lz===0?dark:(Math.floor(X/32)+Math.floor(Z/32))%2?base:shadeHex(base,.86);
      if(ch==='j')return lx===0||lz===0?dark:lx%4===1?light:shadeHex(base,.64);
      if(ch==='q')return lx<2||lz<2||lx>13||lz>13?light:lx===4||lx===11?gold:base;
      if(ch==='e')return lx===0||lz===0?dark:(Math.floor(X/8)+Math.floor(Z/8))%2?light:base;
      const dx=(X+.5)/16-cx,dz=(Z+.5)/16-cz,r=Math.hypot(dx,dz);
      const rim=Math.abs(r-2.15)<.09||Math.abs(r-1.85)<.06;
      const hands=(Math.abs(dx)<.08||Math.abs(dz)<.08)&&r<1.6;
      const hours=Math.abs(r-1.5)<.15&&(Math.abs(Math.abs(dx)-Math.abs(dz))<.12);
      return rim||hands||hours?gold:lx===0||lz===0?dark:base;
    });
  }});
}

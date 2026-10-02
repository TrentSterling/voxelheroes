import { defineTileset, registerTile } from '../tiles.js';
import { land } from './overworld.js';
import { hash3 } from '../../core/vox.js';

defineTileset('whisperwood', { parent: 'overworld', floor: '.' });

// Low ground details, with the same traversal and collision as their grass
// and path bases. The old civic route becomes visible beneath the woodland.
registerTile('whisperwood','h',{name:'wood-leaf-litter',ground:'grass',build(ctx){
  land(ctx);const {D,FX0:x,FZ0:z}=ctx;
  for(let i=0;i<3;i++) {
    const px=x+2+Math.floor(hash3(ctx.tx,i,ctx.tz,91)*9),pz=z+2+Math.floor(hash3(ctx.tx,i,ctx.tz,92)*9);
    const color=[0x948149,0xbaaa61,0x68855c][i];
    D.box(px,1,pz+1,px+5,2,pz+3,color);D.box(px+1,1,pz,px+4,2,pz+4,color);
    D.box(px+2,2,pz+1,px+3,3,pz+4,0x645837);
  }
}});
registerTile('whisperwood','o',{name:'wood-worn-stones',ground:'path',build(ctx){
  land(ctx);const {T,X0:x,Z0:z,D,FX0:fx,FZ0:fz}=ctx;
  for(const [px,pz,w,h] of [[1,1,3,2],[5,1,2,3],[1,4,2,3],[4,5,3,2]])
    T.box(x+px,0,z+pz,x+px+w,1,z+pz+h,(X,Y,Z)=>hash3(X,0,Z,93)<.2?0x687668:0x8e9982);
  D.box(fx+3,1,fz+9,fx+5,2,fz+12,0x718f5e);D.box(fx+10,1,fz+2,fx+13,2,fz+4,0x9aab74);
}});
registerTile('whisperwood','c',{name:'wood-copper-route',ground:'path',build(ctx){
  land(ctx);const {D,FX0:x,FZ0:z}=ctx;
  const vertical=[ctx.defAt(0,-1),ctx.defAt(0,1)].some(d=>d?.ground==='path');
  const horizontal=[ctx.defAt(-1,0),ctx.defAt(1,0)].some(d=>d?.ground==='path');
  for(const rotate of [false,true].filter(r=>r?horizontal:vertical||!horizontal)) {
    const box=(a,b,c,d,color)=>rotate?D.box(x+c,1,z+a,x+d,2,z+b,color):D.box(x+a,1,z+c,x+b,2,z+d,color);
    for(const edge of [3,12])box(edge,edge+1,0,16,0xad8c55);
    for(const cross of [3,11]){box(4,12,cross,cross+1,0x786641);box(7,9,cross,cross+1,0x76aa94);}
  }
}});
registerTile('whisperwood','a',{name:'wood-amber-seedbed',ground:'grass',build(ctx){
  land(ctx);const {D,FX0:x,FZ0:z}=ctx;
  D.box(x+3,1,z+3,x+13,2,z+13,0x60795c);
  for(let px=4;px<12;px++)for(let pz=4;pz<12;pz++){
    const dx=px-7.5,dz=pz-7.5;
    if(Math.abs(dx+dz)<2||Math.abs(dx-dz)<2)D.set(x+px,2,z+pz,px<pz?0xc7aa60:0xe0c986);
  }
  D.box(x+7,2,z+7,x+9,3,z+9,0x9c7650);
}});

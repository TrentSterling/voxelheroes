// Controllers copied from the native earned temple victories. They read live
// positions and clocks and write ordinary input only; no combat state edits.
export async function queenRematch(t){
  const before=await t.state();
  let outcome,elapsed=0,flippedPhoto=false;
  for(let chunk=0;chunk<24;chunk++) {
    outcome=await t.eval(async()=>{
      const h=window.__voxelHeroes,p=h.player,s=h.screen(),q=h.entities.find(e=>!e.removed&&e.type==='boss-queen');
      if(!q)return {dead:true,hp:h.state.hp};
      const directions=[[0,1],[1,0],[0,-1],[-1,0]];
      const diff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
      let ticks=0,bombs=0,swings=0,flipped=false;
      try {
        for(let i=0;i<600&&!q.removed&&h.state.mode==='play';i++) {
          const activeBomb=h.entities.find(e=>!e.removed&&e.type==='bomb');
          const drone=h.entities.filter(e=>!e.removed&&e.type==='queen-drone')
            .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
          const defend=drone&&Math.hypot(drone.x-p.x,drone.z-p.z)<1.55;
          const target=defend?drone:q;
          const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),vertical=Math.abs(dz)>=Math.abs(dx);
          const sx=vertical?0:Math.sign(dx),sz=vertical?Math.sign(dz):0;
          const facing=Math.atan2(sx,sz),aimed=Math.abs(diff(facing,p.yaw))<.25;
          const open=['rest','flipped'].includes(q.ai.phase);
          const readyBomb=!activeBomb&&h.game.inventory.ammo('bombs')>0&&((q.ai.phase==='gather'&&q.ai.t<.35)||(q.ai.phase==='rest'&&q.ai.t>1.05));
          let goal;
          if(activeBomb) {
            const bx=p.x-activeBomb.x,bz=p.z-activeBomb.z,bd=Math.hypot(bx,bz)||1;
            goal=bd<3?{x:activeBomb.x+bx/bd*3,z:activeBomb.z+bz/bd*3}:{x:p.x,z:p.z};
          } else if(q.ai.phase==='flight'||q.ai.phase==='volley') {
            const rx=p.x-q.x,rz=p.z-q.z,rd=Math.hypot(rx,rz)||1;
            const turn=q.ai.phase==='volley'?.45:0;
            goal={x:q.x+(rx*Math.cos(turn)-rz*Math.sin(turn))/rd*4.1,z:q.z+(rx*Math.sin(turn)+rz*Math.cos(turn))/rd*4.1};
          } else {
            goal=directions.map(([x,z])=>({x:q.x+x*1.7,z:q.z+z*1.7})).filter(c=>!h.world.blocked(c.x,c.z,p.r,p))
              .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]??{x:q.x,z:q.z+1.7};
          }
          h.input.up('guard');
          if(!activeBomb&&d<=(defend?1.55:1.95)&&Math.abs(vertical?dx:dz)<(defend?.36:.65)&&p.attackT<=0&&p.knockT<=0&&(defend||open||readyBomb)) {
            if(!aimed) h.input.setStick(sx,sz);
            else {
              h.input.setStick(0,0);h.input.down('guard');
              if(readyBomb&&!defend){h.input.tap('item');bombs++;}
              else {h.input.tap('sword');swings++;}
            }
          } else if(p.attackT<=0) {
            let gx=goal.x,gz=goal.z,mx=gx-p.x,mz=gz-p.z,md=Math.hypot(mx,mz);
            if(md>.12&&h.world.blocked(p.x+mx/md*p.speed/60,p.z+mz/md*p.speed/60,p.r,p)) {
              const path=window.__vhBot.bfs([Math.floor(p.x-s.x0),Math.floor(p.z-s.z0)],(x,z)=>x===Math.floor(gx-s.x0)&&z===Math.floor(gz-s.z0));
              if(path?.length){gx=s.x0+path[0][0]+.5;gz=s.z0+path[0][1]+.5;mx=gx-p.x;mz=gz-p.z;md=Math.hypot(mx,mz);}
            }
            h.input.setStick(md>.12?mx/md:0,md>.12?mz/md:0);
            if(!activeBomb&&aimed&&md<=.2)h.input.down('guard');
          }
          await h.tick();ticks++;
          if(q.ai.phase==='flipped')flipped=true;
          if(flipped&&!window.__nativeQueenFlippedPhoto){window.__nativeQueenFlippedPhoto=true;break;}
        }
      }finally{h.input.up('guard');h.input.setStick(0,0);}
      return {dead:q.removed,ticks,bombs,swings,flipped,hp:h.state.hp,maxHp:h.state.maxHp,mode:h.state.mode,
        queenHp:q.hp,phase:q.ai.phase,phaseT:q.ai.t,ammo:h.game.inventory.ammo('bombs'),
        hero:{x:p.x-s.x0,z:p.z-s.z0},queen:{x:q.x-s.x0,z:q.z-s.z0},drones:q.segments.filter(e=>!e.removed).length};
    });
    elapsed+=(outcome.ticks??0)/60;t.note(`Native Queen ${elapsed.toFixed(2)}s: ${JSON.stringify(outcome)}`);
    if(outcome.flipped&&!flippedPhoto){await t.step(.2);await t.shot('154-native-queen-overturned');flippedPhoto=true;}
    if(chunk===0||outcome.dead||outcome.mode!=='play')await t.shot(`155-native-queen-${chunk+1}`);
    if(outcome.dead||outcome.mode!=='play')break;
  }
  t.expect(outcome.dead&&outcome.hp>0,'the earned hero defeats the real queen rematch through ordinary combat inputs');
  t.expect((await t.state()).maxHp===before.maxHp&&!await t.eval(()=>window.__voxelHeroes.entities.some(e=>!e.removed&&e.type==='heart-container')),'the rematch preserves capacity and gives no repeat permanent heart');
  return outcome;
}

export async function colossusRematch(t){
  const before=await t.state();
  const pictured=new Set();let outcome,elapsed=0;
  for(let chunk=0;chunk<36;chunk++){
    outcome=await t.eval(async()=>{
      const h=window.__voxelHeroes,p=h.player,s=h.screen(),b=h.entities.find(e=>!e.removed&&e.type==='boss-colossus');
      if(!b)return {dead:true,hp:h.state.hp};
      const diff=(a,c)=>Math.atan2(Math.sin(a-c),Math.cos(a-c));let ticks=0,swings=0;
      const initial=b.stage;
      try{
        for(let i=0;i<480&&!b.removed&&h.state.mode==='play';i++){
          const targets=b.stage===3?[b]:b.segments.filter(e=>!e.removed&&!e.guards());
          const e=targets.sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0]??b;
          const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz),vertical=Math.abs(dz)>=Math.abs(dx);
          const ax=vertical?0:Math.sign(dx),az=vertical?Math.sign(dz):0,aimed=Math.abs(diff(Math.atan2(ax,az),p.yaw))<.25;
          const shots=h.entities.filter(e=>!e.removed&&e.kind==='projectile'&&['colossus-laser','colossus-wave'].includes(e.type));
          const threat=shots.sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
          const beamClose=threat?.type==='colossus-laser'&&Math.hypot(threat.x-p.x,threat.z-p.z)<1.8;
          let goal=[[0,1],[1,0],[0,-1],[-1,0]].map(([x,z])=>({x:e.x+x*1.75,z:e.z+z*1.75}))
            .filter(c=>c.x>s.x0+1&&c.x<s.x1-1&&c.z>s.z0+1&&c.z<s.z1-1&&!h.world.blocked(c.x,c.z,p.r,p)&&(b.stage===3||Math.hypot(c.x-b.x,c.z-b.z)>1.8))
            .sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0]??{x:e.x,z:e.z+1.5};
          const line=(p.x-b.x)*b.ai.dz-(p.z-b.z)*b.ai.dx;
          if(b.ai.phase==='laser-tell'&&Math.abs(line)<1.8||beamClose){
            const vx=b.ai.dz,vz=-b.ai.dx,side=line>=0?1:-1;
            goal={x:p.x+vx*side*2,z:p.z+vz*side*2};
          }
          if(b.ai.phase==='leap'){
            const lx=p.x-b.ai.hopX,lz=p.z-b.ai.hopZ,ld=Math.hypot(lx,lz)||1;
            goal={x:b.ai.hopX+lx/ld*4,z:b.ai.hopZ+lz/ld*4};
          }
          h.input.up('guard');
          const evade=b.ai.phase==='leap'||beamClose||(b.ai.phase==='laser-tell'&&Math.abs(line)<1.8);
          if(!evade&&!b.airborne&&d<1.95&&Math.abs(vertical?dx:dz)<.6&&p.attackT<=0&&p.knockT<=0){
            if(!aimed)h.input.setStick(ax,az);
            else{h.input.setStick(0,0);h.input.down('guard');h.input.tap('sword');swings++;}
          }else if(p.attackT<=0){
            goal.x=Math.max(s.x0+1.2,Math.min(s.x1-1.2,goal.x));goal.z=Math.max(s.z0+1.2,Math.min(s.z1-1.2,goal.z));
            const mx=goal.x-p.x,mz=goal.z-p.z,md=Math.hypot(mx,mz);
            h.input.setStick(md>.1?mx/md:0,md>.1?mz/md:0);
            if(!evade&&aimed)h.input.down('guard');
          }
          await h.tick();ticks++;
          if(b.stage!==initial)break;
        }
      }finally{h.input.up('guard');h.input.setStick(0,0);}
      return {dead:b.removed,ticks,swings,hp:h.state.hp,maxHp:h.state.maxHp,mode:h.state.mode,stage:b.stage,
        hpRemaining:b.remainingHp(),phase:b.ai.phase,phaseT:b.ai.t,hero:{x:p.x-s.x0,z:p.z-s.z0},boss:{x:b.x-s.x0,z:b.z-s.z0}};
    });
    elapsed+=(outcome.ticks??0)/60;t.note(`Native Colossus ${elapsed.toFixed(2)}s: ${JSON.stringify(outcome)}`);
    if(outcome.stage&&!pictured.has(outcome.stage)){await t.step(.2);await t.shot(`164-native-colossus-stage-${outcome.stage}`);pictured.add(outcome.stage);}
    if(outcome.dead||outcome.mode!=='play'){await t.shot('165-native-colossus-result');break;}
  }
  t.expect(outcome.dead&&outcome.hp>0,'the earned hero defeats the real colossus rematch through ordinary combat inputs');
  t.expect((await t.state()).maxHp===before.maxHp&&!await t.eval(()=>window.__voxelHeroes.entities.some(e=>!e.removed&&e.type==='heart-container')),'the rematch preserves capacity and gives no repeat permanent heart');
  return outcome;
}

export async function nacreRematch(t){
  const before=await t.state();
  const pictured=new Set();let outcome;
  for(let chunk=0;chunk<40;chunk++){
    outcome=await t.eval(async()=>{
      const h=window.__voxelHeroes,p=h.player,s=h.screen(),b=h.entities.find(e=>!e.removed&&e.type==='boss-beast'),bot=window.__vhBot;
      if(!b)return {dead:true,hp:h.state.hp};
      const counters=window.__nacreInputs??= {ticks:0,swings:0,hooks:0,fire:0,crossings:0,bank:null,start:h.state.time};
      const diff=(a,c)=>Math.atan2(Math.sin(a-c),Math.cos(a-c));let path=null,key=null;
      const aim=(dx,dz)=>{const vertical=Math.abs(dz)>=Math.abs(dx);return vertical?[0,Math.sign(dz)]:[Math.sign(dx),0];};
      const use=id=>{if(h.game.inventory.selectedItem()?.id!==id){h.input.tap('next-item');return false;}h.input.tap('item');return true;};
      try{
        for(let i=0;i<480&&!b.removed&&h.state.mode==='play';i++){
          h.input.up('guard');
          const x=p.x-s.x0,z=p.z-s.z0,bx=b.x-s.x0,bz=b.z-s.z0;
          const bank=x<8?'left':x>=12?'right':null;
          if(bank&&counters.bank&&bank!==counters.bank)counters.crossings++;
          if(bank)counters.bank=bank;
          if(h.game.hero.hero.isPulled()){h.input.setStick(0,0);await h.tick();counters.ticks++;continue;}
          const ink=h.entities.filter(e=>!e.removed&&e.type==='beast-ink'&&Math.hypot(e.x-p.x,e.z-p.z)<3)
            .sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
          if(ink&&p.attackT<=0){const [ax,az]=aim(ink.x-p.x,ink.z-p.z);if(Math.abs(diff(Math.atan2(ax,az),p.yaw))>.25)h.input.setStick(ax,az);else{h.input.setStick(0,0);h.input.down('guard');}await h.tick();counters.ticks++;continue;}
          const threat=b.segments.filter(e=>!e.removed&&e.ai.phase!=='buried'&&Math.hypot(e.x-p.x,e.z-p.z)<4)
            .sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
          if(threat&&p.attackT<=0&&(counters.fireAt??0)<=h.state.time){
            const dx=threat.x-p.x,dz=threat.z-p.z,a=Math.round(Math.atan2(dx,dz)/(Math.PI/4))*Math.PI/4;
            h.input.setStick(Math.sin(a),Math.cos(a));
            h.input.down('guard');
            if(use('fire-wand')){counters.fire++;counters.fireAt=h.state.time+.45;}
            await h.tick();counters.ticks++;continue;
          }
          const reach=Math.min(3.1,h.game.swords.bladeSize().reach-.2);
          const targetBank=bx<8?'left':'right',cross=bank&&bank!==targetBank;
          let goal;
          if(cross){
            const row=Math.abs(z-6.5)<Math.abs(z-10.5)?6.5:10.5;
            goal={x:bank==='left'?7.5:12.5,z:row};
            if(Math.hypot(x-goal.x,z-goal.z)<.17&&p.attackT<=0){
              const dx=bank==='left'?1:-1;h.input.setStick(dx,0);
              const blocker=b.segments.find(e=>!e.removed&&e.ai.phase!=='buried'&&Math.abs(e.z-p.z)<.8&&(e.x-p.x)*dx>0&&(e.x-p.x)*dx<5);
              if(!h.entities.some(e=>!e.removed&&e.type==='grapple-hook')){
                if(use(blocker?'fire-wand':'grapple'))counters[blocker?'fire':'hooks']++;
              }
              await h.tick();counters.ticks++;continue;
            }
          }else{
            const candidates=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dz])=>({x:bx+dx*reach,z:bz+dz*reach}))
              .filter(c=>c.x>1.5&&c.x<s.w-1.5&&c.z>1.5&&c.z<s.h-1.5&&!h.world.blocked(s.x0+c.x,s.z0+c.z,p.r,p));
            goal=candidates.sort((a,c)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(c.x-x,c.z-z))[0]??{x:bx,z:bz+reach};
            const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz),[ax,az]=aim(dx,dz),aligned=Math.abs(ax?dz:dx)<.6;
            if(bank===targetBank&&d<reach+.3&&aligned&&p.attackT<=0){
              if(Math.abs(diff(Math.atan2(ax,az),p.yaw))>.25)h.input.setStick(ax,az);
              else{h.input.setStick(0,0);h.input.down('guard');if(b.ai.phase==='surface'){h.input.tap('sword');counters.swings++;}}
              await h.tick();counters.ticks++;continue;
            }
          }
          if(p.attackT<=0){
            const goalKey=`${Math.floor(goal.x)},${Math.floor(goal.z)}`;
            if(!path||key!==goalKey){key=goalKey;path=bot.bfs([Math.floor(x),Math.floor(z)],(tx,tz)=>`${tx},${tz}`===goalKey);}
            while(path?.length&&Math.hypot(path[0][0]+.5-x,path[0][1]+.5-z)<.17)path.shift();
            const wp=path?.length?{x:path[0][0]+.5,z:path[0][1]+.5}:goal,dx=wp.x-x,dz=wp.z-z,d=Math.hypot(dx,dz);
            h.input.setStick(d>.13?dx/d:0,d>.13?dz/d:0);
            const tentacle=b.segments.filter(e=>!e.removed&&e.ai.phase!=='buried').sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
            if(tentacle&&Math.hypot(tentacle.x-p.x,tentacle.z-p.z)<2.3&&Math.abs(diff(Math.atan2(tentacle.x-p.x,tentacle.z-p.z),p.yaw))<.3){h.input.tap('sword');counters.swings++;}
          }
          await h.tick();counters.ticks++;
        }
      }finally{h.input.up('guard');h.input.setStick(0,0);}
      return {dead:b.removed,hp:h.state.hp,maxHp:h.state.maxHp,mode:h.state.mode,remaining:b.hp,phase:b.ai.phase,t:b.ai.t,site:b.ai.site,hero:{x:p.x-s.x0,z:p.z-s.z0},elapsed:h.state.time-counters.start,...counters};
    });
    t.note(`Native Nacre: ${JSON.stringify(outcome)}`);
    const band=Math.ceil(outcome.remaining/35);
    if(!outcome.dead&&!pictured.has(band)){await t.shot(`174-native-tide-memory-band-${band}`);pictured.add(band);}
    if(outcome.dead||outcome.mode!=='play'){await t.shot('175-native-tide-memory-result');break;}
    await t.page.waitForTimeout(100);
  }
  t.expect(outcome.dead&&outcome.hp>0,'the earned hero defeats the real nacre rematch through ordinary combat inputs');
  t.expect((await t.state()).maxHp===before.maxHp&&!await t.eval(()=>window.__voxelHeroes.entities.some(e=>!e.removed&&e.type==='heart-container')),'the rematch preserves capacity and gives no repeat permanent heart');
  return outcome;
}

import journey from './barrow-journey.mjs';

export const description='Fresh title through the Old Barrow, native Coilmaw combat and actual rewards. The serpent controller reads positions but writes only ordinary stick/button input. No boss or hero health edits, invulnerability, teleport, direct damage, AI overrides or granted gear. Existing movement helpers settle endpoints within two normal steps. All output is muted.';

export default async function(t) {
  await journey(t);
  await t.track('boss-intro','boss-defeated','boss-phase','player-hurt','enemy-hit','dungeon-complete');
  const before=await t.state();
  await t.walkTo(8,1.5); await t.stick(0,-1,.5);
  await t.enter(8,.5);
  t.expect((await t.state()).area==='d1-boss','the actual boss key opens the native arena door');
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6}); await t.step(1.2);
  await t.shot('21-native-coilmaw-intro');
  await t.waitFor(s=>s.mode==='play',{seconds:6});
  t.expect((await t.events('boss-intro')).length===1,'the fresh arena supplies exactly one Coilmaw introduction');
  let outcome,elapsed=0;
  for(let chunk=0;chunk<18;chunk++) {
    outcome=await t.eval(async()=>{
      const h=window.__voxelHeroes,p=h.player,s=h.screen();
      const boss=h.entities.find(e=>!e.removed&&e.type==='boss-serpent');
      if(!boss)return{dead:true,hp:h.state.hp};
      const cards=[[1,0],[-1,0],[0,1],[0,-1]];
      let ticks=0,milestone=false;
      for(let tick=0;tick<600&&!boss.removed&&h.state.mode==='play';tick++) {
        const tail=boss.tail(),target=tail??boss;
        const other=tail?(boss.segments.at(-2)??boss):null;
        const rx=other?target.x-other.x:p.x-target.x,rz=other?target.z-other.z:p.z-target.z,rl=Math.hypot(rx,rz)||1;
        const candidates=cards.map(([x,z])=>({x:target.x+x*1.6,z:target.z+z*1.6,rear:(x*rx+z*rz)/rl})).filter(c=>c.rear>=.2&&!h.world.blocked(c.x,c.z,p.r,p));
        const goal=candidates.sort((a,b)=>(Math.hypot(a.x-p.x,a.z-p.z)-a.rear)-(Math.hypot(b.x-p.x,b.z-p.z)-b.rear))[0]??{x:target.x+rx/rl*1.6,z:target.z+rz/rl*1.6};
        const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),vertical=Math.abs(dz)>=Math.abs(dx);
        const facing=vertical?(dz>0?0:Math.PI):(dx>0?Math.PI/2:-Math.PI/2);
        const angle=Math.atan2(Math.sin(facing-p.yaw),Math.cos(facing-p.yaw));
        const lateral=vertical?dx:dz;
        if((!tail||tail.glowing)&&d<=2.15&&Math.abs(lateral)<.6&&p.attackT<=0&&p.knockT<=0) {
          if(Math.abs(angle)>.25)h.input.setStick(vertical?0:Math.sign(dx),vertical?Math.sign(dz):0);
          else{h.input.setStick(0,0);h.input.tap('sword');}
        }else if(p.attackT<=0){
          let gx=goal.x,gz=goal.z;
          if(h.world.blocked(p.x+(gx-p.x)*.1,p.z+(gz-p.z)*.1,p.r,p)) {
            const path=window.__vhBot.bfs([Math.floor(p.x-s.x0),Math.floor(p.z-s.z0)],(x,z)=>x===Math.floor(gx-s.x0)&&z===Math.floor(gz-s.z0));
            if(path?.length){gx=s.x0+path[0][0]+.5;gz=s.z0+path[0][1]+.5;}
          }
          const mx=gx-p.x,mz=gz-p.z,md=Math.hypot(mx,mz);
          h.input.setStick(md>.12?mx/md:0,md>.12?mz/md:0);
        }
        await h.tick();
        ticks++;
        if(tail&&!boss.segments.length){milestone=true;break;}
      }
      h.input.setStick(0,0);
      return{dead:boss.removed,ticks,milestone,hp:h.state.hp,maxHp:h.state.maxHp,mode:h.state.mode,segments:boss.segments.length,bossHp:boss.hp,orbs:h.entities.filter(e=>!e.removed&&e.type==='serpent-orb').length,hero:{x:p.x-s.x0,z:p.z-s.z0},head:{x:boss.x-s.x0,z:boss.z-s.z0},tail:boss.tail()?{x:boss.tail().x-s.x0,z:boss.tail().z-s.z0,glowing:boss.tail().glowing}:null};
    });
    elapsed+=(outcome.ticks??0)/60;
    t.note(`Native Coilmaw ${elapsed.toFixed(2)}s: ${JSON.stringify(outcome)}`);
    if(outcome.milestone)await t.shot('22-native-head-exposed');
    if(chunk===0||outcome.dead||outcome.mode!=='play')await t.shot(`22-native-coilmaw-${chunk+1}`);
    if(outcome.dead||outcome.mode!=='play')break;
  }
  t.expect(outcome.dead&&outcome.hp>0,'a fresh starter hero defeats Coilmaw with ordinary movement and sword input');
  t.expect((await t.state()).maxHp===before.maxHp,'boss combat did not alter the hero capacity');
  t.expect((await t.events('boss-defeated')).some(e=>e.dungeon==='d1'&&!e.refight),'native defeat grants the first boss flag');
  const reward=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='heart-container');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  t.expect(!!reward,'the actual first victory creates a reachable heart container');
  await t.step(.5);await t.walkTo(reward.x,reward.z);await t.step(2);
  t.expect((await t.state()).maxHp===before.maxHp+2,'walking into the real heart container adds exactly one heart');
  await t.shot('23-native-boss-heart');
  await t.enter(10.5,.5);
  t.expect((await t.state()).screenName==='Reward Room','the actual north exit reaches the sage and first orb');
  await t.walkTo(8.5,5.5);await t.stick(0,-1,.4);await t.step(2);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('orb:1')),'native movement earns the first temple orb');
  await t.shot('24-native-first-orb');
  await t.enter(8,11.5);
  t.expect((await t.state()).area==='ow-3-2','the actual reward stairs return the hero to Barrowfield');
  await t.shot('25-native-barrow-homecoming');
}

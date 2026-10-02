import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import journey from './nursery-crown-journey.mjs';

export const description = 'Fresh title through both temples and native Amber Queen victory. The Queen controller reads positions and clocks and writes ordinary stick, guard, sword and item inputs only. Earned bombs and real heart/orb pickups. No gear grants, teleport, health edits, direct damage, AI overrides or invulnerability. Earlier movement helpers settle endpoints within two ordinary steps. Speaker output disconnected.';

export default async function(t) {
  await journey(t);await t.track('boss-defeated','enemy-hit','player-hurt','explosion');
  const before=await t.state();
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await t.step(1.6);
  t.expect((await t.state()).area==='d2-boss','the earned amber key opens the real queen arena');
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot('50-native-queen-intro');
  await t.waitFor(s=>s.mode==='play',{seconds:6});
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
    if(outcome.flipped&&!flippedPhoto){await t.step(.2);await t.shot('51-native-queen-overturned');flippedPhoto=true;}
    if(chunk===0||outcome.dead||outcome.mode!=='play')await t.shot(`52-native-queen-${chunk+1}`);
    if(outcome.dead||outcome.mode!=='play')break;
  }
  t.expect(outcome.dead&&outcome.hp>0,'the fresh hero defeats the Amber Queen with earned bombs, sword and ordinary movement');
  t.expect(outcome.maxHp===before.maxHp,'the native Queen battle does not edit hero capacity');
  t.expect(flippedPhoto,'at least one earned bomb naturally overturns the Queen');
  t.expect((await t.events('boss-defeated')).some(e=>e.dungeon==='d2'&&!e.refight),'native victory records the second boss');
  const reward=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='heart-container');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  t.expect(!!reward,'native victory drops the actual permanent heart');
  await t.step(.5);await t.walkTo(reward.x,reward.z);await t.step(2);
  t.expect((await t.state()).maxHp===before.maxHp+2,'walking onto the Queen reward adds exactly one permanent heart');
  await t.shot('53-native-queen-heart');
  await t.enter(10.5,.5);
  t.expect((await t.state()).screenName==='Second Light','the real northern arena exit reaches Second Light');
  await t.walkTo(8.5,5.5);await t.stick(0,-1,.3);await t.step(2);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d2')),'the real reward chest earns the second orb');
  await t.shot('54-native-second-orb');
  await t.enter(7.5,11.5);await t.step(1.6);
  t.expect((await t.state()).area==='lost-woods','the ordinary reward stairs lead out of the second temple');
  await t.shot('55-native-rootglass-homecoming');
  writeFileSync(join(t.out,'55-earned-second-orb.save.json'),JSON.stringify({description:'Earned by the complete fresh ordinary-input journey; no checkpoint was loaded.',snapshot:await t.state(),data:await t.save(),log:t.log},null,2));
}

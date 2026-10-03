import crownJourney from './brineglass-crown-journey.mjs';
import { checkpoint } from './brineglass-journey.mjs';

export const description='Fresh title through four earned temple victories. Actual tidewell rest, then Nacre controller reads physical banks and attack clocks and writes normal stick, guard, sword and item-cycle/use inputs. Actual crossings, permanent heart, fourth orb and reward exit. No grants, artificial health edits, immunity, teleports, direct damage, enemy removal or AI overrides. Ancestor endpoint settling and earned starter save roundtrip are disclosed; diagnostic saves are never loaded. Speaker output disconnected.';

export async function afterCrown(t){
  await t.track('boss-defeated','hero-hit','enemy-hit','item-used');
  await t.walkTo(12.5,6.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.4);
  t.expect((await t.state()).hp===(await t.state()).maxHp,'ordinary interaction with the physical tidewell restores the earned hero before Nacre');await t.shot('109-native-tidewell-rest');
  const before=await t.state();
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await t.step(1.6);
  t.expect((await t.state()).area==='d4-boss','the earned crown opens the physical Undertow Court');
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot('110-native-nacre-intro');
  await t.waitFor(s=>s.mode==='play',{seconds:6});
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
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
          if(ink&&p.attackT<=0){const [ax,az]=aim(ink.x-p.x,ink.z-p.z);h.input.setStick(ax,az);h.input.down('guard');await h.tick();counters.ticks++;continue;}
          const threat=b.segments.filter(e=>!e.removed&&e.ai.phase!=='buried'&&Math.hypot(e.x-p.x,e.z-p.z)<4)
            .sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
          if(threat&&p.attackT<=0&&(counters.fireAt??0)<=h.state.time){
            const dx=threat.x-p.x,dz=threat.z-p.z,a=Math.round(Math.atan2(dx,dz)/(Math.PI/4))*Math.PI/4;
            h.input.setStick(Math.sin(a),Math.cos(a));
            h.input.down('guard');
            if(use('fire-wand')){counters.fire++;counters.fireAt=h.state.time+.45;}
            await h.tick();counters.ticks++;continue;
          }
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
            const candidates=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dz])=>({x:bx+dx*1.85,z:bz+dz*1.85}))
              .filter(c=>c.x>1.5&&c.x<s.w-1.5&&c.z>1.5&&c.z<s.h-1.5&&!h.world.blocked(s.x0+c.x,s.z0+c.z,p.r,p));
            goal=candidates.sort((a,c)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(c.x-x,c.z-z))[0]??{x:bx,z:bz+1.85};
            const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz),[ax,az]=aim(dx,dz),aligned=Math.abs(ax?dz:dx)<.6;
            if(bank===targetBank&&d<2.1&&aligned&&p.attackT<=0){
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
    if(!outcome.dead&&!pictured.has(band)){await t.shot(`111-native-nacre-band-${band}`);pictured.add(band);}
    if(outcome.dead||outcome.mode!=='play'){await t.shot('112-native-nacre-result');break;}
    await t.page.waitForTimeout(100);
  }
  t.expect(outcome.dead&&outcome.hp>0,'the earned hero defeats Nacre through native sword, guard and channel movement');
  t.expect(outcome.maxHp===before.maxHp,'the native Nacre battle preserves hero capacity until its real reward');
  t.expect(outcome.crossings>=2&&outcome.hooks>=2,'actual earned grapple crossings join both banks during the battle');
  t.expect((await t.events('boss-defeated')).some(e=>e.dungeon==='d4'&&!e.refight),'the actual fight records the fourth keeper victory');
  const reward=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='heart-container');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  t.expect(!!reward,'Nacre drops its actual permanent heart on reachable floor');
  await t.step(.5);await t.walkTo(reward.x,reward.z);await t.step(2);
  t.expect((await t.state()).maxHp===before.maxHp+2,'collecting the actual fourth heart adds exactly one permanent heart');await t.shot('113-native-fourth-heart');
  await t.enter(10.5,.5);await t.step(1.6);
  t.expect((await t.state()).screenName==='Fourth Light','the real cleared arena exit reaches Fourth Light');
  await t.walkTo(8.5,5.5);await t.stick(0,-1,.3);await t.step(2);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d4')),'the physical Fourth Light chest gives the earned fourth orb');await t.shot('114-native-fourth-orb');
  await t.enter(7.5,11.5);await t.step(1.6);
  t.expect((await t.state()).area==='tidecoast','the authored fourth-light stairs return to the coast');await t.shot('115-native-nacre-homecoming');
  await checkpoint(t,'115-earned-fourth-orb');
}
export default async function(t){await crownJourney(t);await afterCrown(t);}

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import crownJourney from './watch-crown-journey.mjs';

export const description = 'Fresh title through three earned temple victories. Colossus controller reads stage, target positions and attack clocks and writes only normal stick, guard and sword inputs. Feet, arms, core, actual heart, third orb and stairs. No boss/hero health edits, invulnerability, teleport, direct damage, AI overrides or granted gear. Earlier movement endpoints settle within two ordinary steps; starter save roundtrip is earned and diagnostic checkpoints never loaded. Speaker output disconnected.';

export default async function(t){
  await crownJourney(t);await t.track('boss-defeated','hero-hit','enemy-hit');
  const before=await t.state();
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await t.step(1.6);
  t.expect((await t.state()).area==='d3-boss','the earned crown opens the actual Colossus Court');
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot('80-native-colossus-intro');
  await t.waitFor(s=>s.mode==='play',{seconds:6});
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
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
    if(outcome.stage&&!pictured.has(outcome.stage)){await t.step(.2);await t.shot(`81-native-colossus-stage-${outcome.stage}`);pictured.add(outcome.stage);}
    if(outcome.dead||outcome.mode!=='play'){await t.shot('82-native-colossus-result');break;}
  }
  t.expect(outcome.dead&&outcome.hp>0,'the fresh hero shatters real feet, arms and core using earned sword and ordinary movement');
  t.expect(outcome.maxHp===before.maxHp,'the native Colossus battle does not change hero capacity');
  t.expect(pictured.has(2)&&pictured.has(3),'both exposed-arm and hopping-core stages are reached naturally');
  t.expect((await t.events('boss-defeated')).some(e=>e.dungeon==='d3'&&!e.refight),'native victory records the third boss');
  const reward=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='heart-container');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  t.expect(!!reward,'the actual Colossus drops its permanent heart');await t.step(.5);await t.walkTo(reward.x,reward.z);await t.step(2);
  t.expect((await t.state()).maxHp===before.maxHp+2,'walking to the real Colossus heart adds exactly one permanent heart');await t.shot('83-native-colossus-heart');
  await t.enter(10.5,.5);await t.step(1.6);t.expect((await t.state()).screenName==='Third Light','the real arena exit leads to Third Light');
  await t.walkTo(8.5,5.5);await t.stick(0,-1,.3);await t.step(2);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d3')),'the actual Watch reward chest gives the earned third orb');await t.shot('84-native-third-orb');
  await t.enter(7.5,11.5);await t.step(1.6);t.expect((await t.state()).area==='sunreach','the authored reward stairs return to Sunreach');await t.shot('85-native-watch-homecoming');
  writeFileSync(join(t.out,'85-earned-third-orb.save.json'),JSON.stringify({description:'Earned from a fresh title through three normal-input victories; diagnostic only, never loaded by this case.',snapshot:await t.state(),data:await t.save(),log:t.log},null,2));
}

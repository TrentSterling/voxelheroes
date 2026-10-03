import towerJourney,{answer} from './tower-journey.mjs';
import { room, passage, fight, chest, checkpoint } from './brineglass-journey.mjs';

export const description='Fresh earned four-temple and three-memory campaign through Veyl and Caldrin, normal Truesight, shield, sword and movement, actual ending and homecoming. Controllers read visible shadows, clocks, committed warnings and pickups; no forced phases, damage, immunity, grants, health edits or loaded diagnostic saves. Movement endpoint settling and ancestor starter save roundtrip disclosed. Speaker output disconnected.';

export async function afterCrownStair(t,options={}){
  await room(t,'west','tower-crown:0,2');await chest(t,8,4);await room(t,'east','tower-crown:1,2');
  await room(t,'north','tower-crown:1,1');await fight(t,'Crown Guard');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('tower-crown')),'actual crown guard combat and chest grant the last crown key');await t.shot('181-native-last-crown-key');
  await room(t,'north','tower-crown:1,0');await t.walkTo(4.5,8.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.4);
  t.expect((await t.state()).hp===(await t.state()).maxHp,'the physical last well prepares the earned hero');await t.shot('182-native-last-rest');
  await t.walkTo(7.5,1.5);await t.stick(0,-1,.8);await t.step(1.6);
  t.expect((await t.state()).key==='tower-final:0,0','the actual final crown opens the Hollow Throne');
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot('183-native-veyl-intro');await t.waitFor(s=>s.mode==='play',{seconds:6});
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  let outcome;const pictured=new Set();
  for(let chunk=0;chunk<80;chunk++){
    outcome=await t.eval(async()=>{
      const h=window.__voxelHeroes,p=h.player,s=h.screen(),b=h.entities.find(e=>!e.removed&&e.type==='boss-bishop');
      if(!b)return {dead:true,hp:h.state.hp};
      const counters=window.__veylInputs??={ticks:0,swings:0,casts:0,start:h.state.time};
      let path=null,pathKey=null;
      const aim=(dx,dz)=>Math.abs(dz)>=Math.abs(dx)?[0,Math.sign(dz)]:[Math.sign(dx),0];
      const facing=(x,z)=>x?(x>0?'east':'west'):(z>0?'south':'north');
      try{for(let i=0;i<480&&!b.removed&&h.state.mode==='play';i++){
        h.input.up('guard');
        const magicShort=h.state.magic<h.game.spells.spellCost('spell-truesight');
        const pickup=h.entities.filter(e=>!e.removed&&(e.type==='magic'&&magicShort||e.type==='heart'&&h.state.hp<h.state.maxHp)).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
        const wisp=h.entities.filter(e=>!e.removed&&e.type==='crown-wisp').sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
        const shot=h.entities.filter(e=>{
          if(e.removed||e.type!=='crown-shot'||e.owner==='hero')return false;
          const dx=p.x-e.x,dz=p.z-e.z,time=(dx*e.vx+dz*e.vz)/(e.vx*e.vx+e.vz*e.vz);
          return time>=0&&time<.45&&Math.hypot(dx-e.vx*time,dz-e.vz*time)<p.r+e.r+.12;
        }).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
        if(shot&&p.attackT<=0){const [ax,az]=aim(shot.x-p.x,shot.z-p.z);if(p.facing!==facing(ax,az))h.input.setStick(ax,az);else{h.input.setStick(0,0);h.input.down('guard');}await h.tick();counters.ticks++;continue;}
        if(!h.game.effects.effectActive('truesight')&&!magicShort&&p.attackT<=0&&p.knockT<=0&&p.lockT<=0&&p.stallT<=0){
          if(h.game.inventory.selectedItem()?.id!=='spell-truesight')h.input.tap('next-item');else{h.input.tap('item');counters.casts++;}
          h.input.setStick(0,0);await h.tick();counters.ticks++;continue;
        }
        const defend=wisp&&Math.hypot(wisp.x-p.x,wisp.z-p.z)<3.2;
        const target=defend||magicShort&&!h.game.effects.effectActive('truesight')?wisp:b;
        let goal;
        if(pickup)goal={x:pickup.x,z:pickup.z};
        else if(target){
          const reach=Math.min(3,h.game.swords.bladeSize().reach-.25),dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),[ax,az]=aim(dx,dz);
          const visible=target!==b||b.shadow.visible&&b.ai.phase==='hold';
          if(visible&&d<reach+.25&&Math.abs(ax?dz:dx)<.6&&p.attackT<=0){
            if(p.facing!==facing(ax,az))h.input.setStick(ax,az);else{h.input.setStick(0,0);h.input.down('guard');h.input.tap('sword');counters.swings++;}
            await h.tick();counters.ticks++;continue;
          }
          goal=[[0,1],[1,0],[0,-1],[-1,0]].map(([x,z])=>({x:target.x+x*reach,z:target.z+z*reach})).filter(c=>c.x>s.x0+1.5&&c.x<s.x1-1.5&&c.z>s.z0+1.5&&c.z<s.z1-1.5&&!h.world.blocked(c.x,c.z,p.r,p)).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
        }
        if(goal&&p.attackT<=0){
          const key=`${Math.floor(goal.x-s.x0)},${Math.floor(goal.z-s.z0)}`;
          if(!path||pathKey!==key){pathKey=key;path=window.__vhBot.bfs([Math.floor(p.x-s.x0),Math.floor(p.z-s.z0)],(x,z)=>`${x},${z}`===key);}
          while(path?.length&&Math.hypot(path[0][0]+.5+s.x0-p.x,path[0][1]+.5+s.z0-p.z)<.17)path.shift();
          const wp=path?.length?{x:path[0][0]+.5+s.x0,z:path[0][1]+.5+s.z0}:goal,dx=wp.x-p.x,dz=wp.z-p.z,d=Math.hypot(dx,dz);h.input.setStick(d>.13?dx/d:0,d>.13?dz/d:0);
        }else h.input.setStick(0,0);
        await h.tick();counters.ticks++;
      }}finally{h.input.up('guard');h.input.setStick(0,0);}
      return {dead:b.removed,hp:h.state.hp,mode:h.state.mode,remaining:b.hp,phase:b.ai.phase,magic:h.state.magic,elapsed:h.state.time-counters.start,...counters};
    });
    t.note('Native Veyl: '+JSON.stringify(outcome));const band=Math.ceil(outcome.remaining/25);
    if(!outcome.dead&&!pictured.has(band)){pictured.add(band);await t.shot('184-native-veyl-band-'+band);}
    if(outcome.dead||outcome.mode!=='play'){await t.shot('185-native-mask-result');break;}
  }
  t.expect(outcome.dead&&outcome.hp>0,'the earned hero breaks Veyl\'s real mask through normal Truesight and sword inputs');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('tower:mask-broken')),'the actual mask victory persists and calls the Hollow Crown');
  await checkpoint(t,'185-earned-broken-mask');
  await afterBrokenMask(t,options);
}

export async function afterBrokenMask(t,{enterOnly=false}={}){
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot('186-native-hollow-crown-intro');await t.waitFor(s=>s.mode==='play',{seconds:6});
  // A surviving player can use the existing south retreat and last well.
  // Breaking the mask persists, so returning begins with Caldrin alone.
  await passage(t,10.5,15.5,'tower-crown:1,0');
  await t.walkTo(4.5,8.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.4);
  t.expect((await t.state()).hp===(await t.state()).maxHp,'the earned survivor can physically retreat to the last well between the two bosses');await t.shot('186a-native-between-boss-rest');
  await t.walkTo(7.5,1.5);await t.stick(0,-1,.8);await t.step(1.6);await t.waitFor(s=>s.mode==='play',{seconds:8});
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.entities.filter(e=>!e.removed&&e.type==='boss-king').length===1&&!h.entities.some(e=>!e.removed&&e.type==='boss-bishop');}),'actual retreat and return retain the broken mask and create one Hollow Crown');
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  await checkpoint(t,'186-earned-crown-prepared');if(!enterOnly)await hollowCrown(t);
}

export async function hollowCrown(t){
  await t.step(.7);await t.waitFor(s=>s.mode==='play',{seconds:8});await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  let outcome;const pictured=new Set();
  for(let chunk=0;chunk<80;chunk++){
    outcome=await t.eval(async()=>{
      const h=window.__voxelHeroes,p=h.player,s=h.screen(),b=h.entities.find(e=>!e.removed&&e.type==='boss-king');
      if(!b)return{dead:true,hp:h.state.hp};
      const counters=window.__crownInputs??={ticks:0,swings:0,lightningSteps:0,chargeSteps:0,start:h.state.time};
      const aim=(dx,dz)=>Math.abs(dz)>=Math.abs(dx)?[0,Math.sign(dz)]:[Math.sign(dx),0];
      const facing=(x,z)=>x?(x>0?'east':'west'):(z>0?'south':'north');
      const incoming=e=>{const dx=p.x-e.x,dz=p.z-e.z,time=(dx*e.vx+dz*e.vz)/(e.vx*e.vx+e.vz*e.vz);return time>=0&&time<.5&&Math.hypot(dx-e.vx*time,dz-e.vz*time)<p.r+e.r+.15;};
      const move=(dx,dz)=>{const d=Math.hypot(dx,dz)||1;h.input.setStick(dx/d,dz/d);};
      try{for(let i=0;i<480&&!b.removed&&h.state.mode==='play';i++){
        h.input.up('guard');
        const dx=p.x-b.x,dz=p.z-b.z,d=Math.hypot(dx,dz)||1;
        const marks=h.entities.filter(e=>!e.removed&&e.type==='crown-lightning');
        const mark=marks.find(e=>Math.hypot(e.x-p.x,e.z-p.z)<1.4);
        const charge=h.entities.find(e=>!e.removed&&e.type==='crown-charge'&&incoming(e));
        const onLine=b.ai.phase==='charge-tell'&&dx*b.ai.dx+dz*b.ai.dz>0&&Math.abs(dx*b.ai.dz-dz*b.ai.dx)<1.4;
        if(charge||onLine){
          if(window.__crownDodge?.attack!==b.ai.attack){
            const ends=[1,-1].map(sign=>({x:-b.ai.dz*sign,z:b.ai.dx*sign})).map(v=>({...v,ex:p.x+v.x*2.2,ez:p.z+v.z*2.2}));
            const clearance=e=>Math.min(e.ex-s.x0-1.6,s.x1-1.6-e.ex,e.ez-s.z0-1.6,s.z1-1.6-e.ez);
            ends.sort((a,c)=>clearance(c)-clearance(a));window.__crownDodge={attack:b.ai.attack,...ends[0]};
          }
          move(window.__crownDodge.x,window.__crownDodge.z);counters.chargeSteps++;
        }else if(mark){
          let candidates=Array.from({length:8},(_,j)=>{const a=j*Math.PI/4;return{x:p.x+Math.sin(a)*1.7,z:p.z+Math.cos(a)*1.7};}).filter(c=>c.x>s.x0+1.5&&c.x<s.x1-1.5&&c.z>s.z0+1.5&&c.z<s.z1-1.5&&!h.world.blocked(c.x,c.z,p.r,p));
          const score=c=>Math.min(...marks.map(e=>Math.hypot(e.x-c.x,e.z-c.z)),5)+Math.min(4,Math.hypot(c.x-b.x,c.z-b.z))+(onLine||charge?Math.min(2,Math.abs((c.x-b.x)*b.ai.dz-(c.z-b.z)*b.ai.dx))*3:0);
          candidates.sort((a,c)=>score(c)-score(a));if(candidates[0])move(candidates[0].x-p.x,candidates[0].z-p.z);
          counters.lightningSteps++;
        }else{
          const shot=h.entities.filter(e=>!e.removed&&['crown-shot','crown-storm'].includes(e.type)&&e.owner!=='hero'&&incoming(e)).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
          if(shot&&p.attackT<=0){const [ax,az]=aim(shot.x-p.x,shot.z-p.z);if(p.facing!==facing(ax,az))h.input.setStick(ax,az);else{h.input.setStick(0,0);h.input.down('guard');}}
          else if(p.attackT<=0){
            const [ax,az]=aim(-dx,-dz),reach=Math.min(3.9,h.game.swords.bladeSize().reach+.45);
            if(d<2.25){
              const c=Array.from({length:8},(_,j)=>{const a=j*Math.PI/4;return{x:p.x+Math.sin(a),z:p.z+Math.cos(a)};}).filter(c=>c.x>s.x0+2&&c.x<s.x1-2&&c.z>s.z0+2&&c.z<s.z1-2).sort((a,c)=>Math.hypot(c.x-b.x,c.z-b.z)-Math.hypot(a.x-b.x,a.z-b.z))[0];
              if(c)move(c.x-p.x,c.z-p.z);else h.input.setStick(0,0);
            }
            else if(d<reach+.3&&Math.abs(ax?dz:dx)<.75){if(p.facing!==facing(ax,az))h.input.setStick(ax,az);else{h.input.setStick(0,0);h.input.down('guard');if(b.opening.visible){h.input.tap('sword');counters.swings++;}}}
            else{
              const goal=[[0,1],[1,0],[0,-1],[-1,0]].map(([x,z])=>({x:b.x+x*reach,z:b.z+z*reach})).filter(c=>c.x>s.x0+1.5&&c.x<s.x1-1.5&&c.z>s.z0+1.5&&c.z<s.z1-1.5&&!h.world.blocked(c.x,c.z,p.r,p)).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];
              if(goal)move(goal.x-p.x,goal.z-p.z);else h.input.setStick(0,0);
            }
          }else{h.input.setStick(0,0);h.input.down('guard');}
        }
        await h.tick();counters.ticks++;
        if(['charge-tell','lightning','recover'].includes(b.ai.phase)&&!window.__crownWarnings?.[b.ai.phase]){window.__crownWarnings??={};window.__crownWarnings[b.ai.phase]=true;break;}
      }}finally{h.input.up('guard');h.input.setStick(0,0);}
      return{dead:b.removed,hp:h.state.hp,mode:h.state.mode,remaining:b.hp,phase:b.ai.phase,elapsed:h.state.time-counters.start,player:[p.x-s.x0,p.z-s.z0],boss:[b.x-s.x0,b.z-s.z0],...counters};
    });
    t.note('Native Caldrin: '+JSON.stringify(outcome));
    if(['charge-tell','lightning','recover'].includes(outcome.phase)&&!pictured.has(outcome.phase)){pictured.add(outcome.phase);await t.shot('187-native-crown-'+outcome.phase);}
    if(outcome.dead||outcome.mode!=='play'){await t.shot('188-native-crown-result');break;}
  }
  t.expect(outcome.dead&&outcome.hp>0,'the earned Dawn Blade and Bastion Shield defeat the live Hollow Crown through normal inputs');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('campaign:complete')),'the actual 140 HP victory completes the earned campaign');
  await t.waitFor(s=>s.mode==='ending',{seconds:6});await t.step(1);
  for(let page=0;page<3;page++){
    const overlay=await t.eval(()=>window.__voxelHeroes.game.overlay.overlayView());t.expect(overlay.title&&overlay.message.length>70,'earned ending page '+(page+1)+' has its authored story');
    await t.shot('189-native-ending-'+(page+1));if(page===0){await t.page.setViewportSize({width:390,height:844});await t.shot('189a-native-ending-phone');t.expect(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'the earned ending fits phone width');await t.page.setViewportSize({width:1280,height:720});}
    await t.tap('confirm');await t.step(.8);
  }
  await t.step(1.6);t.expect((await t.state()).key==='v1:1,1','the actual earned ending returns the hero to Mossbrook');await t.shot('190-native-homecoming');
  await checkpoint(t,'190-earned-homecoming');
}

export default async function(t){await towerJourney(t);await afterCrownStair(t);}

export const description = 'Silent three-companion wall turns, reversals, one-tile corridor, terrain change recovery, stationary settling, teleport, real room edge and save/load. Recruitment and obstacle terrain are disclosed fixtures; all course travel uses stick input and every frame measures safe ground and separation.';
export default async function(t) {
 const view=()=>t.eval(()=>window.__voxelHeroes.game.companions.companionView());
 const shot=async name=>{await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(name);};
 const drive=points=>t.eval(async points=>{
  const h=window.__voxelHeroes,s=h.screen(),metrics={ticks:0,blocked:0,missing:0,minSeparation:Infinity,maxStep:0};let last=new Map();
  const measure=()=>{const es=h.entities.filter(e=>e.kind==='companion'&&!e.removed&&e.object.visible);metrics.ticks++;if(es.length!==3)metrics.missing++;for(const e of es){if(h.world.blocked(e.x,e.z,e.r,e)||h.world.tileDefAt(Math.floor(e.x),Math.floor(e.z))?.hazard)metrics.blocked++;const prior=last.get(e);if(prior)metrics.maxStep=Math.max(metrics.maxStep,Math.hypot(e.x-prior.x,e.z-prior.z));last.set(e,{x:e.x,z:e.z});}for(let a=0;a<es.length;a++)for(let b=a+1;b<es.length;b++)metrics.minSeparation=Math.min(metrics.minSeparation,Math.hypot(es[a].x-es[b].x,es[a].z-es[b].z));};
  for(const [x,z]of points){let arrived=false;try{for(let i=0;i<900;i++){const dx=s.x0+x-h.player.x,dz=s.z0+z-h.player.z,d=Math.hypot(dx,dz);if(d<.09){arrived=true;break;}h.input.setStick(dx/d,dz/d);await h.tick();measure();}}finally{h.input.setStick(0,0);}if(!arrived)throw Error('Actual stick route stuck at '+[x,z]);}
  for(let i=0;i<240;i++){await h.tick();measure();}const es=h.entities.filter(e=>e.kind==='companion'&&!e.removed&&e.object.visible);metrics.settledSeparation=Infinity;for(let a=0;a<es.length;a++)for(let b=a+1;b<es.length;b++)metrics.settledSeparation=Math.min(metrics.settledSeparation,Math.hypot(es[a].x-es[b].x,es[a].z-es[b].z));return metrics;
 },points);
 const checkTravel=(m,label)=>{t.expect(m.ticks>100,label+' records every actual movement tick');t.expect(m.blocked===0&&m.missing===0,label+' keeps all three visible and off blocked or hazardous ground');t.expect(m.maxStep<.25,label+' moves followers continuously');t.expect(m.settledSeparation>.85,label+' settles distinct companion bodies');};
 const ready=async label=>{const v=await view();t.expect(v.nearby&&v.ternNearby&&v.maraNearby,label+' restores all three technique ranges with unobstructed sight');t.expect([v.mira,v.tern,v.mara].every(e=>e.pose==='stand'),label+' settles every walking pose when the hero stops');};
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
 await t.press('Enter');await t.step(1.1);await t.teleport('Crossroads',6.5,5.5);
 await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();for(const e of h.entities)if(e.kind!=='player'&&e.kind!=='companion')e.remove();for(let z=1;z<s.h-1;z++)for(let x=1;x<s.w-1;x++)h.world.setTile(s.x0+x,s.z0+z,'.');for(let z=2;z<=7;z++)h.world.setTile(s.x0+7,s.z0+z,'#');for(const flag of['era:mira-travels','era:tern-travels','coast:mara-travels','era:voices-returned','era:copper-memory','coast:beacon-lit'])h.game.state.setFlag(flag);h.player.yaw=0;h.player.invT=999;});await t.step(.3);
 let m=await drive([[6.5,8.5],[8.5,8.5],[8.5,5.5]]);checkTravel(m,'The outside wall turn');await ready('The outside wall turn');await shot('01-around-the-wall');
 m=await drive([[8.5,8.5],[6.5,8.5],[6.5,5.5]]);checkTravel(m,'The return wall turn');await ready('The return wall turn');await shot('02-turning-back');
 await t.teleport('Crossroads',3.5,9.5);await t.step(.2);m=await drive([[12.5,9.5]]);checkTravel(m,'A straight traversal after teleport');await ready('A straight traversal after teleport');await shot('03-separated-travel');
 // Narrow corridor with three consecutive right-angle bends.
 await t.teleport('Crossroads',3.5,8.5);
 await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();for(const e of h.entities)if(e.kind!=='player'&&e.kind!=='companion')e.remove();for(let z=1;z<s.h-1;z++)for(let x=1;x<s.w-1;x++)h.world.setTile(s.x0+x,s.z0+z,'#');for(const [x,z]of[[3,7],[3,8],[3,9],[4,8],[5,8],[6,8],[7,8],[7,7],[7,6],[7,5],[7,4],[8,4],[9,4],[10,4],[11,4],[12,4],[12,5],[12,6],[12,7],[12,8],[12,9]])h.world.setTile(s.x0+x,s.z0+z,'.');h.player.yaw=0;});await t.step(.3);
 m=await drive([[7.5,8.5],[7.5,4.5],[12.5,4.5],[12.5,8.5]]);checkTravel(m,'The one-tile corridor');await ready('The one-tile corridor');await shot('04-one-tile-corridor');
 // Block the remembered route after walking begins; leave a real detour.
 await t.teleport('Crossroads',4.5,5.5);
 await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();for(let z=1;z<s.h-1;z++)for(let x=1;x<s.w-1;x++)h.world.setTile(s.x0+x,s.z0+z,'.');h.player.yaw=Math.PI/2;});await t.step(.3);
 await t.hold('ArrowRight',.7);
 await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+5,'#');});
 m=await drive([[11.5,5.5]]);checkTravel(m,'The newly blocked route');await ready('The newly blocked route');await shot('05-repaired-trail');
 const idle=await t.eval(async()=>{const h=window.__voxelHeroes,es=h.entities.filter(e=>e.kind==='companion'&&!e.removed),start=es.map(e=>[e.x,e.z]);await h.step(8);return es.map((e,i)=>({movement:Math.hypot(e.x-start[i][0],e.z-start[i][1]),pose:e.rig.pose()}));});
 t.expect(idle.every(e=>e.movement<.05&&e.pose==='stand'),'an idle party stays settled for eight seconds without shuffling');
 const saved=await t.save();await t.load(saved);await t.step(.4);t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length)===3,'save/load retains exactly one of each follower');
 await t.teleport('mossbrook-past:1,0',13.5,9.5);await t.step(.2);await t.hold('ArrowRight',.9);await t.step(1.3);
 t.expect((await t.state()).key==='mossbrook-past:2,0','the party follows a real outdoor room edge into the workshop');
 t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).every(e=>e.object.visible&&!window.__voxelHeroes.world.blocked(e.x,e.z,e.r,e))),'the workshop arrival keeps all three on safe ground');await shot('06-native-workshop-party');
 await t.eval(()=>window.__voxelHeroes.game.progress.startNewGame());await t.step(.2);t.expect(!(await view()).recruited&&!(await view()).ternRecruited&&!(await view()).maraRecruited,'a fresh adventure resets the travelling party');
}

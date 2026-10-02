export const description = 'Native Rootglass pollinator poses, committed dive, vulnerable sidestep, real contact and held guard, actual boomerang/pot/sword interrupts, ground-safe reach and freeze cancellation. Physical greenhouse entrance, two native sword kills, earned permanent heart piece, revisit and reload. Starter equipment, placements, one missing half-heart, bot emergency healing, isolated enemy and initial attack cooldown are fixtures. Freeze uses the damage API; the final twelve-second ground audit uses invulnerability. All audio muted.';

export default async function(t) {
  const start=()=>t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.game.swords.giveSword('blade-start');h.game.swords.equipSword('blade-start');h.game.inventory.giveItem('boomerang');h.game.inventory.selectItem('boomerang');h.setHp(h.state.maxHp-1);});
  const place=(x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);},[x,z,f]);
  const tile=(x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
  const photo=async n=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(n);};
  await start();await t.teleport('d2:2,1',8.5,9.5);await t.step(1.7);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='nursery-pollinator'&&!e.removed).length===2),'Mossbridge now uses two native leaf-and-brass pollinators');
  await photo('01-leaf-and-brass-mossbridge');
  await t.teleport('d2:1,1',2.5,6);await t.exit('west');
  t.expect(await t.eval(()=>window.__voxelHeroes.screen().key)==='d2:0,1','Actual westward travel reaches the optional greenhouse from Three Watchers');
  await t.step(1.6);t.expect(await tile(8,3)==='h'&&await tile(15,5)==='H','The greenhouse reward and exit wait for its two actual guards');await photo('02-pollinator-court');
  const fight=await t.fight({heal:2,seconds:90});t.note('Native courtyard fight: '+JSON.stringify(fight));
  t.expect(fight.kills===2,'Real sword combat defeats both authored greenhouse pollinators');
  t.expect(await tile(8,3)==='c'&&await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return [5,6].every(z=>!h.world.blocked(s.x0+15.5,s.z0+z+.5,.1,h.player));}), 'Actual victories reveal the heart chest and make both shutters traversable');
  const pieces=await t.eval(()=>window.__voxelHeroes.state.heartPieces);
  await photo('03-the-heart-they-kept');await t.step(.5);await t.walkTo(8.5,4.5);await t.stick(0,-1,.4);await t.step(.5);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.heartPieces)===pieces+1,'Walking into the physical chest earns exactly one permanent heart piece');
  await photo('04-heart-earned');await t.step(2);const saved=await t.save();await t.load(saved);await t.step(.3);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.state.heartPieces===1&&h.state.flags.has(`chest:${s.x0+8},${s.z0+3}`);})&&await tile(8,3)==='c','The earned piece and opened chest survive save/load');
  await t.exit('east');await t.exit('west');await t.step(1);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='enemy'&&!e.removed).length===0),'A return visit keeps the greenhouse cleared');
  await place(8.5,4.5);await t.stick(0,-1,.4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.heartPieces)===pieces+1,'Revisiting the chest cannot award a second piece');
  await start();await t.teleport('d2:0,1',9.5,7.5);await t.step(1.5);
  await t.eval(()=>{
    const h=window.__voxelHeroes;
    window.__pollen={make(x=6.5,z=7.5,hx=9.5,hz=7.5,f='west'){
      h.input.setStick(0,0);for(const a of ['sword','item','dash','guard'])h.input.up(a);
      for(const e of [...h.entities])if(['enemy','projectile','pickup'].includes(e.kind))e.remove();
      h.game.hero.hero.place(hx,hz);h.game.hero.hero.setFacing(f);h.setHp(h.state.maxHp-1);
      Object.assign(h.player,{invT:0,knockT:0,kx:0,kz:0,attackT:0,lockT:0,thrust:null,charge:null});h.player.stopDash();h.state.gear.shield=1;
      const e=h.spawn('nursery-pollinator',x,z);e.spawned=true;e.growT=1;e.holder.scale.setScalar(1);e.ai.pollinator.t=0;window.__pollen.e=e;
    }};
  });
  const make=(args=[])=>t.eval(args=>window.__pollen.make(...args),args);
  const aim=()=>t.eval(async()=>{const h=window.__voxelHeroes,e=window.__pollen.e;for(let i=0;i<60&&e.ai.pollinator.phase!=='tell';i++)await h.tick();return e.ai.pollinator.phase==='tell';});
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,e=window.__pollen.e,s=h.screen();return {ai:{...e.ai.pollinator},cue:e.cue.visible,pose:e.mesh.pose,harmless:e.harmless,stun:e.stunT,enemyHp:e.hp,hp:h.state.hp,x:e.x-s.x0,z:e.z-s.z0,hero:{x:h.player.x-s.x0,z:h.player.z-s.z0},height:e.mesh.position.y};});
  await make();t.expect(await aim(),'Natural targeting starts the raised-wing warning');let v=await view(),hp=v.hp,x=v.x;
  t.expect(v.cue&&v.pose==='tell'&&v.ai.t>.8&&v.harmless&&v.ai.dives===0,'The leaf wings and pink marks warn before any contact damage');await photo('05-raised-leaf-warning');
  await t.stick(0,-1,.3);v=await view();t.expect(v.hero.z<6.5&&v.ai.dx===1&&v.ai.dz===0,'Actual vulnerable movement sidesteps without changing the committed aim');
  await t.step(.57);v=await view();t.expect(v.ai.phase==='dive'&&v.ai.dives===1&&v.x>=x&&v.x<x+.2&&!v.cue,'The full warning expires before a single straight dive begins');
  await t.step(.7);v=await view();t.expect(v.ai.phase==='rest'&&v.pose==='rest'&&v.height<.05&&v.harmless,'The missed dive lands in a low, harmless counterattack pose');
  t.expect(v.hp===hp&&Math.abs(v.z-7.5)<.01&&v.x>x+3,'The original row stays committed and the real sidestep avoids contact');await photo('06-resting-after-the-dive');
  await place(v.x-1.4,v.z,'east');await t.tap('sword');await t.step(.17);v=await view();t.expect(v.enemyHp===6,'Actual starter blade contact punishes the resting body');
  await make();await aim();await t.step(1.6);v=await view();t.expect(v.hp===hp-2,'Ignoring the warning takes two ordinary contact damage');
  await make();await t.eval(()=>window.__voxelHeroes.input.down('guard'));await aim();await t.step(1.6);v=await view();
  t.expect(v.hp===hp&&v.ai.phase==='rest','Native held starter guard blocks the dive and cancels further motion');await t.eval(()=>window.__voxelHeroes.input.up('guard'));
  await make();await aim();await t.tap('item');await t.step(.3);v=await view();
  t.expect(v.enemyHp===9&&v.stun>1.5&&!v.cue&&v.ai.phase==='rest','The actual zero-damage boomerang interrupts the warning');await photo('07-returning-wood-interrupt');await t.step(1);t.expect((await view()).ai.dives===0,'The interrupted warning never resumes its old dive');
  await make([6.5,7.5,8,7.5]);await aim();await t.tap('sword');await t.step(.17);v=await view();t.expect(v.enemyHp===6&&v.ai.phase==='rest'&&!v.cue,'An actual close blade strike interrupts before takeoff');
  await make();await place(11.5,8.5,'east');await t.tap('sword');t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'The authored greenhouse pot lifts through the normal sword button');
  await place(9.5,7.5,'west');await t.eval(()=>{window.__pollen.e.ai.pollinator.t=0;});await aim();await t.tap('sword');await t.step(.4);v=await view();
  t.expect(v.enemyHp===5&&v.ai.phase==='rest'&&!v.cue,'The real thrown clay deals four damage and interrupts the dive');await photo('08-clay-in-the-greenhouse');
  for(const [label,x,z,hx,hz,f]of[['east',6.5,7.5,9.5,7.5,'west'],['west',9.5,7.5,6.5,7.5,'east'],['north',6.5,7.5,6.5,4.5,'south'],['south',9.5,3.5,9.5,6.5,'north'],['diagonal',5.5,6.5,8.5,8.5,'west']]){
    await make([x,z,hx,hz,f]);t.expect(await aim(),`${label} warning can acquire over clear ground`);
    const cue=await t.eval(()=>{const h=window.__voxelHeroes,e=window.__pollen.e,a=e.ai.pollinator;e.object.updateMatrixWorld(true);return e.cue.children.filter(m=>m.visible).map(m=>{const p=m.getWorldPosition(m.position.clone());return {side:Math.abs((p.x-e.x)*a.dz-(p.z-e.z)*a.dx),blocked:h.world.blocked(p.x,p.z,.05,e)};});});
    t.expect(cue.length>0&&cue.every(m=>m.side<=.49&&!m.blocked),`${label} cue follows the exact committed world direction and keeps clear of cover`);
  }
  await make([6.5,5.5,2.5,5.5]);await t.step(.3);t.expect((await view()).ai.phase==='hover'&&!(await view()).cue,'A root pillar prevents acquiring a dive through solid cover');
  await make();await aim();await t.eval(()=>{const h=window.__voxelHeroes,e=window.__pollen.e;h.game.damage.freezeAt(e.x,e.z,1,1);});await t.step(.1);t.expect((await view()).ai.phase==='rest'&&!(await view()).cue,'Freeze cancels the pending dive');
  await t.step(1.8);t.expect((await view()).ai.dives===0,'Thawing does not release the old warning');
  await t.teleport('d2:2,1',8.5,9.5);await t.step(1.5);
  const ground=await t.eval(async()=>{const h=window.__voxelHeroes;h.player.invT=999;const unsafe=[];let samples=0;for(let i=0;i<60;i++){await h.step(.2);for(const e of h.entities.filter(e=>e.type==='nursery-pollinator'&&!e.removed)){samples++;if(h.world.tileDefAt(Math.floor(e.x),Math.floor(e.z))?.name==='pit')unsafe.push({x:e.x,z:e.z,phase:e.ai.pollinator.phase});}}return {samples,unsafe};});
  t.expect(ground.samples===120&&ground.unsafe.length===0,'Both native Mossbridge pollinators stay above walkable ground for twelve seconds: '+JSON.stringify(ground));
  await photo('09-return-to-mossbridge');
}

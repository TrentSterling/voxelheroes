export const description='Isolated Coilmaw arena: native committed charge warning, sidestep, recovery and volley separation; exposed-head interruption. Teleport, campaign progress, starting equipment, hero placement and removing body parts for the head-contract case are disclosed fixtures. No damage or invulnerability edits in the charge sidestep. Actual sword input interrupts the exposed head. Browser audio muted.';

export default async function(t) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');});
  await t.give('blade-start');await t.give('shield-1');await t.track('player-hurt','enemy-interrupted');
  t.expect(await t.eval(()=>window.__voxelHeroes.state.gear.shield===1),'the isolated arena equips the registered starter shield');
  await t.teleport('d1-boss',11,13.5);await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});
  let v=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),b=h.entities.find(e=>e.type==='boss-serpent');return{segments:b.segments.length,inside:b.segments.every(e=>e.x-e.r>=s.x0+1&&e.x+e.r<=s.x1-1&&e.z-e.r>=s.z0+1&&e.z+e.r<=s.z1-1)};});
  t.expect(v.segments===6&&v.inside,'all six initial coils fit inside the playable arena rather than starting through the north wall');
  await t.waitFor(s=>s.mode==='play',{seconds:6});
  const awaitTell=()=>t.eval(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent');for(let i=0;i<600&&!b.ai.pendingLunge;i++)await h.tick();return{pending:b.ai.pendingLunge,t:b.ai.tellT,heading:b.heading,x:b.x,z:b.z};});
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent');return{hp:h.state.hp,invT:h.player.invT,x:b.x,z:b.z,heading:b.heading,t:b.ai.tellT,pending:b.ai.pendingLunge,dash:b.lungeUntil,rest:b.recoverT,harmless:b.harmless,cue:b.chargeCue.visible,marks:b.chargeCue.children.filter(m=>m.visible).length,volley:b.volleyT,shots:h.entities.filter(e=>!e.removed&&e.type==='serpent-shot').length};});
  const warning=await awaitTell();v=await view();
  t.expect(warning.pending&&warning.t>=.7&&v.cue&&v.marks>0,'a coral ground lane is visible for at least seven tenths of a second before the committed dash');
  const direction=await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent'),s=h.screen(),dx=Math.cos(b.heading),dz=Math.sin(b.heading);for(const side of[-1,1]){const x=b.x+dx*2.6,z=b.z+dz*2.6,ex=x-dz*side*1.8,ez=z+dx*side*1.8;if(!h.world.blocked(x,z,h.player.r,h.player)&&!h.world.blocked(ex,ez,h.player.r,h.player)){h.game.hero.hero.place(x-s.x0,z-s.z0);return{x:-dz*side,z:dx*side};}}return null;});
  t.expect(!!direction,'the authored arena leaves a walkable side of the committed charge lane');await t.step(1/60);await t.shot('01-coral-charge-lane');
  await t.stick(direction.x,direction.z,.4);v=await view();
  t.expect(Math.hypot(v.x-warning.x,v.z-warning.z)<.001&&v.t>0,'the boss holds its position while actual native movement sidesteps its warning');
  t.expect(v.heading===warning.heading&&v.hp===6&&v.invT===0,'the committed heading stays fixed and native sidestep has no test invulnerability');
  await t.eval(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent');for(let i=0;i<180&&!(b.recoverT>0);i++)await h.tick();});v=await view();
  t.expect(v.rest>=.6&&v.dash===0&&!v.cue&&v.harmless,'the completed dash hides its lane and gives a readable harmless-head recovery');
  t.expect(v.hp===6&&(await t.events('player-hurt')).length===0,'actual sideways movement evades the committed charge without health edits');
  const recovery=v;await t.step(.35);v=await view();
  t.expect(Math.hypot(v.x-recovery.x,v.z-recovery.z)<.001&&v.rest>0,'the head really holds still through the recovery beat');
  t.expect(v.volley===recovery.volley&&v.shots===recovery.shots,'the volley clock does not fire over charge recovery');await t.shot('02-quiet-coil-recovery');
  await t.step(.55);v=await view();t.expect(v.rest===0&&!v.harmless&&Math.hypot(v.x-recovery.x,v.z-recovery.z)>.05,'ordinary circling resumes after the finite recovery');

  // Removing six parts isolates the exposed-head interrupt, not a native victory.
  await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-serpent');for(const e of b.segments.splice(0))e.remove();});
  await awaitTell();
  const aim=await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent'),s=h.screen();for(const[x,z,face]of[[0,1.65,'north'],[0,-1.65,'south'],[1.65,0,'west'],[-1.65,0,'east']])if(!h.world.blocked(b.x+x,b.z+z,h.player.r,h.player)){h.game.hero.hero.place(b.x+x-s.x0,b.z+z-s.z0);h.game.hero.hero.setFacing(face);return{hp:b.hp};}return null;});
  t.expect(!!aim,'the exposed head has a reachable ordinary sword approach');await t.tap('sword');await t.step(.1);
  v=await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-serpent');return{hp:b.hp,pending:b.ai.pendingLunge,dash:b.lungeUntil,cue:b.chargeCue.visible,stagger:b.knockT>0||b.stunT>0};});
  t.expect(v.hp<aim.hp&&!v.pending&&v.dash===0&&!v.cue&&v.stagger,'an actual sword hit damages the exposed head and cancels its pending charge');
  const interrupts=await t.events('enemy-interrupted');t.note('Actual exposed-head interruption: '+JSON.stringify(interrupts));
  t.expect(interrupts.some(e=>e.entity==='boss-serpent'&&['sword','spin','beam'].includes(e.source)&&e.phase==='charge'),'actual sword input emits a charge interrupt from its swipe, spin or full-health beam');await t.shot('03-native-head-interrupt');
}

export const description = 'Muted real sword/arrow shell guards, grapple interruption, fire opening, pot crack, natural marked rush and dodge/crash punish, two actual skater kills, physical Ember Lens cache and reload. Equipment, positions, reset HP/AI and removal of unrelated drops are fixtures; attacks and charge timers use the game input pipeline.';
export default async function(t) {
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='tideglass-skater'&&!e.removed);return{hp:h.state.hp,foe:e?{hp:e.hp,...e.ai.tide,stun:e.stunT,cue:e.cue.visible,pose:e.mesh.pose,x:e.x-s.x0,z:e.z-s.z0}:null,foes:h.entities.filter(e=>e.type==='tideglass-skater'&&!e.removed).length,chest:h.world.tile(s.x0+8,s.z0+3),lens:h.game.inventory.hasItem('ember-lens'),mode:h.state.mode};});
  const place=(x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);},[x,z,f]);
  const shot=async n=>{await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(n);};
  const reset=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='tideglass-skater');for(const p of [...h.entities])if(p.kind==='projectile'||p.kind==='pickup')p.remove();e.x=s.x0+5.5;e.z=s.z0+5.5;e.yaw=0;e.holder.rotation.y=0;e.hp=18;e.stunT=e.knockT=e.kx=e.kz=0;e.hitSwing=-1;e.flashT=e.squashT=0;e.mat.emissive.setHex(0);e.ai.tide={phase:'hunt',t:999,dx:0,dz:1,openT:0,charges:0};e.think=()=>{};e.harmless=true;e.present();h.player.invT=999;h.setHp(h.state.maxHp);});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
  for(const id of ['fire-wand','grapple','bow'])await t.give(id);await t.teleport('d4:0,7',5.5,9.5);await t.step(1.6);
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),es=h.entities.filter(e=>e.type==='tideglass-skater');window.__tideThink=es[0].think;es[1].x=s.x0+13.5;es[1].z=s.z0+8.5;es[1].think=()=>{};es[1].harmless=true;});await reset();
  t.expect((await view()).foes===2&&(await view()).chest==='h','Two living skaters guard the hidden kiln cache');await shot('01-kiln-ice-shells');
  await place(5.5,7);await t.tap('sword');await t.step(.45);t.expect((await view()).foe.hp===18,'Actual sword and full-health beam cannot damage the closed shell');
  await place(5.5,4,'south');await t.tap('sword');await t.step(.45);t.expect((await view()).foe.hp===18,'The shell also blocks an actual rear sword strike');
  await place(5.5,8.5);await t.eval(()=>window.__voxelHeroes.game.inventory.selectItem('bow'));await t.tap('item');await t.step(.35);t.expect((await view()).foe.hp===18,'Actual arrows cannot break the ice shell');
  await t.step(.5);await t.eval(()=>{const h=window.__voxelHeroes;for(const p of [...h.entities])if(p.kind==='pickup')p.remove();h.game.inventory.selectItem('grapple');});await t.tap('item');await t.step(.35);let v=await view();
  t.expect(v.foe.hp===18&&v.foe.openT===0&&v.foe.stun>.5,'The real grapple interrupts for zero damage without melting the shell');await place(5.5,7);await t.tap('sword');await t.step(.35);t.expect((await view()).foe.hp===18,'A grapple stun alone cannot bypass the closed shell');
  await reset();await place(5.5,8.5);await t.eval(()=>window.__voxelHeroes.game.inventory.selectItem('fire-wand'));await t.tap('item');await t.step(.4);v=await view();
  t.expect(v.foe.hp===12&&v.foe.openT>4.6&&v.foe.pose==='open'&&!v.foe.cue,'A real fire bolt deals six damage and opens the shell for five seconds');await shot('02-fire-opens-shell');
  await place(5.5,7);await t.tap('sword');await t.step(.4);t.expect((await view()).foe?.hp<12,'Actual sword input punishes the fire-opened shell');await t.step(5);t.expect((await view()).foe.openT===0,'The fire opening expires even while the enemy is stunned');
  await reset();await place(4.5,8.5,'west');await t.tap('sword');t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'The physical kiln pot can be lifted with actual input');await place(5.5,7.5);await t.tap('sword');await t.step(.35);v=await view();
  t.expect(v.foe.hp<18&&v.foe.openT>2&&v.foe.pose==='open','The thrown pot cracks the shell and exposes another punish window');await shot('03-pot-cracks-shell');
  await reset();await place(5.5,9.5);await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='tideglass-skater');e.think=window.__tideThink;e.ai.tide.t=0;h.player.invT=0;});await t.step(.05);v=await view();
  t.expect(v.foe.phase==='tell'&&v.foe.cue&&v.foe.charges===0,'The natural attack marks a committed sliding lane before moving');await shot('04-marked-slide');const hp=v.hp;
  await t.stick(1,0,.45);await t.step(.55);v=await view();t.expect(v.foe.phase==='rush'&&v.foe.charges===1&&!v.foe.cue&&Math.abs(v.foe.x-5.5)<.1,'The actual rush follows its original lane after the hero sidesteps');await shot('05-committed-rush');
  await t.step(.65);v=await view();t.expect(v.hp===hp&&v.foe.phase==='crash'&&v.foe.openT>0&&v.foe.pose==='open','Dodging the rush preserves health and exposes the crash recovery');await shot('06-crash-opening');
  await place(v.foe.x,v.foe.z-1.4,'south');await t.tap('sword');await t.step(.4);t.expect((await view()).foe.hp<18,'A real sword punish works after a missed charge without using fire');
  await reset();await place(5.5,9.5);await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='tideglass-skater');e.think=window.__tideThink;e.ai.tide.t=0;});await t.step(.05);await t.tap('item');await t.step(.4);v=await view();t.expect(v.foe.phase==='crash'&&v.foe.charges===0&&v.foe.openT>4.5&&!v.foe.cue,'Fire during the natural tell cancels the pending charge');
  await reset();
  for(let i=0;i<2;i++){
    const p=await view();await place(p.foe.x,p.foe.z+2.5);await t.tap('item');await t.step(.4);await place(p.foe.x,p.foe.z+1.5);
    for(let k=0;k<7&&(await view()).foes===2-i;k++){await t.tap('sword');await t.step(.45);}
  }
  v=await view();t.expect(v.foes===0&&v.chest==='c'&&!v.lens,'Actual fire-and-sword kills reveal the optional lens cache');await shot('07-earned-lens-cache');
  await place(8.5,4.5);await t.stick(0,-1,.4);await t.step(.2);t.expect((await view()).lens,'The physical chest grants the permanent Ember Lens');await shot('08-ember-lens-prize');
  await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  t.expect(!await t.eval(()=>window.__voxelHeroes.game.inventory.selectItem('ember-lens')),'The lens remains passive and does not consume the action slot');const save=await t.save();await t.load(save);await t.step(.4);v=await view();
  t.expect(v.lens&&v.foes===0&&v.chest==='c','Save/load retains the lens and both defeated one-time skaters');await place(8.5,4.5);await t.stick(0,-1,.4);t.expect((await view()).mode==='play','Reopening the cache cannot replay its prize');
}

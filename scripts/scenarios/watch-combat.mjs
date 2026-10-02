export const description = 'Muted real sword guards/flanks, grapple armor opening, physical pottery interruption, committed volley dodge and shield block, natural recovery, earned optional Sun Dial, save/load and one-time reward. Earlier milestones, hero/enemy positions, stationary guard phases and removed unrelated pickups are disclosed fixtures; attacks and the timed volley use actual inputs.';
export default async function(t) {
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='watch-sentinel'&&!e.removed);return{hp:h.state.hp,foe:e?{hp:e.hp,...e.ai.watch,stun:e.stunT,cue:e.cue.visible,pose:e.mesh.pose}:null,shots:h.entities.filter(e=>e.type==='watch-bolt'&&!e.removed).length,chest:h.world.tile(s.x0+8,s.z0+3),dial:h.game.inventory.hasItem('sun-dial'),mode:h.state.mode};});
  const place=(x,z,facing='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);},[x,z,facing]);
  const photo=async name=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  const settle=()=>t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}await h.step(.4);});
  const reset=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='watch-sentinel');for(const p of h.entities)if(p.kind==='projectile'||p.kind==='pickup')p.remove();e.x=s.x0+5.5;e.z=s.z0+4.5;e.yaw=0;e.holder.rotation.y=0;e.hp=18;e.stunT=e.knockT=0;e.kx=e.kz=0;e.hitSwing=-1;e.ai.watch={phase:'hunt',t:999,dx:0,dz:1,openT:0,volleys:0};e.think=()=>{};e.harmless=true;e.present();h.player.invT=999;h.setHp(h.state.maxHp);});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');for(const id of['d1','d2']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}h.player.invT=999;});
  await t.give('grapple');await t.teleport('d3:1,7',5.5,8.5);await t.step(1.6);
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.type==='skeleton')h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:h.player});window.__watchThink=h.entities.find(e=>e.type==='watch-sentinel').think;});await reset();
  t.expect((await view()).chest==='h'&&!(await view()).dial,'The chain extender waits behind the living sentry');
  await place(5.5,6);await t.tap('sword');await t.step(.45);
  t.expect((await view()).foe.hp===18,'Actual sword input cannot damage closed frontal shutters');await photo('01-brass-shutters');
  await place(5.5,7.5);await t.eval(()=>window.__voxelHeroes.game.inventory.selectItem('grapple'));await t.tap('item');await t.step(.25);
  let v=await view();t.expect(v.foe.hp===18&&v.foe.openT>3.7&&v.foe.stun>.7&&!v.foe.cue,'The actual zero-damage hook retracts armor for four seconds and interrupts attacks');await t.step(.2);await photo('02-hook-opens-lens');
  await place(5.5,6);await t.tap('sword');await t.step(.45);v=await view();t.expect(v.foe&&v.foe.hp<18,'A real frontal sword strike damages the hook-exposed lens');
  await t.step(4.5);t.expect((await view()).foe.openT===0,'The armor opening expires while the enemy is stunned or recovering');
  await reset();await place(5.5,3,'south');await t.tap('sword');await t.step(.45);t.expect((await view()).foe.hp<18,'Actual sword input also rewards a flank without requiring the hook');
  await reset();await place(5.5,8.5,'west');await t.tap('sword');t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'Actual sword-button input lifts the room pot');
  await place(5.5,6.5);await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='watch-sentinel');e.ai.watch.phase='tell';e.ai.watch.t=.9;e.ai.watch.dx=0;e.ai.watch.dz=1;e.present();});await t.tap('sword');await t.step(.35);v=await view();
  t.expect(v.foe&&v.foe.hp<18&&v.foe.openT>1.5&&v.foe.phase==='recover'&&v.shots===0,'A real thrown pot opens the armor and cancels a pending volley');await photo('03-pot-interrupts');
  await reset();await place(5.5,8.5);await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='watch-sentinel');e.think=window.__watchThink;e.ai.watch.t=0;h.player.invT=0;});await t.step(.05);v=await view();
  t.expect(v.foe.phase==='tell'&&v.foe.cue&&v.foe.volleys===0,'The actual attack clock displays three committed lanes before shooting');await photo('04-three-lane-warning');
  const hp=v.hp;await t.stick(1,0,.4);await t.step(.6);v=await view();t.expect(v.foe.volleys===1&&v.shots===3&&v.foe.phase==='recover'&&!v.foe.cue,'A real timed volley emits exactly three shieldable bolts and exposes the sentry');await photo('05-committed-volley');
  await t.step(1);t.expect((await view()).hp===hp,'Actual sideways movement evades the committed volley');await t.step(.5);t.expect((await view()).foe.phase==='hunt'&&(await view()).foe.pose==='closed','The natural recovery ends with closed armor and a new approach phase');
  await reset();await place(5.5,8.5);await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='watch-sentinel');e.think=window.__watchThink;e.ai.watch.t=0;h.state.gear.shield=2;h.player.invT=0;h.input.down('guard');});await t.step(1.7);
  t.expect((await view()).hp===hp,'A real held tier-two shield blocks the sentry volley');await t.eval(()=>window.__voxelHeroes.input.up('guard'));
  await reset();await place(5.5,7.5);await t.step(.6);await t.tap('item');await t.step(.3);t.expect((await view()).foe.openT>3.5,'The final real hook leaves a punish window before the winning swords');await place(5.5,6);
  for(let i=0;i<6&&(await view()).foe;i++){await t.tap('sword');await t.step(.45);}
  v=await view();t.expect(!v.foe&&v.chest==='c'&&!v.dial,'Real hook-and-sword fighting reveals the optional cache after the last guard dies');await photo('06-earned-cache');
  await place(8.5,4.5);await t.stick(0,-1,.4);await t.step(.2);t.expect((await view()).dial,'Opening the physical chest grants the passive Sun Dial');await photo('07-sun-dial-prize');await settle();
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.selectItem('sun-dial')===false),'The extender is passive rather than consuming an item-button slot');
  const saved=await t.save();await t.load(saved);await t.step(.5);v=await view();t.expect(v.dial&&!v.foe&&v.chest==='c','Save/load retains the extender, revealed chest and defeated one-time guards');
  await place(8.5,4.5);await t.stick(0,-1,.4);t.expect((await view()).mode==='play'&&(await view()).dial,'An opened cache cannot replay its reward or item-get screen');
}

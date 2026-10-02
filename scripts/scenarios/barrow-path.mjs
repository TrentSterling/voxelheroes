export const description='Muted first-dungeon floor, turning block and rest contracts. Native east/north pushes, solo partial-room reset, one-time key, solved save/load and hourstone A input. Fresh progress, placements, health/magic levels, floor tiles, harmless fixture guards and damage-API clearing are disclosed fixtures; the separate barrow-journey covers the native combat route.';

export default async function(t) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');});
  const tile=(x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
  const solved=()=>t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d1:puzzle:I-3'));
  const turn=async()=>{await t.walkTo(4.5,7.5);await t.stick(1,0,2.8);};
  await t.teleport('d1:2,8',13.5,6.5);await t.step(.8);await t.track('block-pushed');
  await turn();t.expect(await tile(8,7)==='Q'&&!await solved(),'east pushing reaches the statue stop without solving the plate');
  await t.shot('01-at-copper-turn');await t.exit('east');await t.exit('west');
  t.expect(await tile(5,7)==='Q'&&await tile(8,7)==='-'&&!await solved(),'leaving an unfinished solo puzzle resets the block and restores its copper floor');
  const before=(await t.events('block-pushed')).length;await turn();await t.walkTo(8.5,8.5);await t.stick(0,-1,1.8);
  t.expect(await solved()&&await tile(8,5)==='Q'&&await tile(8,6)==='-','east then north pushes park the block on its plate and retain copper behind it');
  t.expect((await t.events('block-pushed')).length-before===5,'the complete native solution is exactly three east pushes and two north pushes');
  await t.walkTo(8,8);await t.step(.3);const keys=await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d1'));
  t.expect(keys===1,'walking over the earned puzzle drop collects one small key');await t.shot('02-turn-complete');
  const save=await t.save();await t.load(save);await t.step(.3);
  t.expect(await solved()&&await tile(8,5)==='Q'&&await tile(8,6)==='-','save/load retains the solved block and the copper floor');
  await t.exit('east');await t.exit('west');await t.walkTo(8.5,6.5);await t.stick(0,-1,1);
  t.expect(await tile(8,5)==='Q'&&await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d1'))===keys,'revisiting and pushing the solved block cannot move it or duplicate its key');
  await t.teleport('d1:3,3',4.5,8.45);await t.step(.6);
  const pushOne=(from)=>t.eval(async from=>{const h=window.__voxelHeroes,s=h.screen();h.input.setStick(1,0);try{for(let i=0;i<120&&h.world.tile(s.x0+from,s.z0+6)==='Q';i++)await h.tick();}finally{h.input.setStick(0,0);}await h.tick();},from);
  for(const ch of ['e','o','p','u','+','=',':',';',',','-']) {
    await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'Q');h.world.setTile(s.x0+6,s.z0+6,ch);h.world.setTile(s.x0+7,s.z0+6,':');h.game.hero.hero.place(4.5,6.5);},ch);
    await pushOne(5);t.expect(await tile(6,6)==='Q','native push accepts '+ch+' decorative floor');
    await t.eval(()=>window.__voxelHeroes.game.hero.hero.place(5.5,6.5));await pushOne(6);
    t.expect(await tile(7,6)==='Q'&&await tile(6,6)==='.', 'pushing onward restores the original floor under '+ch+' fixture');
  }
  for(const ch of ['O','m','i','f']) {
    await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'Q');h.world.setTile(s.x0+6,s.z0+6,ch);h.game.hero.hero.place(4.5,6.5);},ch);
    await t.stick(1,0,.85);t.expect(await tile(5,6)==='Q','pushable decorative floors do not allow a block into '+ch);
  }
  await t.teleport('d1:4,6',3.5,6.45);await t.step(.8);
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(3.5,6.45);h.game.hero.hero.setFacing('north');h.setHp(2);h.game.vitals.setMagic(0);for(const e of h.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;} });
  const purse=(await t.state()).gems;await t.tap('sword');
  t.expect((await t.state()).hp===2&&await t.eval(()=>window.__voxelHeroes.state.magic)===0,'actual rest input cannot heal through the living room guardians');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.toast.toastView().text==='Defeat the room guards.'),'the guarded hourstone gives a complete concise reason');await t.shot('03-guarded-hourstone');
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}});});await t.step(.4);
  await t.tap('sword');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.hp===h.state.maxHp&&h.state.magic===h.state.maxMagic;}),'actual A restores current hearts and magic after the room clear');
  t.expect((await t.state()).gems===purse,'resting costs no coins and grants no coin reward');
  const caps=await t.eval(()=>({hp:window.__voxelHeroes.state.maxHp,magic:window.__voxelHeroes.state.maxMagic}));
  await t.tap('sword');t.expect(await t.eval(c=>{const h=window.__voxelHeroes;return h.state.hp===c.hp&&h.state.maxHp===c.hp&&h.state.magic===c.magic&&h.state.maxMagic===c.magic;},caps),'repeated hourstone input cannot exceed either capacity or raise permanent stats');await t.shot('04-restored-hourstone');
  await t.teleport('d1:3,3',4.5,8.45);await t.step(.4);await t.eval(()=>{const h=window.__voxelHeroes;h.setHp(1);h.game.vitals.setMagic(0);h.game.hero.hero.setFacing('north');});await t.tap('sword');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.hp===h.state.maxHp&&h.state.magic===h.state.maxMagic;}),'the antechamber has its own reachable native rest before the boss');await t.shot('05-boss-hourstone');
}

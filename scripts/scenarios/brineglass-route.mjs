export const description = 'Muted actual one/two-block fire melt, wall/bowl boundaries, physical coastal beacon, future memorial vault, one-time magic reward, tracked quest stages and save/load. All 26 temple rooms, boss court and eight coastal screens captured; actual push tests on all twelve local floor types. Equipment, positions, enemy restraint and tile reset fixtures disclosed.';
export default async function(t) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;h.game.objective.trackQuest('shore-light');});await t.give('fire-wand');
  const place=(x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);h.game.inventory.selectItem('fire-wand');h.player.invT=999;},[x,z,f]);
  const tile=(x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
  const shot=async name=>{await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(name);};
  const settle=()=>t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}await h.step(.4);});
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.currentStep().id==='shore-light:kiln'),'Tracking the new journal adventure points to the optional upper kiln');
  await t.teleport('d4:3,3',8.5,8.5);await place(8.5,8.5);await t.tap('item');await t.step(.5);t.expect(await tile(8,6)==='.'&&await tile(8,5)===':'&&await tile(8,4)===':','One base-wand shot melts exactly one block');await shot('01-one-block-thaw');
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+8,s.z0+6,':');});await t.give('ember-lens');await place(8.5,8.5);await t.tap('item');await t.step(.5);t.expect(await tile(8,6)==='.'&&await tile(8,5)==='.'&&await tile(8,4)===':','One upgraded-wand shot melts exactly two consecutive blocks');await shot('02-two-block-thaw');
  await t.teleport('d4:3,1',3.5,6);await place(3.5,6);await t.tap('item');await t.step(.5);t.expect(await tile(3,3)==='F'&&await tile(12,3)==='f','The lens still lights one bowl without passing through solid fixtures');
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+5,'W');h.world.setTile(s.x0+5,s.z0+4,':');});await place(5.5,8);await t.tap('item');await t.step(.7);t.expect(await tile(5,4)===':','The upgraded bolt cannot pass through an ordinary wall');
  await t.teleport('tidecoast:0,1',8.5,13);await t.exit('south');t.expect((await t.state()).key==='tidecoast:0,2','Actual southward walking discovers the new shore beacon');await shot('03-cold-shore-beacon');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.currentStep().id==='shore-light:beacon'),'The lens advances tracked guidance to the shore');
  await place(8.5,10.5);await t.tap('item');await t.step(.6);t.expect(await tile(8,8)==='.'&&await tile(8,7)==='.'&&await tile(8,5)==='{','One upgraded bolt clears the paired ice without lighting the distant beacon');
  await t.step(.5);await t.tap('item');await t.step(.6);t.expect(await tile(8,5)==='}'&&await t.eval(()=>window.__voxelHeroes.state.flags.has('coast:beacon-lit')),'Actual fire into the beacon lights the saved shore machine');await shot('04-warm-shore-beacon');
  t.expect(await t.eval(()=>/Silent Year/.test(window.__voxelHeroes.game.objective.objectiveText())),'The lit beacon points through the hourgate to the future memorial');
  await t.exit('east');t.expect((await t.state()).key==='tidecoast:1,2','The optional beacon has a usable east exit to Pilgrim Strand');await t.exit('west');t.expect((await t.state()).key==='tidecoast:0,2','Pilgrim Strand connects back to the beacon');
  await t.teleport('mossbrook-future:0,0',13.5,13.5);await t.step(.2);t.expect(await tile(12,12)==='}'&&await tile(13,12)==='C','The present shore light warms the future memorial and opens its vault');await shot('05-future-memorial');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.currentStep().id==='shore-light:memory'),'Future guidance points to the nearby memorial vault');const magic=await t.eval(()=>window.__voxelHeroes.state.maxMagic);await place(13.5,13.5);await t.stick(0,-1,.4);await t.step(.2);
  t.expect(await t.eval(m=>{const h=window.__voxelHeroes;return h.state.maxMagic===m+1&&h.state.flags.has('coast:beacon-memory');},magic),'Opening the physical future vault awards one permanent magic gem');await shot('06-keeper-memory-prize');await settle();
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()===null),'Completing the shared adventure releases its personal journal pin');const save=await t.save();await t.load(save);await t.step(.3);await place(13.5,13.5);await t.stick(0,-1,.4);
  t.expect(await t.eval(m=>window.__voxelHeroes.state.maxMagic===m+1&&window.__voxelHeroes.state.mode==='play',magic),'Reload and reopening cannot repeat the permanent memory reward');
  const rooms=await t.eval(()=>[...window.__voxelHeroes.world.screens.values()].filter(s=>s.area.id==='d4').map(s=>({key:s.key,name:s.name})));t.expect(rooms.length===26,'The temple includes 25 campaign rooms and the optional kiln');
  for(const[i,s]of rooms.entries()){
    await t.teleport(s.key,8,9.5);await t.step(1.5);await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};});
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),floors=['e','a','j','u','o','p','b','i','k','d','q','m'];return s.tileset==='brineglass'&&new Set(s.tiles.flat().filter(c=>floors.includes(c))).size>=4&&s.tiles.every((r,z)=>r.every((c,x)=>!floors.includes(c)||h.world.tileDefAt(s.x0+x,s.z0+z).pushableFloor&&!h.world.tileDefAt(s.x0+x,s.z0+z).solid));}),s.name+' has varied walkable brineglass floors');
    await shot(String(i+7).padStart(2,'0')+'-'+s.name.toLowerCase().replaceAll(' ','-'));
  }
  await t.teleport('d4-boss:0,0',11,13.5);await t.step(3);await shot('33-undertow-court');
  const coast=await t.eval(()=>[...window.__voxelHeroes.world.screens.values()].filter(s=>s.area.id==='tidecoast').map(s=>({key:s.key,name:s.name})));t.expect(coast.length===8,'Brineglass Coast includes its seven routes and the new keeper beacon');
  for(const[i,s]of coast.entries()){await t.teleport(s.key,5.5,10.5);await t.step(1);await t.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy')e.think=()=>{};});await shot(String(i+34)+'-'+s.name.toLowerCase().replaceAll(' ','-'));}
  await t.teleport('d4:0,2',4.5,6.5);
  for(const ch of['e','a','j','u','o','p','b','i','k','d','q','m']){
    await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'Q');h.world.setTile(s.x0+6,s.z0+6,ch);h.game.hero.hero.place(4.5,6.5);},ch);
    await t.eval(async()=>{const h=window.__voxelHeroes,s=h.screen();h.input.setStick(1,0);try{for(let i=0;i<120&&h.world.tile(s.x0+5,s.z0+6)==='Q';i++)await h.tick();}finally{h.input.setStick(0,0);}});
    t.expect(await tile(6,6)==='Q','Real counterweight blocks can be pushed over '+ch+' flooring');await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+6,s.z0+6,s.base[6][6]);});
  }
}

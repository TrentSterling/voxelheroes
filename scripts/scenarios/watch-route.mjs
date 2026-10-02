export const description='Muted actual six/eight-tile grapple shots, optional Sunken Meridian traversal and return, one-time heart reward, reward save/load, all 22 Watch rooms plus the court and seven Sunreach screens. Position and invulnerability fixtures disclose coverage; hooks, walking, chest opening and decorative-floor pushes use actual inputs.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});await t.give('grapple');
  const photo=async name=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  const hook=async(x,z,facing)=>{await t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);h.game.inventory.selectItem('grapple');h.player.invT=999;},[x,z,facing]);await t.tap('item');await t.step(.1);const range=await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='grapple-hook'&&!e.removed)?.range);await t.step(1.4);return{range,...await t.state()};};
  await t.teleport('sunreach:2,2',8.5,12);await t.exit('south');t.expect((await t.state()).key==='sunreach:2,3','Actual movement discovers the new route south of Quiet Dunes');
  let p=await hook(8.5,5.6,'south');t.expect(p.range===6&&p.lz<6,'The ordinary six-tile hook misses the far anchor and returns safely');await photo('01-sunken-meridian-before');
  await t.give('sun-dial');p=await hook(8.5,5.6,'south');t.expect(p.range===8&&p.lz>12&&p.lz<13,'The passive extender enables an actual eight-tile pull over the drowned platform');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return !h.world.blocked(h.player.x,h.player.z,h.player.r,h.player)&&!h.world.tileDefAt(Math.floor(h.player.x),Math.floor(h.player.z)).water&&!h.game.hero.hero.isPulled();}),'The long cast lands on safe dry floor');await photo('02-eight-tile-crossing');
  const before=await t.eval(()=>({max:window.__voxelHeroes.state.maxHp,pieces:window.__voxelHeroes.state.heartPieces}));await t.walkTo(11.5,14.5);await t.stick(0,-1,.4);await t.step(.2);await photo('03-drowned-platform-reward');
  t.expect(await t.eval(before=>{const h=window.__voxelHeroes;return h.state.maxHp>before.max||h.state.heartPieces>before.pieces;},before),'The physical platform chest awards a permanent heart fragment');
  await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  const won=await t.save();await t.load(won);await t.step(.3);const stats=await t.eval(()=>({max:window.__voxelHeroes.state.maxHp,pieces:window.__voxelHeroes.state.heartPieces}));await t.stick(0,-1,.4);
  t.expect(await t.eval(stats=>{const h=window.__voxelHeroes;return h.state.maxHp===stats.max&&h.state.heartPieces===stats.pieces&&h.state.mode==='play';},stats),'Loading and reopening cannot repeat the permanent heart reward');
  p=await hook(8.5,12.45,'north');t.expect(p.range===8&&p.lz>5&&p.lz<6,'The extended chain also returns across the basin');await t.exit('north');t.expect((await t.state()).key==='sunreach:2,2','The optional platform has a usable return to Quiet Dunes');
  const rooms=await t.eval(()=>[...window.__voxelHeroes.world.screens.values()].filter(s=>s.area.id==='d3').map(s=>({key:s.key,name:s.name})));t.expect(rooms.length===22,'Both Watch floors retain all 22 authored rooms');
  for(const[i,s]of rooms.entries()){
    await t.teleport(s.key,8,9);await t.step(1.4);await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};});
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return s.tileset==='watch'&&new Set(s.tiles.flat().filter(c=>['e','a','j','f','o','p'].includes(c))).size>=4&&s.tiles.every((row,z)=>row.every((ch,x)=>!['e','a','j','f','o','p'].includes(ch)||h.world.tileDefAt(s.x0+x,s.z0+z).pushableFloor&&!h.world.tileDefAt(s.x0+x,s.z0+z).solid));}),s.name+' has varied walkable observatory flooring');
    await photo(String(i+4).padStart(2,'0')+'-'+s.name.toLowerCase().replaceAll(' ','-'));
  }
  await t.teleport('d3-boss:0,0',11,13.5);await t.step(4);await photo('26-colossus-court');
  const outdoors=await t.eval(()=>[...window.__voxelHeroes.world.screens.values()].filter(s=>s.area.id==='sunreach').map(s=>({key:s.key,name:s.name})));t.expect(outdoors.length===7,'The basin includes six existing screens and the optional sunken transit line');
  for(const[i,s]of outdoors.entries()){await t.teleport(s.key,5.5,s.key==='sunreach:2,3'?4.5:9.5);await t.step(1);await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};});await photo(String(i+27)+'-'+s.name.toLowerCase().replaceAll(' ','-'));}
  await t.teleport('d3:0,2',4.5,6.5);
  for(const ch of['e','a','j','f','o','p']){
    await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'Q');h.world.setTile(s.x0+6,s.z0+6,ch);h.game.hero.hero.place(4.5,6.5);},ch);
    await t.eval(async()=>{const h=window.__voxelHeroes,s=h.screen();h.input.setStick(1,0);try{for(let i=0;i<120&&h.world.tile(s.x0+5,s.z0+6)==='Q';i++)await h.tick();}finally{h.input.setStick(0,0);}});
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+6,s.z0+6)==='Q';}),'Real blocks remain pushable over '+ch+' observatory floor');
    await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+6,s.z0+6,s.base[6][6]);});
  }
  await t.teleport('d1:2,4',8.5,7.5);await t.step(1.4);await photo('34-barrow-visible-clock-rubble');
}

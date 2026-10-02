export const description='Muted visual receipts for all sixteen hive rooms and the crown arena. Real block pushes over all eight decorative floors, blocking against machinery and pits, and preserved floor restoration. Terrain placement and invulnerable heroes are fixtures.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');h.game.dungeons.defeatBoss('d1');h.game.dungeons.completeDungeon('d1');h.player.invT=999;});
  const screens=await t.eval(()=>[...window.__voxelHeroes.world.screens.values()].filter(s=>s.area.id==='d2').map(s=>({key:s.key,name:s.name})));
  t.expect(screens.length===16,'Rootglass has sixteen authored rooms including the optional greenhouse');
  for(const [i,s]of screens.entries()){
    await t.teleport(s.key,8,9);await t.step(.3);await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};h.player.hero.root.visible=true;});
    const floor=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),chars=new Set(s.tiles.flat()),floors=['e','a','j','u','o','p','+','='];return {set:s.tileset,variants:[...chars].filter(ch=>floors.includes(ch)),unsafe: [...chars].filter(ch=>floors.includes(ch)).filter(ch=>{const [z,row]=s.tiles.map((row,z)=>[z,row]).find(([z,row])=>row.includes(ch));return h.world.tileDefAt(s.x0+row.indexOf(ch),s.z0+z).solid;})};});
    t.expect(floor.set==='hive'&&floor.variants.length>=2&&!floor.unsafe.length,s.name+' uses at least two walkable hive materials');
    await t.shot(String(i+1).padStart(2,'0')+'-'+s.name.toLowerCase().replaceAll(' ','-'));
  }
  await t.teleport('d2-boss:0,0',11,13);await t.step(4);await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;h.player.hero.root.visible=true;});await t.shot('17-amber-crown');
  await t.teleport('Rootglass Mouth',5.5,6.5);
  const pushOne=(from,type='Q')=>t.eval(async ([from,type])=>{const h=window.__voxelHeroes,s=h.screen();h.input.setStick(1,0);try{for(let i=0;i<120&&h.world.tile(s.x0+from,s.z0+6)===type;i++)await h.tick();}finally{h.input.setStick(0,0);}await h.tick();},[from,type]);
  for(const ch of['e','a','j','u','o','p','+','=']){
    await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'Q');h.world.setTile(s.x0+6,s.z0+6,ch);h.world.setTile(s.x0+7,s.z0+6,'e');h.game.hero.hero.place(4.5,6.5);h.player.invT=999;},ch);
    await pushOne(5);
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+6,s.z0+6)==='Q';}),'An actual push block can enter '+ch+' decorative flooring');
    await t.eval(()=>window.__voxelHeroes.game.hero.hero.place(5.5,6.5));await pushOne(6);
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+7,s.z0+6)==='Q'&&h.world.tile(s.x0+6,s.z0+6)===s.base[6][6];}),'Pushing off '+ch+' restores the original decorative floor');
    await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+7,s.z0+6,s.base[6][7]);});
  }
  for(const ch of['O','1']){
    await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'Q');h.world.setTile(s.x0+6,s.z0+6,ch);h.game.hero.hero.place(4.5,6.5);},ch);await t.stick(1,0,.85);
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+5,s.z0+6)==='Q';}),'Decorative floor support cannot push a block into '+(ch==='O'?'a pit':'closed machinery'));
  }
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.setTile(s.x0+5,s.z0+6,'S');h.world.setTile(s.x0+6,s.z0+6,'a');h.world.setTile(s.x0+7,s.z0+6,'e');h.game.hero.hero.place(4.5,6.5);});
  await pushOne(5,'S');t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+6,s.z0+6)==='S';}),'Actual statue movement also accepts a decorative amber floor');
  await t.eval(()=>window.__voxelHeroes.game.hero.hero.place(5.5,6.5));await pushOne(6,'S');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+7,s.z0+6)==='S'&&h.world.tile(s.x0+6,s.z0+6)===s.base[6][6];}),'Moving the statue onward restores its original service channel');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.world.screens.get('d1:2,4');return s.tileset!=='hive'&&h.world.tileDefAt(s.x0+4,s.z0+4).name!=='hive-amber-glass';}),'The hive tileset leaves the barrow kit independent');
}

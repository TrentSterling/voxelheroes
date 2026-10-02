export const description='Seeded 2,880-frame mixed-input soak across town, both eras and all four dungeons, with 12 save reloads and desktop/phone resizing. Teleports, equipment and invulnerability are disclosed fixtures; movement, attacks, dash, guard, inventory and menus use real inputs.';
export default async function(t){
 await t.press('Enter');await t.step(1.1);
 await t.eval(()=>{const h=window.__voxelHeroes;h.give('blade-start');h.game.swords.equipSword('blade-start');h.give('boomerang');window.__soakRng=Number(new URL(location.href).searchParams.get('seed'))||1;});
 const targets=await t.eval(()=>{const h=window.__voxelHeroes;return ['v1','mossbrook-past','mossbrook-future','d1','d2','d3','d4'].map(id=>[...h.world.screens.values()].find(s=>s.area.id===id)?.key).filter(Boolean);});
 t.expect(targets.length===7,'soak includes town, both eras, and all four dungeons');
 for(let round=0;round<12;round++){
  const key=targets[round%targets.length];
  const floor=await t.eval(key=>{const h=window.__voxelHeroes,s=h.world.screens.get(key);for(let z=s.h-3;z>1;z--)for(let x=2;x<s.w-2;x++)if(['.','p','o','l','q','a'].includes(s.tiles[z][x]))return {x:x+.5,z:z+.5};throw Error('No safe floor in '+key);},key);
  await t.teleport(key,floor.x,floor.z);await t.step(.2);
  const result=await t.eval(async()=>{
   const h=window.__voxelHeroes,rand=()=>{let n=window.__soakRng;n^=n<<13;n^=n>>>17;n^=n<<5;window.__soakRng=n>>>0;return (n>>>0)/4294967296;};
   for(let frame=0;frame<240;frame++){
    h.player.invT=100;
    if(h.state.mode==='play'){
     if(frame%20===0)h.input.setStick(Math.round(rand()*2)-1,Math.round(rand()*2)-1);
     if(frame%17===0)h.input.tap(['sword','dash','item','guard'][Math.floor(rand()*4)]);
    }else{h.input.setStick(0,0);if(frame%5===0)h.input.tap('cancel');if(frame%19===0)h.input.tap('confirm');}
    await h.tick();
   }
   h.input.setStick(0,0);h.setMode('play');
   const s=h.state,p=h.player;
   return {finite:[p.x,p.object.position.y,p.z,p.yaw,s.hp,s.magic,s.coins].every(Number.isFinite),vitals:s.hp>=0&&s.hp<=s.maxHp&&s.magic>=0&&s.magic<=s.maxMagic,entities:h.entities.filter(e=>!e.removed).every(e=>[e.x,e.z].every(Number.isFinite)),screen:!!h.world.screenAt(p.x,p.z),key:h.screen()?.key};
  });
  t.expect(result.finite,`round ${round}: hero and economy stay finite`);
  t.expect(result.vitals,`round ${round}: life and magic stay within capacity`);
  t.expect(result.entities,`round ${round}: live entities keep finite positions`);
  t.expect(result.screen,`round ${round}: mixed inputs keep the hero in the world`);
  const saved=await t.eval(()=>{const h=window.__voxelHeroes;window.__soakSave=h.save();return {hp:h.state.hp,maxHp:h.state.maxHp,maxMagic:h.state.maxMagic,key:h.screen().key};});
  await t.eval(()=>window.__voxelHeroes.load(window.__soakSave));await t.step(.05);
  t.expect(await t.eval(expected=>{const h=window.__voxelHeroes;return h.state.hp===expected.hp&&h.state.maxHp===expected.maxHp&&h.state.maxMagic===expected.maxMagic&&h.screen().key===expected.key;},saved),`round ${round}: save reload preserves position and progression`);
  if(round%2===0){
   const view=[{width:1280,height:720},{width:320,height:568},{width:844,height:390}][(round/2)%3];
   await t.page.setViewportSize(view);await t.page.waitForFunction(()=>Math.abs(window.__voxelHeroes.gfx.camera.aspect-innerWidth/innerHeight)<1e-9);await t.step(.02);
   await t.press('KeyL');await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(`round-${round}-journal-${view.width}`);await t.press('KeyL');
   t.expect((await t.state()).mode==='play',`round ${round}: journal opens and closes after resizing`);
  }
 }
}

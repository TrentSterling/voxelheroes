export const description = 'Muted base-wand beacon refusal, cold memorial and original seed-vault locks, one killed skater retained through partial reload, remaining real fire/sword kill, earned lens, and a bolt fired before the upgrade retaining its original melt budget. Positions, stationary enemies and equipment are disclosed fixtures; damage and chest actions use actual input.';
export default async function(t) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});await t.give('fire-wand');
  const place=(x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);h.game.inventory.selectItem('fire-wand');h.player.invT=999;},[x,z,f]);
  const tile=(x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
  await t.teleport('tidecoast:0,2',8.5,6.5);await place(8.5,6.5);await t.tap('item');await t.step(.4);
  t.expect(await tile(8,5)==='{'&&!await t.eval(()=>window.__voxelHeroes.state.flags.has('coast:beacon-lit')),'A base fire wand cannot light the cracked shore beacon');
  await t.teleport('mossbrook-future:0,0',13.5,13.5);await t.step(.2);const magic=await t.eval(()=>window.__voxelHeroes.state.maxMagic);await t.stick(0,-1,.4);
  t.expect(await tile(12,12)==='{'&&await tile(13,12)==='['&&await t.eval(m=>window.__voxelHeroes.state.maxMagic===m,magic),'The cold memorial vault remains sealed and cannot award a memory');
  await place(7.5,4.5);await t.stick(0,-1,.4);t.expect(!await t.eval(()=>window.__voxelHeroes.state.flags.has('era:dawn-seed')),'The original Dawn Seed chest still requires its water-engine repair');
  await t.teleport('d4:0,7',5.5,8.5);await t.step(1.5);await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),es=h.entities.filter(e=>e.type==='tideglass-skater');es.forEach(e=>{e.think=()=>{};e.harmless=true;});es[0].x=s.x0+5.5;es[0].z=s.z0+5.5;es[1].x=s.x0+13.5;es[1].z=s.z0+8.5;});
  const kill=async()=>{const position=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='tideglass-skater');return[e.x-s.x0,e.z-s.z0];});await place(position[0],position[1]+2.5);await t.tap('item');await t.step(.4);for(let i=0;i<7;i++){const e=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='tideglass-skater');return e&&[e.x-s.x0,e.z-s.z0,e.hp];});if(!e||i&&e[2]===18)break;await place(e[0],e[1]+1.3);await t.tap('sword');await t.step(.45);}};
  await kill();t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='tideglass-skater'&&!e.removed).length)===1&&await tile(8,3)==='h','One actual skater kill leaves the optional cache guarded');
  const partial=await t.save();await t.load(partial);await t.step(1.5);t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='tideglass-skater'&&!e.removed).length)===1,'Partial reload preserves the one defeated skater');
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='tideglass-skater');e.think=()=>{};e.harmless=true;e.x=s.x0+5.5;e.z=s.z0+5.5;});await kill();t.expect(await tile(8,3)==='c','Finishing the remaining skater reveals the retryable lens cache');
  await place(8.5,4.5);await t.stick(0,-1,.4);t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('ember-lens')),'The retried physical cache grants its lens');
  await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  await t.teleport('d4:3,3',8.5,9.5);await t.eval(()=>{const h=window.__voxelHeroes;h.state.inventory.owned=h.state.inventory.owned.filter(id=>id!=='ember-lens');});await place(8.5,9.5);await t.tap('item');
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='fire-bolt')?.extraMelt===0),'A bolt fired before the lens has its original one-block budget');await t.give('ember-lens');await t.step(.7);
  t.expect(await tile(8,6)==='.'&&await tile(8,5)===':','Receiving the passive upgrade cannot change a bolt already in flight');
  await t.tap('item');await t.step(.7);t.expect(await tile(8,5)==='.'&&await tile(8,4)==='.','The next newly fired bolt uses the upgraded two-block budget');
  await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot('01-partial-retry-and-live-upgrade');
}

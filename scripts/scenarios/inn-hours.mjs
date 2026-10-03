export const description = 'Actual inn NPC interaction and paid stays at evening, night, after midnight and dawn in both towns. Placement, clock and initial coins are disclosed fixtures. Normal sword and confirm input open the bed choice, spend real coins, restore life and advance the day. Ordinary villagers retain their schedules. No recorded audio playback.';
export default async function(t){
  await t.press('Enter');await t.step(2);
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.vitals.addCoins(300);h.game.settings.setSetting('npcVoices',false);});
  for(const [key,min]of[['v1:1,1',21*60],['sunreach:1,1',23*60],['sunreach:1,1',25*60],['v1:1,1',6*60]]){
    await t.teleport(key,6,10);await t.eval(min=>{window.__voxelHeroes.state.clock.min=min;},min);await t.step(2);
    const data=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='npc-inn');return {x:e.x-s.x0,z:e.z-s.z0,visible:e.out&&e.holder.visible,day:h.state.clock.day,coins:h.state.coins,ordinary:h.entities.filter(e=>e.kind==='npc'&&e.type!=='npc-inn').map(e=>({name:e.name,schedule:e.schedule,out:e.out}))};});
    t.expect(data.visible,`${key} innkeeper stays visible and available at ${min/60}:00`);
    if(min>=23*60)t.expect(data.ordinary.every(e=>e.schedule==='always'||!e.out),'ordinary villagers still go indoors during the night');
    await t.walkTo(data.x,data.z+1.15);await t.stick(0,-1,1/60);await t.tap('sword');
    t.expect((await t.state()).mode==='dialog','ordinary action opens the real inn choice');await t.shot(`inn-${key.replaceAll(':','-').replaceAll(',','-')}-${min}`);
    await t.eval(async()=>{const h=window.__voxelHeroes;let quiet=0;for(let i=0;i<600&&quiet<25;i++){if(i%20===0&&h.state.mode!=='play')h.input.tap('confirm');await h.tick();quiet=h.state.mode==='play'?quiet+1:0;}});await t.step(.3);
    const price=key.startsWith('sunreach')?30:10;
    t.expect(await t.eval(({day,coins,price})=>{const h=window.__voxelHeroes;return h.state.clock.day===day+1&&h.state.coins===coins-price&&h.state.hp===h.state.maxHp&&h.state.mode==='play';},{...data,price}),'the actual selected bed charges its price, restores life and wakes the next day');
    t.expect(await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='npc-inn');return e.out&&e.holder.visible;}),'the keeper remains available after a six-o-clock wakeup');
  }
}

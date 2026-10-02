export const description='Clear both barrow waves without touching the bell, save before collecting its key, reload without restarted guards, then use actual pottery and chest movement to recover the optional memory. Invulnerable positioning and damage-API kills are fixtures; audio is muted.';
export default async function(t){
 const view=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return {foes:h.entities.filter(e=>!e.removed&&e.kind==='enemy').length,bell:h.entities.find(e=>e.type==='barrow-bell')?.ai.phase,chest:h.world.tile(s.x0+12,s.z0+8),keys:h.entities.filter(e=>e.type==='key').length,muted:h.state.flags.has('dungeon:d1:echo-muted'),memory:h.state.flags.has('dungeon:d1:echo-memory'),maxMagic:h.state.maxMagic,blocked:h.game.combat.roomClearBlocked()};});
 const kill=()=>t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities.filter(e=>!e.removed&&e.kind==='enemy'))h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}});});
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
 await t.teleport('d1:2,4',8.5,7.5);await t.step(1.3);await kill();await t.step(2.5);await kill();await t.step(.3);
 let v=await view();t.expect(v.bell==='done'&&v.foes===0&&!v.muted&&v.chest==='h','Both waves can be completed without quieting the bell; its optional chest stays hidden');
 const capacity=v.maxMagic;
 await t.eval(()=>{const h=window.__voxelHeroes;h.load(h.save());});await t.step(1.3);v=await view();
 t.expect(v.bell==='done'&&v.foes===0&&!v.blocked,'A completed encounter loads without restarting its first-wave guards: '+JSON.stringify(v));
 t.expect(v.keys===1,'The uncollected fourth key survives save/load as exactly one waiting pickup');
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(3.5,9.5);h.game.hero.hero.setFacing('west');});await t.tap('sword');
 t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'A real pot remains available after loading the completed encounter');
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(8.5,4.5);h.game.hero.hero.setFacing('north');});await t.tap('sword');await t.step(.35);v=await view();
 t.expect(v.muted&&v.chest==='c','A pot thrown after combat still reveals the memory chest');
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(12.5,9.5);h.game.hero.hero.setFacing('north');});await t.stick(0,-1,.4);v=await view();
 t.expect(v.memory&&v.maxMagic===capacity+1,'The late memory chest grants exactly one permanent magic gem');await t.shot('01-late-memory-reward');
 await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<400&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
 await t.eval(()=>{const h=window.__voxelHeroes;h.load(h.save());});await t.step(.3);v=await view();
 t.expect(v.memory&&v.maxMagic===capacity+1&&v.foes===0&&v.bell==='done','A second reload retains the late reward and empty finished encounter');
 await t.teleport('Barrow Mouth',8,7);await t.teleport('d1:2,4',8.5,7.5);await t.step(.3);v=await view();
 t.expect(v.foes===0&&v.bell==='done'&&v.maxMagic===capacity+1,'Leaving and returning cannot restart the encounter or repeat its reward');
 await t.shot('02-finished-bell-on-return');
}

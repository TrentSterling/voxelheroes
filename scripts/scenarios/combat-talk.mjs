export const description='Isolated Forester Fen combat controls: held guard plus sword should stay in combat, released guard allows native NPC dialogue. Teleport, starter equipment, cleared other foes and placed stationary hostile are disclosed fixtures. Actual guard, sword and confirm input; no direct damage API or hero invulnerability. Browser audio muted.';
export default async function(t){
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');});await t.give('blade-start');await t.give('shield-1');
 await t.teleport('forest:1,2',11.5,12.5);await t.step(2);
 await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),n=h.entities.find(e=>e.name==='Forester Fen');for(const e of [...h.entities])if(e.kind==='enemy')e.remove();h.game.hero.hero.place(n.x-s.x0-1.1,n.z-s.z0+.75);h.game.hero.hero.setFacing('east');window.__fenFoe=h.spawn('hopper',n.x-s.x0+.25,n.z-s.z0+.75,{spawnDelay:0,crowned:false});window.__fenFoe.think=()=>{};});await t.step(.5);
 await t.eval(()=>window.__voxelHeroes.input.down('guard'));await t.step(.1);
 const before=await t.eval(()=>{const h=window.__voxelHeroes;return{hp:window.__fenFoe.hp,guardHeld:h.input.held('guard'),guarding:h.player.guarding,mode:h.state.mode,prompt:h.game.prompts.currentPrompts().find(p=>p.action==='sword')?.label};});t.note('Before guarded A: '+JSON.stringify(before));
 t.expect(before.guardHeld&&before.guarding,'actual held guard raises the earned shield beside the forester');await t.tap('sword');await t.step(.1);
 let after=await t.eval(()=>{const h=window.__voxelHeroes;return{hp:window.__fenFoe.hp,mode:h.state.mode,dialog:h.game.dialog.dialogView(),attacking:h.player.attackT>0};});t.note('After guarded A: '+JSON.stringify(after));
 t.expect(after.mode==='play'&&after.hp<before.hp,'held guard plus actual sword hits the nearby hostile instead of opening Fen dialogue');t.expect(before.prompt==='Sword','the native guarded action prompt agrees with combat input');await t.shot('01-guarded-sword-near-fen');
 await t.eval(()=>{const h=window.__voxelHeroes;h.input.up('guard');window.__fenFoe.remove();});await t.step(.5);
 await t.tap('sword');t.expect((await t.state()).mode==='dialog','releasing guard still lets actual A talk to the forester');t.expect(await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView()?.speaker==='Forester Fen'),'the intended native conversation retains its named NPC');await t.shot('02-deliberate-forester-talk');
 for(let n=0;n<100&&(await t.state()).mode==='dialog';n++)await t.tap('confirm');
 t.expect((await t.state()).mode==='play','native confirms finish the deliberate conversation and return to movement');
}

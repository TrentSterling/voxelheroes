export const description = 'Real group factories in Tangled Wood and Rootglass: exhaust candidate floors with buzzers and larger guardians, then check actual body collision and first movement. Teleport, removed unrelated actors and oversized group counts are disclosed isolation fixtures. No damage or hero health edits. All output muted.';
export default async function(t) {
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
 for(const key of ['lost-woods:1,0','lost-woods:2,0','d2:2,4']) {
  await t.teleport(key,8.5,11.5);await t.step(2);
  for(const type of ['buzzer','guardian']) {
   const result=await t.eval(type=>{
    const h=window.__voxelHeroes,s=h.screen();
    for(const e of [...h.entities])if(e.kind==='enemy')e.remove();
    const group=h.spawn('group',8.5,8.5,{of:[type],count:1000,minDist:0,crowned:false});
    const bad=group.children.filter(e=>h.world.blocked(e.x,e.z,e.r,e)||e.x-e.r<s.x0||e.x+e.r>s.x1||e.z-e.r<s.z0||e.z+e.r>s.z1);
    const noEscape=group.children.filter(e=>![[.06,0],[-.06,0],[0,.06],[0,-.06]].some(([dx,dz])=>!h.world.blocked(e.x+dx,e.z+dz,e.r,e)));
    return {count:group.children.length,bad:bad.map(e=>({x:e.x-s.x0,z:e.z-s.z0,r:e.r})),noEscape:noEscape.length};
   },type);
   t.note(`${key} ${type}: ${JSON.stringify(result)}`);
   t.expect(result.count>50,`${key}: dense ${type} fixture exercises the entire floor pool`);
   t.expect(result.bad.length===0,`${key}: each ${type} uses its actual radius and clears wall insets ${JSON.stringify(result.bad)}`);
   t.expect(result.noEscape===0,`${key}: each ${type} has an ordinary free first step`);
   await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.kind==='enemy')e.remove();});
  }
 }
}

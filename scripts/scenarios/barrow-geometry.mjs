export const description='Actual rendered terrain vertices and matching solid footprints for the Barrow clock rubble and bell plinth. New-game and position fixtures; all geometry comes from the real tile builders. Muted screenshots preserve the correction.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
  for(const[key,ch,name]of[['d1:3,9','m','clock-rubble'],['d1:2,4','i','bell-plinth']]){
    await t.teleport(key,8.5,7.5);await t.step(1.5);
    const result=await t.eval(ch=>{
      const h=window.__voxelHeroes,s=h.screen(),z=s.tiles.findIndex(row=>row.includes(ch)),x=s.tiles[z].indexOf(ch),mesh=s.meshes.find(m=>m.name==='detail')?.mesh,a=mesh?.geometry.attributes.position;
      let high=0;
      for(let i=0;i<(a?.count??0);i++){
        const X=a.getX(i)+mesh.position.x-s.x0,Y=a.getY(i)+mesh.position.y,Z=a.getZ(i)+mesh.position.z-s.z0;
        if(X>x+.05&&X<x+.95&&Z>z+.05&&Z<z+.95&&Y>(ch==='m'?.4:.2))high++;
      }
      return{x,z,high,solid:h.world.blocked(s.x0+x+.5,s.z0+z+.5,.2,h.player),visible:mesh?.visible};
    },ch);
    t.expect(result.high>0&&result.visible,'The real '+name+' terrain contains visible elevated vertices inside its own tile');
    t.expect(result.solid,'The visible '+name+' retains its matching collision footprint');
    await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);
  }
}

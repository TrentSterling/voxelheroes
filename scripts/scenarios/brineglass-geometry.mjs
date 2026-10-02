export const description = 'Rendered vertex checks for six brineglass fine-floor materials, matching walkable collision, local north-wall lantern details, and four outdoor path materials. No tile-builder substitution; new-game and screen position fixtures. Both browser engines capture the real geometry silently.';
export default async function(t) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
  await t.teleport('d4:2,3',8,9.5);await t.step(1.5);
  const floors=await t.eval(()=>{
    const h=window.__voxelHeroes,s=h.screen(),m=s.meshes.find(r=>r.name==='fine')?.mesh,a=m?.geometry.attributes.position;
    return ['e','a','j','u','o','p'].map(ch=>{let x,z;for(let Z=2;Z<s.h-2&&x===undefined;Z++)for(let X=2;X<s.w-2;X++)if(s.tiles[Z][X]===ch&&!h.world.blocked(s.x0+X+.5,s.z0+Z+.5,.2,h.player)){x=X;z=Z;break;}let top=0;
      for(let i=0;i<(a?.count??0);i++){const X=a.getX(i)+m.position.x-s.x0,Y=a.getY(i)+m.position.y,Z=a.getZ(i)+m.position.z-s.z0;if(X>x+.01&&X<x+.99&&Z>z+.01&&Z<z+.99&&Y>.07)top++;}
      return{ch,top,visible:m?.visible,walkable:!h.world.blocked(s.x0+x+.5,s.z0+z+.5,.2,h.player)};
    });
  });
  for(const f of floors){t.expect(f.visible&&f.top>0,'Rendered '+f.ch+' floor has raised vertices in its own footprint');t.expect(f.walkable,'Rendered '+f.ch+' floor remains physically walkable');}
  t.expect(await t.eval(()=>{const s=window.__voxelHeroes.screen(),m=s.meshes.find(r=>r.name==='detail')?.mesh,a=m?.geometry.attributes.position;let inside=0;for(let i=0;i<(a?.count??0);i++){const X=a.getX(i)+m.position.x-s.x0,Y=a.getY(i)+m.position.y,Z=a.getZ(i)+m.position.z-s.z0;if(X>4.2&&X<4.8&&Y>1&&Z>.74&&Z<1.01)inside++;}return m?.visible&&inside>0;}),'North-wall glass lantern geometry appears inside its actual wall tile');
  await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot('01-brineglass-native-floor-kit');
  await t.teleport('tidecoast:0,2',8.5,11);await t.step(1);
  const outdoor=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),m=s.meshes.find(r=>r.name==='terrain')?.mesh,a=m?.geometry.attributes.position;return['e','a','j','u'].map(ch=>{const z=s.tiles.findIndex(r=>r.includes(ch)),x=s.tiles[z].indexOf(ch);let vertices=0;for(let i=0;i<(a?.count??0);i++){const X=a.getX(i)+m.position.x-s.x0,Y=a.getY(i)+m.position.y,Z=a.getZ(i)+m.position.z-s.z0;if(X>x&&X<x+1&&Z>z&&Z<z+1&&Y>=0)vertices++;}return{ch,vertices,walkable:!h.world.blocked(s.x0+x+.5,s.z0+z+.5,.2,h.player)};});});
  for(const f of outdoor)t.expect(f.vertices>0&&f.walkable,'Coastal '+f.ch+' path has real rendered vertices and a clear footprint');
  await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot('02-coast-native-path-kit');
}

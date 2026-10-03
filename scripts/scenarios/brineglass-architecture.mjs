export const description='Actual room-specific floor meshes, quiet boss lanes and pushable floor semantics. Six room and hero-placement fixtures, enemies stationary and harmless, boss intro skipped for visual inspection. No tile-builder replacement; geometry, walkability, distinct room layouts and native warning floor clearance are inspected. Speaker output disconnected.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);});
  const plans=[['d4:2,3','gallery','b'],['d4:1,2','charts','d'],['d4:0,2','sluice','i'],['d4:0,7','kiln','k'],['d4:1,6','ice','b'],['d4:0,6','sanctum','m']];
  const signatures=new Set();
  for(const[key,style,sample]of plans){
    await t.teleport(key,8,9.5);await t.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;}});await t.step(1.6);
    const v=await t.eval(ch=>{const h=window.__voxelHeroes,s=h.screen(),m=s.meshes.find(r=>r.name==='fine')?.mesh,a=m?.geometry.attributes.position;let found=null,vertices=0;
      for(let z=2;z<s.h-2&&!found;z++)for(let x=2;x<s.w-2;x++)if(s.tiles[z][x]===ch&&!h.world.blocked(s.x0+x+.5,s.z0+z+.5,h.player.r,h.player)){found={x,z};break;}
      if(found)for(let i=0;i<(a?.count??0);i++){const x=a.getX(i)+m.position.x-s.x0,z=a.getZ(i)+m.position.z-s.z0,y=a.getY(i)+m.position.y;if(x>=found.x&&x<=found.x+1&&z>=found.z&&z<=found.z+1&&y>.12)vertices++;}
      const chars=new Set(s.tiles.flat());return{style:s.def.floorStyle,signature:s.base.map(r=>r.join('')).join('\n'),found,vertices,visible:m?.visible,chars:[...chars],clear:s.tiles.every((r,z)=>r.every((c,x)=>!['b','i','k','d','q','m'].includes(c)||x===1||x===s.w-2||(!h.world.blocked(s.x0+x+.5,s.z0+z+.5,.2,h.player)&&h.world.tileDefAt(s.x0+x,s.z0+z).pushableFloor)))};},sample);
    t.expect(v.style===style,'the actual '+key+' owns its '+style+' floor plan');
    t.expect(v.visible&&v.found&&v.vertices>0,'the actual '+style+' base material has rendered fine-floor vertices');
    t.expect(v.clear,'the '+style+' interior decorative floors remain walkable and accept a counterweight (side-wall half-tile edges excluded)');
    signatures.add(v.signature);await t.shot('120-'+style+'-architecture');
  }
  t.expect(signatures.size===plans.length,'the six actual room types have distinct authored floor layouts');
  await t.teleport('d4-boss:0,0',3,13);await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');b.introDone=true;for(const e of h.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;}});await t.step(1.6);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return s.base.flat().filter(c=>c==='i').length>100&&s.base[6][8]==='~'&&s.base[6][11]==='~'&&s.base[6][6]==='&'&&s.base[6][13]==='&';}),'the quiet court retains its actual four-column channel and crossing posts');
  await t.shot('121-quiet-undertow-court');
}

export const description='Actual tower floor meshes, four room plans across four palettes, flat walkable push floors and final retreat. New-game, screen positions, stationary harmless enemies and skipped intros are disclosed visual fixtures. No tile builder replacement. Speaker output disconnected.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);});
  const plans=[['tower-hive:1,2','gallery'],['tower-hive:0,2','rest'],['tower-hive:1,1','mechanism'],['tower-hive:0,1','ceremony'],['tower-watch:1,1','mechanism'],['tower-watch:0,1','ceremony'],['tower-tide:1,1','mechanism'],['tower-tide:0,1','ceremony'],['tower-crown:1,2','ceremony'],['tower-crown:0,2','rest']];
  const layouts=new Set(),materials=new Set(),palettes=new Set();
  for(const[key,style]of plans){
    await t.teleport(key,8,9.5);await t.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;e.introDone=true;}});await t.step(1.6);
    const v=await t.eval(()=>{
      const h=window.__voxelHeroes,s=h.screen(),m=s.meshes.find(r=>r.name==='fine')?.mesh,a=m?.geometry.attributes.position;
      const floors=['b','i','j','q','e','m'],samples=[];
      for(const ch of floors){let found;for(let z=2;z<s.h-2&&!found;z++)for(let x=2;x<s.w-2;x++)if(s.tiles[z][x]===ch&&!h.world.blocked(s.x0+x+.5,s.z0+z+.5,.2,h.player)){found={x,z};break;}
        if(!found)continue;let vertices=0,top=-Infinity;for(let i=0;i<(a?.count??0);i++){const x=a.getX(i)+m.position.x-s.x0,z=a.getZ(i)+m.position.z-s.z0,y=a.getY(i)+m.position.y;if(x>found.x+.01&&x<found.x+.99&&z>found.z+.01&&z<found.z+.99){vertices++;top=Math.max(top,y);}}
        samples.push({ch,vertices,top});
      }
      return{style:s.def.floorStyle,visible:m?.visible,palette:s.area.palette.floor,layout:s.base.map(r=>r.join('')).join('\n'),samples,clear:s.tiles.every((r,z)=>r.every((c,x)=>!floors.includes(c)||x===1||x===s.w-2||(!h.world.blocked(s.x0+x+.5,s.z0+z+.5,.2,h.player)&&h.world.tileDefAt(s.x0+x,s.z0+z).pushableFloor)))};
    });
    t.expect(v.style===style,'the actual '+key+' has its '+style+' floor plan');
    t.expect(v.visible&&v.samples.length&&v.samples.every(s=>s.vertices>0&&s.top>=.06&&s.top<=.2),'the real '+key+' floor materials have flat rendered vertices below attack warnings');
    t.expect(v.clear,'the actual '+key+' interior markings remain walkable and pushable');
    if(key.startsWith('tower-hive:'))layouts.add(v.layout);for(const sample of v.samples)materials.add(sample.ch);palettes.add(v.palette);
    await t.shot('200-'+key.replaceAll(':','-').replaceAll(',','-')+'-'+style);
  }
  t.expect(layouts.size===4&&materials.size===6,'four authored room plans use all six actual tower floor materials');
  t.expect(palettes.size===4,'amber, sand, tide and ash floors retain four distinct actual palettes');
  for(const key of['tower-hive-boss:0,0','tower-watch-boss:0,0','tower-tide-boss:0,0','tower-final:0,0']){
    await t.teleport(key,3,12);await t.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;e.introDone=true;}});await t.step(1.6);
    t.expect(await t.eval(()=>window.__voxelHeroes.screen().base.flat().filter(c=>c==='i').length>100),'the actual '+key+' has a quiet slate court');
    if(key.startsWith('tower-tide'))t.expect(await t.eval(()=>{const s=window.__voxelHeroes.screen();return s.base[6][8]==='~'&&s.base[6][11]==='~'&&s.base[6][6]==='&'&&s.base[6][13]==='&';}),'the tide memory retains its authored four-column channel and grapple posts');
    if(key.startsWith('tower-final'))t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return s.base[15][10]==='X'&&s.base[15][11]==='X'&&!h.world.blocked(s.x0+10.5,s.z0+15.5,h.player.r,h.player)&&s.def.warps['10,15'].screen.join(',')==='1,0';}),'the two-stage final has an open physical south retreat to its actual entry well');
    await t.shot('201-'+key.replaceAll(':','-').replaceAll(',','-'));
  }
}

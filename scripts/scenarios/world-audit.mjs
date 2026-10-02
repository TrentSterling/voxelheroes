export const description='Audit every registered screen: tile definitions, rectangular maps, non-overlapping spatial lookup, resolvable warp destinations, and safe new-era spawn floors. No geometry or entity fixtures.';
export default async function(t){
 const audit=await t.eval(()=>{
  const h=window.__voxelHeroes,w=h.world,rows=[];
  for(const s of w.screens.values()){
   const unknown=[];
   for(let z=0;z<s.h;z++)for(let x=0;x<s.w;x++)if(!w.tileDefAt(s.x0+x,s.z0+z))unknown.push({x,z,char:s.tiles[z]?.[x]});
   const shape=s.tiles.length===s.h&&s.tiles.every(row=>row.length===s.w);
   const indexed=w.screenAt(s.x0+.5,s.z0+.5)?.key===s.key&&w.screenAt(s.x1-.5,s.z1-.5)?.key===s.key;
   const badSpawns=s.spawns.filter(p=>{
    if(p.type==='npc'||p.type.startsWith('npc-'))return w.blocked(s.x0+p.x+.5,s.z0+p.z+.5,p.opts.r??.34,{flying:false});
    if(!s.area.id.startsWith('mossbrook-'))return false;
    const def=w.tileDefAt(s.x0+p.x,s.z0+p.z);return def?.solid===true||def?.water;
   });
   rows.push({key:s.key,shape,indexed,unknown,badSpawns});
  }
  const warps=[];
  for(const a of w.areas.values())for(const [char,spot]of Object.entries(a.warps??{})){
   try{const resolved=w.resolveSpot(spot);warps.push({area:a.id,char,ok:!!resolved});}catch(e){warps.push({area:a.id,char,ok:false,error:e.message});}
  }
  return {rows,warps};
 });
 for(const row of audit.rows){
  t.expect(row.shape,`${row.key}: map dimensions match its screen`);
  t.expect(row.indexed,`${row.key}: spatial lookup identifies both corners`);
  t.expect(row.unknown.length===0,`${row.key}: every tile has a definition ${JSON.stringify(row.unknown)}`);
  t.expect(row.badSpawns.length===0,`${row.key}: authored NPC homes and new-era spawns clear scenery ${JSON.stringify(row.badSpawns)}`);
 }
 for(const warp of audit.warps)t.expect(warp.ok,`${warp.area} warp ${warp.char}: destination resolves ${warp.error??''}`);
 t.note(`Audited ${audit.rows.length} screens and ${audit.warps.length} warp destinations.`);
 await t.press('Enter');await t.step(1);await t.shot('01-audited-world-start');
}

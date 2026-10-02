import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const description='Compare all eight woodland maps with published a40aa08: identical dimensions, actors, scenery, loot and maze passages; changed grass/path remains traversable. Photograph each ground motif and physically cross the stone and copper route. Placement and unrelated enemy removal are disclosed visual/collision fixtures. No health edits. Speaker output disconnected.';

export default async function(t) {
  const baseline='a40aa08c5377d85ccc0f7e64ea53dff4067e7f0e';
  const source=execFileSync('git',['show',`${baseline}:src/world/areas/forest.js`],{encoding:'utf8',windowsHide:true});
  const areas=[];
  runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,''),{registerArea:a=>areas.push(a),registerPlace:()=>{}});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
  const rows=[];
  for(const area of areas)for(const [at,old] of Object.entries(area.screens)) {
    const key=`${area.id}:${at}`;await t.teleport(key,8,12);await t.step(2);
    await t.page.waitForFunction(()=>{
      const h=window.__voxelHeroes,s=h.screen();return h.world.backdrop.some(m=>{
        const name=m.mesh.name.match(/^backdrop (-?\d+),(-?\d+)/);return name&&Number(name[1])>=s.x0-16&&Number(name[1])<=s.x1&&Number(name[2])<s.z0&&Number(name[2])>=s.z0-24;
      });
    });
    t.expect(true,`${old.name}: woodland has a built northern terrain backdrop`);
    await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.kind==='enemy')e.remove();});
    const data=await t.eval(({key,old})=>{
      const h=window.__voxelHeroes,s=h.world.screens.get(key),raw=s.area.screens[s.lx+','+s.ly],changes=[],bad=[];
      for(let z=0;z<old.rows.length;z++)for(let x=0;x<old.rows[z].length;x++){
        const before=old.rows[z][x],after=raw.rows[z][x];if(before===after)continue;
        changes.push({x,z,before,after});const def=h.world.tileDefAt(s.x0+x,s.z0+z);
        if(!['.','p'].includes(before)||!['h','o','c','a'].includes(after)||def.solid||def.hazard||def.water||def.onEnter||def.onPush||def.onSword||def.onBomb)bad.push({x,z,before,after});
        const occupied=h.entities.some(e=>!e.removed&&e.solid&&Math.floor(e.x-s.x0)===x&&Math.floor(e.z-s.z0)===z);
        if(!occupied) {
          const blocked=h.world.blocked(s.x0+x+.5,s.z0+z+.5,h.player.r,h.player);
          // Room side scenery already overlaps some grass centres. Compare
          // the actual old base instead of assuming every centre was open.
          h.world.setTile(s.x0+x,s.z0+z,before,{rebuild:false});
          const original=h.world.blocked(s.x0+x+.5,s.z0+z+.5,h.player.r,h.player);
          h.world.setTile(s.x0+x,s.z0+z,after,{rebuild:false});
          if(blocked!==original)bad.push({x,z,before,after,blocked,original});
        }
      }
      return {key,name:s.name,w:s.w,height:s.h,set:s.tileset,changes,bad,variants:[...new Set(changes.map(e=>e.after))],
        metadata:['name','warps','spawnsAt','chests'].map(field=>({field,old:old[field]??null,current:raw[field]??null}))};
    },{key,old});
    rows.push(data);
    t.expect(data.w===16&&data.height===16&&data.set==='whisperwood',`${data.name}: the published 16x16 footprint is retained`);
    t.expect(data.metadata.every(m=>JSON.stringify(m.old)===JSON.stringify(m.current)),`${data.name}: names, actor homes, loot and every authored warp are retained`);
    t.expect(data.changes.length>20&&data.variants.length>=2,`${data.name}: at least two new ground materials form a visible motif`);
    t.expect(data.bad.length===0,`${data.name}: every altered tile was ordinary ground and remains safely traversable ${JSON.stringify(data.bad)}`);
    await t.shot('ground-'+key.replaceAll(':','-').replaceAll(',','-'));
  }
  await t.teleport('forest:1,2',8.5,13.5);await t.step(2);await t.walkTo(8.5,2.5);
  t.expect((await t.state()).lz<3,'ordinary movement follows the worn stone Northwood route');
  await t.teleport('forest:1,1',8.5,10.5);await t.step(2);await t.walkTo(8.5,3.5);
  t.expect((await t.state()).lz<4,'ordinary movement crosses the copper Mothwater route without entering water');
  await t.teleport('lost-woods:2,0',8.5,12);await t.step(2);await t.walkTo(8.5,6.5);
  t.expect((await t.state()).lz<7,'ordinary movement crosses Split Root copper and stone without collision');
  await t.teleport('v1:1,1',8,10);await t.step(2);
  t.expect(await t.eval(()=>window.__voxelHeroes.screen().tileset)!=='whisperwood','the woodland tile kit leaves Mossbrook on its own tileset');
  writeFileSync(join(t.out,'ground-comparison.json'),JSON.stringify({baseline,rows,scope:description},null,2));
}

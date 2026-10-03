import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import thirdOrb from './watch-victory.mjs';

export const description='Fresh title through three earned victories and the native Brineglass fire-wand route. Actual Post Islands grapple, coast combat, patrol, map, counterweight, lock and guarded chest. Only ordinary movement, guard, sword and earned tools; no gear grants, health edits, immunity, teleports, direct damage or AI fixtures. Earlier movement endpoints settle within two normal steps; earned starter save roundtrip and diagnostic saves are disclosed. Speaker output disconnected.';
export const dirs={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
export async function select(t,id){
  for(let i=0;i<20;i++){if(await t.eval(id=>window.__voxelHeroes.game.inventory.selectedItem()?.id===id,id))return;await t.tap('next-item');}
  throw Error(`The native quick ring cannot select earned ${id}`);
}
export async function room(t,dir,key){
  if((await t.state()).key!==key)await t.exit(dir);await t.step(1.6);
  t.expect((await t.state()).key===key,`native ${dir} Brineglass travel reaches ${key}`);
}
export async function passage(t,x,z,key){
  if((await t.state()).key!==key)await t.enter(x,z);await t.step(1.6);
  t.expect((await t.state()).key===key,`the actual Brineglass passage reaches ${key}`);
}
export async function fight(t,label,item='boomerang'){
  await select(t,item);const r=await t.fight({heal:-1,guard:true,tool:true,clearObstacles:true,seconds:90,soft:true});
  t.note(`${label}: ${JSON.stringify(r)}`);t.expect(r.ok&&r.heals===0,`${label} clears through normal combat and earned ${item} without healing edits`);
}
export async function chest(t,x,z){await t.walkTo(x+.5,z+1.5);await t.stick(0,-1,.3);await t.step(2);}
export async function key(t,count,label){
  const drop=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  if(drop)await t.walkTo(drop.x,drop.z,{soft:true});
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===count,label);
}
export async function hook(t,x,z,facing,expected,label){
  await select(t,'grapple');await t.walkTo(x,z);await t.stick(...dirs[facing],1/60);const hp=(await t.state()).hp;
  await t.tap('item');await t.step(1.3);const p=await t.state();
  t.expect(expected(p)&&p.hp===hp&&!await t.eval(()=>window.__voxelHeroes.game.hero.hero.isPulled()),`${label}: actual hook finishes on safe floor (${p.lx},${p.lz})`);
}
export async function fire(t,x,z,facing){await select(t,'fire-wand');await t.walkTo(x,z);await t.stick(...dirs[facing],1/60);await t.tap('item');await t.step(.55);}
export const tile=(t,x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
export async function checkpoint(t,name){writeFileSync(join(t.out,`${name}.save.json`),JSON.stringify({description:'Earned from a fresh title through ordinary inputs. Diagnostic only; this case never loads this checkpoint.',snapshot:await t.state(),data:await t.save(),log:t.log},null,2));}

export async function afterThirdOrb(t){
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId())==='enter-d4','the earned third light points toward the coast');
  await room(t,'south','sunreach:2,1');await hook(t,9.5,8.5,'east',p=>p.lx>11,'Post Islands');
  await chest(t,13,8);await t.shot('90-native-post-islands');
  await room(t,'east','tidecoast:0,1');await fight(t,'Hookshore Landing');await t.shot('91-native-hookshore');
  await room(t,'east','tidecoast:1,1');await fight(t,'Tide Garden');
  await room(t,'north','tidecoast:1,0');await fight(t,'Brineglass approach');
  await passage(t,8.5,6.5,'d4:2,3');await t.shot('92-native-brineglass-vestibule');
  await room(t,'west','d4:1,3');await fight(t,'Lantern Patrol');await key(t,1,'native lantern combat gives the first Brineglass key');await t.shot('93-native-lantern-key');
  await room(t,'north','d4:1,2');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasMap('d4')),'the actual Tide Charts chest gives the two-floor map');await t.shot('94-native-tide-charts');
  await room(t,'west','d4:0,2');await t.walkTo(4.5,7.5);await t.stick(1,0,4.5);await t.step(.5);await t.walkTo(8.5,3.5);
  await key(t,2,'the real sluice counterweight releases the second Brineglass key');await t.shot('95-native-sluice-weight');
  await room(t,'east','d4:1,2');await room(t,'east','d4:2,2');await t.walkTo(13.5,6);await t.stick(1,0,.85);await room(t,'east','d4:3,2');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===1,'the real Glass Junction east lock spends one earned key');
  await fight(t,'Ember Cache');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('fire-wand')),'normal guard combat and physical cache opening give the earned Fire Wand');
  await t.shot('96-native-fire-wand');await checkpoint(t,'96-earned-fire-wand');
}
export default async function(t){await thirdOrb(t);await afterThirdOrb(t);}

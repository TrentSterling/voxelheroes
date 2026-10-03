import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import secondOrb from './nursery-victory.mjs';

export const description = 'Fresh title through two earned temple victories, actual Sunreach road and Watch grapple cache. Ordinary walking, sword, guard, owned tools, fused bombs, inn menu, patrol key, counterweight and chests. No gear grants, teleport, health edits, direct damage, enemy removal or immunity fixtures. Earlier movement endpoints settle within two ordinary steps. Starter gear uses its earned save roundtrip; diagnostic checkpoints are saved and never loaded. Speaker output disconnected.';

async function select(t,id) {
  for(let n=0;n<16;n++) {
    if(await t.eval(id=>window.__voxelHeroes.game.inventory.selectedItem()?.id===id,id))return;
    await t.tap('next-item');
  }
  throw Error(`Native item ring cannot select earned ${id}`);
}
async function room(t,dir,key) {
  if((await t.state()).key!==key)await t.exit(dir);
  await t.step(1.6);t.expect((await t.state()).key===key,`native ${dir} travel reaches ${key}`);
}
async function passage(t,x,z,key) {
  if((await t.state()).key!==key)await t.enter(x,z);
  await t.step(1.6);t.expect((await t.state()).key===key,`ordinary passage reaches ${key}`);
}
async function fight(t,label) {
  await select(t,'boomerang');
  const result=await t.fight({heal:-1,guard:true,tool:true,clearObstacles:true,seconds:90,soft:true});
  t.note(`${label}: ${JSON.stringify(result)}`);
  t.expect(result.ok&&result.heals===0,`${label} clears with earned tools and no healing edits`);
}
async function collectKey(t,expected,label) {
  const drop=await t.eval(()=>{
    const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');
    return e?{x:e.x-s.x0,z:e.z-s.z0}:null;
  });
  if(drop)await t.walkTo(drop.x,drop.z,{soft:true});
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===expected,label);
}
async function chest(t,x,z) {
  await t.walkTo(x+.5,z+1.5);await t.stick(0,-1,.3);await t.step(2);
}

export default async function(t) {
  await secondOrb(t);
  await passage(t,8.5,15.5,'forest:1,0');
  await room(t,'south','forest:1,1');await fight(t,'Native Mothwater homecoming');
  await room(t,'south','forest:1,2');await fight(t,'Native Northwood homecoming');
  await room(t,'south','v1:1,0');await room(t,'south','v1:1,1');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId())==='enter-d3','the second light directs the returning hero toward Sunreach');
  await t.shot('60-native-second-light-home');
  await room(t,'east','v1:2,1');await room(t,'east','sunreach:0,1');
  await t.shot('61-native-dustfall');
  await select(t,'bombs');await t.walkTo(6.8,7.5);await t.stick(1,0,.05);await t.tap('item');
  await t.walkTo(4.5,7.5);await t.step(2.4);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+8,s.z0+7)==='s'&&h.world.tile(s.x0+8,s.z0+8)==='s';}),'earned powder opens both Dustfall road stones');
  await fight(t,'Dustfall Road');
  await room(t,'east','sunreach:1,1');await t.shot('62-native-sandglass-oasis');
  const inn=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='npc-inn');return {x:e.x-s.x0,z:e.z-s.z0};});
  const coins=await t.eval(()=>window.__voxelHeroes.state.coins);
  await t.walkTo(inn.x,inn.z+1.15);await t.stick(0,-1,.05);await t.tap('sword');
  t.note('Inn approach: '+JSON.stringify(await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='npc-inn');return {clock:h.state.clock,mode:h.state.mode,guard:h.input.held('guard'),name:e.name,out:e.out,slot:e.slotNow(),visible:e.holder.visible,rig:!!e.rig,model:!!e.model,position:{x:e.x-h.screen().x0,z:e.z-h.screen().z0},hero:{x:h.player.x-h.screen().x0,z:h.player.z-h.screen().z0,yaw:h.player.yaw},mind:e.mind};})));
  t.expect((await t.state()).mode==='dialog','ordinary action opens the oasis inn conversation');
  await t.eval(async()=>{const h=window.__voxelHeroes;let quiet=0;for(let i=0;i<600&&quiet<25;i++){if(i%20===0&&h.state.mode!=='play')h.input.tap('confirm');await h.tick();quiet=h.state.mode==='play'?quiet+1:0;}});await t.step(2);
  t.expect(await t.eval(n=>{const h=window.__voxelHeroes;return h.state.coins===n-30&&h.state.hp===h.state.maxHp&&h.state.respawn.area==='sunreach';},coins),'the actual paid inn choice refills life and sets the earned Sunreach respawn');
  await room(t,'north','sunreach:1,0');await fight(t,'Dry River Crossing');
  await room(t,'east','sunreach:2,0');await fight(t,'Buried Watch approach');
  await passage(t,8.5,6.5,'d3:2,3');await t.shot('63-native-watchkeeper-vestibule');
  await room(t,'west','d3:1,3');await fight(t,'Shield Patrol');await collectKey(t,1,'ordinary patrol combat earns the first Watch key');
  await t.shot('64-native-shield-patrol-key');
  await room(t,'north','d3:1,2');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasMap('d3')),'the native Watch Charts chest awards the two-floor map');
  await t.shot('65-native-watch-map');
  await room(t,'west','d3:0,2');await t.walkTo(4.5,7.5);await t.stick(1,0,4.5);await t.step(1);
  await collectKey(t,2,'the real counterweight releases a second physical Watch key');
  await t.shot('66-native-counterweight');
  await room(t,'east','d3:1,2');await room(t,'east','d3:2,2');
  await t.walkTo(13.5,6);await t.stick(1,0,.85);await room(t,'east','d3:3,2');
  await fight(t,'Chain Vault');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('grapple')),'ordinary guarded chest interaction gives the earned Watch grapple');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===1,'the actual eastern lock spends just one earned key');
  await t.walkTo(3.5,7.45);await t.stick(0,-1,1/60);await t.tap('sword');
  t.expect((await t.state()).hp===(await t.state()).maxHp,'the actual platform rest clock restores hearts after the guarded grapple');
  t.expect((await t.state()).hp>0&&await t.eval(()=>window.__voxelHeroes.player.invT<2),'the fresh three-temple route reaches the hook without healing or immunity edits');
  await t.shot('67-native-watch-grapple');
  writeFileSync(join(t.out,'67-earned-watch-grapple.save.json'),JSON.stringify({description:'Earned by fresh normal-input adventures; diagnostic only, not loaded by this case.',snapshot:await t.state(),data:await t.save(),log:t.log},null,2));
}

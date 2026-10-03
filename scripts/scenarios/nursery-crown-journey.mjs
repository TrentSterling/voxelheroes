import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import journey from './nursery-journey.mjs';

export const description = 'Fresh title through the first orb and Rootglass to the crown antechamber. Actual walking, earned bombs, returning wood, pressure seals, keys and entrance shortcut. No teleport, gear grants, direct damage, actor removal, health edits, invulnerability or AI overrides. Exact movement endpoints settle within two ordinary steps. Native saved checkpoints are retained for diagnosis; this run does not load them. Speaker output disconnected.';

const keyCount = t => t.eval(() => window.__voxelHeroes.game.keys.keyCount('d2'));
const tile = (t,x,z) => t.eval(([x,z]) => {
  const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);
},[x,z]);
const checkpoint = async (t,name) => writeFileSync(join(t.out,`${name}.save.json`),JSON.stringify({
  description:'Earned entirely by the fresh ordinary-input journey; this case does not restore it.',
  snapshot:await t.state(),data:await t.save(),log:[...t.log],
},null,2));
async function room(t,dir,key) {
  if ((await t.state()).key!==key) await t.exit(dir);
  await t.step(1.6);t.expect((await t.state()).key===key,`native ${dir} travel reaches ${key}`);
}
async function passage(t,x,z,key) {
  if ((await t.state()).key!==key) await t.enter(x,z);
  await t.step(1.6);t.expect((await t.state()).key===key,`ordinary walking through the breach reaches ${key}`);
}
async function select(t,id) {
  for(let n=0;n<12;n++) {
    if (await t.eval(id=>window.__voxelHeroes.game.inventory.selectedItem()?.id===id,id)) return;
    await t.tap('next-item');
  }
  throw Error(`The native quick ring could not select earned ${id}`);
}
async function fight(t,label,options={}) {
  await select(t,'boomerang');
  const result=await t.fight({heal:-1,guard:true,tool:true,clearObstacles:true,seconds:90,soft:true,...options});
  t.note(`${label}: ${JSON.stringify(result)}`);
  t.expect(result.ok&&result.heals===0,`${label} clears with earned tools and no healing edits`);
}
async function collectKey(t,expected,label) {
  const drop=await t.eval(()=>{
    const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');
    return e?{x:e.x-s.x0,z:e.z-s.z0}:null;
  });
  if (drop) await t.walkTo(drop.x,drop.z,{soft:true});
  t.expect(await keyCount(t)===expected,label);
}
async function bomb(t,x,z,dx,dz,retreatX,retreatZ) {
  await select(t,'bombs');await t.walkTo(x,z);await t.stick(dx,dz,1/60);
  const before=await t.eval(()=>window.__voxelHeroes.game.inventory.ammo('bombs'));
  await t.tap('item');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))===before-1,'ordinary item input plants one earned bomb');
  await t.walkTo(retreatX,retreatZ);await t.step(2.3);
}
async function lock(t,next,expectedKeys) {
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north',next);
  t.expect(await keyCount(t)===expectedKeys,'the actual north lock consumes exactly one earned key');
}

export default async function(t) {
  await journey(t);await checkpoint(t,'38-earned-powder-cache');
  await t.track('hive-valve-released','hive-pressure-burst','player-hurt','switch-pressed','item-used');
  await room(t,'east','d2:2,2');
  await bomb(t,13.5,6,1,0,11.5,6);
  t.expect(await tile(t,15,5)==='y','a real bomb opens the eastern stone seam');
  await t.shot('40-native-first-breach');
  await passage(t,15.5,5.5,'d2:3,2');await fight(t,'Breached Gallery gazers');
  await room(t,'north','d2:3,1');await checkpoint(t,'41-earned-nursery-entry');
  await t.shot('41-native-pressure-nursery');
  // Clear pursuing guardians before standing beside seals with a live fuse.
  // The machine stays active throughout this ordinary-input fight.
  await fight(t,'Crossfire Nursery guardians before fuse work',{maxKills:3});
  for(const [index,x,z,rx,rz] of [[0,4.5,4.5,2.5,6],[1,11.5,9.5,13.5,6],[2,11.5,4.5,13.5,6]]) {
    await bomb(t,x,z,0,-1,rx,rz);
    t.expect(await t.eval(i=>window.__voxelHeroes.state.flags.has(`dungeon:d2:nursery-valve:${i}`),index),`native fuse breaks brass seal ${index+1}`);
    await t.shot(`42-native-pressure-seal-${index+1}`);
  }
  await fight(t,'Crossfire Nursery wardens');await t.step(.3);
  await collectKey(t,1,'quieting the actual nursery and defeating its guards earns the second small key');
  t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d2:nursery-vented')),'the nursery clock is permanently quiet');
  await t.shot('43-native-quiet-nursery');await checkpoint(t,'43-earned-quiet-nursery');
  await room(t,'south','d2:3,2');await fight(t,'Returning gallery gazers');
  await bomb(t,13.5,6,1,0,11.5,6);
  await passage(t,15.5,5.5,'d2:4,2');
  await t.walkTo(8.5,5.5);await t.stick(0,-1,.3);await t.step(2);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('d2')),'the real eastern chest gives the amber crown key');
  await t.shot('44-native-amber-key');
  await passage(t,.5,5.5,'d2:3,2');await fight(t,'Western return gazers');
  await passage(t,.5,5.5,'d2:2,2');await lock(t,'d2:2,1',0);await fight(t,'Mossbridge brass pollinators');
  await room(t,'west','d2:1,1');await select(t,'boomerang');
  for(const x of [3.5,5.5,12.5]) {
    await t.walkTo(x,1.9);await t.stick(0,-1,1/60);await t.tap('item');await t.step(.75);
  }
  await collectKey(t,1,'three ordinary returning-wood throws earn the final small key');
  await t.shot('45-native-three-watchers');
  await room(t,'east','d2:2,1');await fight(t,'Mossbridge return');await lock(t,'d2:2,0',0);
  await t.walkTo(8.5,6.5);await t.step(.2);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d2:portal')),'the real floor switch opens Rootglass entrance travel');
  await passage(t,3.5,8.5,'d2:2,4');await passage(t,12.5,8.5,'d2:2,0');
  await t.walkTo(11.5,7.45);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.2);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))===10,'actual interaction with the crown supply refills the earned bomb bag');
  t.expect((await t.state()).hp>0&&await t.eval(()=>window.__voxelHeroes.player.invT<2),'a fresh adventure reaches the crown alive without health or immunity edits');
  await t.shot('46-native-crown-antechamber');await checkpoint(t,'46-earned-crown');
}

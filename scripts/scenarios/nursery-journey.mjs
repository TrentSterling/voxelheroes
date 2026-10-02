import firstOrb from './barrow-victory.mjs';
export const description = 'Fresh title through the real first orb, native homecoming, Whisperwood and Rootglass bomb cache. Ordinary walking, sword/guard, owned boomerang and real chests only. No teleport, gear grants, direct damage, actor removal, health edits or invulnerability. Outdoor combat may carry the hero through the authored forest entrance; gated dungeon fights must clear. Native fight healing disabled; movement endpoints settle within two ordinary steps. Browser output muted.';

async function room(t, dir, key) {
 if ((await t.state()).key !== key) await t.exit(dir);
 await t.step(1.6);
 t.expect((await t.state()).key === key, `native ${dir} travel reaches ${key}`);
}
async function fight(t, label, forward = null) {
 // Let maze fliers leave an unreachable edge instead of repeatedly stunning them.
 const useTool = (await t.state()).area !== 'lost-woods';
 const result = await t.fight({heal:-1, guard:true, tool:useTool, clearObstacles:true, seconds:90, soft:true});
 t.note(`${label}: ${JSON.stringify(result)}`);
 if (!result.ok) {
  // Keep diagnostics primitive. Returning alertMesh serializes its scene.
  const actors = await t.eval(() => {
   const h = window.__voxelHeroes;
   return h.entities.filter(e => e.kind === 'enemy').map(e => ({
    type:e.type, x:e.x, z:e.z, hp:e.hp, r:e.r, spawned:e.spawned,
    spawnT:e.spawnT, grow:e.growT, stunT:e.stunT, knockT:e.knockT,
    ai:{fly:e.ai.fly, wander:e.ai.wander, charge:e.ai.charge, tellT:e.ai.tellT, alertT:e.ai.alertT},
    frozenT:e.frozenT, blocked:h.world.blocked(e.x,e.z,e.r,e),
   }));
  });
  t.note('Stopped actors: ' + JSON.stringify(actors));
 }
 const advanced = forward && result.reason === 'left the screen' && (await t.state()).key === forward;
 t.expect((result.ok || advanced) && result.heals === 0, `${label} clears or takes its authored forward passage with native tools and no healing edits`);
}
async function warp(t, x, z, key) {
 if ((await t.state()).key !== key) await t.enter(x,z);
 await t.step(1.6);
 t.expect((await t.state()).key === key, `walking into the authored passage reaches ${key}`);
}
async function chest(t, x, z) {
 await t.walkTo(x+.5,z+1.5);
 await t.stick(0,-1,.3);
 await t.step(2);
}

export default async function(t) {
 await firstOrb(t);
 for (const [dir,key] of [['north','ow-3-2:1,1'],['east','ow-3-2:2,1'],['east','v1:0,1'],['east','v1:1,1']]) await room(t,dir,key);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId()) === 'enter-d2', 'the earned first orb gives the northward temple objective back in Mossbrook');
 await t.shot('30-native-first-orb-home');
 await room(t,'north','v1:1,0');
 await room(t,'north','forest:1,2');await fight(t,'Northwood Trail');await t.shot('31-native-northwood');
 await room(t,'north','forest:1,1');await fight(t,'Mothwater Crossing');
 await room(t,'north','forest:1,0');await t.shot('32-native-carved-stone');
 await fight(t,'Carved Stone Clearing','lost-woods:0,0');
 await warp(t,8.5,3.5,'lost-woods:0,0');await fight(t,'The First Wind');
 for (const [x,z,key] of [[8.5,.5,'lost-woods:1,0'],[.5,8.5,'lost-woods:2,0'],[15.5,8.5,'lost-woods:3,0'],[8.5,.5,'lost-woods:4,0']]) {
  await warp(t,x,z,key);await fight(t,(await t.state()).screenName);
 }
 await t.shot('33-native-amber-gate');
 await warp(t,8.5,3.5,'d2:2,4');await t.shot('34-native-rootglass-mouth');
 await room(t,'east','d2:3,4');await fight(t,'Broken Patrol');await t.step(.5);
 const drop = await t.eval(()=>{
  const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');
  return e ? {x:e.x-s.x0,z:e.z-s.z0} : null;
 });
 // Collection can finish beside a moved statue before reaching the old drop centre.
 if (drop) await t.walkTo(drop.x,drop.z,{soft:true});
 t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d2')) === 1, 'native patrol combat earns the first Rootglass small key');
 await t.shot('35-native-nursery-patrol-key');
 await room(t,'west','d2:2,4');await room(t,'north','d2:2,3');await chest(t,8,4);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasMap('d2')), 'the actual north map chest gives the Rootglass map');
 await t.shot('36-native-nursery-map');
 await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north','d2:2,2');
 t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d2')) === 0, 'the real northern lock spends the earned patrol key');
 await room(t,'west','d2:1,2');await fight(t,'Powder Cache');await chest(t,8,4);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('bombs')), 'the native guarded chest gives the bomb bag without a shop purchase');
 await t.shot('37-native-bomb-cache');
 t.expect((await t.state()).hp > 0 && await t.eval(()=>window.__voxelHeroes.player.invT<2), 'the fresh second-temple route reaches its real tool alive without test invulnerability');
}

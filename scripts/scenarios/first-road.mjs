import opening from './opening.mjs';
export const description = 'Native fresh opening, Tinker Wyll boots, actual dash and guard braking, then west through real Barrowfield fights to the first dungeon key. Walking, sword input, loot and chests only; no teleport, invulnerability, direct enemy damage, healing edits or granted gear. Fight helper healing is disabled. Browser output muted and NPC speech disabled.';
export default async function(t) {
  await opening(t);
  await t.walkTo(13.5,6.6);
  await t.stick(0,-1,1/60); await t.tap('sword');
  t.expect(await t.eval(() => window.__voxelHeroes.game.dialog.dialogView()?.speaker === 'Tinker Wyll'), 'actual walking and action input reach Tinker Wyll');
  for(let n=0;n<80&&(await t.state()).mode==='dialog';n++) await t.tap('confirm');
  t.expect(await t.eval(() => window.__voxelHeroes.state.gear.boots === 'boots-dash'), 'Wyll grants working Sprint Boots through his real conversation');
  await t.shot('06-native-boots'); await t.step(2);
  // The dash extends the blade. Use the long, clear lane instead of pointing
  // it at the inn wall from the short crossing beside the square's pond.
  await t.exit('south'); await t.stick(0,1,1/60);
  const before=await t.state(); await t.tap('dash'); await t.step(.3);
  t.expect(await t.eval(() => !!window.__voxelHeroes.player.dashing), 'actual dash input revs and accelerates with the earned boots');
  t.expect((await t.state()).z > before.z+.5, 'the earned boots move the hero along the actual town lane');
  await t.eval(() => window.__voxelHeroes.input.down('guard')); await t.step(.1);
  t.expect(await t.eval(() => !window.__voxelHeroes.player.dashing&&window.__voxelHeroes.player.guarding), 'actual held guard brakes the dash and raises the owned shield');
  await t.eval(() => window.__voxelHeroes.input.up('guard')); await t.step(.1);
  await t.exit('north');
  for(const [dir,key] of [['west','v1:0,1'],['west','ow-3-2:2,1'],['west','ow-3-2:1,1'],['south','ow-3-2:1,2']]) {
    await t.exit(dir); t.expect((await t.state()).key === key, `actual road travel reaches ${key}`);
    if(key.startsWith('ow-3-2:')) {
      await t.shot('07-before-fight-'+key.split(':')[1].replace(',','-'));
      const fight=await t.fight({heal:-1,guard:true,seconds:75,soft:true});
      t.note(`Native fight ${key}: ${JSON.stringify(fight)}`);
      t.expect(fight.heals===0, `${key}: combat does not use automatic test healing`);
      t.expect(fight.ok, `${key}: native sword combat survives and clears the road (${fight.reason??'clear'})`);
    }
  }
  await t.walkTo(4.5,10.4); await t.stick(0,1,1/60); await t.tap('sword');
  t.expect((await t.state()).hp === (await t.state()).maxHp, 'actual spring interaction restores health before the dungeon');
  t.expect(await t.eval(()=>['Hearts restored.','Hearts already full.'].includes(window.__voxelHeroes.game.toast.toastView().text)), 'the actual action reaches the spring rather than merely starting at full health');
  await t.shot('08-wayside-spring');
  await t.walkTo(7.5,8.5); await t.stick(0,-1,.6); await t.step(2);
  t.expect((await t.state()).key === 'd1:3,9', 'walking through the actual barrow doorway enters Barrow Mouth');
  await t.shot('08-first-dungeon');
  await t.exit('east'); await t.step(1);
  t.expect((await t.state()).key === 'd1:4,9', 'native movement enters the first dungeon combat room');
  const fight=await t.fight({heal:-1,guard:true,seconds:90,soft:true});
  t.note(`Native first key fight: ${JSON.stringify(fight)}`);
  t.expect(fight.ok&&fight.heals===0, 'native sword attacks win the first dungeon fight without invulnerability or healing edits');
  await t.step(.5);
  const pickup=await t.eval(() => {const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  if(pickup) await t.walkTo(pickup.x,pickup.z);
  t.expect(await t.eval(() => window.__voxelHeroes.game.keys.keyCount('d1') === 1), 'walking over the earned drop collects the first small key');
  await t.shot('09-first-key-earned');
}

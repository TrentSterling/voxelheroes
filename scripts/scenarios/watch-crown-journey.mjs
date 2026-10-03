import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import grappleJourney from './watch-journey.mjs';

export const description = 'Fresh title through two bosses and the real third-temple crown route. Earned grapple crossings, chest hooks, returning-eye puzzle, actual sentries, passive Sun Dial, second lock and entrance shortcut. No gear grants, teleport, health edits, direct damage, enemy removal, immunity or AI fixtures. Earlier movement endpoints settle within two ordinary steps. Diagnostic saves are never loaded; all speaker output disconnected.';
const dirs={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
async function select(t,id) {
  for(let n=0;n<16;n++){
    if(await t.eval(id=>window.__voxelHeroes.game.inventory.selectedItem()?.id===id,id))return;
    await t.tap('next-item');
  }
  throw Error(`Native item ring cannot select earned ${id}`);
}
async function room(t,dir,key) {
  if((await t.state()).key!==key)await t.exit(dir);
  await t.step(1.6);t.expect((await t.state()).key===key,`native ${dir} Watch travel reaches ${key}`);
}
async function passage(t,x,z,key) {
  if((await t.state()).key!==key)await t.enter(x,z);
  await t.step(1.6);t.expect((await t.state()).key===key,`ordinary Watch passage reaches ${key}`);
}
async function chest(t,x,z){await t.walkTo(x+.5,z+1.5);await t.stick(0,-1,.3);await t.step(2);}
async function hook(t,x,z,facing,expected,label){
  await select(t,'grapple');await t.walkTo(x,z);await t.stick(...dirs[facing],1/60);
  const hp=(await t.state()).hp;await t.tap('item');await t.step(1.3);
  const p=await t.state();
  t.expect(expected(p)&&p.hp===hp&&!await t.eval(()=>window.__voxelHeroes.game.hero.hero.isPulled()),`${label}: earned hook lands on safe floor without damage (${p.lx},${p.lz})`);
}
async function fight(t,label,maxKills=null){
  await select(t,'boomerang');
  const result=await t.fight({heal:-1,guard:true,tool:true,clearObstacles:true,seconds:90,soft:true,...(maxKills?{maxKills}:{} )});
  t.note(`${label}: ${JSON.stringify(result)}`);t.expect(result.ok&&result.heals===0,`${label} clears with native tools and no healing edits`);
}
export default async function(t){
  await grappleJourney(t);
  await room(t,'south','d3:3,3');await hook(t,6.3,6.5,'east',p=>p.lx>10,'First Cast');await t.shot('70-native-first-cast');
  await room(t,'east','d3:4,3');await hook(t,8.5,7.7,'north',p=>p.lz<4,'Chest Island north');
  const coins=await t.eval(()=>window.__voxelHeroes.state.coins);await chest(t,8,2);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.coins)===coins+90,'the earned hook reaches the real ninety-coin island chest');await t.shot('71-native-chest-island');
  await hook(t,8.5,3.5,'south',p=>p.lz>7,'Chest Island return');await room(t,'west','d3:3,3');
  await hook(t,10.6,6.5,'west',p=>p.lx<7,'First Cast return');await room(t,'north','d3:3,2');
  await room(t,'west','d3:2,2');await room(t,'north','d3:2,1');await room(t,'west','d3:1,1');
  await select(t,'boomerang');
  for(const x of[3.5,12.5]){await t.walkTo(x,2);await t.stick(0,-1,1/60);await t.tap('item');await t.step(.5);}
  t.expect(await t.eval(()=>window.__voxelHeroes.state.colorKeys.blue)===1,'two ordinary returning throws wake the Watch blue eyes');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north','d3:1,0');
  const pieces=await t.eval(()=>window.__voxelHeroes.state.heartPieces);await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.heartPieces)===pieces+1,'the earned blue-vault chest yields one permanent heart fragment');await t.shot('72-native-sapphire-vault');
  await room(t,'south','d3:1,1');await room(t,'east','d3:2,1');
  await hook(t,8.5,7.7,'north',p=>p.lz<4,'Broken Stair');await passage(t,7.5,.5,'d3:2,7');await t.shot('73-native-upper-landing');
  await room(t,'west','d3:1,7');await fight(t,'Hook and Guard');await chest(t,8,3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('sun-dial')),'normal sentry combat and its actual cache earn the passive Sun Dial');await t.shot('74-native-sun-dial');
  await room(t,'east','d3:2,7');await room(t,'north','d3:2,6');
  await hook(t,8.5,7.7,'north',p=>p.lz<4,'The Missing Bridge');await t.shot('75-native-missing-bridge');
  await hook(t,8.5,3.5,'south',p=>p.lz>7,'Missing Bridge return');await room(t,'east','d3:3,6');
  await fight(t,'Crossing Arsenal western sentry',1);await hook(t,6.3,6.5,'east',p=>p.lx>10,'Crossing Arsenal bank');
  await fight(t,'Crossing Arsenal eastern sentry');await room(t,'east','d3:4,6');
  await hook(t,8.5,8.3,'north',p=>p.lz<4,'Watchkeeper Crown');await chest(t,8,2);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('d3')),'the earned grapple opens the actual Watch crown chest');await t.shot('76-native-watchkeeper-crown');
  await hook(t,8.5,3.5,'south',p=>p.lz>8,'Watchkeeper Crown return');await room(t,'west','d3:3,6');
  await hook(t,10.6,6.5,'west',p=>p.lx<7,'Crossing Arsenal return');await room(t,'west','d3:2,6');
  await hook(t,8.5,7.7,'north',p=>p.lz<4,'Missing Bridge crown return');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north','d3:2,5');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===0,'the second actual Watch lock spends the counterweight key');
  await t.walkTo(8.5,6.5);await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('dungeon:d3:portal')),'stepping on the real antechamber plate wakes the entrance shortcut');
  await passage(t,3.5,8.5,'d3:2,3');await passage(t,12.5,8.5,'d3:2,5');
  await t.walkTo(5.5,9.45);await t.stick(0,-1,1/60);await t.tap('sword');
  t.expect((await t.state()).hp===(await t.state()).maxHp,'the real antechamber rest clock prepares an earned full-life boss attempt');
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  await t.shot('78-native-platform-rest');
  t.expect((await t.state()).hp>0&&await t.eval(()=>window.__voxelHeroes.player.invT<2),'the earned Watch route reaches the Colossus alive without health or immunity edits');
  await t.shot('77-native-colossus-antechamber');
  writeFileSync(join(t.out,'77-earned-watch-crown.save.json'),JSON.stringify({description:'Earned by fresh normal-input adventures; diagnostic only, not loaded by this case.',snapshot:await t.state(),data:await t.save(),log:t.log},null,2));
}

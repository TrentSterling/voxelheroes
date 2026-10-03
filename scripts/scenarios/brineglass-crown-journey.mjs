import fireWandJourney,{room,passage,fight,chest,key,hook,fire,tile,select,checkpoint} from './brineglass-journey.mjs';

export const description='Fresh title through three earned victories and the actual fourth-temple crown. Native fire melting, optional island reward, four small keys, Warden blade selected through the Equipment screen, ice-shell combat, magic shield, Ember Lens and upper ember gates. No gear grants, health edits, immunity, teleport, direct damage, enemy removal or AI fixtures. Ancestor movement endpoint settling and diagnostic saves are disclosed; this fresh case never loads those saves. Speaker output disconnected.';

async function equipWarden(t){
  await t.press('Tab');
  for(let i=0;i<10&&await t.eval(()=>window.__voxelHeroes.game.equipment.equipmentView().selectedId!=='blade-warden');i++)await t.tap('next-item');
  await t.press('Enter');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.swords.equippedId())==='blade-warden','the newly earned Warden blade is equipped through the actual Equipment screen');
  await t.shot('101-native-warden-equipment');await t.press('Tab');
}
export async function afterFireWand(t){
  await room(t,'south','d4:3,3');
  for(let i=0;i<3;i++)await fire(t,8.5,3.1,'south');
  t.expect(await tile(t,8,4)==='.'&&await tile(t,8,5)==='.'&&await tile(t,8,6)==='.','three actual base-wand bolts open the First Thaw lane');
  await t.walkTo(8.5,8);await t.shot('97-native-first-thaw');await room(t,'east','d4:4,3');
  await hook(t,8.5,7.7,'north',p=>p.lz<4,'Stillwater Gift');
  const pieces=await t.eval(()=>window.__voxelHeroes.state.heartPieces);await chest(t,8,2);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.heartPieces)===pieces+1,'the earned grapple opens the physical Stillwater heart-piece chest');await t.shot('98-native-stillwater-gift');
  await hook(t,8.5,3.5,'south',p=>p.lz>7,'Stillwater return');await room(t,'west','d4:3,3');await room(t,'north','d4:3,2');await fight(t,'Ember Cache return','fire-wand');await room(t,'north','d4:3,1');
  for(const x of[3.5,12.5])await fire(t,x,5,'north');await t.walkTo(8.5,6.5);await key(t,2,'two real ember bowls release the third earned temple key');await t.shot('99-native-twin-bowls');
  await room(t,'south','d4:3,2');await room(t,'west','d4:2,2');await room(t,'west','d4:1,2');await room(t,'south','d4:1,3');await fight(t,'Lantern Patrol return');
  await t.walkTo(2.5,6);await t.stick(-1,0,.85);await room(t,'west','d4:0,3');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.swords.hasSword('blade-warden')),'the actual optional Warden Legacy vault grants its blade');await equipWarden(t);
  await room(t,'east','d4:1,3');await room(t,'north','d4:1,2');await room(t,'east','d4:2,2');await room(t,'east','d4:3,2');await room(t,'east','d4:4,2');
  await fight(t,'Pressure Patrol','fire-wand');await key(t,2,'native ice-shell combat gives the fourth small key');await t.shot('102-native-pressure-patrol');
  await room(t,'west','d4:3,2');await room(t,'west','d4:2,2');await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north','d4:2,1');await room(t,'west','d4:1,1');
  await select(t,'boomerang');
  for(const x of[3.5,12.5]){await t.walkTo(x,2);await t.stick(0,-1,1/60);await t.tap('item');await t.step(.5);}
  t.expect(await t.eval(()=>window.__voxelHeroes.state.colorKeys.blue)===1,'two actual returning throws wake the Tidekeeper blue gate');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north','d4:1,0');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.gear.shield)===3,'the actual Tidekeeper chest equips the magic shield for Nacre ink');await t.shot('103-native-magic-shield');
  await room(t,'south','d4:1,1');await room(t,'east','d4:2,1');await passage(t,7.5,.5,'d4:2,7');await room(t,'west','d4:1,7');await room(t,'west','d4:0,7');
  await fight(t,'Kiln of the First Light','fire-wand');await chest(t,8,3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('ember-lens')),'actual kiln skaters and their physical cache earn the Ember Lens');await t.shot('104-native-ember-lens');await checkpoint(t,'104-earned-ember-lens');
  await room(t,'east','d4:1,7');for(const x of[3.5,12.5])await fire(t,x,5,'north');await room(t,'north','d4:1,6');
  for(let i=0;i<2;i++)await fire(t,8.5,7.7,'north');await t.walkTo(8.5,5.5);
  for(let i=0;i<4;i++)await fire(t,8.5,5.5,'west');await t.step(.8);await room(t,'west','d4:0,6');
  for(const x of[5.5,10.5])await fire(t,x,9,'north');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('d4')),'two native crown flames expose the actual Brineglass boss key');await t.shot('105-native-crown-of-tide');
  await room(t,'east','d4:1,6');await t.walkTo(8.5,5.5);await t.walkTo(8.5,8);await room(t,'south','d4:1,7');await room(t,'east','d4:2,7');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north','d4:2,6');await hook(t,8.5,7.5,'north',p=>p.lz<4,'Tide Bridge');await room(t,'north','d4:2,5');
  await t.walkTo(8.5,6.5);await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('dungeon:d4:portal')),'the real Undertow plate wakes the return shortcut');
  await passage(t,3.5,8.5,'d4:2,3');await passage(t,12.5,8.5,'d4:2,5');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===0,'all four earned small keys pay for the wand, optional blade, stair and bridge');
  t.expect((await t.state()).hp>0&&await t.eval(()=>window.__voxelHeroes.player.invT<2),'the earned route reaches Undertow alive without health or immunity edits');
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  await t.shot('106-native-undertow-antechamber');await checkpoint(t,'106-earned-brineglass-crown');
}
export default async function(t){await fireWandJourney(t);await afterFireWand(t);}

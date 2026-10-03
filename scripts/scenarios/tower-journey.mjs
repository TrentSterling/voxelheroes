import fourthOrb from './brineglass-victory.mjs';
import { room, passage, fight, select, fire, chest, checkpoint } from './brineglass-journey.mjs';
import { queenRematch,colossusRematch,nacreRematch } from '../lib/native-tower-rematches.mjs';

export const description='Fresh title through four earned temples, actual coast road, four clock anchors and three native tower rematches. Independent floor keys, puzzles, maps, wells, Sage Iona, Bastion Shield and Dawn Blade through ordinary controls. No granted gear, health edits, immunity, direct damage, forced AI or loaded diagnostic saves. Movement helpers settle endpoints within two ordinary steps and the ancestor starter save roundtrip is disclosed. Speaker output disconnected.';

export async function answer(t){
  await t.eval(async()=>{const h=window.__voxelHeroes;let quiet=0;for(let i=0;i<1200&&quiet<25;i++){if(i%20===0&&h.state.mode!=='play')h.input.tap('confirm');await h.tick();quiet=h.state.mode==='play'?quiet+1:0;}});
  t.expect((await t.state()).mode==='play','normal confirmation finishes the spoken conversation');
}

export async function afterFourthOrb(t){
  await t.track('boss-defeated','hero-hit','item-used');
  await room(t,'south','tidecoast:1,1');await fight(t,'Tide Garden tower road');
  await room(t,'south','tidecoast:1,2');await fight(t,'Pilgrim Strand');await t.shot('140-native-pilgrim-strand');
  await room(t,'east','tidecoast:2,2');await fight(t,'Fourfold approach');
  await fire(t,8.5,5,'north');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+8,s.z0+3)!==';';}),'the earned fire wand burns the actual tree in front of the tower');
  await t.shot('141-native-fourfold-door');await passage(t,8.5,2.5,'tower-trial:0,0');
  await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot('142-native-first-reflection-intro');
  await t.waitFor(s=>s.mode==='play',{seconds:6});
  await t.walkTo(11.5,13.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))>=10,'ordinary interaction with the actual powder supply prepares the clock bomb');
  const use=async(id,x,z,wait=.65)=>{await select(t,id);await t.walkTo(x,z);await t.stick(0,-1,1/60);await t.tap('item');await t.step(wait);};
  await use('boomerang',4.5,9.5);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('tower:clock:return')),'an actual earned returning blade frees the Return winding');await t.shot('143-native-return-anchor');
  await use('bombs',17.5,9.15,.1);await t.stick(0,1,.5);await t.step(2.6);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('tower:clock:break')),'an actual placed bomb frees the brass Break winding');await t.shot('144-native-break-anchor');
  await use('grapple',7.5,13.5,1);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('tower:clock:draw')),'a real zero-damage grapple frees the Draw winding');await t.shot('145-native-draw-anchor');
  await use('fire-wand',14.5,13.5);await t.step(.3);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.game.state.hasFlag('tower:trial')&&h.game.state.hasFlag('tower:clock:kindle')&&!h.entities.some(e=>!e.removed&&e.type==='boss-bishop');}),'the fourth actual tool frees the city clock and fades its live reflections');
  t.expect((await t.state()).hp>0&&!await t.eval(()=>window.__voxelHeroes.entities.some(e=>!e.removed&&e.type==='heart-container')),'the earned hero survives the real clock pressure without an extra boss heart');await t.shot('146-native-clock-unwound');
  await passage(t,10.5,.5,'tower-hive:1,2');await fight(t,'Amber Memory patrol');
  const drop=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  if(drop)await t.walkTo(drop.x,drop.z);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('tower-hive'))===1,'actual amber patrol combat releases this floor\'s independent small key');await t.shot('147-native-amber-patrol-key');
  await t.walkTo(3.5,9.5);await t.stick(0,-1,1/60);await t.tap('sword');await answer(t);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('spell-truesight')),'actual conversation with Sage Iona teaches Truesight');await t.shot('148-native-iona-truesight');
  await select(t,'spell-truesight');await t.step(1.6);await t.tap('item');await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.effects.effectActive('truesight')),'Truesight learned as the first spell can actually be cast with the earned magic reserve');await t.shot('148a-native-first-spell-cast');
  await room(t,'west','tower-hive:0,2');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasMap('tower-hive')),'the actual Resting Light chest gives the amber map');
  await t.walkTo(4.5,8.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.4);
  t.expect((await t.state()).hp===(await t.state()).maxHp,'normal use of the physical amber well restores personal life');await t.shot('149-native-resting-light');
  await checkpoint(t,'149-earned-amber-entry');
  await afterAmberEntry(t);
}

async function rest(t){await t.walkTo(4.5,8.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.4);t.expect((await t.state()).hp===(await t.state()).maxHp,'ordinary use of the floor well restores the earned hero');}
async function arena(t,key,photo){await t.walkTo(7.5,1.5);await t.stick(0,-1,.8);await t.step(1.6);t.expect((await t.state()).key===key,'the earned floor crown opens '+key);await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.step(1.2);await t.shot(photo);await t.waitFor(s=>s.mode==='play',{seconds:6});await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);}
async function patrol(t,id,label){await fight(t,label);const drop=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='key');return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});if(drop)await t.walkTo(drop.x,drop.z);t.expect(await t.eval(id=>window.__voxelHeroes.game.keys.keyCount(id),id)===1,'the native '+id+' patrol gives its separate small key');}
async function gate(t,id){await t.walkTo(8,1.5);await t.stick(0,-1,.8);await room(t,'north',id+':1,1');t.expect(await t.eval(id=>window.__voxelHeroes.game.keys.keyCount(id),id)===0,'the actual paired gate spends one '+id+' key');}
async function crown(t,id,photo){await room(t,'west',id+':0,1');await chest(t,8,4);t.expect(await t.eval(id=>window.__voxelHeroes.game.dungeons.hasBossKey(id),id),'the actual '+id+' vault grants its crown key');await t.shot(photo);await room(t,'east',id+':1,1');}

export async function afterAmberEntry(t){
  await room(t,'east','tower-hive:1,2');await gate(t,'tower-hive');
  await select(t,'boomerang');for(const x of[3.5,12.5]){await t.walkTo(x,3.2);await t.stick(0,-1,1/60);await t.tap('item');await t.step(.55);}
  await t.shot('150-native-amber-windings');await crown(t,'tower-hive','151-native-amber-crown');
  await t.walkTo(12.5,9.5);await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))>=10,'the actual amber powder supply prepares the queen rematch');await select(t,'bombs');
  await arena(t,'tower-hive-boss:0,0','152-native-amber-rematch-intro');await queenRematch(t);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.bossDefeated('tower-hive')),'actual rematch victory opens the amber reward stair');
  await passage(t,10.5,.5,'tower-hive:1,0');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.gear.shield)===6,'the actual amber reward equips the Bastion Shield');await t.shot('156-native-bastion-shield');await rest(t);
  await passage(t,7.5,.5,'tower-watch:1,2');await patrol(t,'tower-watch','Sand Memory patrol');
  await room(t,'west','tower-watch:0,2');await chest(t,8,4);await rest(t);await t.shot('160-native-sand-rest');await room(t,'east','tower-watch:1,2');await gate(t,'tower-watch');
  await t.walkTo(4.5,7.5);await t.stick(1,0,4.5);await t.step(.4);await t.shot('161-native-sand-counterweight');await crown(t,'tower-watch','162-native-sand-crown');
  await arena(t,'tower-watch-boss:0,0','163-native-colossus-rematch-intro');await colossusRematch(t);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.bossDefeated('tower-watch')),'the native multipart rematch clears the sand memory');
  await passage(t,10.5,.5,'tower-watch:1,0');await chest(t,8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.swords.hasSword('blade-dawn')),'the actual sand reward grants Dawn Blade');
  await t.press('Tab');for(let i=0;i<12&&await t.eval(()=>window.__voxelHeroes.game.equipment.equipmentView().selectedId!=='blade-dawn');i++)await t.tap('next-item');await t.press('Enter');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.swords.equippedId())==='blade-dawn','the earned Dawn Blade is equipped through the normal Equipment screen');await t.shot('166-native-dawn-equipment');await t.press('Tab');await rest(t);
  await passage(t,7.5,.5,'tower-tide:1,2');await patrol(t,'tower-tide','Tide Memory patrol');
  await room(t,'west','tower-tide:0,2');await chest(t,8,4);await rest(t);await t.shot('170-native-tide-rest');await room(t,'east','tower-tide:1,2');await gate(t,'tower-tide');
  for(const x of[3.5,12.5])await fire(t,x,5,'north');await t.shot('171-native-tide-bowls');await crown(t,'tower-tide','172-native-tide-crown');
  await arena(t,'tower-tide-boss:0,0','173-native-nacre-rematch-intro');await nacreRematch(t);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.bossDefeated('tower-tide')),'the actual tide rematch clears the last memory');
  await passage(t,10.5,.5,'tower-tide:1,0');const money=(await t.state()).gems;await chest(t,8,4);t.expect((await t.state()).gems===money+1000,'the physical tide reward gives its thousand coins once');await t.shot('176-native-tide-treasury');await rest(t);
  await passage(t,7.5,.5,'tower-crown:1,2');await t.shot('180-native-crown-stair');await checkpoint(t,'180-earned-crown-stair');
}

export default async function(t){await fourthOrb(t);await afterFourthOrb(t);}

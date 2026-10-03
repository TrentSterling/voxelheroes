import crownJourney from './brineglass-crown-journey.mjs';
export const description='Fresh title through the earned fourth crown, natural death to Nacre attacks, actual Try Again, retained earned gear/keys/shortcut and physical return to the arena. Ordinary controls and passive waiting; no health/damage edits, immunity, teleport, forced AI, granted gear or loaded diagnostic save. Ancestor endpoint settling and starter save roundtrip disclosed. Speaker output disconnected.';
export default async function(t){
  await crownJourney(t);await t.track('hero-hit');
  const before=await t.state();await t.walkTo(8,1.5);await t.stick(0,-1,.8);await t.step(1.6);
  t.expect((await t.state()).area==='d4-boss','the earned hero enters Undertow for the recovery test');
  await t.waitFor(s=>s.mode==='play',{seconds:8});await t.step(90);
  t.expect((await t.state()).mode==='dead'&&(await t.state()).hp===0,'actual Nacre attacks defeat the idle hero without health edits');await t.shot('130-native-undertow-defeat');
  t.expect((await t.events('hero-hit')).some(e=>e.result==='hit'&&e.damage>0),'the defeat includes actual received enemy damage');
  await t.press('Enter');await t.step(1.6);
  t.expect((await t.state()).key==='d4:2,3'&&(await t.state()).hp===(await t.state()).maxHp,'actual Try Again restores health at the temple entrance');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.game.swords.equippedId()==='blade-warden'&&h.state.gear.shield===3&&h.game.inventory.hasItem('ember-lens')&&h.game.dungeons.hasBossKey('d4')&&h.game.keys.keyCount('d4')===0;}),'retry retains the earned blade, shield, lens and crown without refunding spent keys');
  await t.enter(12.5,8.5);await t.step(1.6);
  t.expect((await t.state()).key==='d4:2,5','the actual unlocked entrance shortcut returns directly to the antechamber');await t.shot('131-native-undertow-retry-shortcut');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await t.step(1.6);
  t.expect((await t.state()).area==='d4-boss'&&(await t.state()).maxHp===before.maxHp,'the actual open boss door permits another attempt with the earned capacity');
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>!e.removed&&e.type==='boss-beast').length===1),'retry creates one live Nacre body');await t.shot('132-native-undertow-retry');
}

import journey from './tower-journey.mjs';
import { afterCrownStair } from './tower-victory.mjs';
import { room,fight } from './brineglass-journey.mjs';
export const description='Fresh title through four temples, three memory rematches and actual Veyl victory. Natural Caldrin death, real Try Again and retained mask/gear/keys, physical crown return and exactly one final boss. No health edits, immunity, damage APIs, teleports, grants, forced AI or loaded diagnostics. Ancestor endpoint settling and earned starter save roundtrip disclosed. Speaker output disconnected.';
export default async function(t){
  await journey(t);await afterCrownStair(t,{enterOnly:true});await t.track('hero-hit');
  const before=await t.state();await t.step(90);
  t.expect((await t.state()).mode==='dead'&&(await t.state()).hp===0,'actual Hollow Crown attacks naturally defeat the idle earned hero');
  t.expect((await t.events('hero-hit')).some(e=>e.result==='hit'&&e.damage>0),'the final defeat includes actual received enemy damage');await t.shot('191-native-crown-defeat');
  await t.press('Enter');await t.step(1.6);
  t.expect((await t.state()).key==='tower-crown:1,2'&&(await t.state()).hp===(await t.state()).maxHp,'actual Try Again restores personal life at the Crown Stair');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.game.state.hasFlag('tower:mask-broken')&&h.game.swords.equippedId()==='blade-dawn'&&h.state.gear.shield===6&&h.game.spells.knowsSpell('spell-truesight')&&h.game.dungeons.hasBossKey('tower-crown')&&['tower-hive','tower-watch','tower-tide'].every(id=>h.game.keys.keyCount(id)===0&&h.game.dungeons.bossDefeated(id));}),'retry retains the earned blade, shield, first spell, broken mask and spent memory keys');await t.shot('192-native-crown-retry');
  await room(t,'north','tower-crown:1,1');await fight(t,'Crown Guard retry');await room(t,'north','tower-crown:1,0');
  await t.walkTo(7.5,1.5);await t.stick(0,-1,.8);await t.step(1.6);await t.waitFor(s=>s.mode==='play',{seconds:8});
  t.expect((await t.state()).key==='tower-final:0,0'&&(await t.state()).maxHp===before.maxHp,'the actual earned crown door permits a fresh attempt without changing capacity');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.entities.filter(e=>!e.removed&&e.type==='boss-king').length===1&&!h.entities.some(e=>!e.removed&&e.type==='boss-bishop');}),'natural death and retry preserve Veyl victory and spawn exactly one Caldrin');await t.shot('193-native-single-crown-retry');
}

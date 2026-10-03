import { answer } from './tower-journey.mjs';
import { select } from './brineglass-journey.mjs';
export const description='Actual Sage Iona conversation, first cast, repeat talk, saved lesson and violet-wisp supply through sword and item controls. New-game profiles, tower placement and stationary harmless enemies/wisp are isolated fixtures; no spell grant or direct damage. Speaker output disconnected.';
export default async function(t){
  for(const[label,profile]of[['no-earlier-sage',{}],['focus',{trait:'focus'}],['balanced',{class:'balanced'}]]){
    await t.eval(profile=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false,...profile});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);},profile);
    const before=await t.eval(()=>window.__voxelHeroes.state.maxMagic);
    await t.teleport('tower-hive:1,2',3.5,9.5);await t.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;}});await t.step(1.6);
    await t.track('spell-learned','spell-cast');const learnedBefore=(await t.events('spell-learned')).length;await t.stick(0,-1,1/60);await t.tap('sword');await answer(t);await t.step(1.6);
    const lesson=await t.eval(()=>{const h=window.__voxelHeroes;return{max:h.state.maxMagic,magic:h.state.magic,cost:h.game.spells.spellCost('spell-truesight'),known:h.game.spells.knowsSpell('spell-truesight')};});
    t.expect(lesson.known&&lesson.magic===lesson.max&&lesson.max===Math.max(before+1,lesson.cost),label+': actual first lesson fills enough reserve for a cast');
    await select(t,'spell-truesight');await t.tap('item');await t.step(.3);
    t.expect(await t.eval(m=>{const h=window.__voxelHeroes;return h.state.magic===m.magic-m.cost&&h.game.effects.effectActive('truesight');},lesson),label+': ordinary item input casts the learned spell and spends its actual cost');await t.shot('210-'+label+'-first-cast');
    await t.stick(0,-1,1/60);await t.tap('sword');await answer(t);
    t.expect(await t.eval(max=>window.__voxelHeroes.state.maxMagic===max,lesson.max)&&(await t.events('spell-learned')).length===learnedBefore+1,label+': repeat sage talk cannot increase reserve or teach twice');
    const save=await t.save();await t.load(save);await t.step(1.6);
    t.expect(await t.eval(max=>{const h=window.__voxelHeroes;return h.state.maxMagic===max&&h.game.spells.knowsSpell('spell-truesight')&&h.game.state.hasFlag('overworld:sage:spell-truesight');},lesson.max),label+': the usable first lesson and sage flag survive a save roundtrip');
  }
  await t.teleport('tower-hive:0,2',8,8.5);await t.step(1.6);await t.step(15.1);
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.vitals.setMagic(0);const s=h.screen(),e=h.spawn('crown-wisp',8,7,{index:1,spawnDelay:0});e.think=()=>{};e.harmless=true;});
  await t.stick(0,-1,1/60);await t.tap('sword');await t.step(.6);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return !h.entities.some(e=>!e.removed&&e.type==='crown-wisp')&&h.state.magic+h.entities.filter(e=>!e.removed&&e.type==='magic').length===3;}),'one actual sword kill of a violet wisp supplies three ordinary magic gems, including any already collected by the blade');
  await t.walkTo(8,7);await t.step(.4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.magic)===3,'walking over one violet wisp supply restores a full normal Truesight charge');
  await select(t,'spell-truesight');await t.tap('item');await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.effects.effectActive('truesight')),'a single collected violet wisp supports another ordinary Truesight cast');await t.shot('211-native-wisp-recast');
}

import { clearFoes } from '../lib/helpers.mjs';
export const description='Coastal approach, twenty-five temple rooms, four earned keys, real wand shots and torch gates, ice paths, shield vault, bag thirty, tide bridge, Nacre/tentacle combat, shield/ink, fourth orb, Freeze, burning orchard and save. Earlier campaign milestones, room kills and controlled boss windows use fixtures.';
export default async function(t){
  const photograph=t.shot;t.shot=async name=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.page.waitForTimeout(2400);return photograph(name);};
  await t.eval(()=>{
    const h=window.__voxelHeroes;h.game.progress.startNewGame({name:'Bo',class:'balanced'});h.state.flags.add('overworld:talked:king');
    for(const id of ['d1','d2','d3']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}
    for(const id of ['bombs','boomerang','grapple'])h.game.inventory.giveItem(id);
    for(const id of ['spell-reveal','spell-reflect','spell-quake'])h.game.spells.learnSpell(id);
    h.player.invT=999;
  });
  const safe=()=>t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;h.setHp(h.state.maxHp);});
  const settle=async()=>{await t.step(1.6);await safe();};
  const kill=async()=>{await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.kind==='enemy'&&!e.removed&&e.countsForClear!==false)e.die();});await t.step(.25);};
  const answer=()=>t.eval(async()=>{const h=window.__voxelHeroes;let quiet=0;for(let i=0;i<600&&quiet<25;i++){if(i%20===0&&h.state.mode!=='play')h.input.tap('confirm');await h.tick();quiet=h.state.mode==='play'?quiet+1:0;}await h.step(1.6);});
  const go=async(dir,name)=>{if((await t.state()).screenName!==name)await t.exit(dir);await settle();t.expect((await t.state()).screenName===name,`${dir} reaches ${name}`);};
  const chest=async(x,z)=>{await t.walkTo(x+.5,z+1.6);await t.stick(0,-1,.4);await settle();};
  const warp=async(x,z,key)=>{await t.walkTo(x+.5,z+.5,{allowHooks:true,soft:true});await settle();t.expect((await t.state()).key===key,`real passage reaches ${key} (${(await t.state()).key})`);};
  const item=async(id,facing,time=.5)=>{await t.eval(([id,f])=>{const h=window.__voxelHeroes;h.game.inventory.selectItem(id);h.game.hero.hero.setFacing(f);},[id,facing]);await t.tap('item');await t.step(time);};
  const fire=async(x,z,facing)=>{await t.walkTo(x,z);await item('fire-wand',facing);};
  const tile=async(x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
  const hook=async(x,z,facing,expected,photo)=>{
    await t.walkTo(x,z);const hp=await t.eval(()=>window.__voxelHeroes.state.hp);
    await item('grapple',facing,photo?.4:1.15);if(photo){await t.shot(photo);await t.step(.75);}
    const p=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return {x:h.player.x-s.x0,z:h.player.z-s.z0,pulled:h.game.hero.hero.isPulled(),hp:h.state.hp};});
    t.expect(!p.pulled&&p.hp===hp&&expected(p),`real hook crosses safely (${p.x.toFixed(2)},${p.z.toFixed(2)})`);
  };
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId())==='enter-d4','third orb points to the coastal temple');
  await t.teleport('sunreach:2,1',9.3,8.5);await clearFoes(t);await hook(9.3,8.5,'east',p=>p.x>11);await go('east','Hookshore Landing');await clearFoes(t);await t.shot('01-coast-landing');
  await go('east','Tide Garden');await clearFoes(t);await go('north','The Brineglass Temple');await clearFoes(t);await warp(8,6,'d4:2,3');await t.shot('02-tide-entrance');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.dungeonRooms('d4').filter(r=>r.room).length)===26,'the temple registers twenty-six rooms on two floors');
  await go('west','Lantern Patrol');await kill();await t.walkTo(8,7);t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===1,'lantern patrol gives the first key');
  await go('north','Tide Charts');await chest(8,4);await t.tap('map');await t.shot('03-tide-map');await t.tap('map');
  await go('west','Sluice Counterweight');await t.walkTo(4.5,7.5);await t.stick(1,0,4.5);await t.step(1);await t.walkTo(8,3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===2,'pushing the sluice weight gives the second key');
  await go('east','Tide Charts');await go('east','The Glass Junction');await t.walkTo(13.5,6);await t.stick(1,0,.85);await go('east','Ember Cache');await kill();await chest(8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('fire-wand')&&window.__voxelHeroes.game.keys.keyCount('d4')===1),'real east lock spends one key and the cache grants the wand');await t.shot('04-ember-cache');
  await go('south','First Thaw');
  // The ice is sword-proof; three actual wand shots make a continuous lane.
  await t.walkTo(8.5,3.1);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('south'));await t.tap('sword');await t.step(.4);t.expect(await tile(8,4)===':','ordinary sword cannot melt tideglass');
  for(let i=0;i<3;i++)await fire(8.5,3.1,'south');
  t.expect(await tile(8,4)==='.'&&await tile(8,5)==='.'&&await tile(8,6)==='.','real wand melts three ice blocks in order');await t.walkTo(8.5,7.5);await t.shot('05-first-thaw');
  await go('east','The Stillwater Gift');await hook(8.5,7.7,'north',p=>p.z<4);const piece=await t.eval(()=>window.__voxelHeroes.state.heartPieces);await chest(8,2);t.expect(await t.eval(()=>window.__voxelHeroes.state.heartPieces)===piece+1,'grapple detour yields a heart piece');await hook(8.5,3.5,'south',p=>p.z>7);
  await go('west','First Thaw');await go('north','Ember Cache');await go('north','Twin Ember Bowls');
  await fire(3.5,5,'north');t.expect(await tile(3,3)==='F'&&await tile(12,3)==='f','one real fire shot lights only its bowl');await fire(12.5,5,'north');await t.walkTo(8,6);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===2,'lighting both bowls gives the third earned key');await t.shot('06-twin-bowls');
  await go('east','Crosscurrents');await go('south','Pressure Patrol');await kill();await t.walkTo(8,7);t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===3,'pressure patrol gives the fourth earned key');await go('west','Ember Cache');await go('north','Twin Ember Bowls');
  await go('north','Ash Treasury');await chest(8,4);await t.walkTo(2.5,6);await item('bombs','west',2.4);await warp(0,5,'d4:2,0');await chest(8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.maxAmmo('bombs'))===30,'bombed secret chest upgrades the bag to thirty');await t.shot('07-deep-powder-bag');await warp(15,5,'d4:3,0');await go('south','Twin Ember Bowls');await go('south','Ember Cache');await go('west','The Glass Junction');
  await go('west','Tide Charts');await go('south','Lantern Patrol');await t.walkTo(2,6);await t.stick(-1,0,.85);await go('west','The Warden Legacy');await chest(8,4);await go('east','Lantern Patrol');await go('north','Tide Charts');await go('east','The Glass Junction');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===2,'optional sword consumes exactly one of the four keys');
  await t.walkTo(8,1.5);await t.stick(0,-1,.85);await go('north','The Flood Stair');await go('west','Sapphire Watchers');
  for(const x of [3.5,12.5]){await t.walkTo(x,2);await item('boomerang','north');}
  t.expect(await t.eval(()=>window.__voxelHeroes.state.colorKeys.blue)===1,'returning throws earn the optional blue key');await t.walkTo(8,1.5);await t.stick(0,-1,.8);await go('north','The Tidekeeper Shield');await chest(8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.gear.shield)===3,'the blue vault grants a magic shield');await t.shot('08-magic-shield');await go('south','Sapphire Watchers');await go('east','The Flood Stair');await warp(7,0,'d4:2,7');
  await go('west','The Ember Gate');await fire(3.5,5,'north');t.expect(await tile(7,0)==='E','one bowl leaves the upper shutter shut');await fire(12.5,5,'north');t.expect(await tile(7,0)==='.','both real flames open the upper shutter');await t.shot('09-ember-gate');
  await go('north','Cooled Glass Hall');for(let i=0;i<3;i++)await fire(8.5,7.7,'north');await t.walkTo(8.5,5.5);
  // Clear the westward ice row from the newly opened lane.
  for(let i=0;i<7;i++)await item('fire-wand','west');await t.step(.5);await go('west','Crown of the Tide');await fire(5.5,9,'north');await fire(10.5,9,'north');await chest(8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('d4')),'lighting crown bowls uncovers the big key chest');await t.shot('10-tide-crown');
  await go('east','Cooled Glass Hall');await go('south','The Ember Gate');await go('east','Upper Tide Landing');await t.walkTo(8,1.5);await t.stick(0,-1,.8);await go('north','The Tide Bridge');
  await hook(8.5,7.5,'north',p=>p.z<4,'11a-tide-hook');await t.shot('11-tide-bridge');await go('north','Undertow Antechamber');t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d4'))===0,'three main locks and the sword vault consume exactly four keys');
  await t.walkTo(8.5,6.5);await warp(3,8,'d4:2,3');await warp(12,8,'d4:2,5');await t.walkTo(8,1.5);await t.stick(0,-1,.8);await settle();t.expect((await t.state()).key==='d4-boss:0,0','the tide crown opens the actual arena');await t.step(4);await safe();await t.page.waitForTimeout(2400);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');return b.hp===105&&b.segments.length===4&&b.segments.every(e=>e.holder.scale.x===1); }),'Nacre starts with 105 body HP and four visible-scale tentacles');
  // Controlled windows isolate real weapon and projectile behavior.
  const window=()=>t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');b.ai.site=0;b.surface();b.ai.t=3;for(const e of b.segments){e.ai.phase='buried';e.ai.t=9;}for(const e of [...h.entities])if(e.type==='beast-ink')e.remove();h.game.hero.hero.place(5.5,8,Math.PI);});
  await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');b.ai.site=0;b.surface();});await t.step(.1);await t.shot('12-nacre-surface');
  await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast'),s=h.screen(),e=b.segments[0];e.x=s.x0+4.5;e.z=s.z0+8.5;e.ai.phase='root';e.ai.t=3;h.game.hero.hero.place(4.5,11,Math.PI);});await item('fire-wand','north',.35);
  t.expect(await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');return b.hp===105&&b.segments[0].ai.phase==='buried';}),'real fire severs a tentacle without touching body HP');await t.shot('13-tentacle-cleared');await t.step(4.8);t.expect(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-beast').segments[0].ai.phase)!=='buried','the tentacle regrows after its opening');
  await window();await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.state.gear.shield=2;h.input.down('guard');});await t.step(1);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.hp<window.__voxelHeroes.state.maxHp),'real Nacre ink overcomes the tier-two shield');await t.eval(()=>window.__voxelHeroes.input.up('guard'));await safe();
  await window();await t.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.type==='beast-ink')e.remove();h.player.invT=0;h.state.gear.shield=3;h.input.down('guard');});await t.step(1);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.hp===window.__voxelHeroes.state.maxHp),'the earned magic shield blocks real ink');await t.eval(()=>window.__voxelHeroes.input.up('guard'));await safe();
  await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');for(const e of b.segments){e.ai.phase='buried';e.ai.t=9;}for(const e of [...h.entities])if(e.type==='beast-ink')e.remove();b.ai.site=0;b.surface();h.game.hero.hero.place(5.5,6.8,Math.PI);});await t.tap('sword');await t.step(.15);
  const struck=await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');return {hp:b.hp,phase:b.ai.phase};});t.expect(struck.hp<105&&struck.phase==='dive','one real sword strike drives Nacre under immediately');
  await t.step(.8);t.expect(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-beast').ai.site)===1,'the next surfacing location alternates to the far bank');
  await hook(7.7,10.5,'east',p=>p.x>12,'14a-boss-hook');await t.step(.5);await t.shot('14-far-bank');
  const life=await t.eval(()=>window.__voxelHeroes.state.maxHp);
  for(let i=0;i<40;i++){
    const live=await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');if(!b)return false;for(const e of b.segments){e.ai.phase='buried';e.ai.t=9;}b.surface();b.ai.shots=0;h.game.hero.hero.place(b.x-h.screen().x0,b.z-h.screen().z0+1.3,Math.PI);return true;});
    if(!live)break;await t.tap('sword');await t.step(.6);
  }
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.bossDefeated('d4')),'actual sword inputs finish the body');
  const reward=await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='heart-container'),s=h.screen();return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});if(reward){await t.walkTo(reward.x,reward.z);await t.step(.3);}
  t.expect(await t.eval(()=>window.__voxelHeroes.state.maxHp)===life+2,'first victory yields one reachable permanent heart');
  await warp(10,0,'d4:0,5');await chest(8,4);await t.shot('15-fourth-orb');t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d4')),'the fourth orb completes the temple');
  await t.walkTo(4.5,7.6);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('sword');await answer();t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('spell-freeze')),'Sage Neru teaches Freeze through real conversation');await t.shot('16-freeze-sage');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(10,8);window.__frozenTarget=h.spawn('barrow-warden',11,8,{spawnDelay:0});h.game.inventory.selectItem('spell-freeze');});await t.step(.3);const magic=await t.eval(()=>window.__voxelHeroes.state.magic);await t.tap('item');await t.step(.25);
  t.expect(await t.eval(m=>{const h=window.__voxelHeroes;return window.__frozenTarget.frozenT>4&&h.state.magic===m-4;},magic),'real Freeze spends four magic and holds the fixture enemy for five seconds');await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('east'));await t.tap('sword');await t.step(.3);t.expect(await t.eval(()=>window.__frozenTarget.removed),'a real sword shatters the frozen warden');
  await t.eval(()=>window.__voxelHeroes.game.vitals.refill());await t.teleport('d4:1,1',2,6);await item('spell-freeze','west');await go('west','The Frozen Secret');t.expect(await tile(14,5)===',','Freeze turns the real flame wall into ice');await t.walkTo(15.3,5.5);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('west'));await t.tap('sword');await t.step(.3);t.expect(await tile(14,5)==='.','real sword breaks frozen flame ice');await chest(8,4);await t.shot('17-frozen-secret');
  await t.teleport('tidecoast:2,1',6.5,8.5);await item('fire-wand','east');t.expect(await tile(8,8)==='.','the wand burns an otherwise uncuttable outdoor tree');await chest(13,8);await t.shot('18-charred-orchard');
  const saved=await t.save();await t.load(saved);await settle();t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.game.inventory.hasItem('fire-wand')&&h.game.inventory.hasItem('spell-freeze')&&h.game.dungeons.isComplete('d4')&&h.game.inventory.maxAmmo('bombs')===30;}),'save/load keeps the fourth orb, wand, Freeze and bag thirty');
  await t.teleport('d4-boss:0,0',11.5,12.2);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('south'));await t.tap('sword');await t.step(4);await safe();t.expect(await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='boss-beast'&&e.refight)),'sword on the memorial starts a real optional rematch');
  await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');b.spawned=true;b.surface();h.game.damage.dealDamage(b,{amount:999,source:'sword',from:h.player});});await t.step(.3);t.expect(await t.eval(()=>!window.__voxelHeroes.entities.some(e=>e.type==='heart-container')),'rematch gives no second heart');
}

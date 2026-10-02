import { clearFoes } from '../lib/helpers.mjs';
export const description='Desert road, two watch floors, two earned keys, map, real grapple crossings and chest hooks, blue vault, powder bag, colossus targets, projectile guard rules, third orb and save/load. Earlier campaign milestones and room kills use fixtures.';
export default async function(t){
  const photograph=t.shot;
  t.shot=async name=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});return photograph(name);};
  await t.eval(()=>{
    const h=window.__voxelHeroes;h.game.progress.startNewGame({name:'Bo',class:'balanced'});
    h.state.flags.add('overworld:talked:king');
    for(const id of ['d1','d2']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}
    h.game.inventory.giveItem('bombs');h.game.inventory.giveItem('boomerang');h.player.invT=999;
  });
  const safe=()=>t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;h.setHp(h.state.maxHp);});
  const settle=async()=>{await t.step(1.6);await safe();};
  const kill=async()=>{await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.kind==='enemy'&&!e.removed&&e.countsForClear!==false)e.die();});await t.step(.25);};
  const answer=()=>t.eval(async()=>{const h=window.__voxelHeroes;let quiet=0;for(let i=0;i<600&&quiet<25;i++){if(i%20===0&&h.state.mode!=='play')h.input.tap('confirm');await h.tick();quiet=h.state.mode==='play'?quiet+1:0;}await h.step(1.6);});
  const go=async(dir,name)=>{if((await t.state()).screenName!==name)await t.exit(dir);await settle();t.expect((await t.state()).screenName===name,`${dir} reaches ${name}`);};
  const chest=async(x,z)=>{await t.walkTo(x+.5,z+1.6);await t.stick(0,-1,.4);await settle();};
  const warp=async(x,z,key)=>{await t.walkTo(x+.5,z+.5,{allowHooks:true,soft:true});await settle();t.expect((await t.state()).key===key,`real passage reaches ${key} (${(await t.state()).key})`);};
  const hook=async(x,z,facing,expected,photo)=>{
    await t.walkTo(x,z);const hp=await t.eval(()=>window.__voxelHeroes.state.hp);
    await t.eval(f=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('grapple');h.game.hero.hero.setFacing(f);},facing);
    await t.tap('item');if(photo){await t.step(.4);await t.shot(photo);await t.step(.75);}else await t.step(1.15);
    const p=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return {x:h.player.x-s.x0,z:h.player.z-s.z0,pulled:h.game.hero.hero.isPulled(),hp:h.state.hp};});
    t.expect(!p.pulled&&p.hp===hp&&expected(p),`real grapple lands safely across the gap (${p.x.toFixed(2)},${p.z.toFixed(2)})`);
  };
  t.expect(await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId())==='enter-d3','second orb points toward the third dungeon');
  await t.teleport('v1:2,1',12,8);await go('east','Dustfall Road');await clearFoes(t);await t.shot('01-desert-road');
  await t.walkTo(7.1,7.5);await t.eval(()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('bombs');h.game.hero.hero.setFacing('east');});await t.tap('item');await t.step(2.4);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+8,s.z0+7)==='s'&&h.world.tile(s.x0+8,s.z0+8)==='s';}),'real bomb clears both road stones in place');
  await go('east','Sandglass Oasis');await t.shot('02-oasis-inn');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.vitals.addCoins(30);h.setHp(3);h.game.services.innRest('inn-2');});
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.hp===h.state.maxHp&&h.state.respawn.area==='sunreach';}),'the oasis inn refills life and sets a desert respawn');
  await go('north','Dry River Crossing');await clearFoes(t);await go('east','The Buried Watch');await clearFoes(t);await warp(8,6,'d3:2,3');
  await t.shot('03-watch-entrance');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.dungeonRooms('d3').filter(r=>r.room).length)===22,'the map registers twenty-two authored rooms on two floors');
  await go('west','Shield Patrol');await kill();await t.walkTo(8,7);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===1,'the patrol pays the first real key');
  await go('west','Sleeping Stone');await kill();await chest(8,4);await go('east','Shield Patrol');await go('north','Watch Charts');await chest(8,4);
  await t.tap('map');t.expect(await t.eval(()=>new Set(window.__voxelHeroes.game.dungeons.dungeonRooms('d3').filter(r=>r.room).map(r=>r.floor)).size)===2,'the acquired map shows both watch floors');await t.shot('04-two-floor-map');await t.tap('map');
  await go('west','Counterweight Key');await t.walkTo(4.5,7.5);await t.stick(1,0,4.5);await t.step(1);
  await t.walkTo(8,3);t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===2,'the pushed counterweight gives the second key');
  await go('east','Watch Charts');await go('east','Divided Hall');await t.walkTo(13.5,6);await t.stick(1,0,.85);await go('east','Chain Vault');await kill();await chest(8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('grapple')),'the real cache chest grants the grapple');await t.shot('05-grapple-cache');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===1,'the east-facing lock spends one key for both door leaves');
  await go('south','First Cast');await hook(6.3,6.5,'east',p=>p.x>10,'06a-grapple-in-flight');await t.shot('06-first-cast');
  await go('east','Chest Island');await hook(8.5,7.7,'north',p=>p.z<4);await chest(8,2);
  await hook(8.5,3.5,'south',p=>p.z>7);await go('west','First Cast');await hook(10.6,6.5,'west',p=>p.x<7);await go('north','Chain Vault');
  await go('north','Eastern Lookout');await kill();await go('north','Buried Purse');await chest(8,4);
  await t.walkTo(2.5,6);await t.eval(()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('bombs');h.game.hero.hero.setFacing('west');});await t.tap('item');await t.step(2.4);await warp(0,5,'d3:2,0');await t.shot('07-powderwright');
  const money=await t.eval(()=>window.__voxelHeroes.state.coins);
  await t.walkTo(8.5,8.6);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('sword');await answer();
  t.expect(await t.eval(n=>{const h=window.__voxelHeroes;return h.state.coins===n-200&&h.game.inventory.maxAmmo('bombs')===20;},money),'the real merchant choice spends 200 coins and doubles bomb capacity');
  await t.tap('sword');await answer();t.expect(await t.eval(()=>window.__voxelHeroes.state.coins)===money-200,'the powderwright cannot sell the same upgrade twice');
  await warp(15,5,'d3:3,0');await go('south','Eastern Lookout');await go('south','Chain Vault');await go('west','Divided Hall');await go('north','Broken Stair');
  await go('west','Blue Watchers');
  for(const x of [3.5,12.5]){await t.walkTo(x,2);await t.eval(()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('boomerang');h.game.hero.hero.setFacing('north');});await t.tap('item');await t.step(.5);}
  t.expect(await t.eval(()=>window.__voxelHeroes.state.colorKeys.blue)===1,'two real boomerangs wake the blue watchers and grant one blue key');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await go('north','Sapphire Vault');const pieces=await t.eval(()=>window.__voxelHeroes.state.heartPieces);await chest(8,4);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.heartPieces)===pieces+1,'the optional blue vault gives one permanent heart piece');await t.shot('07a-blue-vault');await go('south','Blue Watchers');await go('east','Broken Stair');
  await hook(8.5,7.7,'north',p=>p.z<4);await warp(7,0,'d3:2,7');await t.shot('08-upper-landing');
  await go('west','Hook and Guard');
  // Place a guard on a clear line to inspect the tool's one-second stun.
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='skeleton'),sentry=h.entities.find(e=>e.type==='watch-sentinel');sentry.x=s.x0+12.5;sentry.z=s.z0+2.5;sentry.think=()=>{};e.x=s.x0+6.5;e.z=s.z0+5;e.recover(5);h.game.hero.hero.place(6.5,8,Math.PI);h.game.inventory.selectItem('grapple');});
  const guardHp=await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='skeleton').hp);
  await t.tap('item');await t.step(.25);
  t.expect(await t.eval(hp=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='skeleton');return e.hp===hp&&e.stunT>.5;},guardHp),'real hook stuns a guard for a sword opening without damaging it');await kill();await chest(8,3);t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('sun-dial')),'the optional upper cache extends the grapple');await answer();await go('east','Upper Landing');
  await go('north','The Missing Bridge');await hook(8.5,7.7,'north',p=>p.z<4,'09a-pit-pull');await t.shot('09-missing-bridge');
  await hook(8.5,3.5,'south',p=>p.z>7);await go('east','Crossing Arsenal');await kill();await hook(6.3,6.5,'east',p=>p.x>10);await go('east','Watchkeeper Crown');
  await hook(8.5,8.3,'north',p=>p.z<4);await chest(8,2);t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('d3')),'hooking the distant crown chest unlocks the boss route');
  await hook(8.5,3.5,'south',p=>p.z>8);await go('west','Crossing Arsenal');await hook(10.6,6.5,'west',p=>p.x<7);await go('west','The Missing Bridge');await hook(8.5,7.7,'north',p=>p.z<4);
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await go('north','Colossus Antechamber');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d3'))===0,'both locks consume the two earned keys');
  await t.walkTo(8.5,6.5);await warp(3,8,'d3:2,3');await warp(12,8,'d3:2,5');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await settle();t.expect((await t.state()).key==='d3-boss:0,0','the watchkeeper crown opens Colossus Court');await t.step(4);await safe();await t.page.waitForTimeout(2400);await t.shot('10-colossus-feet');
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='colossus-part').every(e=>e.holder.scale.x>=1&&e.object.visible)),'all four colossus targets render at their authored scale');
  const total=await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-colossus').remainingHp());t.expect(total===45,'the colossus has 45 HP across two feet, two arms, and its core');
  const closed=await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');return h.game.damage.dealDamage(b,{amount:3,source:'sword',from:h.player}).result;});t.expect(closed==='blocked','the core stays armored while its feet and arms remain');
  const prepareAttack=async phase=>t.eval(phase=>{
    const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus'),s=h.screen();
    for(const e of [...h.entities])if(e.type==='colossus-laser'||e.type==='colossus-wave')e.remove();
    b.x=s.x0+11;b.z=s.z0+6;b.ai.phase=phase;b.ai.t=.2;b.ai.dx=0;b.ai.dz=1;b.ai.sweep=Math.PI/2;b.ai.shotT=0;
    h.game.hero.hero.place(11,10,Math.PI);h.game.hero.hero.setFacing('north');h.state.gear.shield=6;h.player.invT=0;h.setHp(h.state.maxHp);h.input.down('guard');
  },phase);
  await prepareAttack('laser-tell');await t.step(.1);await t.shot('10a-colossus-tell');await t.step(.7);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.hp<window.__voxelHeroes.state.maxHp),'the colossus’s real pale laser pierces even a tier-six shield');await t.eval(()=>window.__voxelHeroes.input.up('guard'));await safe();
  await prepareAttack('slam-tell');await t.step(1.1);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.hp===window.__voxelHeroes.state.maxHp),'holding guard blocks the colossus’s real slam wave');await t.eval(()=>window.__voxelHeroes.input.up('guard'));await safe();
  await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.type==='colossus-laser'||e.type==='colossus-wave')e.remove();});
  // Use actual sword input against each exposed part. Placement isolates
  // target rules from navigation; the boss continues ticking between strikes.
  const strike=async index=>{
    for(let i=0;i<7;i++){
      const live=await t.eval(index=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus'),e=b.segments[index];if(e.removed)return false;b.ai.phase='laser-tell';b.ai.t=2;h.game.hero.hero.place(e.x-h.screen().x0,e.z-h.screen().z0+1.15,Math.PI);h.game.hero.hero.setFacing('north');return true;},index);
      if(!live)return;await t.tap('sword');await t.step(.45);
    }
    t.expect(await t.eval(index=>window.__voxelHeroes.entities.find(e=>e.type==='boss-colossus').segments[index].removed,index),`sword breaks exposed colossus part ${index}`);
  };
  await strike(0);await strike(1);await t.step(.2);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-colossus').stage)===2,'two broken feet expose the arms');await t.walkTo(14,12,{soft:true});await t.shot('11-colossus-arms');
  await strike(2);await strike(3);await t.step(.2);t.expect(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-colossus').stage)===3,'two broken arms expose the fifteen-HP hopping core');await t.walkTo(14,12,{soft:true});await t.shot('12-colossus-core');
  await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-colossus');b.ai.phase='idle';b.ai.t=0;b.ai.attack=2;});await t.step(.2);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');return b.airborne&&b.mesh.position.y>1&&h.game.damage.dealDamage(b,{amount:3,source:'sword',from:h.player}).result==='ignored';}),'the high leap lifts the core out of sword reach');await t.step(.9);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='colossus-wave').length)>=12,'the high landing sends a large radial shockwave');
  await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.type==='colossus-laser'||e.type==='colossus-wave')e.remove();});
  await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');b.ai.phase='idle';b.ai.t=99;});
  const lifeBeforeVictory=await t.eval(()=>window.__voxelHeroes.state.maxHp);
  for(let i=0;i<8;i++){
    const live=await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');if(!b)return false;h.game.hero.hero.place(b.x-h.screen().x0,b.z-h.screen().z0+1.15,Math.PI);h.game.hero.hero.setFacing('north');return true;});
    if(!live)break;await t.tap('sword');await t.step(.45);
  }
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.bossDefeated('d3')),'real sword input defeats the exposed core');
  const reward=await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='heart-container'),s=h.screen();return e?{x:e.x-s.x0,z:e.z-s.z0}:null;});
  if(reward){await t.walkTo(reward.x,reward.z);await t.step(.3);}
  t.expect(await t.eval(()=>window.__voxelHeroes.state.maxHp)===lifeBeforeVictory+2,'the colossus heart is collectible by walking or blade and permanently adds one heart');
  await warp(10,0,'d3:0,5');await chest(8,4);await t.shot('13-third-orb');t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d3')),'the third orb completes the watch');
  await t.walkTo(4.5,7.6);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('sword');await answer();
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('spell-quake')),'the real sage conversation teaches Quake after the watch');
  await t.shot('14-quake-sage');
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.game.hero.hero.place(10,8);window.__quakeTarget=h.spawn('barrow-warden',11,8,{spawnDelay:0});h.game.inventory.selectItem('spell-quake');});await t.step(.3);
  const magic=await t.eval(()=>window.__voxelHeroes.state.magic);await t.tap('item');await t.step(.25);
  const quakeResult=await t.eval(()=>({hp:window.__quakeTarget.hp,removed:window.__quakeTarget.removed,magic:window.__voxelHeroes.state.magic,mode:window.__voxelHeroes.state.mode,canAct:window.__voxelHeroes.game.hero.hero.canAct()}));
  t.expect(quakeResult.hp===1&&!quakeResult.removed&&quakeResult.magic===magic-3,`real Quake input deals eight nearby damage and spends three magic (before ${magic}, after ${JSON.stringify(quakeResult)})`);
  const saved=await t.save();await t.load(saved);await settle();t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('grapple')&&window.__voxelHeroes.game.dungeons.isComplete('d3')),'save/load keeps the grapple and third orb');
  await t.teleport('d3-boss:0,0',11,12.2);await t.step(.3);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('sword');await t.step(4);await safe();
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='boss-colossus'&&e.refight)),'real sword input at the colossus stone starts an optional rematch');
  const rematchLife=await t.eval(()=>window.__voxelHeroes.state.maxHp);
  await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus');for(const e of b.segments)if(e&&!e.removed)e.die();b.stage=3;b.spawned=true;b.airborne=false;h.game.damage.dealDamage(b,{amount:99,source:'sword',from:h.player});});await t.step(.3);
  t.expect(await t.eval(n=>{const h=window.__voxelHeroes;return h.state.maxHp===n&&!h.entities.some(e=>e.type==='heart-container');},rematchLife),'a rematch pays coins without adding another permanent heart');
  await t.teleport('sunreach:1,1',12,8);await go('east','Post Islands');await clearFoes(t);await hook(9.3,8.5,'east',p=>p.x>11);await chest(13,8);await t.page.waitForTimeout(2400);await t.shot('15-post-islands');
  await hook(11.5,8.5,'west',p=>p.x<10);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.state.flags.has('chest:'+(s.x0+13)+','+(s.z0+8));}),'the earned grapple opens a real outdoor treasure detour');
}

import { clearFoes } from '../lib/helpers.mjs';

export const description = 'Whisperwood route and wrong turns; sixteen hive rooms, three keys, real block and bomb input, map, cache, breaches, portal, queen phases, bomb counter, rewards, rematch and save/load. Room fights and the final boss kill use the damage API.';

export default async function(t) {
  const photograph=t.shot;
  t.shot=async(name)=>{
    const visible=await t.eval(()=>{const root=window.__voxelHeroes.player.hero.root,visible=root.visible;root.visible=true;return visible;});
    try{return await photograph(name);}finally{await t.eval(v=>{window.__voxelHeroes.player.hero.root.visible=v;},visible);}
  };
  await t.eval(() => {
    const h=window.__voxelHeroes;
    h.game.progress.startNewGame({name:'Bo',class:'balanced'});
    h.state.flags.add('overworld:talked:king');
    h.state.flags.add('dungeon:d1:entered');
    h.game.dungeons.giveBossKey('d1');
    h.game.dungeons.defeatBoss('d1');
    h.game.dungeons.completeDungeon('d1');
    h.player.invT=999;
  });
  const safe=()=>t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;h.setHp(h.state.maxHp);});
  const phase=()=>t.eval(()=>{const q=window.__voxelHeroes.entities.find(e=>!e.removed&&e.type==='boss-queen');return q?{hp:q.hp,...q.ai,drones:q.segments.filter(e=>!e.removed).length}:null;});
  const tile=(x,z)=>t.eval(([x,z])=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},[x,z]);
  const settle=async()=>{await t.step(1.6);await safe();};
  const kill=async()=>{await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(!e.removed&&e.kind==='enemy'&&e.countsForClear!==false)e.die();});await t.step(0.2);};
  const keys=()=>t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d2'));
  const go=async(dir,name)=>{if((await t.state()).screenName!==name)await t.exit(dir);await settle();t.expect((await t.state()).screenName===name,`${dir} reaches ${name}`);};
  const push=async(x,z,dx,dz,seconds=.65)=>{await t.walkTo(x-dx+.5,z-dz+.5);await t.stick(dx,dz,seconds);await t.step(1);};
  const warp=async(x,z,expected)=>{await t.walkTo(x+.5,z+.5,{allowHooks:true,soft:true});await settle();t.expect((await t.state()).key===expected,`walking into passage reaches ${expected} (${(await t.state()).key})`);};
  const bomb=async(x,z,facing)=>{
    await t.walkTo(x,z);
    await t.eval(f=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('bombs');h.game.hero.hero.setFacing(f);},facing);
    await t.tap('item'); await t.step(2.3);
  };

  t.expect((await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId()))==='enter-d2','first orb points north toward a playable second dungeon');
  await t.teleport('v1:1,0',4,6);
  await go('north','Northwood Trail'); await clearFoes(t); await t.shot('01-whisperwood');
  await go('north','Mothwater Crossing'); await clearFoes(t);
  await go('north','Carved Stone Clearing'); await clearFoes(t); await t.shot('02-carved-stone');
  await warp(8,3,'lost-woods:0,0'); await clearFoes(t);
  await warp(15,8,'lost-woods:0,0');
  t.expect((await t.state()).screenName==='The First Wind','a wrong forest turn returns to the first clearing');
  for(const [x,z,expected] of [[8,0,1],[0,8,2],[15,8,3],[8,0,4]]) {await clearFoes(t);await warp(x,z,`lost-woods:${expected},0`);}
  await t.shot('03-amber-gate');
  await warp(8,3,'d2:2,4');
  t.expect((await t.eval(()=>window.__voxelHeroes.game.objective.objectiveId()))==='hive-map','entering the hive advances its objective');
  await t.shot('04-hive-mouth');

  await go('east','Broken Patrol'); await kill(); await t.walkTo(8,7);
  t.expect(await keys()===1,'first hive patrol drops a collectible small key');
  await go('west','Rootglass Mouth'); await go('north','Fern Cartography');
  await push(8,4,0,-1,.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasMap('d2')),'real chest interaction gives the hive map');
  await t.tap('map');
  t.expect((await t.eval(()=>window.__voxelHeroes.game.mapScreen.mapView())).rooms===16,'the map charts sixteen authored hive rooms');
  await t.shot('05-hive-map'); await t.tap('map');
  await go('west','Root Counterweight');
  t.expect(await tile(7,4)==='E','the counterweight treasury starts sealed');
  await t.walkTo(4.5,7.5); await t.stick(1,0,4.5);
  t.expect(await tile(7,4)==='.' && await tile(9,7)==='Q','pushing the block onto its plate opens the treasury');
  await push(8,2,0,-1,.3); await t.shot('06-counterweight');
  await go('east','Fern Cartography');
  await t.walkTo(8,1.5); await t.stick(0,-1,.8); await go('north','Sealed Gallery');
  t.expect(await keys()===0,'the first small-key lock spends exactly one key');
  await go('west','Powder Cache'); await kill();
  t.expect(await tile(8,4)==='c','clearing the powder guards reveals the bomb chest');
  await push(8,4,0,-1,.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('bombs')),'the dungeon provides bombs without a shop purchase');
  await t.shot('07-powder-cache'); await go('east','Sealed Gallery');
  await bomb(13.5,6,'east');
  t.expect(await tile(15,5)==='y','real B input plants a bomb and opens the first stone seam');
  await warp(15,5,'d2:3,2'); await clearFoes(t);
  await t.shot('08-breached-gallery');
  await go('south','Forgotten Pay'); await clearFoes(t); await push(8,4,0,-1,.3);
  await go('north','Breached Gallery'); await clearFoes(t);
  await go('north','Crossfire Nursery'); await kill();
  t.expect(await keys()===0,'defeating the nursery guards alone does not bypass its pressure seals');
  for (const [x,z] of [[4.5,4.5],[11.5,9.5],[11.5,4.5]]) await bomb(x,z,'north');
  await t.walkTo(8,6);
  t.expect(await keys()===1,'three actual bombs quiet the nursery and release the second key');
  await go('south','Breached Gallery'); await clearFoes(t);
  await bomb(13.5,6,'east'); await warp(15,5,'d2:4,2'); await push(8,4,0,-1,.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.hasBossKey('d2')),'two real breaches lead to the amber big key');
  await warp(0,5,'d2:3,2'); await clearFoes(t); await warp(0,5,'d2:2,2');
  await t.walkTo(8,1.5); await t.stick(0,-1,.8); await go('north','Mossbridge'); await clearFoes(t);
  await go('west','Three Watchers');
  await t.give('boomerang');
  // Three real throws from aligned positions, within the configured window.
  for(const x of [3.5,5.5,12.5]) {
    await t.walkTo(x,1.9);await t.eval(()=>{const h=window.__voxelHeroes;h.game.inventory.selectItem('boomerang');h.game.hero.hero.setFacing('north');});
    await t.tap('item');await t.step(.75);
  }
  await t.walkTo(8,6);
  t.expect(await keys()===1,'three real boomerang throws wake the eyes and release the third key');
  await t.give('key-red');await t.walkTo(8,1.5);await t.stick(0,-1,.8);await go('north','Scarlet Well');
  const magic=await t.eval(()=>window.__voxelHeroes.state.maxMagic);
  await push(8,4,0,-1,.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.maxMagic)>magic,'the optional red vault permanently increases magic');
  await go('south','Three Watchers');await go('east','Mossbridge');await clearFoes(t);
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await go('north','Crown Antechamber');
  t.expect(await keys()===0,'three locks consume the three earned keys');
  await t.walkTo(8.5,6.5);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d2:portal')),'stepping on the floor switch wakes the entrance shortcut');
  await warp(3,8,'d2:2,4');await warp(12,8,'d2:2,0');
  await t.walkTo(11.5,7.6);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('sword');
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))===10,'the antechamber supply prevents an empty-bomb softlock');
  await t.walkTo(8,1.5);await t.stick(0,-1,.8);await settle();
  t.expect((await t.state()).key==='d2-boss:0,0','the big key opens the queen arena');
  await t.step(4);await safe();
  await t.shot('09-queen-flight');
  const initial=await phase();t.expect(initial?.hp===45 && initial.drones===8,'the queen has 45 HP and an eight-drone brood');
  const blocked=await t.eval(()=>{const h=window.__voxelHeroes,q=h.entities.find(e=>e.type==='boss-queen');q.ai.phase='flight';q.ai.t=3;return h.game.damage.dealDamage(q,{amount:2,source:'sword',from:h.player,swingId:'flight-check'}).result;});
  t.expect(blocked==='blocked','the folded crown guards sword hits during flight');
  // Start a normal gathering window at the arena centre; placement, fuse and
  // explosion are real item input. The queen continues her own AI throughout.
  await t.eval(()=>{const h=window.__voxelHeroes,q=h.entities.find(e=>e.type==='boss-queen'),s=h.screen();q.x=s.x0+11;q.z=s.z0+7;q.ai.phase='gather';q.ai.t=.7;h.player.x=q.x;h.player.z=q.z+.7;h.game.hero.hero.setFacing('north');h.game.inventory.selectItem('bombs');});
  await t.tap('item');await t.step(2.05);await safe();
  const flipped=await phase();
  t.expect(flipped.phase==='flipped' && flipped.hp===39 && flipped.drones===0,'a real bomb deals six damage, flips the queen for a counter and scatters her brood');
  await t.step(.35);
  await t.shot('10-queen-bomb-counter');
  await t.eval(()=>{const h=window.__voxelHeroes,q=h.entities.find(e=>e.type==='boss-queen');h.player.x=q.x;h.player.z=q.z+1.1;h.game.hero.hero.setFacing('north');});
  await t.step(.35);await t.tap('sword');await t.step(.2);
  t.expect((await phase()).hp<flipped.hp,'real sword input punishes the overturned crown');
  await t.step(4.4);t.expect((await phase()).phase!=='flipped','the four-second bomb opening expires');
  await t.eval(()=>{const h=window.__voxelHeroes,q=h.entities.find(e=>e.type==='boss-queen');q.flashT=0;q.ai.phase='rest';h.game.damage.dealDamage(q,{amount:99,source:'sword',from:h.player,swingId:'finish-fixture'});});
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.bossDefeated('d2')),'defeat records the queen and opens the arena doors');
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='heart-container')),'first victory leaves a reachable permanent heart reward');
  const heart=await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='heart-container'),s=h.screen();return {x:e.x-s.x0,z:e.z-s.z0,before:h.state.maxHp};});
  await t.walkTo(heart.x,heart.z);await t.step(.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.state.maxHp)>heart.before,'walking onto the queen’s heart permanently increases life');
  await warp(10,0,'d2:0,0');await push(8,4,0,-1,.3);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d2')),'the reward chest completes dungeon two');
  await t.shot('11-second-orb');
  await t.walkTo(4.5,7.6);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('sword');
  await t.eval(async()=>{const h=window.__voxelHeroes;let quiet=0;for(let i=0;i<600&&quiet<25;i++){if(i%20===0&&h.state.mode!=='play')h.input.tap('confirm');await h.tick();quiet=h.state.mode==='play'?quiet+1:0;}await h.step(1.6);});
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('spell-reflect')),'the hive sage teaches Reflect through real conversation');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(10,8,Math.PI);h.state.gear.shield=2;h.player.invT=0;h.game.inventory.selectItem('spell-reflect');});
  const magicBeforeReflect=await t.eval(()=>window.__voxelHeroes.state.magic);await t.tap('item');
  await t.eval(()=>{const h=window.__voxelHeroes;window.__reflectShot=h.spawn('queen-shot',10,5,{dir:{x:0,z:1},speed:5.2});h.input.down('guard');});await t.step(.6);
  t.expect(await t.eval(n=>{const h=window.__voxelHeroes,e=window.__reflectShot;return e.reflected&&e.owner==='hero'&&e.vz<0&&h.state.magic===n-1;},magicBeforeReflect),'real Reflect and guard return a fixture projectile and spend one magic');await t.eval(()=>window.__voxelHeroes.input.up('guard'));

  const saved=await t.save();await t.load(saved);await settle();
  t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.isComplete('d2')&&window.__voxelHeroes.game.inventory.hasItem('bombs')),'save/load retains the second orb and its tool');
  await t.teleport('d2-boss:0,0',11,12.5);await t.step(.3);
  await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='queen-tombstone').onInteract());await t.step(4);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='boss-queen'&&e.refight)),'the queen’s stone starts an optional rematch');
  await t.eval(()=>{const h=window.__voxelHeroes,q=h.entities.find(e=>e.type==='boss-queen');q.spawned=true;q.flashT=0;q.ai.phase='rest';h.game.damage.dealDamage(q,{amount:99,source:'sword',from:h.player});});
  t.expect(!await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='heart-container')),'a rematch pays coins without granting another permanent heart');
}

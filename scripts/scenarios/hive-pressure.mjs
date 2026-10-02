export const description = 'Muted actual pressure clock, movement out of warnings, hazard damage and guard bypass, real bomb placement/fuses, lane cancellation, partial saves, key and shutter gating. Position fixtures, stationary guards and damage-API guard kills isolate the machinery; no direct valve calls.';
export default async function(t) {
  const view = () => t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen(), m = h.entities.find(e => e.type === 'hive-pressure');
    return { machine: m ? { ...m.ai, visible: m.lanes.map(e => e.visible), height: m.lanes[0].position.y } : null,
      guards: h.entities.filter(e => !e.removed && e.kind === 'enemy').length, blocked: h.game.combat.roomClearBlocked(),
      valves: [0,1,2].map(i => h.state.flags.has(`dungeon:d2:nursery-valve:${i}`)), tiles: [[4,3],[11,8],[11,3]].map(([x,z]) => h.world.tile(s.x0+x,s.z0+z)),
      vented: h.state.flags.has('dungeon:d2:nursery-vented'), key: h.state.flags.has('dungeon:d2:key:B-4'), pickups: h.entities.filter(e => !e.removed && e.type === 'key').length,
      ammo: h.game.inventory.ammo('bombs'), hp: h.state.hp, keys: h.game.keys.keyCount('d2'), bursts: window.__hiveBursts ?? [] };
  });
  const place = (x,z) => t.eval(([x,z]) => window.__voxelHeroes.game.hero.hero.place(x,z),[x,z]);
  const safe = () => t.eval(() => { const h=window.__voxelHeroes;h.player.invT=999;h.setHp(h.state.maxHp); });
  const kill = () => t.eval(() => { const h=window.__voxelHeroes;for(const e of h.entities.filter(e=>!e.removed&&e.kind==='enemy'))h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}}); });
  const wait = async (pred, label, limit=12) => { for(let i=0;i<limit*20;i++){const v=await view();if(pred(v))return v;await t.step(.05);}throw Error('Timed out: '+label+' '+JSON.stringify(await view())); };
  const photo=async(name)=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  const bomb = async (x,z,index) => {
    await place(x,z);await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.game.inventory.selectItem('bombs');});
    const before=(await view()).ammo;await t.tap('item');await t.step(.3);
    t.expect((await view()).ammo===before-1&&!(await view()).valves[index],'Actual item input spends a bomb before the fuse opens seal '+(index+1));
    await place(2.5,6);await t.step(2.1);
    t.expect((await view()).valves[index]&&(await view()).tiles[index]==='d','The actual blast opens seal '+(index+1)+' and leaves walkable machinery');
  };
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');h.game.dungeons.defeatBoss('d1');h.game.dungeons.completeDungeon('d1');h.player.invT=999;window.__hiveBursts=[];h.events.on('hive-pressure-burst',p=>window.__hiveBursts.push(p.lane));});
  await t.give('bombs');await t.teleport('d2:3,1',2.5,6);await t.step(1.4);
  let v=await view();t.expect(v.guards===3&&v.machine&&v.blocked&&!v.key&&v.tiles.join('')==='123','The nursery starts with three guards, one machine and three closed seals');
  t.expect(v.machine.height>.125,'Pressure markers sit above the highest raised service grate');
  await kill();await t.step(.2);v=await view();
  t.expect(v.guards===0&&v.blocked&&!v.key&&v.pickups===0,'Killing all guards holds the key while the irrigation is still sealed');
  await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.setHp(h.state.maxHp);});
  await place(5.5,4.65);v=await wait(v=>v.machine.phase==='warning'&&v.machine.lane===0,'first lane warning');
  const hp=v.hp;await photo('01-pressure-warning');
  await t.stick(0,1,.4);await t.step(1.5);v=await view();
  t.expect(v.hp===hp&&(await t.state()).lz>5.6,'Actual movement out of the marked lane avoids its burst');
  await place(5.5,7.2);await wait(v=>v.machine.phase==='warning'&&v.machine.lane===1,'second lane warning');
  await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.state.gear.shield=6;h.input.down('guard');});
  await t.step(1.3);v=await view();t.expect(v.hp===hp-1&&v.machine.phase==='active','Standing on an active lane takes one half-heart despite a full guard');
  await photo('02-pressure-burst');await t.step(.6);t.expect((await view()).hp===hp-1,'Normal hit immunity prevents repeated damage within one burst');
  await t.eval(()=>window.__voxelHeroes.input.up('guard'));await safe();
  await bomb(4.5,4.5,0);v=await view();t.expect(v.blocked&&!v.key&&v.valves.filter(Boolean).length===1,'One seal does not release the room or its key');await photo('03-first-seal-open');
  const partial=await t.save();await t.load(partial);await t.step(.3);await safe();v=await view();
  t.expect(v.valves.join(',')==='true,false,false'&&v.tiles.join('')==='d23'&&v.guards===0&&v.blocked&&!v.key,'A partial save retains the broken seal and defeated guards without clearing unfinished machinery');
  await place(2.5,6);await t.step(14);v=await view();
  t.expect(v.bursts.slice(-3).every(i=>i!==0),'Released lanes no longer enter the pressure rotation');
  await bomb(11.5,9.5,1);await photo('04-two-seals-open');
  await bomb(11.5,4.5,2);v=await view();
  t.expect(v.vented&&!v.blocked&&v.key&&v.pickups===1&&v.machine.phase==='vented'&&v.machine.visible.every(x=>!x),'The last actual bomb silences the nursery, opens the shutters and drops exactly one key');
  const won=await t.save();await t.load(won);await t.step(.3);await safe();v=await view();
  t.expect(v.vented&&v.guards===0&&v.pickups===1&&!v.blocked,'Loading victory before pickup restores one waiting key and an inert nursery');
  await t.walkTo(8,6);await t.step(.2);v=await view();t.expect(v.keys===1&&v.pickups===0,'The nursery key is reachable on a clear floor');
  await photo('05-quiet-nursery');
  await t.teleport('Rootglass Mouth',8,7);await t.teleport('d2:3,1',8,7);await t.step(.3);v=await view();
  t.expect(v.keys===1&&v.pickups===0&&v.guards===0&&v.machine.phase==='vented','Leaving the dungeon wing cannot repeat the nursery reward or restart its guards');
  await t.exit('south');t.expect((await t.state()).key==='d2:3,2','The quiet nursery has a usable southern exit');
}

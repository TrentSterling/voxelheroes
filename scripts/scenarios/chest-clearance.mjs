export const description = 'Reported chest overlap: actual sword kills reveal Turning Room and Chain Vault rewards under the hero; native movement, A claims, repeat claims and save/load follow. Every authored hidden chest is checked with occupied floor and edge overlap. Teleports, removed unrelated foes, stationary one-HP final guards, recruitment flags and companion placement are disclosed isolation fixtures. All output is disconnected before navigation.';

export default async function(t) {
  const fresh = () => t.eval(() => {
    const h = window.__voxelHeroes;
    h.game.progress.startNewGame({prologue:false});
    h.game.audio.setMuted(true); h.game.settings.setSetting('npcVoices',false);
  });
  const view = () => t.eval(() => {
    const h=window.__voxelHeroes,p=h.player,s=h.screen();
    return {x:p.x-s.x0,z:p.z-s.z0,blocked:h.world.blocked(p.x,p.z,p.r,p),hp:h.state.hp,
      bodies:h.entities.filter(e=>!e.removed&&e.kind==='companion'&&e.object.visible)
        .map(e=>({name:e.name,blocked:h.world.blocked(e.x,e.z,e.r,e),x:e.x,z:e.z,r:e.r}))};
  });
  const dismiss = () => t.eval(async () => {
    const h=window.__voxelHeroes;
    for(let i=0;i<900&&h.state.mode!=='play';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}
  });
  await t.track('room-cleared','chest-clearance','sword-swing');
  for(const room of [{key:'d1:4,6',x:7,z:5,reward:'boomerang'}, {key:'d3:3,2',x:8,z:4,reward:'grapple'}]) {
    await fresh(); await t.teleport(room.key,room.x+.5,room.z+.5);
    await t.eval(room=>{
      const h=window.__voxelHeroes;
      for(const e of [...h.entities])if(e.kind==='enemy')e.remove();
      h.give('blade-start'); h.game.swords.equipSword('blade-start');
      h.game.hero.hero.place(room.x+.5,room.z+.5); h.game.hero.hero.setFacing('north');
      const guard=h.spawn('slime',room.x+.5,room.z-.8);
      guard.hp=1;guard.spawned=true;guard.update=()=>{};window.__clearanceGuard=guard;
    },room);
    const before=await view(),clears=(await t.events('room-cleared')).length;
    t.expect(!before.blocked,`${room.key}: unrevealed reward floor is walkable`);
    await t.shot(`${room.reward}-01-standing-on-reward-floor`);
    await t.tap('sword');await t.step(.8);
    t.expect(await t.eval(()=>window.__clearanceGuard.removed),`${room.key}: actual sword kills the final guard`);
    t.expect((await t.events('room-cleared')).length>clears,`${room.key}: normal combat emits room-cleared`);
    t.expect(await t.eval(room=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+room.x,s.z0+room.z)==='c';},room),`${room.key}: normal room clear reveals the authored chest`);
    const after=await view();
    t.expect(!after.blocked&&Math.hypot(after.x-before.x,after.z-before.z)>0,`${room.key}: chest reveal puts its occupant on clear nearby floor`);
    t.expect(after.hp===before.hp,`${room.key}: clearance causes no damage`);
    await t.shot(`${room.reward}-02-clear-revealed-chest`);
    await t.hold('ArrowLeft',.35);
    t.expect(Math.hypot((await view()).x-after.x,(await view()).z-after.z)>.1,`${room.key}: ordinary movement works immediately after reveal`);
    await t.eval(room=>{const h=window.__voxelHeroes;h.game.hero.hero.place(room.x+.5,room.z+1.5);h.game.hero.hero.setFacing('north');},room);
    await t.tap('sword');await dismiss();
    t.expect(await t.eval(room=>window.__voxelHeroes.state.inventory.owned.includes(room.reward),room),`${room.key}: native A still grants the authored item`);
    const saved=await t.save();await t.tap('sword');await dismiss();await t.load(saved);await t.step(.1);
    t.expect(await t.eval(room=>window.__voxelHeroes.state.inventory.owned.filter(id=>id===room.reward).length===1,room),`${room.key}: repeated A and reload preserve exactly one reward`);
    await t.shot(`${room.reward}-03-opened-and-reloaded`);
  }
  await fresh();
  const markers=await t.eval(()=>{const h=window.__voxelHeroes;return [...h.world.screens.values()].flatMap(s=>s.base.flatMap((row,z)=>row.flatMap((ch,x)=>ch==='h'&&h.world.tileDefAt(s.x0+x,s.z0+z)?.name==='chest-spot'?[{key:s.key,x,z}]:[])));});
  t.expect(markers.length>5,'Catalog exercises hidden reward floors throughout the authored world');
  const unmarked=await t.eval(()=>{const h=window.__voxelHeroes;return [...h.world.screens.values()].flatMap(s=>s.tiles.flatMap((row,z)=>row.flatMap((ch,x)=>{const def=h.world.tileDefAt(s.x0+x,s.z0+z);return def?.prompt==='Open chest'&&!def.chest?[`${s.key}:${x},${z}`]:[];})));});
  t.expect(!unmarked.length,'Every authored chest, including derived era tiles, carries clearance metadata '+JSON.stringify(unmarked));
  for(const room of markers) {
    await fresh();await t.teleport(room.key,room.x+.5,room.z+.5);
    const result=await t.eval(room=>{
      const h=window.__voxelHeroes,s=h.screen(),p=h.player,tx=s.x0+room.x,tz=s.z0+room.z;
      for(const e of [...h.entities])if(e.kind==='enemy')e.remove();
      h.world.setTile(tx,tz,'h',{rebuild:false});h.game.hero.hero.place(room.x+.5,room.z+.5);
      h.world.setTile(tx,tz,'c',{rebuild:false,reason:'chest'});
      const centre=!h.world.blocked(p.x,p.z,p.r,p);
      h.world.setTile(tx,tz,'h',{rebuild:false});h.game.hero.hero.place(room.x+1+p.r/2,room.z+.5);
      h.world.setTile(tx,tz,'c',{rebuild:false,reason:'chest'});
      return {centre,edge:!h.world.blocked(p.x,p.z,p.r,p)};
    },room);
    t.expect(result.centre&&result.edge,`${room.key}:${room.x},${room.z}: centre and radius overlap both clear safely`);
  }
  await fresh();await t.teleport('d1:4,6',8.5,9.5);
  const distant=await t.eval(()=>{const h=window.__voxelHeroes,p=h.player,s=h.screen(),before={x:p.x,z:p.z};h.world.setTile(s.x0+7,s.z0+5,'c',{rebuild:false,reason:'chest'});return p.x===before.x&&p.z===before.z;});
  t.expect(distant,'A hero clear of the reward floor stays exactly where they stood');
  await fresh();await t.eval(()=>{
    const h=window.__voxelHeroes;h.game.companions.setMiraTravelling(true);
    h.game.state.setFlag('era:voices-returned');h.game.companions.setTernTravelling(true);
  });
  await t.teleport('d1:4,6',7.5,5.5);await t.step(.2);
  const companions=await t.eval(()=>{
    const h=window.__voxelHeroes,s=h.screen(),p=h.player;
    for(const e of [...h.entities])if(e.kind==='enemy')e.remove();
    const cs=h.entities.filter(e=>e.kind==='companion'&&e.object.visible);
    h.game.hero.hero.place(7.5,5.5);cs.forEach(e=>{e.x=p.x;e.z=p.z;});
    h.world.setTile(s.x0+7,s.z0+5,'c',{persist:true,rebuild:false,reason:'chest'});
    const bodies=[p,...cs];
    return {count:cs.length,clear:bodies.every(e=>!h.world.blocked(e.x,e.z,e.r,e)),
      apart:bodies.every((e,i)=>bodies.slice(i+1).every(o=>Math.hypot(e.x-o.x,e.z-o.z)>=e.r+o.r)),
      immediate:cs.every(e=>e.object.position.x===e.x&&e.object.position.z===e.z)};
  });
  t.expect(companions.count===2&&companions.clear&&companions.apart&&companions.immediate,'Hero, Mira and Tern all clear the chest immediately onto separate floors');
  await t.shot('party-01-safe-reveal');await t.hold('ArrowDown',.6);await t.step(1);
  t.expect((await view()).bodies.every(e=>!e.blocked),'Both companions keep following on clear floor after reveal');
  // The old production build can leave a saved hero inside an existing chest.
  await t.eval(()=>window.__voxelHeroes.game.hero.hero.place(7.5,5.5));
  t.expect((await view()).blocked,'Legacy save fixture reproduces the reported occupied solid chest');
  const rescue=await t.eval(()=>{const h=window.__voxelHeroes;return h.game.saves.saveSlot(1)&&h.game.saves.loadSlot(1);});
  await t.step(.2);t.expect(rescue&&!(await view()).blocked,'Real Save Slot / Load Slot recovers an already trapped hero');
  await t.shot('party-02-legacy-save-recovered');
  t.note(`Checked ${markers.length} authored hidden reward markers, including body-radius overlap.`);
}

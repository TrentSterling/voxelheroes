export const description = 'Muted valve-first encounter, real zero-ammo refill, sword resistance, current-lane cancellation, old-save compatibility and shared-flag future growth. Arranged positions and stationary guards isolate bomb/puzzle behavior; guard kills use the damage API.';
export default async function(t) {
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),m=h.entities.find(e=>e.type==='hive-pressure');return {phase:m?.ai.phase,lane:m?.ai.lane,visible:m?.lanes.map(e=>e.visible),guards:h.entities.filter(e=>!e.removed&&e.kind==='enemy').length,blocked:h.game.combat.roomClearBlocked(),key:h.state.flags.has('dungeon:d2:key:B-4'),valves:[0,1,2].map(i=>h.state.flags.has(`dungeon:d2:nursery-valve:${i}`)),ammo:h.game.inventory.ammo('bombs'),keys:h.entities.filter(e=>e.type==='key').length};});
  const reset=()=>t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');h.game.dungeons.defeatBoss('d1');h.game.dungeons.completeDungeon('d1');h.player.invT=999;});
  const place=(x,z,facing='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);},[x,z,facing]);
  const photo=async(name)=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  await reset();await t.give('bombs');await t.teleport('d2:3,1',2.5,6);await t.step(1.4);
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();let i=0;for(const e of h.entities.filter(e=>e.kind==='enemy')){e.x=s.x0+3.5+i++;e.z=s.z0+9.5;e.think=()=>{};}});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.inventory.addAmmo('bombs',-999);});
  await place(13.5,9.5);await t.tap('sword');t.expect((await view()).ammo===10,'A real supply interaction refills an empty bag inside the locked nursery');
  await place(4.5,4.5);await t.tap('sword');await t.step(.3);t.expect(!(await view()).valves[0],'Swords do not silently open pressure seals');
  // The first bomb is planted late in the idle interval so its normal fuse
  // finishes during the machine's actual warning or active lane, not a fake phase.
  for(let i=0;i<500;i++){const m=await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='hive-pressure');return e.ai;});if(m.phase==='idle'&&m.t<.8&&m.cycle===0)break;await t.step(.02);}
  await t.eval(()=>window.__voxelHeroes.game.inventory.selectItem('bombs'));await t.tap('item');await t.step(2.05);
  let v=await view();t.expect(v.valves[0]&&v.phase==='idle'&&v.visible.every(x=>!x),'Breaking the firing seal immediately cancels its real marked lane');
  for(const [x,z]of[[11.5,9.5],[11.5,4.5]]){await place(x,z);await t.tap('item');await t.step(2.3);}
  v=await view();t.expect(v.valves.every(Boolean)&&v.phase==='vented'&&!v.blocked&&!v.key&&v.guards===3,'Venting every seal still requires the nursery guards before a key drops');
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities.filter(e=>e.kind==='enemy'))h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}});});await t.step(.2);
  t.expect((await view()).key&&(await view()).keys===1,'Clearing the remaining guards after venting releases one mandatory key');
  await t.teleport('mossbrook-future:0,0',6,13);await t.step(.2);
  const patch=()=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return [2,3].flatMap(x=>[10,11].map(z=>h.world.tile(s.x0+x,s.z0+z)));});
  t.expect((await patch()).every(ch=>ch==='.'),'The nursery does not grow a future garden before the main water engine is restored');
  await t.eval(()=>window.__voxelHeroes.state.flags.add('era:water-restored'));await t.step(.2);
  t.expect((await patch()).every(ch=>ch==='b'),'The vented nursery feeds a second future garden after water is restored');await photo('01-future-nursery-garden');
  const saved=await t.save();await t.load(saved);await t.step(.2);t.expect((await patch()).every(ch=>ch==='b'),'Future nursery growth survives save/load');
  await reset();await t.teleport('Rootglass Mouth',8,7);
  await t.eval(()=>{const h=window.__voxelHeroes;h.state.flags.add('dungeon:d2:key:B-4');h.state.flags.add('dungeon:d2:keytaken:B-4');});
  const legacy=await t.save();await t.load(legacy);await t.teleport('d2:3,1',8,7);await t.step(.3);v=await view();
  t.expect(v.valves.every(Boolean)&&v.phase==='vented'&&v.guards===0&&v.keys===0&&!v.blocked,'An older save with the nursery key already taken keeps its earned progress without a new lock or duplicate key');await photo('02-old-save-nursery');
  await reset();await t.teleport('d2:3,1',8,7);await t.step(.3);v=await view();t.expect(v.valves.every(x=>!x)&&v.guards===3&&v.blocked&&!v.key,'A new adventure resets all three seals and its nursery guards');
}

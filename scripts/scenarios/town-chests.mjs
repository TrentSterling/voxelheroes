export const description='Reported Old Wick pot overlap and every Silent Year chest: native A input, locked feedback, sentry gates, repeated claims, save/revisit, morning schedules and occupied regrowth. Placement, time, prerequisite flags, invulnerability and isolated sentry removal are disclosed fixtures; actual story routes and combat are tested separately.';

export default async function(t) {
  const hfn=fn=>t.eval(fn);
  const flag=id=>t.eval(id=>window.__voxelHeroes.state.flags.has(id),id);
  const place=(x,z,facing='north')=>t.eval(({x,z,facing})=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(facing);},{x,z,facing});
  const fresh=()=>hfn(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
  const dismiss=()=>hfn(async()=>{const h=window.__voxelHeroes;for(let i=0;i<900&&h.state.mode!=='play';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
  const addFlag=id=>t.eval(id=>window.__voxelHeroes.game.state.setFlag(id),id);
  const chestOpened=(x,z)=>t.eval(({x,z})=>{const h=window.__voxelHeroes,s=h.screen();return h.state.flags.has(`chest:${s.x0+x},${s.z0+z}`);},{x,z});
  await fresh();
  const badHomes=await hfn(()=>{const h=window.__voxelHeroes;return [...h.world.screens.values()].flatMap(s=>s.spawns.filter(p=>p.type==='npc'||p.type.startsWith('npc-')).filter(p=>h.world.blocked(s.x0+p.x+.5,s.z0+p.z+.5,p.opts.r??.34,{flying:false})).map(p=>({screen:s.key,type:p.type,name:p.opts.name,x:p.x,z:p.z})));});
  t.expect(!badHomes.length,'Every authored NPC home clears scenery across the whole world '+JSON.stringify(badHomes));
  await t.teleport('v1:1,2',11.5,5.5);await t.step(.15);
  const wick=()=>hfn(()=>{const h=window.__voxelHeroes,n=h.entities.find(e=>e.name==='Old Wick');return{name:n.name,x:n.x,z:n.z,home:n.home,out:n.out,blocked:h.world.blocked(n.x,n.z,n.r,n),tile:h.world.tile(Math.floor(n.x),Math.floor(n.z))};});
  t.expect(!(await wick()).blocked&&(await wick()).tile!== 'v','Old Wick starts beside his pot on a clear tile');
  await t.step(3);await t.shot('01-wick-beside-pot');
  await place(12.5,5.5);await t.tap('sword');
  t.expect((await t.state()).mode==='dialog','Native A input talks to Old Wick beside the pot');
  await dismiss();
  await place(14.5,4.5,'west');await t.tap('sword');
  t.expect(await hfn(()=>!!window.__voxelHeroes.player.carrying),'The pot beside Old Wick can be lifted with A');
  await t.shot('02-wick-pot-lifted');
  await place(14.5,5.5,'south');await t.tap('sword');await t.step(.6);
  t.expect(await hfn(()=>!window.__voxelHeroes.player.carrying),'The same pot can be thrown with A');

  // Reproduce a wanderer standing on the cleared pot; the map remains native.
  await hfn(()=>{const h=window.__voxelHeroes,n=h.entities.find(e=>e.name==='Old Wick'),s=h.screen();window.__wick=n;window.__wickLane=s;n.x=s.x0+13.5;n.z=s.z0+4.5;h.world.regrow(s);});
  t.expect(await hfn(()=>{const h=window.__voxelHeroes,n=window.__wick,s=window.__wickLane;return h.world.tile(s.x0+13,s.z0+4)!=='v'&&!h.world.blocked(n.x,n.z,n.r,n);}), 'Regrowth leaves a cleared pot empty while an NPC occupies it');
  await place(8.5,.8);await t.hold('ArrowUp',.9);
  t.expect((await t.state()).key==='v1:1,1','The hero actually walks from Mossbrook Lane into the square');
  await hfn(()=>window.__voxelHeroes.world.regrow(window.__wickLane));
  t.expect(await hfn(()=>{const h=window.__voxelHeroes,n=window.__wick;return !n.removed&&!h.world.blocked(n.x,n.z,n.r,n);}), 'A neighbouring NPC bucket also prevents a pot growing through its resident');
  await hfn(()=>{const h=window.__voxelHeroes,n=window.__wick;n.x=n.home.x;n.z=n.home.z;h.world.regrow(window.__wickLane);});
  t.expect(await hfn(()=>{const h=window.__voxelHeroes,s=window.__wickLane;return h.world.tile(s.x0+13,s.z0+4)==='v';}),'The unoccupied pot still regrows normally');
  await t.teleport('v1:1,2',14.5,4.5);await place(14.5,4.5,'west');await t.tap('sword');
  await place(13.5,4.5,'south');await t.tap('sword');await t.step(.5);
  await hfn(()=>window.__voxelHeroes.world.regrow(window.__voxelHeroes.screen()));
  t.expect(await hfn(()=>{const h=window.__voxelHeroes;return !h.world.blocked(h.player.x,h.player.z,h.player.r,h.player);}), 'A pot cannot regrow through the hero either');
  await place(11.5,6.5);
  await hfn(()=>{const h=window.__voxelHeroes;h.state.clock.min=22*60;h.entities.find(e=>e.name==='Old Wick').onWake();});
  t.expect(!(await wick()).out,'Old Wick follows his night schedule');
  await hfn(()=>window.__voxelHeroes.state.clock.min=8*60);await t.step(.05);
  t.expect((await wick()).out&&!(await wick()).blocked,'Morning places Old Wick safely beside his pot');
  await hfn(()=>{const h=window.__voxelHeroes;window.__townChestSave=h.save();h.load(window.__townChestSave);});await t.step(.1);
  t.expect(!(await wick()).blocked,'Old Wick remains clear after save/load');
  await t.teleport('mossbrook-future:0,0',7.5,12.5);await t.teleport('v1:1,2',11.5,5.5);
  t.expect(!(await wick()).blocked,'Leaving the area and returning never respawns him in the pot');
  // Bad authored/home positions introduced by future map edits get a safe
  // fallback too, rather than relying only on this one corrected coordinate.
  await hfn(()=>{const h=window.__voxelHeroes,n=h.entities.find(e=>e.name==='Old Wick'),s=h.screen();n.home.x=s.x0+13.5;n.home.z=s.z0+4.5;h.world.regrow(s);n.hide();n.show();});
  t.expect(!(await wick()).blocked&&!(await hfn(()=>{const h=window.__voxelHeroes,n=h.entities.find(e=>e.name==='Old Wick');return h.world.blocked(n.home.x,n.home.z,n.r,n);})), 'A blocked morning home is corrected to the nearest safe floor');

  const vaults=[
    {id:'seed',screen:'mossbrook-future:0,0',x:7,z:3,ready:'era:water-restored',reward:'era:dawn-seed',hint:'engine',kind:'hp',amount:2},
    {id:'archive',screen:'mossbrook-future:2,0',x:7,z:3,ready:'era:archive-powered',reward:'era:copper-memory',hint:'valves',guard:'sentries',kind:'mp',amount:2},
    {id:'departure',screen:'mossbrook-future:1,1',x:11,z:12,ready:'era:departure-powered',reward:'era:departure-tag',hint:'fix signal',guard:'Courier',kind:'tag',amount:1},
    {id:'keeper',screen:'mossbrook-future:0,0',x:13,z:12,ready:'coast:beacon-lit',reward:'coast:beacon-memory',hint:'beacon',kind:'mp',amount:1},
  ];
  for(const v of vaults) {
    await fresh();await t.teleport(v.screen,v.x+.5,v.z+1.5);await place(v.x+.5,v.z+1.5);await hfn(()=>window.__voxelHeroes.player.invT=999);
    await t.step(3.2);
    t.expect(await hfn(()=>window.__voxelHeroes.game.interact.findInteraction(window.__voxelHeroes.player)?.label)==='Open chest',`${v.id}: the action prompt offers Open chest`);
    await t.tap('sword');await t.step(.05);
    const locked=await hfn(()=>({toast:window.__voxelHeroes.game.toast.toastView().text,mode:window.__voxelHeroes.state.mode,thrust:!!window.__voxelHeroes.player.thrust}));
    t.expect(!await chestOpened(v.x,v.z)&&!await flag(v.reward),`${v.id}: A respects the story lock and awards nothing`);
    t.expect(locked.toast.includes(v.hint)&&locked.mode==='play'&&!locked.thrust,`${v.id}: a locked A press explains its prerequisite ${JSON.stringify(locked)}`);
    await t.shot(`03-${v.id}-locked-feedback`);
    await addFlag(v.ready);await t.step(.1);
    if(v.guard) {
      await t.tap('sword');await t.step(.05);
      t.expect(!await chestOpened(v.x,v.z)&&(await hfn(()=>window.__voxelHeroes.game.toast.toastView().text)).includes(v.guard),`${v.id}: repairing the past does not bypass its live sentries`);
      await hfn(()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy'&&!e.removed)e.hurt({damage:999,knockback:0,source:'reported-chest-fixture'});});await t.step(.2);
    }
    const before=await hfn(()=>{const s=window.__voxelHeroes.state;return{hp:s.maxHp,mp:s.maxMagic,tag:Number(s.flags.has('era:departure-tag'))};});
    await t.tap('sword');await t.step(.1);
    t.expect(await chestOpened(v.x,v.z)&&await flag(v.reward),`${v.id}: actual A opens the available vault and grants its own reward`);
    await dismiss();
    const totals=()=>hfn(()=>{const s=window.__voxelHeroes.state;return{hp:s.maxHp,mp:s.maxMagic,tag:Number(s.flags.has('era:departure-tag'))};});
    t.expect((await totals())[v.kind]===before[v.kind]+v.amount,`${v.id}: grants exactly the intended permanent reward`);
    await t.step(3);await t.shot(`04-${v.id}-opened-by-action`);
    await t.tap('sword');await t.hold('ArrowUp',.4);await dismiss();
    t.expect((await totals())[v.kind]===before[v.kind]+v.amount,`${v.id}: repeated A and push claims cannot duplicate its reward`);
    await hfn(()=>{const h=window.__voxelHeroes;window.__townChestSave=h.save();h.load(window.__townChestSave);});await t.step(.15);
    t.expect(await flag(v.reward)&&await chestOpened(v.x,v.z),`${v.id}: opened lid and reward survive save/load`);
    await t.teleport('v1:1,1',7.5,12.5);await t.teleport(v.screen,v.x+.5,v.z+1.5);await place(v.x+.5,v.z+1.5);await t.tap('sword');await dismiss();
    t.expect((await totals())[v.kind]===before[v.kind]+v.amount,`${v.id}: leaving and revisiting cannot duplicate the reward`);
  }
}

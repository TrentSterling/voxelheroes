export const description = 'The barrow bell: actual telegraph/volley, physical pot pickup and throw, four-second silence, two real encounter waves, no early key or shutters, safe reinforcements, optional memory chest, one-time permanent magic, save/load and journal layouts. Positioning, stationary first-wave guards and damage-API kills are disclosed fixtures. Audio master muted and NPC voices disabled.';

export default async function(t) {
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='barrow-bell');return {bell:b?{...b.ai,ring:b.ring.visible}:null,foes:h.entities.filter(e=>!e.removed&&e.kind==='enemy').map(e=>({type:e.type,x:e.x,z:e.z})),blocked:h.game.combat.roomClearBlocked(),shut:h.world.isSolid(h.screen().x0+15,h.screen().z0+5),shots:h.entities.filter(e=>!e.removed&&e.type==='turret-bolt').length,key:h.state.flags.has('dungeon:d1:key:E-3'),chest:h.world.tile(h.screen().x0+12,h.screen().z0+8),muted:h.state.flags.has('dungeon:d1:echo-muted'),memory:h.state.flags.has('dungeon:d1:echo-memory'),maxMagic:h.state.maxMagic,hp:h.state.hp};});
  const shot=async name=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  const waitTell=()=>t.eval(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='barrow-bell');for(let i=0;i<420&&b.ai.tell<=0;i++)await h.tick();return b.ai.tell>0;});
  const kill=()=>t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities.filter(e=>!e.removed&&e.kind==='enemy'&&e.countsForClear!==false))h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}});});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});});
  await t.teleport('d1:2,4',8.5,7.5);await t.step(1.3);
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};h.player.invT=0;});
  let r=await view();t.expect(r.foes.length===3&&r.blocked&&r.shut&&!r.key&&r.chest==='h','three first-wave guards, a held encounter and hidden key/memory rewards');
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible&&!window.__voxelHeroes.game.toast.toastView().visible);
  t.expect(await waitTell(),'the bell begins a real timed warning');
  r=await view();t.expect(r.bell.ring&&r.bell.tell>.95&&r.shots===0,'a visible floor ring warns for 1.1 seconds before any projectile fires');
  await shot('01-bell-warning');
  const hp=r.hp;await t.stick(0,1,.35);await t.step(.8);
  r=await view();t.expect(r.shots===4&&!r.bell.ring,'the committed volley releases four slow, shieldable projectiles');await shot('02-bell-volley');
  await t.step(2.4);t.expect((await view()).hp===hp,'actual movement evades the committed volley without losing health');
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='projectile')e.remove();h.game.hero.hero.place(3.5,9.5);h.game.hero.hero.setFacing('west');});
  await t.tap('sword');t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'actual sword-button input lifts an authored clay pot');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(8.5,4.5);h.game.hero.hero.setFacing('north');});
  t.expect(await waitTell(),'the next warning starts before the real throw');
  await t.tap('sword');await t.step(.35);r=await view();
  t.expect(r.muted&&r.bell.muted>3.5&&r.bell.tell===0&&!r.bell.ring,'a physical thrown pot cancels the pending volley and gives four seconds of quiet');
  await shot('03-clay-quiets-the-bell');
  const shots=r.shots;await t.step(2);t.expect((await view()).shots===shots,'no shots appear during the silence window');
  await kill();await t.step(.3);r=await view();
  t.expect(r.foes.length===0&&r.blocked&&r.shut&&!r.key&&r.bell.phase==='reinforcements','the quiet interval between waves keeps the key and shutters locked');await shot('04-quiet-between-waves');
  await t.step(1.3);r=await view();
  t.expect(r.foes.length===2&&r.foes.some(e=>e.type==='barrow-warden')&&r.foes.some(e=>e.type==='gazer'),'the second wave changes the fight to a shielded warden and ranged gazer');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.entities.filter(e=>e.kind==='enemy').every(e=>!h.world.blocked(e.x,e.z,e.r,e)&&Math.hypot(e.x-h.player.x,e.z-h.player.z)>=2);}), 'reinforcements arrive on safe floor away from the hero');
  await t.step(.8); // Reinforcements keep the normal appear-in protection.
  await shot('05-the-second-wave');
  await kill();await t.step(.3);r=await view();
  t.expect(!r.blocked&&!r.shut&&r.key&&r.chest==='c'&&r.bell.phase==='done','the last wave opens shutters, drops the fourth key and reveals the optional memory chest');
  const capacity=r.maxMagic;
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(12.5,9.5);h.game.hero.hero.setFacing('north');});
  await t.stick(0,-1,.4);await t.step(.2);r=await view();
  t.expect(r.memory&&r.maxMagic===capacity+1,'opening the physical memory chest grants exactly one permanent magic gem');await shot('06-echo-memory');
  await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<400&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.grants.grant('barrow-memory',1,{fanfare:false});h.load(h.save());});await t.step(.2);r=await view();
  t.expect(r.memory&&r.maxMagic===capacity+1&&r.bell.phase==='done'&&!r.blocked,'save/load retains the memory and finished encounter without repeating the magic reward');
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.journal.openJournal();h.render();const target=h.game.journal.journalView().entries.findIndex(e=>e.title==='The Note Beneath');for(let i=0;i<target;i++)h.game.ui.pressUi('journal-next');});
  t.expect(await t.eval(()=>window.__voxelHeroes.game.journal.journalView().entries.find(e=>e.title==='The Note Beneath').status==='done'),'the adventure journal records the recovered copper note');
  await shot('07-note-journal');
  for(const [w,h]of[[320,568],[568,320]]){await t.page.setViewportSize({width:w,height:h});await shot(`08-note-journal-${w}`);}
}

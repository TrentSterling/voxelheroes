export const description='Isolated Nacre body/tentacle warning geometry, committed lanes, native phase clocks and rendered visibility. Campaign, arena placement and phase/direction/growth are disclosed fixtures; unrelated ink is removed and the intro is skipped. No health edits, gear grants or immunity. Speaker output disconnected.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');for(const id of ['d1','d2','d3']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}h.state.flags.add('dungeon:d4:entered');h.game.dungeons.giveBossKey('d4');});
  await t.teleport('d4-boss:0,0',3,13);await t.eval(()=>{window.__voxelHeroes.entities.find(e=>e.type==='boss-beast').introDone=true;});await t.step(1.5);await t.waitFor(s=>s.mode==='play',{seconds:6});
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
  await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');for(const e of [...h.entities])if(e.type==='beast-ink')e.remove();b.ai.phase='ripple';b.ai.t=.85;for(const [i,e]of b.segments.entries()){e.ai.phase='tell';e.ai.t=.7;e.ai.dx=i%2?0:1;e.ai.dz=i%2?-1:0;e.holder.rotation.y=-.8;}});await t.step(.05);
  await t.shot('180-undertow-ripples');
  const v=await t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-beast');return {phase:b.ai.phase,t:b.ai.t,body:b.marks.visible,bodyMarks:b.marks.children.map(m=>m.getWorldPosition(m.position.clone()).y),bodyColor:b.marks.children[0].material.color.getHex(),tentacles:b.segments.map(e=>({phase:e.ai.phase,t:e.ai.t,x:e.x,z:e.z,dx:e.ai.dx,dz:e.ai.dz,visible:e.marks.visible,color:e.marks.children[0].material.color.getHex(),marks:e.marks.children.map(m=>{const p=m.getWorldPosition(m.position.clone());return{x:p.x,y:p.y,z:p.z};})})),hero:h.player.hero.root.visible};});
  t.expect(v.body&&v.phase==='ripple'&&v.t<.85&&v.t>.7,'the body ripple is visible and its real clock advances');
  t.expect(v.bodyMarks.every(y=>y>.125+3/16),'the body ripple clears the highest temple fine-floor surface');
  t.expect(v.tentacles.every(e=>e.visible&&e.phase==='tell'&&e.t<.7),'all four arranged tentacle tells have active real clocks');
  t.expect(v.tentacles.every(e=>e.marks.every(p=>p.y-.0125>.125+3/16)),'even the bottom of each tentacle warning clears the highest temple fine-floor surface');
  t.expect(v.tentacles.every(e=>e.marks.slice(0,11).every(p=>Math.abs((p.x-e.x)*e.dz-(p.z-e.z)*e.dx)<1e-6)),'coral warning lanes follow the committed world direction despite body interpolation');
  t.expect(v.bodyColor===0x83f7ed&&v.tentacles.every(e=>e.color===0xff9483),'teal surfacing and coral committed lunges remain distinct');
  t.expect(v.hero,'the hero renders without forcing visibility');
  const raised=await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast'),actors=[b,...b.segments];for(const e of actors){e.holder.scale.setScalar(.3);e.present();}const ys=actors.flatMap(e=>e.marks.children.map(m=>m.getWorldPosition(m.position.clone()).y));for(const e of actors){e.holder.scale.setScalar(1);e.present();}return ys;});
  t.expect(raised.every(y=>y-.0125>.125+3/16),'warning height also clears the floor during a partial spawn-growth fixture');
  await t.step(.8);
  const next=await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-beast');return {body:b.ai.phase,bodyMarks:b.marks.visible,tentacles:b.segments.map(e=>({phase:e.ai.phase,visible:e.marks.visible}))};});
  t.expect(next.body==='surface'&&!next.bodyMarks,'the native ripple clock exposes Nacre and hides the surfacing ring');
  t.expect(next.tentacles.every(e=>e.phase==='lunge'&&!e.visible),'the native tentacle clocks commit the lunges and hide their tells');
  await t.shot('181-undertow-native-lunges');
}

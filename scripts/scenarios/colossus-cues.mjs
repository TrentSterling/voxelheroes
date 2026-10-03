export const description = 'Rook telegraph geometry and active phase clocks. Disclosed campaign, arena, body/direction/phase and unrelated projectile-removal fixtures; no immunity or health edits. Raised laser lane follows committed world direction while the body turns; slam and committed landing have separate ground rings. Pose, footprints and HUD are inspected through rendered native scenes. Speaker output disconnected.';
export default async function(t){
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');for(const id of['d1','d2']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}h.state.flags.add('dungeon:d3:entered');h.game.dungeons.giveBossKey('d3');});await t.step(2);await t.teleport('d3-boss:0,0',3,12);await t.step(5);
  await t.waitFor(s=>s.mode==='play',{seconds:6});
  const view=()=>t.eval(()=>{
    const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus'),g=h.game.ui.g;
    h.game.ui.requestUi();h.render();
    const laser=b.marks.children.map(m=>{const p=m.getWorldPosition(m.position.clone());return {x:p.x,z:p.z,y:p.y};});
    const landing=b.landingMarks.getWorldPosition(b.landingMarks.position.clone());
    return {phase:b.ai.phase,t:b.ai.t,yaw:b.holder.rotation.y,x:b.x,z:b.z,dx:b.ai.dx,dz:b.ai.dz,
      laser,laserVisible:b.marks.visible,waveVisible:b.waveMarks.visible,landingVisible:b.landingMarks.visible,
      landing:{x:landing.x,z:landing.z},target:{x:b.ai.hopX,z:b.ai.hopZ},
      height:b.waveMarks.children[0].getWorldPosition(b.waveMarks.children[0].position.clone()).y,
      hud:h.game.hud.hudView(),objective:h.game.objective.currentStep(),heroVisible:h.player.hero.root.visible};
  });
  const phase=async(id,dir=[1,0])=>{
    await t.eval(([id,dir])=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-colossus'),s=h.screen();for(const e of [...h.entities])if(e.type==='colossus-laser'||e.type==='colossus-wave')e.remove();b.x=s.x0+11;b.z=s.z0+6;b.yaw=Math.atan2(dir[0],dir[1]);b.holder.rotation.y=-.8;b.ai.phase=id;b.ai.t=.9;b.ai.dx=dir[0];b.ai.dz=dir[1];b.ai.hopX=s.x0+6;b.ai.hopZ=s.z0+10;b.airborne=id==='leap';},[id,dir]);
    await t.step(.05);return view();
  };
  for(const dir of[[1,0],[0,-1]]){
    const v=await phase('laser-tell',dir);
    t.expect(v.laserVisible&&!v.waveVisible&&!v.landingVisible,'the active laser tell has its own visible lane');
    t.expect(v.laser.every(p=>p.y>.125+3/16),'every laser mark clears the highest Watch rail surface');
    t.expect(v.laser.every(p=>Math.abs((p.x-v.x)*v.dz-(p.z-v.z)*v.dx)<1e-6),'every warning mark follows the committed world direction despite body interpolation');
    t.expect(v.t<.9&&v.t>.8,'the native laser phase clock keeps advancing');
    await t.shot(dir[0]?'90-coral-laser-east':'91-coral-laser-north');
  }
  let v=await phase('slam-tell');
  t.expect(!v.laserVisible&&v.waveVisible&&!v.landingVisible&&v.height>.125+3/16,'the slam exposes its separate raised golden wave ring');await t.shot('92-golden-slam-ring');
  v=await phase('leap');
  t.expect(!v.laserVisible&&!v.waveVisible&&v.landingVisible,'the high leap shows only its landing ring');
  t.expect(Math.hypot(v.landing.x-v.target.x,v.landing.z-v.target.z)<1e-6,'the landing marker stays on the committed target as the body moves');await t.shot('93-committed-landing-ring');
  v=await phase('idle');
  t.expect(!v.laserVisible&&!v.waveVisible&&!v.landingVisible,'all tell markers disappear during normal approach');
  t.expect(v.heroVisible,'the settled hero renders without forcing visibility');
}

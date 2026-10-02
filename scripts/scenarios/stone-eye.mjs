export const description = 'Stone Eye: native one-second committed warnings, sidestep, damage, shield tiers, actual boomerang/pot/sword interruption, counterattack, cover, four cardinal cue directions and freeze cancellation. Native dungeon floor capture and save/revisit. Starter gear, placements, initial attack cooldown, one missing half-heart to isolate sword contact from the existing full-life beam, and an isolated uncrowned enemy are disclosed fixtures. All audio muted.';

export default async function(t) {
  await t.track('enemy-hit','hero-hit','item-used','enemy-killed');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.game.swords.giveSword('blade-start');h.game.swords.equipSword('blade-start');h.game.inventory.giveItem('boomerang');h.game.inventory.selectItem('boomerang');});
  await t.teleport('d1:4,7',10.5,7.5);await t.step(3.2);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>!e.removed&&e.type==='gazer').length===3),'Gazer Walk retains its three actual Stone Eyes');
  await t.shot('01-sight-mosaics');
  await t.eval(()=>{
    const h=window.__voxelHeroes;
    window.__eye={
      make(x=3.5,z=7.5,hx=10.5,hz=7.5,face='west') {
        h.input.setStick(0,0);for(const a of ['guard','sword','item','dash'])h.input.up(a);
        for(const e of [...h.entities])if(['enemy','projectile','pickup'].includes(e.kind))e.remove();
        h.game.hero.hero.place(hx,hz);h.game.hero.hero.setFacing(face);h.game.hero.hero.clearStatus('paralyzed');
        Object.assign(h.player,{invT:0,knockT:0,kx:0,kz:0,attackT:0,lockT:0,thrust:null,charge:null});h.player.stopDash();h.setHp(h.state.maxHp-1);h.state.gear.shield=1;
        const e=h.spawn('gazer',x,z,{crowned:false});e.spawned=true;e.growT=1;e.holder.scale.setScalar(1);e.yaw=Math.atan2(hx-x,hz-z);e.ai.eye.cool=0;
        window.__eye.e=e;return e;
      },
      async aim() {for(let i=0;i<60&&this.e.ai.eye.phase!=='aim';i++)await h.tick();return this.e.ai.eye.phase==='aim';}
    };
  });
  const make=(args=[])=>t.eval(args=>{window.__eye.make(...args);},args);
  const aim=()=>t.eval(()=>window.__eye.aim());
  const view=()=>t.eval(()=>{const h=window.__voxelHeroes,e=window.__eye.e;return {eye:{...e.ai.eye},cue:e.sightCue.visible,pose:e.mesh.pose,harmless:e.harmless,stun:e.stunT,hp:h.state.hp,enemyHp:e.hp,held:h.game.hero.hero.hasStatus('paralyzed'),hero:{x:h.player.x,z:h.player.z},shots:h.entities.filter(e=>!e.removed&&e.type==='gazer-shot').map(e=>({x:e.x,z:e.z,vx:e.vx,vz:e.vz,tier:e.tier}))};});
  await make();t.expect(await aim(),'native targeting starts a warning');let r=await view(),hp=r.hp,z=r.hero.z;
  t.expect(r.cue&&r.pose==='open'&&r.eye.t>.95&&!r.held&&r.shots.length===0,'coral marks and an open lid warn before shots while movement remains available');
  await t.shot('02-coral-warning');
  await t.stick(0,-1,.35);r=await view();
  t.expect(z-r.hero.z>1&&!r.held,'actual movement leaves the sight line without a paralysis lock');
  t.expect(r.eye.dx===1&&r.eye.dz===0&&r.cue&&r.shots.length===0,'aim remains committed to its original row after a sidestep');
  await t.shot('03-sidestep-the-line');await t.step(.67);r=await view();
  t.expect(r.shots.length===1&&r.shots[0].vx>6.9&&Math.abs(r.shots[0].vz)<.01,'one real tier-three shot follows the warned row after a full second');
  t.expect(r.eye.phase==='recover'&&r.eye.t>.6&&!r.cue&&r.pose==='shut'&&r.harmless,'the eye closes its lid for a visible counterattack window');
  await t.shot('04-the-lid-closes');await t.step(1.15);
  t.expect((await view()).hp===hp,'a native sidestep avoids the projectile without invulnerability');
  await make();await aim();await t.step(2);r=await view();
  t.expect(r.hp===hp-2&&!r.held,'ignoring the line takes ordinary projectile damage without a movement status');
  for(const tier of [1,3]) {
    await make();await t.eval(tier=>{const h=window.__voxelHeroes;h.state.gear.shield=tier;h.input.down('guard');},tier);
    await aim();await t.step(2);r=await view();
    t.expect(r.hp===(tier===3?hp:hp-2),`native held shield tier ${tier} ${tier===3?'blocks':'cannot block'} the magic shot`);
    await t.eval(()=>window.__voxelHeroes.input.up('guard'));
  }
  await make([3.5,7.5,7.5,7.5]);await aim();await t.tap('item');await t.step(.4);r=await view();
  t.expect(r.enemyHp===6&&r.stun>1.5&&r.eye.phase==='recover'&&!r.cue,'actual zero-damage boomerang input interrupts the pending shot and stuns the eye: '+JSON.stringify(r));
  await t.shot('05-boomerang-interruption');await t.step(1.4);
  t.expect((await view()).shots.length===0,'the interrupted warning cannot resume its old projectile during the stun');
  await t.eval(()=>{const h=window.__voxelHeroes,e=window.__eye.e;h.game.hero.hero.place(e.x+1.5-h.screen().x0,e.z-h.screen().z0);h.game.hero.hero.setFacing('west');});
  await t.tap('sword');await t.step(.15);r=await view();
  t.expect(r.enemyHp===3&&r.hp===hp,'a native starter-sword thrust punishes the boomerang opening: '+JSON.stringify(r));
  await make([3.5,7.5,5,7.5]);await aim();await t.tap('sword');await t.step(.17);r=await view();
  t.expect(r.enemyHp===3&&r.eye.phase==='recover'&&!r.cue&&r.shots.length===0,'an actual blade interrupt also cancels the warning');
  await make();await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(3.5,9.5);h.game.hero.hero.setFacing('west');});
  await t.tap('sword');t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'the existing authored pot lifts through actual input');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(7.5,7.5);h.game.hero.hero.setFacing('west');window.__eye.e.ai.eye.cool=0;});
  await aim();await t.tap('sword');await t.step(.5);r=await view();
  t.expect(r.enemyHp===2&&r.eye.phase==='recover'&&!r.cue&&r.shots.length===0,'a real thrown pot interrupts and damages the eye: '+JSON.stringify(r));
  await t.shot('06-clay-counter');
  await make([3.5,4.5,10.5,4.5]);await t.eval(()=>{window.__eye.e.ai.wander={dir:{x:0,z:0},t:10,pause:true};});await t.step(.4);r=await view();
  t.expect(r.eye.phase==='roam'&&!r.cue&&r.shots.length===0,'solid dungeon cover prevents acquiring the hero through a pillar');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(3.5,7.5);h.game.hero.hero.setFacing('north');});
  t.expect(await aim(),'leaving cover gives the eye a new, readable sight line');
  for(const [name,x,z,hx,hz,face] of [['east',3.5,7.5,10.5,7.5,'west'],['west',12.5,5.5,8.5,5.5,'east'],['south',3.5,3.5,3.5,7.5,'north'],['north',12.5,7.5,12.5,3.5,'south']]) {
    await make([x,z,hx,hz,face]);t.expect(await aim(),`${name} targeting starts a native warning`);
    const data=await t.eval(()=>{const h=window.__voxelHeroes,e=window.__eye.e,a=e.ai.eye;e.object.updateMatrixWorld(true);return {blocked:e.sightCue.children.filter(m=>m.visible).some(m=>{const p=m.getWorldPosition(m.position.clone());return h.world.shotBlockedAt(p.x,p.z);}),aligned:e.sightCue.children.filter(m=>m.visible).every(m=>{const p=m.getWorldPosition(m.position.clone());const dx=p.x-e.x,dz=p.z-e.z;return Math.abs(dx*a.dz-dz*a.dx)<=.51;}),count:e.sightCue.children.filter(m=>m.visible).length};});
    t.expect(data.count>0&&data.aligned&&!data.blocked,`${name} cue follows the exact shot direction and stops before cover`);
  }
  await make();await aim();await t.eval(()=>{window.__voxelHeroes.game.damage.freezeAt(window.__eye.e.x,window.__eye.e.z,1,2);});await t.step(.1);r=await view();
  t.expect(!r.cue&&r.eye.phase==='recover'&&r.shots.length===0,'freezing the eye cancels its pending warning');
  await t.step(2.7);r=await view();t.expect(r.shots.length===0,'thawing cannot release a stale aimed projectile');
  await t.eval(()=>{const h=window.__voxelHeroes;h.load(h.save());});await t.step(1);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.entities.filter(e=>e.type==='gazer'&&!e.removed).every(e=>e.ai.eye.phase==='roam'&&!e.sightCue.visible);}), 'solo reload restores ordinary patrols without reviving a saved warning');
  await t.shot('07-return-to-the-walk');
}

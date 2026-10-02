export const description = 'Opening bow: real authored tier-one arrow and long draw, actual held guard, sword and boomerang interruption, and later tier-two bow unchanged. Disclosed arena teleport, isolated spawned actors, clear memory, initial cooldown, gear and health fixtures; the recovery fixture re-aligns the hero with the wandering bow without altering enemy timers. Attacks and projectile collisions are native. Muted throughout.';

export default async function(t) {
  await t.press('Enter'); await t.step(2);
  await t.teleport('test-foes-field',8.5,8.5);
  await t.eval(() => {
      const h=window.__voxelHeroes;
    h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});
    h.game.settings.setSetting('npcVoices',false);
    const authored=h.world.screen('ow-3-2:1,1').spawns.find(s=>s.type==='archer');
    window.__roadBow={opts:authored.opts,hits:[]};
    h.game.events.on('hero-hit',e=>window.__roadBow.hits.push({result:e.result,kind:e.kind}));
    window.__roadBow.setup=(x,opts={})=>{
      for(const e of h.entities)if(['enemy','projectile','pickup','spawner','bomb'].includes(e.kind))e.remove();
      h.game.clears.forgetCleared(key=>key===h.screen().key);
      h.input.up('guard');h.input.setStick(0,0);
      h.player.stopDash();h.player.attackT=h.player.lockT=h.player.knockT=h.player.invT=0;
      h.game.hero.hero.place(8.5,8.5);h.game.hero.hero.setFacing('west');
      h.state.gear.shield=1;h.setHp(h.state.maxHp);window.__roadBow.hits=[];
      const a=h.spawn('archer',x,8.5,{crowned:false,...opts});
      a.spawned=true;a.growT=1;a.holder.scale.setScalar(1);
      a.ai.shoot={cool:0,dir:null};window.__roadBow.archer=a;
      return {tier:a.arrowTier,tell:a.shotTell};
    };
  });
  const authored=await t.eval(()=>{const b=window.__roadBow;return b.setup(3.5,b.opts);});
  t.expect(authored.tier===1&&authored.tell===.8,'the actual Crossing bow has starter-shield arrows and a 0.8-second draw');
  await t.eval(()=>window.__voxelHeroes.input.down('guard'));await t.step(.55);
  t.expect(await t.eval(()=>!!window.__roadBow.archer.ai.shoot.dir&&!window.__voxelHeroes.entities.some(e=>e.type==='archer-arrow')),'the native bow visibly draws for more than half a second before firing');
  await t.shot('01-long-draw');await t.step(.35);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='archer-arrow'&&e.tier===1)),'the authored bow actually fires a tier-one projectile');
  await t.step(.7);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.hp===h.state.maxHp&&window.__roadBow.hits.some(e=>e.kind==='projectile'&&e.result==='blocked');}),'actual starter guard blocks the native road arrow without losing hearts');
  await t.shot('02-starter-shield-block');
  const later=await t.eval(()=>window.__roadBow.setup(3.5));
  t.expect(later.tier===2&&later.tell===.4,'ordinary later archers retain tier-two arrows and their original draw time');
  await t.eval(()=>window.__voxelHeroes.input.down('guard'));await t.step(1.3);
  t.expect(await t.eval(()=>window.__roadBow.hits.some(e=>e.kind==='projectile'&&e.result==='hit')),'the same tier-one guard does not incorrectly block a later tier-two bow');

  await t.eval(()=>{const b=window.__roadBow;b.setup(7.4,b.opts);window.__voxelHeroes.give({grant:'blade-start',source:'test',fanfare:false});});
  t.expect(await t.eval(()=>window.__voxelHeroes.state.swords.equipped==='blade-start'),'an unarmed hero automatically equips the first sword granted');
  await t.step(.05);
  t.expect(await t.eval(()=>!!window.__roadBow.archer.ai.shoot.dir),'the nearby bow commits to its native draw before a sword strike');
  const swordHp=await t.eval(()=>window.__roadBow.archer.hp);
  await t.tap('sword');await t.step(.12);
  t.expect(await t.eval(hp=>{const a=window.__roadBow.archer;return a.hp<hp&&!a.ai.shoot.dir&&a.ai.tellT===0;},swordHp),'actual sword damage cancels the pending draw and its tell');
  await t.step(.55);
  t.expect(await t.eval(()=>!window.__voxelHeroes.entities.some(e=>e.type==='archer-arrow')),'the interrupted draw cannot release its stale arrow after sword stagger');
  await t.shot('03-sword-cancels-draw');

  await t.eval(()=>window.__voxelHeroes.give('boomerang'));await t.step(2);
  const boomHp=await t.eval(()=>{const b=window.__roadBow;return b.setup(5.5,b.opts),b.archer.hp;});
  await t.step(.05);await t.tap('item');await t.step(.3);
  t.expect(await t.eval(hp=>{const a=window.__roadBow.archer;return a.hp===hp&&a.stunT>0&&!a.ai.shoot.dir&&a.ai.tellT===0;},boomHp),'an actual zero-damage boomerang stun also cancels the pending draw');
  await t.step(.8);
  t.expect(await t.eval(()=>!window.__voxelHeroes.entities.some(e=>e.type==='archer-arrow')),'a stunned bow cannot fire its loaded shot');
  await t.shot('04-boomerang-cancels-draw');
  await t.eval(()=>window.__voxelHeroes.input.down('guard'));
  // Recovery tests shooting, rather than whether random wandering happens
  // to re-align with a stationary hero. Leave every enemy timer untouched.
  let fired=false;for(let n=0;n<360&&!fired;n++){
    await t.eval(()=>{const h=window.__voxelHeroes,a=window.__roadBow.archer,s=h.screen();h.game.hero.hero.place(a.x-s.x0+3,a.z-s.z0);h.game.hero.hero.setFacing('west');});
    await t.step(1/60);fired=await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='archer-arrow'));
  }
  t.expect(fired,'the bow recovers and can start a new draw after the interruption');
  await t.eval(()=>window.__voxelHeroes.input.up('guard'));
  await t.eval(()=>window.__voxelHeroes.give({grant:'blade-warden',fanfare:false}));
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.swords.owned.includes('blade-warden')&&h.state.swords.equipped==='blade-start';}),'a later sword reward preserves the hero\'s equipped weapon choice');
}

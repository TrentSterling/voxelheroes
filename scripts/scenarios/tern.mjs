export const description = 'Recruit Tern through the archive homecoming, keep two distinct travelling companions, follow real movement, Bell Shelter through actual guard/sword input, real enemy projectile blocking, hazard/unblockable/expiry/cooldown boundaries, dismissal and save/load. Copper Memory, empty combat room and incoming shots are fixtures; conversations, controls, movement and the hit pipeline are real. Everything is muted.';

export default async function(t) {
  const view = () => t.eval(() => window.__voxelHeroes.game.companions.companionView());
  const shot = async name => { await t.eval(() => { window.__voxelHeroes.player.hero.root.visible = true; }); await t.shot(name); };
  const answer = choice => t.eval(async choice => {
    const h = window.__voxelHeroes;
    for(let i = 0; i < 1600 && h.state.mode === 'dialog'; i++) {
      const d = h.game.dialog.dialogView();
      if(d.choices && d.page === d.pages - 1) {
        h.input.tap(d.choice === choice ? 'confirm' : 'down');
      } else if(i % 15 === 0) h.input.tap('confirm');
      await h.tick();
    }
    return h.state.mode;
  }, choice);
  const talk = async type => {
    await t.eval(type => {
      const h = window.__voxelHeroes, e = h.entities.find(e => e.type === type && !e.removed), s = h.screen();
      h.game.hero.hero.place(e.x - s.x0, e.z - s.z0 + 1); h.game.hero.hero.setFacing('north');
    }, type);
    await t.tap('sword');
    t.expect((await t.state()).mode === 'dialog', `actual Talk input opens ${type}`);
  };
  const shelter = async () => {
    await t.page.keyboard.down('Shift'); await t.step(1/60);
    await t.page.keyboard.down('j'); await t.step(1/60);
    await t.page.keyboard.up('j'); await t.page.keyboard.up('Shift'); await t.step(1/60);
  };
  const resetHit = () => t.eval(() => {
    const h = window.__voxelHeroes; h.player.invT = 0; h.player.knockT = 0; h.player.lockT = 0;
  });
  await t.eval(() => { const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false); });
  await t.press('Enter'); await t.step(1.1);
  t.expect(await t.eval(() => !window.__voxelHeroes.game.companions.setTernTravelling(true)) && !(await view()).ternRecruited, 'Tern cannot be recruited before recovering the choir');
  await talk('npc-mira'); await answer(0); await t.step(.2);
  t.expect((await view()).recruited, 'Mira is recruited through her actual conversation');
  await t.eval(() => window.__voxelHeroes.game.grants.grant('copper-memory',1,{fanfare:false}));
  await t.teleport('mossbrook-future:0,0',10.5,12.5); await t.step(.2);
  await talk('npc-tern'); await shot('01-choir-homecoming'); await answer(0); await t.step(.2);
  t.expect(await t.eval(() => window.__voxelHeroes.state.flags.has('era:voices-returned')), 'the real archive homecoming records the recovered choir');
  t.expect((await view()).ternRecruited && (await view()).tern?.visible && (await view()).mira?.visible, 'Travel with Tern adds the garden machine alongside Mira');
  t.expect(await t.eval(() => {const h=window.__voxelHeroes;return h.entities.filter(e=>e.kind==='companion'&&!e.removed).length===2&&h.entities.filter(e=>e.type==='npc-tern').every(e=>!e.out&&!e.solid&&!e.object.visible);}), 'two travelling companions replace the Tern resident collider and presentation');
  await shot('02-two-companions');
  await t.teleport('Crossroads',8,5.5); await t.step(.2);
  await t.eval(() => { const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy')e.remove();h.give('blade-start');h.game.swords.equipSword('blade-start'); });
  await t.walkTo(6.5,5.5); await t.walkTo(6.5,7.5); await t.step(.6);
  t.expect((await view()).ternNearby && !(await view()).tern.blocked && !(await view()).mira.blocked, 'both companions follow actual walking onto clear terrain');
  const before = await t.eval(() => window.__voxelHeroes.state.magic);
  await shelter();
  t.expect((await view()).shelterCount===1 && await t.eval(()=>window.__voxelHeroes.state.magic)===before-2, 'guard plus actual sword input pays two personal magic for one shelter');
  t.expect((await view()).wardT>2.9 && (await view()).shelterCooldown>7.9, 'the shelter lasts three seconds and recharges for eight');
  t.expect(await t.eval(() => window.__voxelHeroes.player.attackT<=0), 'the combination consumes the sword press rather than also starting an attack');
  await t.step(.1); await shot('03-bell-shelter');
  await resetHit();
  const hp = (await t.state()).hp;
  await t.eval(() => {
    const h=window.__voxelHeroes,s=h.screen();window.__ternHits=[];h.events.on('hero-hit',e=>window.__ternHits.push({result:e.result,kind:e.kind,source:e.source?.type??e.source}));
    h.spawn('rock-shot',h.player.x-s.x0+1.4,h.player.z-s.z0,{vx:-4,vz:0,damage:2,tier:5,deflectable:false});
  });
  await t.step(.5);
  t.expect((await t.state()).hp===hp && (await view()).blocks===1 && await t.eval(()=>window.__ternHits.some(e=>e.result==='blocked'&&e.kind==='projectile')), 'a real tier-five shot is blocked from the side without taking life');
  await resetHit();
  const contact=await t.eval(()=>{const h=window.__voxelHeroes;return h.game.hero.hero.receiveHit({damage:2,from:{x:h.player.x-1,z:h.player.z},kind:'contact',source:'tern-contact-check'});});
  t.expect(contact==='blocked' && (await t.state()).hp===hp, 'shelter also blocks contact attacks without a directional shield');
  await resetHit();
  const hazard=await t.eval(()=>window.__voxelHeroes.game.hero.hero.receiveHit({damage:1,kind:'hazard',knockback:false,lock:0,source:'tern-hazard-check'}));
  t.expect(hazard==='hit' && (await t.state()).hp===hp-1, 'pits and floor hazards still hurt a sheltered hero');
  await resetHit();
  const unblockable=await t.eval(()=>window.__voxelHeroes.game.hero.hero.receiveHit({damage:1,kind:'projectile',tier:Infinity,knockback:false,lock:0}));
  t.expect(unblockable==='hit' && (await t.state()).hp===hp-2, 'an explicitly unblockable shot bypasses Bell Shelter');
  await resetHit(); await t.eval(()=>window.__voxelHeroes.game.vitals.restoreMagic(2));
  await shelter();
  t.expect((await view()).shelterCount===1&&await t.eval(()=>window.__voxelHeroes.state.magic)===2, 'a sword press during shelter cooldown spends no magic and cannot repeat the pulse');
  await t.step(3.1); await resetHit();
  const expired=await t.eval(()=>window.__voxelHeroes.game.hero.hero.receiveHit({damage:1,kind:'contact',knockback:false,lock:0}));
  t.expect(expired==='hit' && (await view()).wardT===0, 'the expired shelter no longer blocks normal hits');
  await t.step(5); await resetHit();
  await t.eval(()=>{window.__voxelHeroes.state.magic=0;});await shelter();
  t.expect((await view()).shelterCount===1&&(await view()).wardT===0,'an empty magic row cannot create temporary protection');
  await t.eval(()=>window.__voxelHeroes.game.vitals.restoreMagic(2));await t.step(.6);await shelter();
  t.expect((await view()).shelterCount===2 && (await view()).wardT>2.9, 'the technique is available again after its full cooldown');
  const saved=await t.save();await t.load(saved);await t.step(.3);
  t.expect((await view()).ternRecruited&&(await view()).recruited&&(await view()).shelterCount===0&&(await view()).wardT===0, 'save/load keeps both recruitments while clearing temporary wards and combat timers');
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length)===2, 'save/load creates one Mira and one Tern without duplicates');
  await t.teleport('mossbrook-past:1,0',13.5,9.5); await t.step(.2);await t.hold('ArrowRight',.9);await t.step(1.1);
  t.expect((await t.state()).key==='mossbrook-past:2,0' && (await view()).tern.visible&&!(await view()).tern.blocked, 'Tern follows the actual eastward room edge into the Singing Workshop');
  await shot('04-tern-workshop');
  await t.teleport('v1:1,1',8,10);await t.step(.3);
  await talk('companion-tern'); await answer(1);await t.step(.2);
  t.expect(!(await view()).ternRecruited&&!(await view()).tern.visible&&(await view()).mira.visible, 'Tend the garden dismisses only Tern through an actual conversation choice');
  await t.teleport('mossbrook-future:0,0',10.5,12.5);await t.step(.2);
  t.expect(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='npc-tern')?.out), 'the dismissed caretaker returns to the future garden');
  await talk('npc-tern');await answer(0);await t.step(.1);
  t.expect((await view()).ternRecruited, 'the saved choir lets Tern rejoin without another archive reward');
  await t.eval(()=>window.__voxelHeroes.game.progress.startNewGame());await t.step(.2);
  t.expect(!(await view()).ternRecruited&&!(await view()).recruited&&(await view()).wardT===0, 'a new adventure clears both travelling companions and all temporary protection');
}

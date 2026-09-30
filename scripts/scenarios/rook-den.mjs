export const description = 'Rook: actual brush entrance, patrol combat, earned bow, two arrow targets, physical bridge, guarded dice and one-time quiver/bomb reward. Starting sword, positioning, invulnerability and guard attack windows are fixtures; actions and damage are real.';

export default async function(t){
  const view=fn=>t.eval(fn);
  const place=(x,z,facing='north')=>t.eval(({x,z,facing})=>{
    const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(facing);h.player.invT=999;
  },{x,z,facing});
  const shot=async name=>{await view(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  const tile=(x,z)=>t.eval(({x,z})=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+x,s.z0+z);},{x,z});
  const flag=name=>t.eval(name=>window.__voxelHeroes.state.flags.has(name),name);
  const key=()=>view(()=>window.__voxelHeroes.screen().key);
  const journal=()=>view(()=>window.__voxelHeroes.game.errands.errandEntries().find(e=>e.giver==='Rook'));
  const settle=()=>view(async()=>{
    const h=window.__voxelHeroes;
    for(let i=0;i<500&&h.state.mode!=='play';i++){
      if(h.state.mode==='dialog'&&i%15===0){const d=h.game.dialog.dialogView();
        if(d.choices?.includes('Goodbye')&&d.choice!==d.choices.indexOf('Goodbye')){h.input.tap('down');await h.tick();}
        h.input.tap('confirm');
      }await h.tick();
    }
    await h.step(.4);
  });
  const talk=async photo=>{
    await place(11.4,8.5,'east');
    await t.step(.05); // Update the rig before the dialogue pauses animation.
    t.expect(await view(()=>{const h=window.__voxelHeroes;return !h.world.blocked(h.player.x,h.player.z,h.player.r,{body:h.player});}),'the conversation fixture stands on clear floor beside Rook');
    await view(()=>{const h=window.__voxelHeroes,n=h.entities.find(e=>e.name==='Rook');if(!n)throw Error('Rook missing');n.onInteract(h.player);});
    if(photo){await t.step(.1);await t.tap('confirm');await shot(photo);}
    await settle();
  };
  const north=async expected=>{
    await place(7.5,1.4);await t.hold('ArrowUp',.45);await t.step(1.2);
    t.expect(await key()===expected,`a real north doorway enters ${expected}`);
  };
  const south=async expected=>{
    await place(7.5,10.35,'south');await t.hold('ArrowDown',.45);await t.step(1.2);
    t.expect(await key()===expected,`a real south doorway enters ${expected}`);
  };
  const shoot=async(seconds=.4)=>{await t.tap('item');await t.step(seconds);};
  await t.press('Enter');await t.step(1.1);await t.teleport('v1:0,1',12,9);await t.step(.3);
  await view(()=>{const h=window.__voxelHeroes;h.give('blade-start');h.game.swords.equipSword('blade-start');h.player.invT=999;});
  await view(()=>{const h=window.__voxelHeroes;h.state.errands.Rook={status:'done',found:true};h.state.errands.Hettie={status:'done',found:false};h.game.saves.saveSlot(1);h.game.saves.loadSlot(1);});await t.step(.3);
  t.expect((await journal()).status==='offer'&&await view(()=>window.__voxelHeroes.state.errands.Hettie.status)==='done','loading an old completed bush errand offers the new adventure without resetting other quests');
  t.expect(await tile(3,3)==='K','the den starts concealed in actual northwest brush');
  await talk('01-rook-offer');
  t.expect((await journal()).status==='active','Rook offers and accepts the dice adventure');
  await view(()=>{const h=window.__voxelHeroes;h.game.saves.saveSlot(1);h.game.saves.loadSlot(1);});await t.step(.3);
  t.expect((await journal()).status==='active','the new accepted adventure survives save/load without being offered again');
  await place(2.5,5.9);await t.tap('sword');await t.step(.5);
  t.expect(!(await flag('errand:rook:dice'))&&(await journal()).status==='active','an ordinary bush cut cannot satisfy the dice quest');
  await place(3.5,4.4);await t.tap('sword');await t.step(.5);
  t.expect(await tile(3,3)==='j'&&await flag('rook:den-open'),'a real sword cut opens persistent den stairs');
  await shot('02-den-stairs');
  await t.hold('ArrowUp',.45);await t.step(2);
  t.expect(await key()==='rook-den:0,2','walking onto the uncovered stairs enters the hunter bench');
  t.expect(await view(()=>{const h=window.__voxelHeroes;return !h.world.blocked(h.player.x,h.player.z,h.player.r,{body:h.player});}),'the hero enters on clear floor');
  t.expect(await tile(7,0)==='d'&&await tile(8,2)!=='c','the patrol protects both the north route and bow chest');
  await shot('03-hunter-bench');
  const patrol=await t.fight({seconds:70,heal:0});t.note(`Actual patrol combat: ${JSON.stringify(patrol)}`);
  t.expect(await flag('rook:patrol-cleared')&&await tile(7,0)==='.'&&await tile(8,2)==='c','real patrol defeats reveal the bow and open the route');
  t.expect(!await view(()=>window.__voxelHeroes.game.inventory.hasItem('bow')),'clearing the patrol does not auto-collect its chest');
  await t.step(.8);
  await place(8.5,3.3);await t.hold('ArrowUp',.4);await t.step(.4);
  t.expect(await view(()=>window.__voxelHeroes.game.inventory.hasItem('bow')),'walking into the actual chest earns the hunter bow');
  t.expect(await view(()=>window.__voxelHeroes.game.inventory.ammo('arrows'))===10,'the earned bow starts with ten arrows');
  await shot('04-bow-earned');await settle();
  await view(()=>window.__voxelHeroes.game.inventory.selectItem('bow'));
  await north('rook-den:0,1');await shot('05-arrow-span-before');
  // A real pot shot must not satisfy the bow puzzle.
  await place(13.5,7.9);await t.tap('sword');await t.step(.25);
  t.expect(await view(()=>!!window.__voxelHeroes.player.carrying),'the span pot can be lifted');
  await place(5.5,7.7);await t.tap('sword');await t.step(.8);
  t.expect(!await flag('rook:target:5,2'),'clay striking the target cannot substitute for an arrow');
  await place(5.5,7.7);await shoot(.6);
  t.expect(await flag('rook:target:5,2')&&await tile(5,2)===':','a real bow shot lights the first far-bank target');
  t.expect(!await flag('rook:bridge')&&await tile(7,5)==='O','one target leaves the pit uncrossable');
  await shot('06-first-target');
  await view(()=>{const h=window.__voxelHeroes;h.game.inventory.useAmmo('arrows',h.game.inventory.ammo('arrows'));});
  await place(10.5,7.7);await shoot(.5);
  t.expect(!await flag('rook:target:10,2')&&await view(()=>window.__voxelHeroes.game.inventory.ammo('arrows'))===0,'an empty quiver cannot create a free arrow');
  const coinsBefore=await view(()=>window.__voxelHeroes.state.coins);
  await place(2.5,7.9);await t.tap('sword');await t.step(.3);
  t.expect(await view(()=>window.__voxelHeroes.game.inventory.ammo('arrows'))===10,'real rack interaction recovers from an empty quiver');
  await t.tap('sword');await t.step(.3);
  t.expect(await view(()=>window.__voxelHeroes.game.inventory.ammo('arrows'))===10&&await view(()=>window.__voxelHeroes.state.coins)===coinsBefore,'repeat supplies respect capacity and cannot farm coins');
  await place(10.5,7.7);await shoot(.6);
  t.expect(await flag('rook:target:10,2')&&await flag('rook:bridge'),'both actual arrow hits lower the bridge');
  t.expect(await view(()=>{const h=window.__voxelHeroes,s=h.screen();for(let z=4;z<=6;z++)for(const x of[7,8])if(h.world.tile(s.x0+x,s.z0+z)!=='+')return false;return true;}),'all six bridge deck tiles replace the pit');
  t.expect((await journal()).status==='active'&&(await journal()).progress==='Recover the dice from the vault','the journal follows the physical puzzle without claiming the dice');
  await shot('07-bridge-lowered');
  const hpBefore=await view(()=>window.__voxelHeroes.state.hp);
  await place(7.5,8.3);await t.hold('ArrowUp',1.5);await t.step(.2);
  t.expect(await view(()=>{const h=window.__voxelHeroes,s=h.screen();return h.player.z-s.z0<4;})&&await view(()=>window.__voxelHeroes.state.hp)===hpBefore,'real movement crosses the new deck without pit damage');
  await shot('08-span-crossed');
  await north('rook-den:0,0');await shot('09-dice-vault');
  // Full-health guard, facing the hero with a deliberately held attack window.
  await view(()=>{
    const h=window.__voxelHeroes,s=h.screen(),w=h.entities.find(e=>e.type==='barrow-warden');
    if(!w)throw Error('Vault warden missing');w.x=s.x0+8.5;w.z=s.z0+5.5;w.yaw=0;w.ai.melee.phase='aim';w.ai.melee.t=99;window.__rookWardenHp=w.hp;
  });
  await place(8.5,8.2);await shoot(.3);
  t.expect(await view(()=>{const w=window.__voxelHeroes.entities.find(e=>e.type==='barrow-warden');return w.hp===window.__rookWardenHp;}),'a frontal arrow respects the warden shield');
  await place(2.5,9.9);await t.tap('sword');await t.step(.25);
  t.expect(await view(()=>!!window.__voxelHeroes.player.carrying),'the vault provides an actual throwable pot');
  await place(8.5,8.2);await t.tap('sword');await t.step(.4);
  t.expect(await view(()=>{const w=window.__voxelHeroes.entities.find(e=>e.type==='barrow-warden');return w&&w.hp<window.__rookWardenHp&&w.stunT>0;}),'a real pot damages and stuns the shielded guard');
  await shot('10-guard-stunned');
  await shoot(.3);await shoot(.3);await shoot(.3);
  t.expect(!await view(()=>window.__voxelHeroes.entities.some(e=>e.type==='barrow-warden'&&!e.removed)),'real arrows finish the guard while its shield is down');
  for(let i=0;i<4&&await view(()=>window.__voxelHeroes.entities.some(e=>e.type==='archer'&&!e.removed));i++){
    await view(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='archer'&&!e.removed);e.x=s.x0+11.5;e.z=s.z0+5.5;e.ai.shoot={cool:99,dir:null};e.ai.wander={pause:true,t:99};});
    await place(8.5,5.5,'east');await shoot(.35);
  }
  t.expect(await flag('rook:vault-cleared')&&await tile(8,2)==='c','real enemy defeats reveal the dice chest');
  await shot('11-vault-clear');
  await place(8.5,3.3);await t.hold('ArrowUp',.4);await t.step(.4);
  t.expect(await flag('errand:rook:dice'),'walking into the vault chest collects Rook\'s dice');
  await shot('12-dice-found');await settle();
  t.expect((await journal()).status==='ready','the quest becomes ready after the actual dice are found');
  await south('rook-den:0,1');
  await place(7.5,3.2,'south');await t.hold('ArrowDown',1.5);await t.step(.2);
  t.expect(await view(()=>{const h=window.__voxelHeroes,s=h.screen();return h.player.z-s.z0>7;}),'the lowered span also supports the return trip');
  await south('rook-den:0,2');await south('v1:0,1');
  await talk('13-rook-return');await settle();
  t.expect((await journal()).status==='done','returning the physical dice completes Rook\'s adventure');
  t.expect(await view(()=>window.__voxelHeroes.state.bags.arrows)===1&&await view(()=>window.__voxelHeroes.game.inventory.ammo('arrows'))===30,'Rook gives a permanent thirty-arrow quiver and fills it');
  t.expect(await view(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))===3,'first bomb ownership receives exactly the three promised bombs');
  await view(()=>window.__voxelHeroes.game.inventory.useAmmo('arrows',1));await talk();await settle();
  t.expect(await view(()=>window.__voxelHeroes.game.inventory.ammo('arrows'))===29&&await view(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))===3,'repeating the conversation cannot duplicate the quiver refill or bombs');
  await shot('14-rook-complete');
  await view(()=>{const h=window.__voxelHeroes;h.game.saves.saveSlot(1);h.game.saves.loadSlot(1);});await t.step(.3);
  t.expect((await journal()).status==='done'&&await tile(3,3)==='j'&&await view(()=>window.__voxelHeroes.state.bags.arrows)===1,'completed quest, entrance and quiver survive a real save/load');
  await place(3.5,4.4);await t.hold('ArrowUp',.45);await t.step(2);
  t.expect(await key()==='rook-den:0,2'&&!await view(()=>window.__voxelHeroes.entities.some(e=>e.kind==='enemy'&&!e.removed)),'saved patrol enemies do not respawn on revisit');
  await north('rook-den:0,1');
  t.expect(await tile(7,5)==='+'&&await tile(5,2)===':'&&await tile(10,2)===':','bridge and both target states survive save/load and room revisit');
  await shot('15-span-revisit');
}

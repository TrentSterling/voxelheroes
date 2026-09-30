export const description = 'Tobin: real offer, bomb opens a root cellar, unlimited spare pots without loot, real throw reveals keepsake chest, saved progress and one-time return reward. Equipment, positioning and invulnerability are fixtures.';

export default async function(t) {
  const evalHero = (fn, arg) => t.eval(fn, arg);
  // Prevent the invulnerability fixture from hiding the hero during a receipt.
  const shot = async name => { await evalHero(()=>{window.__voxelHeroes.player.hero.root.visible=true;}); await t.shot(name); };
  const place = (x,z,facing='north') => evalHero(({x,z,facing})=>{
    const h=window.__voxelHeroes;
    h.game.hero.hero.place(x,z);
    h.game.hero.hero.setFacing(facing);
    h.player.invT=999;
  },{x,z,facing});
  const talk = async (name,{photo=null}={}) => {
    await evalHero(name=>{
      const h=window.__voxelHeroes,n=h.entities.find(e=>e.name===name);
      if(!n)throw Error('Missing NPC '+name);
      n.onInteract(h.player);
    },name);
    if(photo){await t.step(.1);await t.tap('confirm');await shot(photo);}
    await evalHero(async()=>{
      const h=window.__voxelHeroes;
      for(let i=0;i<500&&h.state.mode==='dialog';i++){
        if(i%15===0)h.input.tap('confirm');
        await h.tick();
      }
      await h.step(.2);
    });
  };
  const journal = () => evalHero(()=>window.__voxelHeroes.game.errands.errandEntries().find(e=>e.giver==='Old Tobin'));
  await t.press('Enter');await t.step(1.1);
  await t.teleport('v1:1,1',14.5,8.6);await t.step(.2);
  await evalHero(()=>{
    const h=window.__voxelHeroes;
    h.give('blade-start');h.game.swords.equipSword('blade-start');
    h.give('bombs');h.game.inventory.addAmmo('bombs',3);h.game.inventory.selectItem('bombs');
  });
  const stump=()=>evalHero(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+14,s.z0+7);});
  t.expect(await stump()==='%', 'the actual stump stands beside Tobin, clear of the prologue spawn');
  await talk('Old Tobin',{photo:'01-tobin-offer'});
  t.expect((await journal()).status==='active', 'Tobin offers and accepts the physical cellar quest');
  t.expect((await journal()).progress==='Blast the stump beside Tobin','the journal starts with the actual stump objective');
  await place(12.8,8.6);await t.step(.4);await shot('02-stump-before');
  await place(14.5,8.6);
  const bombsBefore=await evalHero(()=>window.__voxelHeroes.game.inventory.ammo('bombs'));
  await t.tap('item');await t.step(2.4);
  t.expect(await stump()==='y','a real placed bomb clears the stump into stairs');
  t.expect(await evalHero(()=>window.__voxelHeroes.game.inventory.ammo('bombs'))===bombsBefore-1,'opening the cellar spends one actual bomb');
  t.expect((await journal()).progress==='Retrieve the cellar keepsake','the journal follows the revealed cellar');
  t.expect((await journal()).status==='active','destroying the stump alone cannot finish the quest');
  await shot('03-cellar-stairs');
  await t.hold('ArrowUp',.42);await t.step(2);
  t.expect(await evalHero(()=>window.__voxelHeroes.screen().key)==='cellar-tobin:0,0','walking onto the revealed stairs enters the actual cellar');
  t.expect(await evalHero(()=>{const h=window.__voxelHeroes;return !h.world.blocked(h.player.x,h.player.z,h.player.r,{body:h.player});}),'cellar entry places the hero in clear floor');
  await shot('04-root-cellar');
  t.expect(await evalHero(()=>window.__voxelHeroes.game.npcFx.bubblesShown())===0,'cached town speech bubbles never appear inside the cellar');
  // Destroy the sole ordinary pot first: the supply must make the puzzle
  // recoverable even when a party snapshot prevents ordinary pot regrowth.
  await place(9.5,7.9);await t.tap('sword');await t.step(.25);
  t.expect(await evalHero(()=>!!window.__voxelHeroes.player.carrying),'the ordinary cellar pot lifts with the actual action');
  await t.tap('sword');await t.step(1);
  await place(2.5,7.9);await t.tap('sword');await t.step(.25);
  t.expect(await evalHero(()=>!!window.__voxelHeroes.player.carrying),'the crate provides a spare through real interaction');
  t.expect(await evalHero(()=>window.__voxelHeroes.player.carrying.loot)===false,'spare pots cannot farm coins, health or magic');
  await shot('05-spare-pot');
  // Miss intentionally; no ordinary pots remain. Ask for another and retry.
  await evalHero(()=>window.__voxelHeroes.game.hero.hero.setFacing('south'));
  await t.tap('sword');await t.step(1);
  await place(2.5,7.9);await t.tap('sword');await t.step(.25);
  t.expect(await evalHero(()=>!!window.__voxelHeroes.player.carrying),'a missed throw can be retried without leaving or resetting the party');
  await place(6.5,7.7);await t.tap('sword');await t.step(1);
  t.expect(await evalHero(()=>window.__voxelHeroes.state.flags.has('pot-seal:cellar-tobin:0,0')),'a real thrown spare pot rings the cellar seal');
  t.expect(await evalHero(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+6,s.z0+2)==='c';}),'the ring reveals the actual keepsake chest');
  t.expect((await journal()).status==='active','ringing the seal does not pretend the keepsake was collected');
  await shot('06-keepsake-chest');
  const piecesBefore=await evalHero(()=>window.__voxelHeroes.state.heartPieces);
  await place(6.5,3.3);await t.hold('ArrowUp',.4);await t.step(.4);
  t.expect(await evalHero(()=>window.__voxelHeroes.state.flags.has('errand:tobin:keepsake')),'walking into the chest acquires the keepsake');
  t.expect(await evalHero(()=>window.__voxelHeroes.state.heartPieces)===piecesBefore+1,'the keepsake chest gives one permanent heart piece');
  await shot('07-keepsake-found');
  await evalHero(async()=>{
    const h=window.__voxelHeroes;
    for(let i=0;i<300&&h.state.mode!=='play';i++){
      if(h.state.mode==='dialog'&&i%15===0)h.input.tap('confirm');
      await h.tick();
    }
  });
  t.expect((await journal()).status==='ready','the quest becomes ready only after collecting the medallion');
  await evalHero(()=>{const h=window.__voxelHeroes;h.game.saves.saveSlot(1);h.game.saves.loadSlot(1);});await t.step(.3);
  t.expect((await journal()).status==='ready','the medallion and quest stage survive a real save/load');
  await place(5.5,8.3,'south');await t.hold('ArrowDown',.35);await t.step(2);
  t.expect(await evalHero(()=>window.__voxelHeroes.screen().key)==='v1:1,1','the cellar stairs return to Mossbrook without landing on the stump');
  const coinsBefore=await evalHero(()=>window.__voxelHeroes.state.coins);
  await evalHero(()=>{
    const h=window.__voxelHeroes;
    window.__tobinRewards=[];
    h.game.events.on('coins-changed',e=>{if(e.reason==='errand'&&e.delta>0)window.__tobinRewards.push(e.delta);});
  });
  await talk('Old Tobin',{photo:'08-tobin-return'});
  t.expect((await journal()).status==='done','returning the physical keepsake completes Tobin\'s errand');
  t.expect(await evalHero(()=>window.__voxelHeroes.state.coins)===coinsBefore+40,'Tobin pays his promised forty coins once');
  await talk('Old Tobin');
  t.expect(await evalHero(()=>JSON.stringify(window.__tobinRewards))==='[40]','repeating the conversation cannot duplicate the errand reward, even if a normal friendship gift is bought');
  await evalHero(()=>{const h=window.__voxelHeroes;h.game.saves.saveSlot(1);h.game.saves.loadSlot(1);});await t.step(.3);
  t.expect(await stump()==='y'&&(await journal()).status==='done','the cleared stump and completed quest remain saved');
  await shot('09-tobin-complete');
  await place(14.5,8.6);await t.hold('ArrowUp',.42);await t.step(2);
  await place(6.5,3.3);await t.hold('ArrowUp',.4);await t.step(.3);
  t.expect(await evalHero(()=>window.__voxelHeroes.state.heartPieces)===piecesBefore+1,'revisiting the open chest does not duplicate the permanent reward');
  await shot('10-cellar-revisit');
}

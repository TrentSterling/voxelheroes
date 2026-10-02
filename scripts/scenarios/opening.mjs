export const description = 'Fresh title start, actual walking from Mossbrook to King Aldric, native sword/shield conversation, safe courtyard waiting and walking home. No teleport, granted equipment, enemy removal, health edits or invulnerability. Browser output is muted and NPC speech disabled.';

export default async function(t) {
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.game.audio.setMuted(true); h.game.audio.setVolumes({master:0});
    h.game.settings.setSetting('muted', true);
    h.game.settings.setSetting('npcVoices', false);
  });
  await t.track('hero-hit', 'item-get', 'room-enter');
  await t.press('Enter'); await t.step(2);
  const initial = await t.state();
  t.expect(initial.key === 'v1:1,1' && initial.mode === 'play', 'the actual title starts a fresh adventure in Mossbrook Square');
  t.expect(await t.eval(() => { const h = window.__voxelHeroes; return !h.state.swords.equipped && h.state.gear.shield === 0 && h.player.invT === 0; }), 'the new hero is unarmed and has no test invulnerability');
  await t.shot('01-fresh-start');
  for (const key of ['v1:1,2','ow-4-3:1,0','ow-4-3:1,1']) {
    await t.exit('south');
    t.expect((await t.state()).key === key, `actual southward walking reaches ${key}`);
  }
  await t.step(2);
  await t.shot('02-royal-approach');
  const spot = await t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen(), k = h.entities.find(e => !e.removed && e.type === 'npc-king');
    if (!k) throw Error('King Aldric is missing');
    const sides = [[0,1.1,'north'],[0,-1.1,'south'],[1.1,0,'west'],[-1.1,0,'east']];
    for (const [dx,dz,face] of sides) {
      const x=k.x-s.x0+dx,z=k.z-s.z0+dz;
      if (!h.world.blocked(s.x0+x,s.z0+z,h.player.r,h.player) && window.__vhBot.bfs([Math.floor(h.player.x-s.x0),Math.floor(h.player.z-s.z0)],(tx,tz)=>tx===Math.floor(x)&&tz===Math.floor(z))) return {x,z,face};
    }
    throw Error('No walkable approach to King Aldric');
  });
  await t.walkTo(spot.x,spot.z);
  const facing = {north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[spot.face];
  await t.stick(...facing,1/60);
  await t.tap('sword');
  t.expect((await t.state()).mode === 'dialog', 'actual action input opens the king conversation without clearing damage locks');
  t.expect(await t.eval(() => window.__voxelHeroes.game.dialog.dialogView()?.speaker === 'King Aldric'), 'the native conversation is King Aldric');
  const lines = new Set(); let pictured = false;
  for (let n=0;n<200;n++) {
    const view = await t.eval(() => {
      const h=window.__voxelHeroes;
      return {mode:h.state.mode,text:h.game.dialog.dialogView()?.text,armed:h.state.swords.equipped==='blade-start'};
    });
    if (view.mode !== 'dialog') break;
    if (view.text) lines.add(view.text);
    if (view.armed && !pictured) { await t.shot('03-native-blade-reward'); pictured=true; }
    await t.tap('confirm');
  }
  await t.step(2);
  t.expect(lines.size === 6, 'the original borrowed-hours story and both route paragraphs complete through confirm input');
  t.expect(await t.eval(() => { const h=window.__voxelHeroes;return h.state.swords.equipped==='blade-start'&&h.state.gear.shield===1&&h.game.state.hasFlag('overworld:talked:king'); }), 'the actual king grants and equips sword and shield');
  t.expect((await t.events('hero-hit')).length === 0 && (await t.state()).hp === initial.hp, 'the unarmed route and royal audience take no enemy hits');
  await t.step(8);
  t.expect((await t.state()).hp === initial.hp, 'the royal courtyard remains safe while a player reads the next objective');
  await t.shot('04-ready-to-adventure');
  for (const key of ['ow-4-3:1,0','v1:1,2','v1:1,1']) {
    await t.exit('north');
    t.expect((await t.state()).key === key, `actual walking returns through ${key}`);
  }
  const save=await t.save(); await t.load(save); await t.step(.5);
  t.expect(await t.eval(() => { const h=window.__voxelHeroes;return h.state.swords.equipped==='blade-start'&&h.state.gear.shield===1&&h.game.state.hasFlag('overworld:talked:king'); }), 'native starter equipment and completed audience survive a save and reload');
  await t.shot('05-back-in-mossbrook');
}

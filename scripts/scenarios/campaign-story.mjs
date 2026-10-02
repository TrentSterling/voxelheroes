export const description='Native King Aldric arming, original borrowed-hours story branches, repeat grants, saved homecoming and all three ending pages. Earlier temple milestones, invulnerability, positions and removal of ending-room enemies are fixtures. Actual A talks, confirm paging, starter grants and ending return are gameplay. Browser muted and NPC recordings disabled.';
export default async function(t){
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:true});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
 const talk=async()=>{
  await t.teleport('ow-4-3:1,1',7.5,6.7);await t.step(.2);
  await t.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();const k=h.entities.find(e=>e.type==='npc-king'),s=h.screen();k.wander=0;h.game.hero.hero.place(k.x-s.x0,k.z-s.z0+1.2);h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});
  await t.tap('sword');t.expect((await t.state()).mode==='dialog','actual A opens King Aldric talk');
  const lines=new Set();for(let n=0;n<200;n++){const d=await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView());if(d)lines.add(d.text);if((await t.state()).mode!=='dialog')break;await t.tap('confirm');}
  await t.step(.2);return [...lines];
 };
 await t.track('item-get');const first=await talk();
 t.expect(first.length===6&&first.some(l=>l.includes('thirteen times'))&&first.some(l=>l.includes('hour of return')),'real initial talk preserves four borrowed-hour paragraphs and both navigation paragraphs');
 t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.swords.equipped==='blade-start'&&h.state.swords.owned.includes('blade-start')&&h.state.gear.shield===1&&h.game.state.hasFlag('overworld:talked:king');}),'real new story talk still grants and equips the starter blade and shield');
 await t.shot('01-the-hour-we-lost');const granted=(await t.events('item-get')).length;
 const branches=[['barrow',null,'better teachers',2],['nursery','boss:d1','seedlings',3],['watch','boss:d2','hour of change',3],['shore','boss:d3','person who arrived',3],['tower','orbs','Iona',3],['homecoming','campaign:complete','perfect morning',4]];
 for(const[stage,flag,phrase,count]of branches){
  if(flag)await t.eval(flag=>{const h=window.__voxelHeroes;if(flag==='orbs')for(let n=1;n<=4;n++)h.game.state.setFlag('orb:'+n);else h.game.state.setFlag(flag);},flag);
  const lines=await talk();t.expect(lines.length===count&&lines.some(l=>l.includes(phrase)),`${stage}: actual king talk follows the next borrowed hour`);
  t.expect((await t.events('item-get')).length===granted,`${stage}: repeat story talk cannot grant extra equipment`);
  if(['nursery','shore','homecoming'].includes(stage))await t.shot('02-story-'+stage);
 }
 const save=await t.save();await t.load(save);await t.step(.3);t.expect(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('overworld:celebrated')),'the native homecoming acknowledgement survives reload');
 await t.teleport('tower-final:0,0',13.5,13.5);await t.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();});await t.step(1.8);
 t.expect((await t.state()).mode==='ending','native completed-campaign hook opens the ending');const titles=[];
 for(let p=0;p<3;p++){const o=await t.eval(()=>window.__voxelHeroes.game.overlay.overlayView());titles.push(o.title);t.expect(o.message.length>70,`ending ${p+1} has its complete authored paragraph`);await t.shot('03-ending-'+p);await t.step(.8);await t.tap('confirm');await t.step(.3);}
 t.expect(new Set(titles).size===3&&titles[0]==='The clock lets tomorrow come'&&titles[1]==='The hour we keep','all three original ending pages are reached by actual confirm input');await t.step(1.8);
 t.expect((await t.state()).key==='v1:1,1','the original-story ending physically returns to the Mossbrook hub');
}

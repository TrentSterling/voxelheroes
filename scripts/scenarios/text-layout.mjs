import { startRelay } from '../lib/nostr-relay.mjs';
import { writeFileSync } from 'node:fs';
export const description='Actual canvas text and panel bounds at desktop, laptop, portrait and landscape sizes: saved title, party, settings, maps, journal, large dialog, banner and ending. Long profile and earlier campaign state are fixtures.';
export default async function(t){
 const relay=await startRelay(),issues=[],checks=[];
 const viewports=[['desktop',1280,720],['laptop',1024,600],['phone',390,844],['small-phone',320,568],['landscape',844,390],['short-landscape',568,320]];
 await t.eval(()=>{
  const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text,panel=g.panel,button=g.button,rect=g.rect;
  window.__textCapture={runs:[],panels:[],parent:null,chart:null};
  g.rect=function(x,y,w,height,color){const c=window.__textCapture;if(h.state.mode==='map'&&color==='#0a1712'&&!c.chart)c.chart={x,y,w,h:height};return rect.call(this,x,y,w,height,color);};
  g.panel=function(x,y,w,h,o){const c=window.__textCapture,p={x,y,w,h};c.panels.push(p);if(o?.accent)c.parent=p;return panel.call(this,x,y,w,h,o);};
  g.button=function(id,...args){if(['party-open','journal-open'].includes(id))window.__textCapture.parent=null;return button.call(this,id,...args);};
  g.text=function(value,x,y,o={}){const c=window.__textCapture,w=g.measure(String(value),o.size??1,o.tracking??0),left=o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,chart=c.chart&&y>=c.chart.y&&y<c.chart.y+c.chart.h?c.chart:null;c.runs.push({text:String(value),x:left,y,w,h:g.cap*(o.size??1),size:o.size??1,parent:c.parent,chart});return text.call(this,value,x,y,o);};
 });
 const capture=async(label,{speaker=false,photo=true}={})=>{
  const data=await t.eval(()=>{const h=window.__voxelHeroes,c=window.__textCapture;c.runs=[];c.panels=[];c.parent=null;c.chart=null;h.game.ui.requestUi();h.render();return{...h.game.ui.uiView(),mode:h.state.mode,overlay:h.game.overlay.overlayVisible(),hud:h.game.hud.hudView(),runs:c.runs,panels:c.panels};});
  const bad=data.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>data.w||r.y+r.h>data.h||r.parent&&(r.x<r.parent.x+2||r.x+r.w>r.parent.x+r.parent.w-2||(!speaker||r.y>=r.parent.y)&&(r.y<r.parent.y||r.y+r.h>r.parent.y+r.parent.h))||r.chart&&(r.x<r.chart.x||r.x+r.w>r.chart.x+r.chart.w||r.y+r.h>r.chart.y+r.chart.h));
  const panels=data.panels.filter(p=>p.x<0||p.y<0||p.x+p.w>data.w||p.y+p.h>data.h);
  const hudOverlaps=[];
  if(data.mode==='journal'){
   const controls=data.hits.filter(h=>h.id.startsWith('journal-')&&!['journal-scrim','journal-panel'].includes(h.id));
   for(let i=0;i<controls.length;i++)for(const other of controls.slice(i+1)){const a=controls[i];if(a.x<other.x+other.w&&a.x+a.w>other.x&&a.y<other.y+other.h&&a.y+a.h>other.y)hudOverlaps.push({control:a.id,other:other.id});}
   for(const run of data.runs.filter(r=>r.text.startsWith('Reward:')))for(const hit of controls)if(run.x<hit.x+hit.w&&run.x+run.w>hit.x&&run.y<hit.y+hit.h&&run.y+run.h>hit.y)hudOverlaps.push({reward:run.text,control:hit.id});
  }
  if(data.mode==='play'&&!data.overlay)for(const widget of data.hud.widgets.filter(w=>w.region==='center'))for(const hit of data.hits.filter(h=>['party-open','journal-open'].includes(h.id)))
    if(widget.x<hit.x+hit.w&&widget.x+widget.w>hit.x&&widget.y<hit.y+hit.h&&widget.y+widget.h>hit.y)hudOverlaps.push({widget:widget.id,button:hit.id});
  if(data.mode==='play'&&!data.overlay)for(const run of data.runs.filter(r=>r.size>1))for(const other of[...data.hud.widgets,...data.hits.filter(h=>['party-open','journal-open'].includes(h.id))])
    if(run.x<other.x+other.w&&run.x+run.w>other.x&&run.y<other.y+other.h&&run.y+run.h>other.y)hudOverlaps.push({banner:run.text,widget:other.id});
  checks.push({label,width:data.w,height:data.h,textRuns:data.runs.length,violations:bad,panels,hudOverlaps});
  if(bad.length||panels.length||hudOverlaps.length)issues.push({label,text:bad,panels,hudOverlaps});
  if(photo)await t.shot(label);
 };
 const reset=()=>t.eval(()=>{const h=window.__voxelHeroes;h.game.party.leaveParty();h.game.progress.startNewGame({name:'WWWWWWWWWWWW',class:'balanced'});h.state.settings.largeText=false;});
 try{
  for(const [id,width,height]of viewports){
   await t.page.setViewportSize({width,height});await t.step(.05);await reset();
   await t.teleport('d4:3,1',8,7);await t.eval(()=>{const h=window.__voxelHeroes;h.game.saves.saveSlot(1);h.newGame();});await t.step(.1);await capture(id+'-saved-title');
   await t.eval(()=>window.__voxelHeroes.game.partyUi.openParty());await capture(id+'-party-entry');await t.eval(()=>window.__voxelHeroes.game.partyUi.closeParty());
   await reset();await t.eval(()=>window.__voxelHeroes.game.settingsPanel.openSettings());await capture(id+'-settings');
   const settingsSeen=new Set(),settingsRows=new Set();let effectsFound=false;
   for(let page=0;page<12;page++){
    const layout=await t.eval(()=>{const h=window.__voxelHeroes;h.render();return {sel:h.game.settingsPanel.settingsView().sel,hits:h.game.ui.uiView().hits};});
    if(settingsSeen.has(layout.sel))break;settingsSeen.add(layout.sel);
    for(const hit of layout.hits.filter(h=>h.id.startsWith('setting-')))settingsRows.add(hit.id.replace(/^setting-/,'').replace(/-(prev|next)$/,''));
    if(page)await capture(`${id}-settings-page-${page+1}`);
    if(layout.hits.some(h=>h.id==='setting-sfx')){effectsFound=true;await t.eval(()=>window.__voxelHeroes.game.ui.dragUi('setting-sfx',.25));t.expect(Math.abs(await t.eval(()=>window.__voxelHeroes.state.settings.sfx)-.25)<.01,'The actual Effects slider responds on its visible page at '+id);}
    if(!await t.eval(()=>window.__voxelHeroes.game.ui.pressUi('settings-next-page')))break;
   }
   const expectedSettings=await t.eval(()=>window.__voxelHeroes.game.settingsPanel.settingsView().rows.map(r=>r.key));
   t.expect(effectsFound&&expectedSettings.every(key=>settingsRows.has(key)),'All settings are reachable through the real page controls at '+id);
   await t.eval(()=>window.__voxelHeroes.game.settingsPanel.closeSettings());
   await t.teleport('tower-hive:0,2',8,7);await t.eval(()=>window.__voxelHeroes.game.dungeons.giveMap('tower-hive'));await t.tap('map');await capture(id+'-memory-map');await t.tap('map');
   await t.teleport('d4:3,1',8,7);await t.eval(()=>window.__voxelHeroes.game.dungeons.giveMap('d4'));await t.tap('map');await capture(id+'-temple-map');await t.tap('map');
   await t.teleport('v1:1,1',8,10);await t.tap('map');await capture(id+'-world-map');await t.tap('map');
   await t.eval(()=>{const h=window.__voxelHeroes;h.state.errands.Rook={status:'active',found:false};h.state.flags.add('overworld:talked:king');for(const d of['d1','d2','d3','d4']){h.state.flags.add('dungeon:'+d+':entered');h.game.dungeons.giveBossKey(d);h.game.dungeons.defeatBoss(d);h.game.dungeons.completeDungeon(d);}h.game.journal.openJournal();});
   const journalCount=await t.eval(()=>window.__voxelHeroes.game.journal.journalView().entries.length);
   for(let i=0;i<journalCount;i++){await capture(id+(i?'-journal-'+i:'-journal'),{photo:i===0});await t.eval(()=>{const h=window.__voxelHeroes;h.render();h.game.ui.pressUi('journal-next');});}
   for(const stage of['era:bell','era:water-restored','era:dawn-seed','era:homecoming']){
    await t.eval(stage=>window.__voxelHeroes.state.flags.add(stage),stage);
    for(let i=0;i<journalCount;i++){
     const who=await t.eval(()=>{const j=window.__voxelHeroes.game.journal.journalView();return j.entries[j.selected].giver;});
     if(who==='Mira')break;
     await t.eval(()=>{const h=window.__voxelHeroes;h.render();h.game.ui.pressUi('journal-next');});
    }
    await capture(id+'-'+stage.replaceAll(':','-'),{photo:false});
   }
   for(const stage of['era:archive-powered','era:copper-memory','era:voices-returned']){
    await t.eval(stage=>window.__voxelHeroes.state.flags.add(stage),stage);
    for(let i=0;i<journalCount;i++){
     const who=await t.eval(()=>{const j=window.__voxelHeroes.game.journal.journalView();return j.entries[j.selected].giver;});
     if(who==='Tern')break;
     await t.eval(()=>{const h=window.__voxelHeroes;h.render();h.game.ui.pressUi('journal-next');});
    }
    await capture(id+'-'+stage.replaceAll(':','-'),{photo:stage==='era:voices-returned'});
   }
   for(const stage of['active','quiet','clear','ready','memory']){
    await t.eval(stage=>{const f=window.__voxelHeroes.state.flags;for(const id of['muted','cleared','memory'])f.delete('dungeon:d1:echo-'+id);if(['quiet','ready','memory'].includes(stage))f.add('dungeon:d1:echo-muted');if(['clear','ready','memory'].includes(stage))f.add('dungeon:d1:echo-cleared');if(stage==='memory')f.add('dungeon:d1:echo-memory');},stage);
    for(let i=0;i<journalCount;i++){
     const who=await t.eval(()=>{const j=window.__voxelHeroes.game.journal.journalView();return j.entries[j.selected].title;});
     if(who==='The Note Beneath')break;
     await t.eval(()=>{const h=window.__voxelHeroes;h.render();h.game.ui.pressUi('journal-next');});
    }
    const original=await t.eval(()=>{const h=window.__voxelHeroes;h.render();const j=h.game.journal.journalView();return {text:j.entries[j.selected].detail,pages:j.detailPages};});
    let paragraph='';
    for(let p=0;p<original.pages;p++){
     await capture(`${id}-barrow-${stage}-${p}`,{photo:stage==='memory'&&p===0});
     paragraph+=' '+await t.eval(()=>window.__voxelHeroes.game.journal.journalView().shownDetail);
     if(original.pages>1)await t.eval(()=>{const h=window.__voxelHeroes;h.game.ui.pressUi('journal-detail-next');h.render();});
    }
    t.expect(paragraph.replace(/\s/g,'')===original.text.replace(/\s/g,''),'Journal Read pages preserve every character of the barrow '+stage+' paragraph at '+id);
   }
   await t.eval(()=>window.__voxelHeroes.game.journal.closeJournal());
   await t.eval(()=>{const h=window.__voxelHeroes;h.state.settings.largeText=true;h.game.dialog.showDialog('King Aldric asks {hero} to follow the four lights through the barrow, forest, desert and coast. Bring the lights to the Fourfold Tower, speak to Sage Iona, and learn to distinguish the keeper from its reflections.',{speaker:'Sage of the Fourfold Tower',choices:['Continue the adventure','Return to Mossbrook']});});await t.step(.1);await t.tap('confirm');await capture(id+'-large-dialog',{speaker:true});
   const expected=await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView().text);let shown='';
   for(let page=0;page<30;page++){
    const dialog=await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView());shown+=dialog.shown;
    if(dialog.choices){await capture(id+'-dialog-choices',{speaker:true});break;}
    await t.tap('confirm');await t.tap('confirm');await capture(id+'-dialog-page-'+(page+2),{speaker:true,photo:page===0});
   }
   t.expect(shown===expected,'dialog pagination preserves the entire authored paragraph at '+id);
   await t.tap('down');await t.tap('confirm');t.expect(!(await t.eval(()=>window.__voxelHeroes.game.dialog.dialogOpen())),'the final dialog choice still closes normally at '+id);
   await reset();await t.eval(()=>window.__voxelHeroes.game.grants.grant('arrow-bag-1'));await t.page.waitForTimeout(500);await capture(id+'-quiver-reward');
   await reset();await t.eval(()=>window.__voxelHeroes.game.banner.showBanner('Caldrin, The Hollow Crown'));await t.page.waitForTimeout(500);await capture(id+'-boss-banner');
   await t.eval(()=>window.__voxelHeroes.game.overlay.showOverlay({title:'The four lights return home',kicker:'THE HOLLOW CROWN HAS FALLEN',msg:'The lights shine again. Mossbrook waits for you, and the roads remain open for friends to explore.',button:'Return to Mossbrook',onAction(){}}));await capture(id+'-ending');await t.eval(()=>window.__voxelHeroes.game.overlay.hideOverlay());
   await t.eval(({url})=>window.__voxelHeroes.game.party.createParty('ABCDEFGHIJKL',{relayUrls:[url],rtcConfig:{iceServers:[]}}),{url:relay.url});await t.eval(()=>window.__voxelHeroes.game.partyUi.openParty());await capture(id+'-active-party');await reset();
  }
  writeFileSync(t.out+'/text-bounds.json',JSON.stringify({checkedUtc:new Date().toISOString(),checks,issues},null,2));
  t.expect(issues.length===0,'drawn text and panels stay in bounds, and central HUD text avoids shortcuts: '+JSON.stringify(issues.map(x=>({label:x.label,text:x.text.map(r=>r.text),panels:x.panels.length,hudOverlaps:x.hudOverlaps}))));
 }finally{await relay.close();}
}

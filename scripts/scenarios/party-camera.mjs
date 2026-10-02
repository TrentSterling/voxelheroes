import { measurePartyFrame, recruitParty, resized } from '../lib/party-frame.mjs';
export const description = 'Muted native party framing at desktop, portrait and landscape; all four player rigs, real outdoor travel, idle stability, combat poses, carrying, scenery probes, companion dismissal, reward framing and save/load. Recruitment and invulnerability are fixtures; bounds project actual figure vertices.';
export default async function(t) {
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
 await t.press('Enter');await t.step(1.1);await recruitParty(t);
 await t.eval(source=>{window.__measurePartyCamera=eval('('+source+')');},measurePartyFrame.toString());
 const verify=async label=>{
  const f=await t.eval(measurePartyFrame);
  t.expect(f.actors.length===4,label+' measures the entire native party');
  t.expect(f.actors.every(a=>!a.out&&!a.techOverlap),label+' keeps every figure in frame and clear of the drawn technique panel');
  t.expect(f.actors.every(a=>a.headerOverlaps.length===0),label+' keeps every figure clear of actual HUD widgets and party/journal buttons');
  t.expect(f.camera.frame?.targets.length===4,label+' frames the actual nearby party');
  const safe=f.camera.frame?.safe;
  t.expect(!!safe&&f.actors.every(a=>a.left>=safe.left-1e-4&&a.right<=safe.right+1e-4&&a.top>=safe.top-1e-4&&a.bottom<=safe.bottom+1e-4),label+' projects every native vertex inside the measured free rectangle');
  t.expect(f.actors.every(a=>(a.bottom-a.top)*f.viewport[1]>18),label+' retains at least eighteen pixels of native figure height');
  return f;
 };
 for(const [label,viewport]of[['desktop',{width:1280,height:720}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  await resized(t,viewport);
  for(const preset of ['A','B','C','D']){
   await t.teleport('mossbrook-past:1,0',10.5,9.5);
   await t.eval(p=>{const h=window.__voxelHeroes;h.player.yaw=Math.PI/2;h.camera.choose(p);},preset);await t.step(.5);
   await verify(`${label} ${preset}`);if(preset==='A')await t.shot(`01-${label}-party`);
  }
 }
 await resized(t,{width:390,height:844});await t.eval(()=>window.__voxelHeroes.camera.choose('A'));
 await t.teleport('mossbrook-past:1,0',13.5,9.5);await t.step(.2);
 const travel=await t.eval(async()=>{
  const h=window.__voxelHeroes,metrics={ticks:0,out:0,outsideSafe:0,maxCameraStep:0};let previous=h.gfx.camera.position.clone();
  h.input.setStick(1,0);
  try{for(let i=0;i<54;i++){await h.tick();const f=window.__measurePartyCamera(false),safe=f.camera.frame?.safe;metrics.ticks++;metrics.out+=f.actors.filter(a=>a.out).length;if(safe)metrics.outsideSafe+=f.actors.filter(a=>a.left<safe.left-1e-4||a.right>safe.right+1e-4||a.top<safe.top-1e-4||a.bottom>safe.bottom+1e-4).length;metrics.maxCameraStep=Math.max(metrics.maxCameraStep,previous.distanceTo(h.gfx.camera.position));previous.copy(h.gfx.camera.position);}}
  finally{h.input.setStick(0,0);}return metrics;
 });await t.step(1.3);
 t.expect((await t.state()).key==='mossbrook-past:2,0','actual stick input crosses into the native workshop');
 t.expect(travel.ticks===54&&travel.out===0&&travel.outsideSafe===0,'every actual travel tick keeps the native party in its free rectangle');
 t.expect(travel.maxCameraStep<.75,'outdoor party framing has no camera jump above three quarters of a tile per tick');
 await verify('Native workshop arrival');await t.shot('02-workshop-portrait');
 const idle=await t.eval(async()=>{const h=window.__voxelHeroes;await h.step(2);const before=h.gfx.camera.position.clone();await h.step(6);return before.distanceTo(h.gfx.camera.position);});
 t.expect(idle<.025,'a settled party camera stays still for six seconds');
 const probes=await t.eval(()=>{const h=window.__voxelHeroes;h.render();return h.game.partyCamera.partyCameraView().cutaway;});
 t.expect(probes.targets.length===4&&probes.targets.every(v=>v.every(Number.isFinite)),'native foliage cutaway receives all four finite body centers');
 t.expect(probes.floor===.125&&probes.end===.15,'group cutaway retains the floor and reaches close foreground obstructions');
 await resized(t,{width:1280,height:720});await t.teleport('d4:0,7',7.5,8.5);await t.step(.6);
 await t.eval(()=>{const h=window.__voxelHeroes;h.give('fire-wand');h.game.inventory.selectItem('fire-wand');h.state.maxMagic=9;h.state.magic=9;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};});
 await t.page.keyboard.down('Shift');await t.step(1/60);await t.page.keyboard.down('k');await t.step(.05);await t.page.keyboard.up('k');await t.page.keyboard.up('Shift');
 await verify('Actual Steamwheel');await t.shot('03-party-combat');
 t.expect(await t.eval(()=>window.__voxelHeroes.state.magic)===6,'actual party attack still pays three personal magic');
 const save=await t.save();await t.load(save);await t.step(.6);await verify('Saved party');
 // An actual native dungeon pot lift, followed by throwing with the same A.
 await resized(t,{width:390,height:844});await t.teleport('d1:3,9',2.5,3.4);await t.step(.2);
 await t.eval(()=>{const h=window.__voxelHeroes;h.player.lockT=h.player.knockT=h.player.stallT=0;h.game.hero.hero.setFacing('north');});await t.tap('sword');
 t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'actual A input lifts the native pot with the full party');
 const carried=await t.eval(()=>{const h=window.__voxelHeroes,o=h.player.carrying.object,v=o.position.clone(),p=o.geometry.attributes.position,points=[];o.updateWorldMatrix(true,false);h.gfx.camera.updateMatrixWorld();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(h.gfx.camera);points.push([v.x,v.y]);}return points;});
 t.expect(carried.every(([x,y])=>Math.abs(x)<1&&Math.abs(y)<1),'every native carried-pot vertex stays inside the portrait frame');
 // Keep the natural arrival announcement out of the pot receipt; do not hide
 // or replace native UI. Waiting leaves the manual simulation unchanged.
 await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
 await t.eval(measurePartyFrame);await t.shot('04-party-pot');
 await t.tap('sword');t.expect(await t.eval(()=>!window.__voxelHeroes.player.carrying),'the same A throws the pot without changing the party camera controls');
 await resized(t,{width:1280,height:720});await t.teleport('d1:3,9',13,6.5);await t.step(.3);
 const doorway=await t.eval(async()=>{const h=window.__voxelHeroes,m={ticks:0,scroll:0,out:0};h.input.setStick(1,0);try{for(let i=0;i<100;i++){await h.tick();m.ticks++;if(h.state.mode==='scroll')m.scroll++;m.out+=window.__measurePartyCamera(false).actors.filter(a=>a.out).length;}}finally{h.input.setStick(0,0);}return m;});await t.step(.6);
 t.expect(doorway.scroll>20&&(await t.state()).key==='d1:4,9','actual stick travel carries the party through the native Barrow east doorway slide');
 t.expect(doorway.out===0,'every measured native figure stays in frame throughout the room slide');await verify('Barrow doorway arrival');await t.shot('06-party-doorway');
 await resized(t,{width:390,height:844});
 await t.teleport('mossbrook-past:2,0',7.5,9.5);await t.step(.4);
 await t.eval(()=>window.__voxelHeroes.game.grants.grant('heart-container',1,{source:'camera-receipt-fixture'}));await t.step(.05);
 const reward=await t.eval(()=>{const h=window.__voxelHeroes,root=h.gfx.scene.getObjectByName('item-prize'),figure=h.player.hero.figure;figure.geometry.computeBoundingBox();root.updateMatrixWorld(true);const b=new figure.geometry.boundingBox.constructor().setFromObject(root),p=root.position.clone(),corners=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){p.set(x,y,z).project(h.gfx.camera);corners.push({x:(p.x+1)/2,y:(1-p.y)/2});}return{corners,header:Math.max(...h.game.hud.hudView().widgets.map(w=>(w.y+w.h)/h.game.ui.g.h))};});
 t.note('Party reward native bounds: '+JSON.stringify(reward));
 t.expect(reward.corners.every(p=>p.x>0&&p.x<1&&p.y>reward.header&&p.y<1),'the native party reward stays in the portrait frame below the measured HUD');
 await verify('Party heart reward');await t.shot('05-party-reward');await t.step(1.5);
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.companions.setMiraTravelling(false);h.game.companions.setTernTravelling(false);h.game.companions.setMaraTravelling(false);});await t.step(2);
 t.expect(await t.eval(()=>!window.__voxelHeroes.gfx.camera.userData.partyFrame),'dismissing every companion releases the party framing');
 t.expect(await t.eval(()=>{const h=window.__voxelHeroes,lens=h.camera.lens(),base=h.camera.presets[h.camera.get()];return Math.abs(lens.height-base.height)<.001&&Math.abs(lens.pitch-base.pitch)<.001;}),'the released camera returns to its selected solo lens');
 await t.eval(()=>window.__voxelHeroes.game.progress.startNewGame());await t.step(.2);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.partyCamera.partyCameraView().targets.length===1),'a fresh adventure clears every party camera subject');
}

import { writeFileSync } from 'node:fs';

export const description = 'Native reward models over the hero: actual bow chest, five viewport sizes, movement, dialogue, quiet shared grants, replacement, expiry, cached assets and world lifecycle. Patrol deaths and later grants are disclosed fixtures.';

export default async function(t) {
  const resize=async(width,height)=>{
    await t.page.setViewportSize({width,height});
    // A delayed resize clears the GL canvas. Wait for the actual camera
    // resize before taking the manually rendered receipt.
    await t.page.waitForFunction(()=>Math.abs(window.__voxelHeroes.gfx.camera.aspect-innerWidth/innerHeight)<1e-9);
    await t.step(.02);
  };
  await t.press('Enter'); await t.step(1.1);
  await t.teleport('rook-den:0,2',8.5,3.3); await t.step(.4);
  await t.eval(() => {
    const h=window.__voxelHeroes;
    // The patrol result is a fixture; chest contents and walking collection
    // use the real game, and the full Rook scenario verifies patrol combat.
    for(const e of h.entities) if(e.kind==='enemy'&&!e.removed)e.die();
    h.player.invT=0;
    h.game.hero.hero.setFacing('north');
    window.__prizeReceipts=[];
    window.__prizeView=()=>{
      const root=h.gfx.scene.getObjectByName('item-prize');
      if(!root)return null;
      const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
      const mesh=meshes[0];mesh.geometry.computeBoundingBox();
      root.updateMatrixWorld(true);
      const b=new mesh.geometry.boundingBox.constructor().setFromObject(root);
      const corners=[];
      for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])corners.push(h.camera.project(x,y,z));
      return {id:root.userData.grant,position:root.position.toArray(),min:b.min.toArray(),max:b.max.toArray(),corners,
        meshes:meshes.length,vertices:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),
        coloured:meshes.every(m=>!!m.geometry.attributes.color),pose:h.player.hero.pose(),mode:h.state.mode};
    };
  });
  await t.hold('ArrowUp',.4); await t.step(.05);
  t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('bow')),'walking into the revealed patrol chest really earns the bow');
  let v=await t.eval(()=>window.__prizeView());
  t.expect(v?.id==='bow'&&v.coloured&&v.vertices>30&&v.pose==='cheer','the earned bow displays a native coloured voxel model during cheer');
  t.expect(v.min[1]>await t.eval(()=>window.__voxelHeroes.camera.groundY+1),'the prize starts above the hero head rather than intersecting it');
  for(const [name,width,height] of[['desktop',1280,720],['phone',390,844],['phone-small',320,568],['phone-wide',430,932],['laptop',1366,768]]){
    await resize(width,height);
    await t.eval(()=>window.__voxelHeroes.render());
    const view=await t.eval(()=>window.__prizeView());
    t.expect(view.corners.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&z>-1&&z<1),`the actual bow prize stays in the ${name} camera frame`);
    const clear=await t.eval(view=>{
      const h=window.__voxelHeroes,u=h.game.ui.uiView(),top=Math.min(...view.corners.map(p=>(1-p[1])*u.h/2));
      const header=Math.max(...h.game.hud.hudView().widgets.map(w=>w.y+w.h),...u.hits.filter(w=>['party-open','journal-open'].includes(w.id)).map(w=>w.y+w.h));
      return top>header;
    },view);
    t.expect(clear,`the ${name} prize clears the actual HUD and shortcut rectangles`);
    await t.eval(({name,width,height,view})=>window.__prizeReceipts.push({name,width,height,view}),{name,width,height,view});
    await t.shot(`${name}-earned-bow`);
  }
  await resize(1280,720);
  await t.hold('ArrowRight',.12);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,p=window.__prizeView();return Math.abs(p.position[0]-h.player.x)<.01&&Math.abs(p.position[2]-h.player.z)<.01&&h.state.mode==='play';}),'the prize follows real movement without putting the game into a modal reward mode');
  await t.eval(()=>{
    const h=window.__voxelHeroes,r=h.gfx.scene.getObjectByName('item-prize');window.__earnedBowRoot=r;
    r.traverse(o=>{if(o.isMesh)window.__earnedBowGeometry=o.geometry;});
    h.game.grants.grant('heart-container',1,{source:'party',fanfare:false});
  });
  t.expect(await t.eval(()=>window.__voxelHeroes.gfx.scene.getObjectByName('item-prize')===window.__earnedBowRoot),'a quiet shared grant does not replace or interrupt the local earned prize');
  await t.eval(()=>{window.__voxelHeroes.game.dialog.showDialog('A reward can arrive during a conversation.',{speaker:'Receipt fixture',voice:false});});
  await t.step(1.5);
  t.expect(await t.eval(()=>window.__prizeView()?.id)==='bow','dialogue pauses the local presentation along with the cheer pose');
  const before=await t.eval(()=>window.__voxelHeroes.state.maxHp);
  await t.eval(()=>window.__voxelHeroes.game.grants.grant('heart-container',1,{source:'receipt-fixture'}));
  v=await t.eval(()=>window.__prizeView());
  t.expect(v?.id==='heart-container'&&v.pose==='cheer'&&(await t.state()).maxHp===before+2,'a heart reward replaces the prize and shows cheer immediately in dialogue, with one real grant');
  t.expect(await t.eval(()=>window.__earnedBowRoot.parent===null&&window.__earnedBowGeometry.attributes.position.count>0),'replacement detaches the old instance and preserves its cached geometry');
  await t.shot('dialog-heart-prize');
  await t.eval(()=>window.__voxelHeroes.setMode('play'));
  await t.eval(()=>window.__voxelHeroes.game.grants.grant('tobin-keepsake',1,{source:'receipt-fixture'}));
  t.expect(await t.eval(()=>window.__prizeView()?.id)==='tobin-keepsake','a quest keepsake also uses its existing native reward model');
  await t.step(.1);await t.shot('keepsake-prize');
  await t.eval(()=>window.__voxelHeroes.game.grants.grant('arrow-bag-1',1,{source:'receipt-fixture'}));
  await t.step(.1);await t.shot('quiver-prize');
  await resize(320,568);await t.eval(()=>window.__voxelHeroes.render());
  t.expect(await t.eval(()=>window.__prizeView()?.corners.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&z>-1&&z<1)),'the phone quiver reward has an actual prize in the camera frame');
  await t.shot('phone-quiver-prize');
  await resize(1280,720);
  await t.step(1.05);
  t.expect(await t.eval(()=>window.__prizeView())===null,'the presentation expires automatically after returning to play');
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes,a=h.gfx.camera.userData.subject,e=h.camera.expected();return Math.abs(a.x-e.x)<1e-6&&Math.abs(a.z-e.z)<1e-6;}),'the measured dungeon camera returns to its normal subject after the reward');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.grants.grant('heart-container');h.game.grants.grant('token');});
  t.expect(await t.eval(()=>window.__prizeView())===null,'a reward without a model keeps its banner without displaying the preceding item');
  await t.eval(()=>window.__voxelHeroes.game.grants.grant('heart-container'));
  await t.teleport('v1:1,1',7.5,12.5);
  t.expect(await t.eval(()=>window.__prizeView())===null,'changing rooms clears the presentation');
  await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.game.hero.hero.setFacing('south');});
  await t.step(.05);
  t.expect(await t.eval(()=>{const h=window.__voxelHeroes;return !h.world.blocked(h.player.x,h.player.z,h.player.r,{body:h.player});}),'the town presentation fixture stands on the clear central path');
  for(const [name,width,height]of[['town-phone',320,568],['town-landscape',844,390]]){
    await resize(width,height);
    await t.eval(()=>window.__voxelHeroes.game.grants.grant('arrow-bag-1',1,{source:'receipt-fixture'}));
    await t.step(.05);await t.eval(()=>window.__voxelHeroes.render());
    const clear=await t.eval(()=>{
      const h=window.__voxelHeroes,p=window.__prizeView(),u=h.game.ui.uiView(),b=h.game.banner.bannerView();
      const left=Math.min(...p.corners.map(c=>(c[0]+1)*u.w/2)),right=Math.max(...p.corners.map(c=>(c[0]+1)*u.w/2));
      const top=Math.min(...p.corners.map(c=>(1-c[1])*u.h/2)),bottom=Math.max(...p.corners.map(c=>(1-c[1])*u.h/2));
      return b.layout.length>0&&b.layout.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=u.w&&r.y+r.h<=u.h&&!(r.x<right&&r.x+r.w>left&&r.y<bottom&&r.y+r.h>top));
    });
    t.expect(clear,`${name}: the complete caption is in bounds and clears the projected native quiver in the closer town camera`);
    await t.shot(`${name}-quiver-prize`);
    await t.step(1.1);
  }
  await resize(1280,720);
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.grants.grant('heart-container');h.game.saves.saveSlot(1);h.game.saves.loadSlot(1);});
  t.expect(await t.eval(()=>window.__prizeView())===null,'save/load clears presentation while retaining the reward state');
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.grants.grant('heart-container');h.setMode('dead');});
  t.expect(await t.eval(()=>window.__prizeView())===null,'death clears a prize immediately');
  await t.eval(()=>{const h=window.__voxelHeroes;h.setMode('play');h.game.grants.grant('heart-container');h.game.progress.startNewGame({prologue:false});});
  t.expect(await t.eval(()=>window.__prizeView())===null,'a new game cannot inherit the preceding presentation');
  writeFileSync(`${t.out}/item-prizes.json`,JSON.stringify({at:new Date().toISOString(),fixtures:['Patrol deaths reveal the actual bow chest','Later grants directly exercise presentation lifecycle; complete route and NPC rewards have separate gameplay checks'],views:await t.eval(()=>window.__prizeReceipts)},null,2));
}

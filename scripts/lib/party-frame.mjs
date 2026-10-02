// Measures native geometry and the panels actually drawn; no camera-outline assumptions.
export function measurePartyFrame(draw = true) {
  const h=window.__voxelHeroes,cam=h.gfx.camera,g=h.game.ui.g,panels=[];
  // Invulnerability is a fixture; do not capture its alternating hidden blink.
  h.player.hero.root.visible=true;
  const drawPanel=g.panel;
  g.panel=function(x,y,w,height,...rest){panels.push({x,y,w,h:height});return drawPanel.call(this,x,y,w,height,...rest);};
  try {if(draw){h.game.ui.requestUi();h.render();}} finally {g.panel=drawPanel;}
  cam.updateMatrixWorld();
  const headers=[...h.game.hud.hudView().widgets,...h.game.ui.uiView().hits.filter(r=>['party-open','journal-open'].includes(r.id))];
  const actors=[h.player,...h.entities.filter(e=>['companion','friend'].includes(e.kind)&&!e.removed&&e.object.visible&&Math.hypot(e.x-h.player.x,e.z-h.player.z)<6.5)];
  const bounds=actors.map(e=>{
    const rig=e.hero??e.rig,figure=rig.figure,v=e.object.position.clone(),box={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    figure.updateWorldMatrix(true,false);const pos=figure.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(figure.matrixWorld).project(cam);const x=(v.x+1)/2,y=(1-v.y)/2;box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);}
    const overlaps=panels.filter(p=>box.left<(p.x+p.w)/g.w&&box.right>p.x/g.w&&box.top<(p.y+p.h)/g.h&&box.bottom>p.y/g.h);
    const headerOverlaps=headers.filter(p=>box.left<(p.x+p.w)/g.w&&box.right>p.x/g.w&&box.top<(p.y+p.h)/g.h&&box.bottom>p.y/g.h);
    return{name:e===h.player?'Hero':e.name??e.peerId,kind:e.kind,world:[e.x,e.z],pose:rig.pose(),vertices:pos.count,...box,out:box.left<0||box.right>1||box.top<0||box.bottom>1,techOverlap:overlaps.some(p=>p.h===27),panelOverlaps:overlaps,headerOverlaps};
  });
  return{mode:h.state.mode,screen:h.screen().key,viewport:[innerWidth,innerHeight],logical:[g.w,g.h],camera:{position:cam.position.toArray(),subject:{...cam.userData.subject},lens:h.camera.lens(),frame:cam.userData.partyFrame??null},actors:bounds,panels};
}

export async function recruitParty(t) {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);for(const flag of['era:mira-travels','era:tern-travels','coast:mara-travels','era:voices-returned','era:copper-memory','coast:beacon-lit'])h.game.state.setFlag(flag);h.player.invT=999;});
}

export async function resized(t,viewport) {
  await t.page.setViewportSize(viewport);
  await t.eval(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await t.step(.2);
}

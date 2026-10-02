export const description='Reported invisible overhead sword/boots and double shields: native King and Tinker dialogue rewards, every fanfare model, actual guard input, gear tiers, visible prize/caption bounds, cancellation and saved gear. Safe placements, unrelated courtyard enemy removal and isolated catalog grants are fixtures. All output is muted.';

export default async function(t) {
  const view=()=>t.eval(()=>{
    const h=window.__voxelHeroes,p=h.gfx.scene.getObjectByName('item-prize'),hero=h.player.hero;
    let rect=null;
    if(p){
      const geometry=p.children[0].children[0].geometry;geometry.computeBoundingBox();
      const b=geometry.boundingBox,points=[];
      p.updateMatrixWorld(true);h.gfx.camera.updateMatrixWorld(true);
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
        const v=h.gfx.camera.position.clone().set(x,y,z).applyMatrix4(p.children[0].children[0].matrixWorld).project(h.gfx.camera);points.push({x:(v.x+1)/2,y:(1-v.y)/2});
      }
      rect={left:Math.min(...points.map(v=>v.x)),right:Math.max(...points.map(v=>v.x)),top:Math.min(...points.map(v=>v.y)),bottom:Math.max(...points.map(v=>v.y))};
    }
    const g=hero.figure.model.grid,colors=[0xe9b832,0xb0743c,0xf4f4f4];let baked=0;
    for(let z=0;z<g.sz;z++)for(let y=0;y<g.sy;y++)for(let x=0;x<g.sx;x++)if(g.has(x,y,z)&&colors.includes(g.color(x,y,z)))baked++;
    return{mode:h.state.mode,pose:hero.pose(),grant:p?.userData.grant,prize:!!p,rect,baked,shield:!!h.player.guardShield.parent,shieldId:h.player.guardShield.uuid,tier:h.player.guardShield.userData.tier,guarding:h.player.guarding,shieldX:h.player.guardShield.position.x,caption:h.game.banner.bannerView()};
  });
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:true});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=0;});
  const location=type=>t.eval(type=>{const h=window.__voxelHeroes;for(const s of h.world.screens.values()){const p=s.spawns.find(p=>p.type===type);if(p)return{screen:s.key,x:p.x+.5,z:p.z+1.5};}throw Error('NPC absent '+type);},type);
  const talk=async type=>{const p=await location(type);await t.teleport(p.screen,p.x,p.z);
    // The king's courtyard has early combat. Isolate reward presentation from
    // a hopper reaching this teleported hero and locking the interaction.
    await t.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.remove();h.player.lockT=h.player.knockT=0;h.setHp(h.state.maxHp);});
    await t.step(2.5);
    // Follow the actual wandering resident rather than assuming he stayed on
    // his authored marker during arrival and the camera settle.
    await t.eval(type=>{const h=window.__voxelHeroes,n=h.entities.find(e=>e.type===type),s=h.screen();for(const[dx,dz,facing]of[[0,.9,'north'],[.9,0,'west'],[0,-.9,'south'],[-.9,0,'east']]){const x=n.x+dx,z=n.z+dz;if(h.world.blocked(x,z,h.player.r,h.player))continue;h.game.hero.hero.place(x-s.x0,z-s.z0);h.player.setFacing(facing);h.player.invT=0;return;}throw Error('No safe interaction spot for '+type);},type);
    await t.step(1/60); // present the placed body before dialogue pauses it
    await t.tap('sword');t.expect((await t.state()).mode==='dialog','Actual A starts '+type+' dialogue');};
  const advanceUntil=async id=>{
    for(let i=0;i<900;i++){
      if((await view()).grant===id)return;
      if(i%15===0)await t.tap('confirm');else await t.step(1/60);
    }
    throw Error('Native dialogue did not grant '+id);
  };
  await talk('npc-king');await advanceUntil('blade-start');await t.step(.1);let v=await view();
  t.expect(v.prize&&v.pose==='cheer'&&v.grant==='blade-start','The king gives a visible Squire Blade above both raised hands');
  t.expect(v.rect.top>=0&&v.rect.bottom<1&&v.rect.right-v.rect.left>.01,'The native sword model has a readable on-screen silhouette '+JSON.stringify(v.rect));
  t.expect(v.baked===0&&!v.shield,'The reward pose has no second baked or carried shield');await t.shot('01-king-visible-blade');
  await t.step(2);t.expect((await view()).prize,'Dialogue keeps the actual prize visible while the player reads');
  for(let i=0;i<900&&(await t.state()).mode!=='play';i++){if(i%15===0)await t.tap('confirm');else await t.step(1/60);}
  await t.step(2);t.expect(!(await view()).prize&&(await view()).pose==='stand','After dialogue the prize ends and the hero returns to a normal stance');
  t.expect(await t.eval(()=>window.__voxelHeroes.state.swords.equipped)==='blade-start','Presentation does not lose the king\'s equipped blade');
  await talk('npc-inventor');await advanceUntil('boots-dash');await t.step(.25);v=await view();
  t.expect(v.prize&&v.pose==='cheer'&&v.grant==='boots-dash','Tinker Wyll gives an actual pair of boots above the hero');await t.shot('02-tinker-visible-boots');await t.step(2);

  // The catalog check enumerates metadata from the loaded game. This prevents
  // another new fanfare reward silently becoming empty hands.
  const catalog=await t.eval(()=>{const g=window.__voxelHeroes.game;return [...new Set([...g.grants.grantIds(),...g.items.allItems().map(i=>i.id)])].filter(id=>g.grants.grantMeta(id).fanfare).map(id=>{const m=g.grants.grantMeta(id).model?.();let vertices=0;m?.traverse(o=>{if(o.isMesh)vertices+=o.geometry.attributes.position.count;});return{id,object3D:m?.isObject3D===true,vertices};});});
  for(const item of catalog)t.expect(item.object3D&&item.vertices>0,`${item.id}: every fanfare reward builds nonempty native geometry`);
  await t.teleport('v1:1,1',8.5,9.5);await t.step(2);await t.eval(()=>window.__voxelHeroes.player.invT=0);
  for(const id of ['blade-warden','blade-dawn','boots-swamp','ring-half','heart-piece','magic-container','token','spell-freeze','key-boss','map','orb-1','bomb-bag-1']) {
    await t.eval(id=>window.__voxelHeroes.game.grants.grant(id,1,{source:'catalog-presentation-fixture',dungeon:'d1'}),id);await t.step(.35);await t.shot('catalog-'+id);v=await view();
    t.expect(v.grant===id&&v.pose==='cheer'&&v.rect.top>=0&&v.rect.bottom<1,`${id}: real grant produces a visible overhead reward`);await t.step(2);
  }
  await t.eval(()=>{const h=window.__voxelHeroes;h.player.setFacing('south');h.state.gear.shield=0;});await t.step(.1);v=await view();
  t.expect(!v.shield&&v.baked===0,'An unarmed prologue hero has no ornamental shield');
  await t.eval(()=>window.__voxelHeroes.state.gear.shield=1);await t.step(.1);v=await view();const shieldId=v.shieldId;
  t.expect(v.shield&&v.baked===0&&v.shieldX>.2&&!v.guarding,'An owned shield rests at the off hand as one separate mesh');await t.shot('03-one-carried-shield');
  await t.hold('Shift',.2);v=await view();
  // hold() releases before returning; capture a native held key explicitly.
  await t.eval(()=>window.__voxelHeroes.input.down('guard'));await t.step(.2);v=await view();
  t.expect(v.guarding&&v.shield&&v.baked===0&&v.shieldId===shieldId&&v.shieldX<0,'Holding guard moves the SAME shield forward, with no baked duplicate');await t.shot('04-one-raised-shield');
  for(let tier=1;tier<=6;tier++) {await t.eval(tier=>window.__voxelHeroes.state.gear.shield=tier,tier);await t.step(.05);v=await view();t.expect(v.shieldId===shieldId&&v.tier===tier&&v.baked===0,`Tier ${tier} changes the single held shield geometry`);}
  await t.shot('05-bastion-shield');await t.eval(()=>window.__voxelHeroes.input.up('guard'));await t.step(.1);v=await view();
  t.expect(!v.guarding&&v.shield&&v.shieldId===shieldId&&v.shieldX>.2,'Releasing guard lowers the same shield');
  await t.eval(()=>window.__voxelHeroes.game.grants.grant('boots-dash'));await t.step(.1);v=await view();t.expect(v.prize&&!v.shield&&v.baked===0,'A reward puts the single carried shield away');
  await t.teleport('v1:1,2',11.5,5.5);v=await view();t.expect(!v.prize,'Leaving a screen clears the overhead presentation');
  await t.step(2);const saved=await t.save();await t.load(saved);await t.step(.2);v=await view();
  t.expect(v.shield&&v.baked===0&&v.tier===6&&!v.prize,'Save/load restores one earned shield without an orphan reward');
}

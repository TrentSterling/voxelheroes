export const FAIR_BELLS=[[3,3],[8,3],[12,3],[3,8],[8,8],[12,8]];
export const fairState=t=>t.eval(()=>{const h=window.__voxelHeroes,m=h.entities.find(e=>e.type==='fair-clock');return {ai:m?{...m.ai}:null,coins:h.state.coins,hp:h.state.hp,carrying:!!h.player.carrying,loot:h.player.carrying?.loot,medal:h.game.state.hasFlag('fair:bell-medal'),times:[...h.state.flags].filter(f=>f.startsWith('fair:time:')),requests:[...h.state.flags].filter(f=>f.startsWith('fair:start:')),mode:h.state.mode};});
export async function fairRead(t,choice=0,x=7.5){
 await t.walkTo(x,14.6);await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});await t.tap('sword');
 for(let n=0;n<90&&(await t.state()).mode==='dialog';n++){
  const d=await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView());
  if(d.choices){if(choice)await t.tap('down');await t.tap('confirm');break;}await t.tap('confirm');
 }
 await t.step(.08);
}
export async function fairLift(t,index){
 const x=FAIR_BELLS[index][0]<6?2:11;await t.walkTo(x+.5,13.6);await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});await t.tap('sword');await t.step(.05);
 if(!(await fairState(t)).carrying)throw Error('Native fair clay lift did not produce a carried pot');
}
export async function fairThrow(t,index){
 const[x,z]=FAIR_BELLS[index];await t.walkTo(x+.5,z+1.6);await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});
 for(let n=0;n<400;n++){const a=(await fairState(t)).ai;if(a?.phase!=='running')throw Error('Clockfair ended before the throw: '+JSON.stringify(a));if(a.lit&&a.target===index&&a.beat>.25)break;await t.step(.07);if(n===399)throw Error('Glowing bell never became available');}
 await t.tap('sword');await t.step(.26);
}
export async function fairRingAll(t){for(let i=0;i<6;i++){await fairLift(t,i);await fairThrow(t,i);}await t.step(.1);}

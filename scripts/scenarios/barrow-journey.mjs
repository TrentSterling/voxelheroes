import firstRoad from './first-road.mjs';
export const description='Native title-to-boss-key dungeon journey. Actual travel, sword combat, push block, keys, physical pots, chests and boomerang input. No teleport, gear grants, direct enemy damage, actor removal, health edits or invulnerability. Bot healing disabled; exact walk endpoints settle within two movement steps. Browser output muted.';
const room=async(t,dir,key)=>{await t.exit(dir);t.expect((await t.state()).key===key,`native ${dir} travel reaches ${key}`);};
const fight=async(t,label,tool=false)=>{const r=await t.fight({heal:-1,guard:true,tool,seconds:60,soft:true});t.note(`${label}: ${JSON.stringify(r)}`);t.expect(r.ok&&r.heals===0,`${label} clears by native sword, guard and owned tools without healing edits`);return r;};
const chest=async(t,x,z,dir='north')=>{const [dx,dz]={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[dir];await t.walkTo(x+.5-dx,z+.5-dz);await t.stick(dx,dz,.3);await t.step(2);};
export default async function(t){
 await firstRoad(t);
 await t.track('block-pushed','switch-pressed','item-used','chest-opened');
 await room(t,'west','d1:3,9');await room(t,'north','d1:3,8');
 await fight(t,'Map Hall bats');await chest(t,8,4);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.dungeonProgress('d1').map),'the native Map Hall chest gives the dungeon map');await t.shot('10-native-map');
 await room(t,'west','d1:2,8');await t.shot('11-before-copper-turn');await t.walkTo(4.5,7.5);await t.stick(1,0,2.8);
 t.expect(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+8,s.z0+7)==='Q'&&!h.state.flags.has('dungeon:d1:puzzle:I-3');}),'holding right reaches the turn but cannot solve the new block hall');
 await t.shot('11-block-at-the-turn');await t.walkTo(8.5,8.5);await t.stick(0,-1,1.8);
 t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d1:puzzle:I-3')),'actual east then north pushes solve the copper turn');
 await t.walkTo(8,8);await t.step(.3);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d1')===2),'native pickups collect both earned small keys');await t.shot('11-native-block-key');
 await room(t,'east','d1:3,8');await t.walkTo(8,1.5);await t.stick(0,-1,.5);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d1')===1),'the native north door consumes one earned small key');
 await room(t,'north','d1:3,7');await fight(t,'Pit Walk bats on safe bridge');await room(t,'east','d1:4,7');await room(t,'north','d1:4,6');await t.step(.8);
 await t.shot('12-before-native-turning-fight');await fight(t,'Turning Room guardians');
 await chest(t,7,5);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('boomerang')),'the real lock-in battle reveals the chest and gives a usable boomerang');await t.shot('13-earned-boomerang');
 await t.walkTo(3.5,6.45);await t.stick(0,-1,1/60);await t.tap('sword');
 t.expect((await t.state()).hp===(await t.state()).maxHp,'actual hourstone interaction restores hearts after the guarded reward');await t.shot('13-native-hourstone');
 await room(t,'south','d1:4,7');const gazers=await fight(t,'Gazer Walk with earned boomerang',true);
 t.expect(gazers.itemUses>0,'the actual return fight uses the earned boomerang');
 await room(t,'west','d1:3,7');await room(t,'north','d1:3,6');
 await t.walkTo(5.5,2);await t.walkTo(10.5,2);await t.stick(0,-1,1/60);
 for(let n=0;n<4&&!await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d1:switches:G-4'));n++){await t.tap('item');await t.step(.5);}
 t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d1:switches:G-4')),'an actual boomerang throw lights the single eye');
 await t.walkTo(5,5);await t.step(.3);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d1')===2),'the actual boomerang puzzle gives the third small key');await t.shot('14-native-eye-key');
 await t.walkTo(4.5,7.45);await t.stick(0,-1,1/60);await t.tap('sword');
 t.expect((await t.state()).hp===(await t.state()).maxHp,'actual western hourstone restores hearts between the third key and upper barrow battles');await t.shot('14-native-eye-rest');
 await t.walkTo(2,6);await t.stick(-1,0,.5);await room(t,'west','d1:2,6');await fight(t,'Dark Hall bones',true);
 await room(t,'north','d1:2,5');await room(t,'north','d1:2,4');await t.step(.8);
 await fight(t,'Crossed Bones two-wave encounter',true);
 await t.walkTo(3.5,9.5);await t.stick(-1,0,1/60);await t.tap('sword');
 t.expect(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'native walking and sword input lift the bell-room pot');
 await t.walkTo(8.5,4.5);await t.stick(0,-1,1/60);
 for(let n=0;n<4&&await t.eval(()=>!!window.__voxelHeroes.player.carrying);n++){await t.tap('sword');await t.step(.4);}
 t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d1:echo-muted')),'the carried pot physically hits the copper bell');await t.shot('15-native-clay-bell');
 await t.walkTo(8,5);await t.step(.3);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.keys.keyCount('d1')===2),'native bell waves earn the fourth small key');await t.shot('16-native-bell-key');
 await room(t,'east','d1:3,4');
 for(const x of [2.5,5.5,10.5,13.5]){await t.walkTo(x,1.65);await t.stick(0,-1,1/60);await t.tap('item');await t.step(.3);}
 t.expect(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d1:switches:E-4')),'four native boomerang throws open the timed eye gate');
 const eyes=(await t.events('switch-pressed')).filter(e=>e.id==='dungeon:d1:switches:E-4');
 t.note(`Native timed eyes: ${JSON.stringify(eyes)}`);t.expect(eyes.length===4&&eyes.at(-1).time-eyes[0].time<=5,'all four eyes are lit by real throws inside five seconds');await t.shot('17-native-four-eyes');
 await room(t,'east','d1:4,4');await chest(t,8,5);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.dungeonProgress('d1').bossKey),'the real east chest gives the boss key');await t.shot('18-native-boss-key');
 await room(t,'west','d1:3,4');await t.walkTo(8,1.5);await t.stick(0,-1,.5);await room(t,'north','d1:3,3');
 await t.walkTo(8.5,6.5);await t.step(.1);
 t.expect(await t.eval(()=>window.__voxelHeroes.game.dungeons.dungeonProgress('d1').portal),'native stepping wakes the entrance shortcut');
 await t.walkTo(4.5,8.45);await t.stick(0,-1,1/60);await t.tap('sword');
 t.expect((await t.state()).hp===(await t.state()).maxHp,'the second native hourstone restores hearts before the boss');await t.shot('19-native-last-rest');
}

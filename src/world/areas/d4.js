import { registerArea } from '../areas.js';
import { GOLD } from '../palette.js';
import { D4_ENTRANCE,D4_EXIT } from './coast.js';
import { brineglassStyle,brineglassFloor } from '../brineglass-layout.js';
export const TIDE_PALETTE={...GOLD,floor:0x4e656c,floorRing:0x759399,grout:0x394c56,floorUnder:0x26373e,wall:0x779cad,wallDark:0x567888,mortar:0x324f60,trim:0x8f5b4e,ledge:0xb8ceca};
const room=(name,doors,props=[],extra={})=>{
  const rows=Array.from({length:12},(_,z)=>Array.from({length:16},(_,x)=>x===0||x===15||z===0||z===11?'W':'.'));
  const floorStyle=brineglassStyle(name);
  for(let z=1;z<11;z++)for(let x=1;x<15;x++)rows[z][x]=brineglassFloor(floorStyle,x,z);
  for(const[side,tile]of Object.entries(doors))for(const k of[0,1])rows[side==='n'?0:side==='s'?11:5+k][side==='w'?0:side==='e'?15:7+k]=tile;
  for(const[x,z,ch]of props)rows[z][x]=ch;return {name,floorStyle,...extra,rows:rows.map(r=>r.join(''))};
};
const band=(from,to,ch)=>Array.from({length:to-from+1},(_,i)=>Array.from({length:14},(_,x)=>[x+1,from+i,ch])).flat();
const lower={area:'d4',screen:[2,1],x:8,z:9.5,yaw:0};
const upper={area:'d4',screen:[2,7],x:8,z:9.5,yaw:Math.PI};
const screens={
  '2,3':room('Brineglass Vestibule',{s:'X',n:'.',w:'.'},[[4,4,'T'],[12,8,'Y'],[3,8,'v'],[3,3,'F'],[12,3,'F']],{tablet:['The ember wand rests east of the central hall. Earn a key from the lantern patrol.','The wand lights unlit bowls and melts tideglass ice. Striped posts carry you across water.','The tide beast dives after every hit. Clear a tentacle, cross the channel, and strike the next opening.'],warps:{'12,8':{area:'d4',screen:[2,5],x:4.5,z:8.5,yaw:0}}}),
  '1,3':room('Lantern Patrol',{e:'H',n:'.',w:'l'},[[5,4,'n'],[10,8,'s'],[5,7,'v'],[11,3,'v'],[8,5,'S']],{clear:'key',keyAt:[8,7],encounterHint:'A shield blocks the warden from the front. Hook it or flank during recovery.'}),
  '0,3':room('The Warden Legacy',{e:'.'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:'blade-warden'}),
  '1,2':room('Tide Charts',{s:'.',w:'.',e:'.'},[[8,4,'c'],[3,3,'F'],[12,3,'F']],{chest:'map'}),
  '0,2':room('Sluice Counterweight',{e:'.'},[[5,7,'Q'],[9,7,'_'],[8,8,'T'],[4,4,'v']],{puzzle:'key',keyAt:[8,3],tablet:['The sluice weight releases a key when its square block rests on the matching plate.']}),
  '2,2':room('The Glass Junction',{s:'.',w:'.',e:'l',n:'l'},[[5,4,'S'],[10,7,'S'],[3,8,'v'],[12,3,'v']]),
  '3,2':room('Ember Cache',{w:'H',s:'.',n:'.',e:'.'},[[8,4,'h'],[5,7,'s'],[10,7,'g'],[3,3,'v'],[12,8,'v'],[5,5,'S']],{clear:'chest',chest:'fire-wand',encounterHint:'Stay behind the statues between magic shots. The keeper left an ember wand in this vault.'}),
  '3,3':room('First Thaw',{n:'.',e:'.'},[...band(4,6,':'),[13,5,'.'],[13,6,'.'],[14,5,'.'],[14,6,'.'],[3,8,'T']],{tablet:['Send fire north into the glass. Each shot melts one block; make a path.','Unlit bowls catch the same fire. Pots, water and posts do not.']}),
  '4,3':room('The Stillwater Gift',{w:'.'},[...band(4,6,'~'),[1,5,'.'],[2,5,'.'],[1,6,'.'],[2,6,'.'],[8,2,'c'],[8,8,'&']],{chest:'heart-piece'}),
  '3,1':room('Twin Ember Bowls',{s:'.',n:'.',w:'.',e:'.'},[[3,3,'f'],[12,3,'f'],[8,8,'T'],[5,6,'S'],[10,6,'S']],{torchReward:'key',keyAt:[8,6],tablet:['Wake both bowls with the fire wand. Their light releases a small key.','The fire stays lit when you leave.']}),
  '4,1':room('Crosscurrents',{w:'.',s:'.'},[...band(4,6,'~'),[1,5,'.'],[2,5,'.'],[1,6,'.'],[2,6,'.'],[8,2,'c'],[8,8,'&']],{chest:{grant:'coins',amount:120}}),
  '4,2':room('Pressure Patrol',{n:'H',w:'.'},[[8,5,'S'],[4,8,'v'],[11,3,'v']],{clear:'key',keyAt:[8,7],spawnsAt:{'5,4':{type:'tideglass-skater',once:true},'10,7':{type:'tideglass-skater',once:true}},encounterHint:'Fire opens ice shells. Sidestep the marked slide, then strike while the skater recovers.'}),
  '3,0':room('Ash Treasury',{s:'.',w:'z'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:{grant:'coins',amount:150},warps:{y:{area:'d4',screen:[2,0],x:13,z:6,yaw:-Math.PI/2}}}),
  '2,0':room('The Deep Powder Bag',{e:'y'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:'bomb-bag-2',warps:{y:{area:'d4',screen:[3,0],x:2.5,z:6,yaw:Math.PI/2}}}),
  '2,1':room('The Flood Stair',{s:'.',w:'.',e:'.',n:'y'},[[3,3,'T'],[12,8,'v']],{tablet:["The upper temple's crown waits past two ember gates and a broken tide bridge."],warps:{y:upper}}),
  '1,1':room('Sapphire Watchers',{e:'.',w:'.',n:'V'},[[3,0,'w'],[12,0,'w'],[4,5,'S'],[11,5,'S'],[8,8,'T']],{switches:{opens:'key-blue',window:7},tablet:['Two returning throws wake the blue gate.',"The magic shield beyond can block the beast's ink."]}),
  '1,0':room('The Tidekeeper Shield',{s:'.'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:'shield-3'}),
  '0,1':room('The Frozen Secret',{e:'.'},[[14,5,';'],[14,6,';'],[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:'magic-container'}),
  '2,7':room('Upper Tide Landing',{s:'y',w:'.',n:'l'},[[3,3,'T'],[12,8,'v']],{tablet:['The crown lies west through the ember gates. A third key opens the northern bridge.'],warps:{y:lower}}),
  '1,7':room('The Ember Gate',{e:'.',n:'E',w:'.'},[[3,3,'f'],[12,3,'f'],[8,8,'T'],[6,6,'v']],{tablet:['Both bowls must burn before the gate rises.','The keeper\'s kiln lies west. An Ember Lens rests there, guarded by ice-shell skaters.']}),
  '0,7':room('Kiln of the First Light',{e:'.'},[[8,3,'h'],[4,4,'S'],[11,7,'S'],[3,8,'v'],[12,3,'v'],[8,8,'T'],[4,2,'F'],[11,2,'F']],{clear:'chest',chest:'ember-lens',spawnsAt:{'5,5':{type:'tideglass-skater',once:true},'10,5':{type:'tideglass-skater',once:true}},tablet:['The keeper made lenses here for every lamp on the shore. The last one never left the kiln.','Fire opens a skater\'s shell. Its marked slide cannot turn. Bait the charge, step aside, then strike the broken shell.','The Ember Lens melts two ice blocks with one bolt. Carry its warmth to the beacon south of Hookshore Landing.']}),
  '1,6':room('Cooled Glass Hall',{s:'.',w:'.'},[...band(4,6,':'),[3,8,'T']],{tablet:['Fire a path through the ice to the western doorway.','The crown bowl beyond needs two more flames.']}),
  '0,6':room('Crown of the Tide',{e:'.'},[[5,7,'f'],[10,7,'f'],[8,4,'h'],[4,3,'F'],[11,3,'F']],{torchReward:'chest',chest:'key-boss'}),
  '2,6':room('The Tide Bridge',{s:'.',n:'.'},[...band(4,6,'~'),[8,2,'&'],[8,8,'&']]),
  '2,5':room('Undertow Antechamber',{s:'.',n:'B'},[[8,6,'Z'],[3,8,'Y'],[5,4,'T'],[3,3,'F'],[12,3,'F'],[12,5,'R']],{tablet:['The keeper left a warm tidewell here. Rest at its cup before crossing into Undertow.','The beast surfaces on four banks. Its ink can be stopped by the magic shield.','Tentacles regrow; hurting them never hurts the body. Fire clears a space to cross.','One hit drives the body under. Watch the next ripple, then follow it with the grapple.'],warps:{B:{area:'d4-boss',screen:[0,0],x:11,z:13.5,yaw:Math.PI},'3,8':{area:'d4',screen:[2,3],x:11.5,z:8.5,yaw:0}}}),
  '0,5':room('Fourth Light',{s:'X'},[[8,4,'c'],[3,3,'F'],[12,3,'F']],{chest:'orb-4',spawnsAt:{'4,6':{type:'npc-sage',name:'Sage Neru',spell:'spell-freeze',grantLines:['Four lights awake. Still the water and hear its quiet.','Freeze holds nearby foes for five seconds. It turns flame walls into ice your sword can break.'],afterLines:['The four lights belong at the old tower.','The pilgrim strand leads east; your fire wand clears the old trees.']}}}),
};
registerArea({id:'d4',name:'Brineglass Temple',kind:'dungeon',tileset:'brineglass',lighting:'crypt',camera:'dungeon',rooms:true,origin:[252,0],start:[2,3],entrance:D4_ENTRANCE,keyGroup:'d4',palette:TIDE_PALETTE,spawns:{s:'skeleton',n:'barrow-warden',g:'gazer',t:'turret'},warps:{X:D4_EXIT},screens});
const arena=Array.from({length:16},(_,z)=>Array.from({length:22},(_,x)=>x===0||x===21||z===0||z===15?'W':x>=8&&x<=11&&z>=3&&z<=12?'~':'.'));
for(let z=1;z<15;z++)for(let x=1;x<21;x++)if(arena[z][x]==='.')arena[z][x]=x===7||x===12?'q':x===6||x===13?'u':z===2||z===13?'e':'i';
for(const x of [10,11])for(const z of [0,15])arena[z][x]='U';
for(const[x,z]of[[6,6],[13,6],[6,10],[13,10]])arena[z][x]='&';
for(const[x,z]of[[2,2],[19,2],[2,13],[19,13]])arena[z][x]='F';
registerArea({id:'d4-boss',name:'Undertow Court',kind:'arena',tileset:'brineglass',lighting:'crypt',camera:'boss',rooms:true,screen:[22,16],at:[260*16,0],entrance:D4_ENTRANCE,keyGroup:'d4',palette:TIDE_PALETTE,screens:{'0,0':{name:'Undertow Court',rows:arena.map(r=>r.join('')),spawnsAt:{'5,5':{type:'boss-beast',dungeon:'d4'},'11,13':{type:'beast-tombstone',dungeon:'d4'}},warps:{'10,0':{area:'d4',screen:[0,5],x:8,z:9,yaw:Math.PI},'11,0':{area:'d4',screen:[0,5],x:8,z:9,yaw:Math.PI},'10,15':{area:'d4',screen:[2,5],x:8,z:2,yaw:0},'11,15':{area:'d4',screen:[2,5],x:8,z:2,yaw:0}}}}});

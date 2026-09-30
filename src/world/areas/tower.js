import { registerArea } from '../areas.js';
import { GOLD } from '../palette.js';
import { TIDE_PALETTE } from './d4.js';
import { HIVE_PALETTE } from './d2.js';
export const TOWER_ENTRY={area:'tower-trial',screen:[0,0],x:11,z:13,yaw:Math.PI};
export const TOWER_EXIT={area:'tidecoast',screen:[2,2],x:8.5,z:5,yaw:0};
const ASH={...GOLD,floor:0x574d65,floorRing:0x867294,grout:0x3d354a,floorUnder:0x292533,wall:0x91869c,wallDark:0x655e72,mortar:0x4d4659,trim:0xa98968,ledge:0xcfc6b4};
const room=(name,doors,props=[],extra={})=>{
  const rows=Array.from({length:12},(_,z)=>Array.from({length:16},(_,x)=>x===0||x===15||z===0||z===11?'W':'.'));
  for(const[side,tile]of Object.entries(doors))for(const k of[0,1])rows[side==='n'?0:side==='s'?11:5+k][side==='w'?0:side==='e'?15:7+k]=tile;
  for(const[x,z,ch]of props)rows[z][x]=ch;return{name,...extra,rows:rows.map(r=>r.join(''))};
};
const arena=(name,id,at,palette,boss,dungeon,next,extraProps=[])=>{
  const rows=Array.from({length:16},(_,z)=>Array.from({length:22},(_,x)=>x===0||x===21||z===0||z===15?'W':'.'));
  for(const x of[10,11])for(const z of[0,15])rows[z][x]='U';
  for(const[x,z,ch]of[[2,2,'F'],[19,2,'F'],[2,13,'F'],[19,13,'F'],...extraProps])rows[z][x]=ch;
  registerArea({id,name,kind:'arena',tileset:'dungeon',lighting:'crypt',camera:'boss',rooms:true,screen:[22,16],at,entrance:dungeon==='tower-trial'?TOWER_ENTRY:{area:dungeon,screen:[1,2],x:8,z:9.5,yaw:Math.PI},keyGroup:dungeon,palette,screens:{'0,0':{name,rows:rows.map(r=>r.join('')),
    spawnsAt:{'5,5':{type:boss,dungeon,refight:dungeon!=='tower-trial'&&dungeon!=='tower-crown',trial:dungeon==='tower-trial',once:true},...(id==='tower-final'?{'11,5':{type:'boss-king',dungeon,once:true}}:{})},
    warps:{'10,0':next,'11,0':next,'10,15':dungeon==='tower-trial'?TOWER_EXIT:{area:dungeon,screen:[1,1],x:8,z:2,yaw:0},'11,15':dungeon==='tower-trial'?TOWER_EXIT:{area:dungeon,screen:[1,1],x:8,z:2,yaw:0}}
  }}});
};
arena('The First Reflection','tower-trial',[280*16,0],ASH,'boss-bishop','tower-trial',{area:'tower-hive',screen:[1,2],x:8,z:9.5,yaw:Math.PI});
const floors=[
  {id:'tower-hive',origin:282,name:'The Amber Memory',palette:HIVE_PALETTE,boss:'boss-queen',reward:'shield-6',next:'tower-watch',puzzle:[[3,0,'w'],[12,0,'w'],[4,5,'S'],[11,5,'S']],puzzleExtra:{switches:{opens:'shutter',window:7}},hint:'Returning throws wake both eyes within seven seconds. The western vault holds this floor\'s crown key.',arenaProps:[[4,12,'.']]},
  {id:'tower-watch',origin:286,name:'The Sand Memory',palette:GOLD,boss:'boss-colossus',reward:'blade-dawn',next:'tower-tide',puzzle:[[5,7,'Q'],[9,7,'_'],[4,4,'S'],[11,3,'S']],puzzleExtra:{puzzle:'shutter'},hint:'Push the square block onto its plate to raise the western gate. The crown key waits beyond.',arenaProps:[]},
  {id:'tower-tide',origin:290,name:'The Tide Memory',palette:TIDE_PALETTE,boss:'boss-beast',reward:{grant:'coins',amount:1000},next:'tower-crown',puzzle:[[3,3,'f'],[12,3,'f'],[8,7,':'],[8,6,':'],[8,5,':']],puzzleExtra:{},hint:'Melt the glass and light both ember bowls. The western vault holds the last crown key.',arenaProps:[...Array.from({length:10},(_,i)=>Array.from({length:4},(_,x)=>[8+x,3+i,'~'])).flat(),[6,6,'&'],[13,6,'&'],[6,10,'&'],[13,10,'&']]},
];
for(const f of floors){
 const entrance={area:f.id,screen:[1,2],x:8,z:9.5,yaw:Math.PI};
 const next={area:f.next,screen:[1,2],x:8,z:9.5,yaw:Math.PI};
 registerArea({id:f.id,name:f.name,kind:'dungeon',tileset:'dungeon',lighting:'crypt',camera:'dungeon',rooms:true,origin:[f.origin,0],start:[1,2],entrance,keyGroup:f.id,palette:f.palette,spawns:{n:'barrow-warden',g:'gazer'},screens:{
  '1,2':room(f.name,{s:'X',w:'.',n:'l'},[[5,4,'n'],[10,7,'g'],[5,8,'v'],[11,3,'v'],[8,5,'S']],{clear:'key',keyAt:[8,7],tablet:['The tower remembers the trials you passed. Each floor keeps its own small key and crown key.',f.hint],warps:{X:f.id==='tower-hive'?{area:'tower-trial',screen:[0,0],x:11,z:2,yaw:0}:{area:f.id==='tower-watch'?'tower-hive':'tower-watch',screen:[1,0],x:8,z:2,yaw:0}},spawnsAt:f.id==='tower-hive'?{'3,8':{type:'npc-sage',name:'Sage Iona',spell:'spell-truesight',grantLines:['You endured the first reflection. The real keeper awaits above the memories.','Truesight reveals the one body with a shadow. Strike it while the spell lasts.'],afterLines:['Magic wisps in the crown room replenish your sight.','Each floor has a rest well. The amber memory rewards a shield that guards lightning and storms.']}}:{}}),
  '0,2':room('The Resting Light',{e:'.'},[[8,4,'c'],[3,3,'F'],[12,3,'F']],{chest:'map',spawnsAt:{'4,7':{type:'tower-well'}}}),
  '1,1':room(f.name+' Gate',{s:'.',w:'E',n:'B'},f.puzzle,{...f.puzzleExtra,tablet:[f.hint],warps:{B:{area:f.id+'-boss',screen:[0,0],x:11,z:13,yaw:Math.PI}},spawnsAt:f.id==='tower-hive'?{'12,8':{type:'bomb-supply'}}:{}}),
  '0,1':room('The Memory Crown',{e:'.'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:'key-boss'}),
  '1,0':room('The Light Above',{s:'X',n:'y'},[[8,4,'c'],[3,3,'F'],[12,3,'F']],{chest:f.reward,warps:{X:{area:f.id+'-boss',screen:[0,0],x:11,z:2,yaw:0},y:next},spawnsAt:{'4,7':{type:'tower-well'}}}),
 }});
 arena(f.name+' Court',f.id+'-boss',[(f.origin+3)*16,60],f.palette,f.boss,f.id,{area:f.id,screen:[1,0],x:8,z:9.5,yaw:Math.PI},f.arenaProps);
}
registerArea({id:'tower-crown',name:'The Fourfold Crown',kind:'dungeon',tileset:'dungeon',lighting:'crypt',camera:'dungeon',rooms:true,origin:[294,0],start:[1,2],entrance:{area:'tower-crown',screen:[1,2],x:8,z:9.5,yaw:Math.PI},keyGroup:'tower-crown',palette:ASH,spawns:{n:'barrow-warden'},screens:{
 '1,2':room('The Crown Stair',{s:'X',n:'.',w:'.'},[[4,3,'F'],[11,3,'F']],{tablet:['Above waits the keeper of false light. With Truesight, only its real body has a shadow.','The crown beyond commands storms. Guard ordinary attacks with your Bastion Shield; leave the bright charged shot\'s line.'],warps:{X:{area:'tower-tide',screen:[1,0],x:8,z:2,yaw:0}}}),
 '0,2':room('The Last Rest',{e:'.'},[[8,4,'c'],[3,3,'F'],[12,3,'F']],{chest:'map',spawnsAt:{'4,7':{type:'tower-well'}}}),
 '1,1':room('The Crown Guard',{s:'.',n:'H'},[[5,4,'n'],[10,7,'n'],[3,8,'v'],[12,3,'v'],[8,4,'h']],{clear:'chest',chest:'key-boss'}),
 '1,0':room('The Last Door',{s:'.',n:'B'},[[3,3,'F'],[12,3,'F'],[8,7,'T']],{tablet:['Truesight lasts fifteen seconds. Wisps drop magic; keep enough for another casting.','The Hollow Crown\'s lightning marks the floor before it strikes. Dash out of its marked squares.'],warps:{B:{area:'tower-final',screen:[0,0],x:11,z:13,yaw:Math.PI}},spawnsAt:{'4,7':{type:'tower-well'}}}),
}});
arena('The Hollow Throne','tower-final',[298*16,0],ASH,'boss-bishop','tower-crown',{area:'v1',screen:[1,1],x:8,z:11,yaw:Math.PI});

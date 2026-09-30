import { registerArea } from '../areas.js';
import { GOLD } from '../palette.js';
import { D3_ENTRANCE, D3_EXIT } from './desert.js';

export const WATCH_PALETTE={...GOLD,floor:0x6b6256,floorRing:0x96816a,grout:0x4c4540,floorUnder:0x38312d,wall:0xb59c82,wallDark:0x887362,mortar:0x594a3b,trim:0x3e7287,ledge:0xd7b568};
const room=(name,doors,props=[],extra={})=>{
  const rows=Array.from({length:12},(_,z)=>Array.from({length:16},(_,x)=>x===0||x===15||z===0||z===11?'W':'.'));
  for(const [side,tile] of Object.entries(doors))for(const k of [0,1])rows[side==='n'?0:side==='s'?11:5+k][side==='w'?0:side==='e'?15:7+k]=tile;
  for(const [x,z,tile] of props)rows[z][x]=tile;
  return {name,...extra,rows:rows.map(r=>r.join(''))};
};
const trench=(axis,from,to,ch='~')=>Array.from({length:to-from+1},(_,i)=>Array.from({length:14},(_,k)=>axis==='z'?[k+1,from+i,ch]:[from+i,k%10+1,ch])).flat().filter(([x,z])=>x>0&&x<15&&z>0&&z<11);
const upper={area:'d3',screen:[2,7],x:8,z:9,yaw:Math.PI};
const lower={area:'d3',screen:[2,1],x:8,z:10,yaw:0};
const screens={
  '2,3':room('Watchkeeper Vestibule',{s:'X',n:'.',e:'.',w:'.'},[[4,4,'T'],[12,8,'Y'],[3,8,'v'],[12,3,'F'],[3,3,'F']],{
    tablet:['The watchkeeper sealed his grapple in the eastern vault. First, earn a key in the western patrol.','Striped posts and treasure chests catch a hook. Water and pits cannot stop the chain.','The colossus has two feet, then two arms, then a hopping core. Its pale lasers ignore shields.'],
    warps:{'12,8':{area:'d3',screen:[2,5],x:4.5,z:8.5,yaw:0}},spawnsAt:{'11,6':'bomb-supply'},
  }),
  '1,3':room('Shield Patrol',{e:'H',n:'.',w:'.'},[[5,4,'n'],[10,8,'s'],[5,7,'v'],[11,3,'v'],[8,5,'S']],{clear:'key',keyAt:[8,7],encounterHint:'Break the shield patrol with pots, a flank, or a baited lunge.'}),
  '1,2':room('Watch Charts',{s:'.',e:'.',w:'.'},[[8,4,'c'],[3,3,'F'],[12,3,'F'],[4,8,'v']],{chest:'map'}),
  '0,2':room('Counterweight Key',{e:'.'},[[5,7,'Q'],[9,7,'_'],[4,4,'v'],[11,4,'v'],[8,8,'T']],{puzzle:'key',keyAt:[8,3],tablet:['Slide the square block onto its matching plate. The old weights release a second key.']}),
  '2,2':room('Divided Hall',{s:'.',w:'.',e:'l',n:'.'},[[5,4,'S'],[10,7,'S'],[3,8,'v'],[12,3,'v']]),
  '3,2':room('Chain Vault',{w:'H',s:'.',n:'.'},[[8,4,'h'],[5,7,'s'],[10,7,'g'],[3,3,'v'],[12,8,'v'],[5,5,'S'],[11,4,'S']],{clear:'chest',chest:'grapple',encounterHint:'The gazer keeps moving. Hide behind stone, then strike when its shot misses.'}),
  '3,3':room('First Cast',{n:'.',e:'.',w:'.'},[...trench('x',7,9),[7,1,'.'],[8,1,'.'],[7,2,'.'],[8,2,'.'],[11,6,'&'],[4,6,'&'],[3,3,'T']],{tablet:['Stand west of the channel and face east. Send the grapple to the striped post.','The hook reaches six tiles. A miss returns; a catch pulls you across.']}),
  '4,3':room('Chest Island',{w:'.'},[...trench('z',4,6),[1,5,'.'],[2,5,'.'],[1,6,'.'],[2,6,'.'],[8,2,'c'],[8,8,'&'],[3,8,'v'],[12,8,'v']],{chest:{grant:'coins',amount:90}}),
  '2,1':room('Broken Stair',{s:'.',w:'.',n:'y'},[[3,3,'T'],[12,8,'v'],...trench('z',4,6),[1,5,'.'],[2,5,'.'],[1,6,'.'],[2,6,'.'],[8,2,'&'],[8,8,'&']],{
    tablet:['The upper watch is beyond the stair. Bring the grapple; the bridges are gone.'],
    warps:{y:upper},
  }),
  '1,1':room('Blue Watchers',{e:'.',n:'V'},[[3,0,'w'],[12,0,'w'],[4,5,'S'],[11,5,'S'],[8,8,'T']],{switches:{opens:'key-blue',window:7},tablet:['Two eyes, one returning throw. Wake both before their light dies.','The blue vault keeps a fragment of life.']}),
  '1,0':room('Sapphire Vault',{s:'.'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:'heart-piece'}),
  '3,1':room('Eastern Lookout',{s:'.',n:'.'},[[5,3,'t'],[10,8,'g'],[8,5,'S'],[4,8,'v'],[11,3,'v']]),
  '3,0':room('Buried Purse',{s:'.',w:'z'},[[8,4,'c'],[4,3,'F'],[11,3,'F']],{chest:{grant:'coins',amount:120},warps:{y:{area:'d3',screen:[2,0],x:13,z:6,yaw:-Math.PI/2}}}),
  '2,0':room('Powderwright Cell',{e:'y'},[[8,4,'T'],[4,8,'v']],{tablet:['The powderwright sells a larger bag: twenty bombs for two hundred coins.','Bomb the western wall of the lookout treasury to find his workshop.'],spawnsAt:{'8,7':'bomb-upgrader'},warps:{y:{area:'d3',screen:[3,0],x:2.5,z:6,yaw:Math.PI/2}}}),
  '0,3':room('Sleeping Stone',{e:'.'},[[8,4,'c'],[5,7,'b'],[10,7,'b'],[4,3,'v'],[11,3,'v']],{chest:{grant:'coins',amount:60}}),
  // The next floor occupies local rows 5..8, separated by a blank row.
  '2,7':room('Upper Landing',{n:'.',s:'y',w:'.'},[[3,3,'T'],[12,8,'v']],{tablet:['The upper keys and crown lie across the broken bridges. Aim at a striped post from clear floor.'],warps:{y:lower}}),
  '1,7':room('Hook and Guard',{e:'H'},[[5,4,'n'],[10,7,'s'],[8,5,'S'],[4,8,'v'],[11,3,'v']],{clear:'shutters',encounterHint:'A hook stuns a guard without damage. Close the distance, then strike.'}),
  '2,6':room('The Missing Bridge',{s:'.',e:'.',n:'l'},[...trench('z',4,6,'O'),[13,5,'.'],[14,5,'.'],[13,6,'.'],[14,6,'.'],[8,2,'&'],[8,8,'&'],[3,8,'T']],{tablet:['Face north from the southern post. The far post is within six tiles.','Pulling holds your blade and carries you over the pit.']}),
  '3,6':room('Crossing Arsenal',{w:'.',e:'.'},[...trench('x',7,9),[4,6,'&'],[11,6,'&'],[4,3,'t'],[11,8,'t']]),
  '4,6':room('Watchkeeper Crown',{w:'.'},[...trench('z',4,7),[1,5,'.'],[2,5,'.'],[1,6,'.'],[2,6,'.'],[1,7,'.'],[2,7,'.'],[8,2,'c'],[8,9,'&'],[3,2,'F'],[12,2,'F']],{chest:'key-boss'}),
  '2,5':room('Colossus Antechamber',{s:'.',n:'B'},[[8,6,'Z'],[3,8,'Y'],[5,4,'T'],[3,3,'F'],[12,3,'F'],[12,8,'v']],{
    tablet:['Feet, then arms, then the core. Only the glowing parts take damage.','Pale lasers ignore shields. Step out of their marked line. The round slam waves can be guarded.','The final core hops. Keep your distance during its high leap.'],
    warps:{B:{area:'d3-boss',screen:[0,0],x:11,z:13.5,yaw:Math.PI},'3,8':{area:'d3',screen:[2,3],x:11.5,z:8.5,yaw:0}},spawnsAt:{'11,6':'bomb-supply'},
  }),
  '0,5':room('Third Light',{s:'X'},[[8,4,'c'],[3,3,'F'],[12,3,'F']],{chest:'orb-3',spawnsAt:{'4,6':{type:'npc-sage',spell:'spell-quake',grantLines:['The buried watch is quiet. Hear how its stone remembers.','Quake ripples through nearby foes. Save your magic for a crowded fight.'],afterLines:['Three lights awake. Your hook can cross the Sunreach islands.','The final temple road will open beyond them.']}}}),
};
registerArea({id:'d3',name:'The Buried Watch',kind:'dungeon',tileset:'dungeon',lighting:'crypt',camera:'dungeon',rooms:true,origin:[236,0],start:[2,3],entrance:D3_ENTRANCE,keyGroup:'d3',palette:WATCH_PALETTE,spawns:{s:'skeleton',n:'barrow-warden',b:'bat',g:'gazer',t:'turret'},warps:{X:D3_EXIT},screens});
registerArea({id:'d3-boss',name:'Colossus Court',kind:'arena',tileset:'dungeon',lighting:'crypt',camera:'boss',rooms:true,screen:[22,16],at:[244*16,0],entrance:D3_ENTRANCE,keyGroup:'d3',palette:WATCH_PALETTE,screens:{'0,0':{
  name:'Colossus Court',spawnsAt:{'11,4':{type:'boss-colossus',dungeon:'d3'},'11,11':{type:'colossus-tombstone',dungeon:'d3'}},warps:{'10,0':{area:'d3',screen:[0,5],x:8,z:9,yaw:Math.PI},'11,0':{area:'d3',screen:[0,5],x:8,z:9,yaw:Math.PI},'10,15':{area:'d3',screen:[2,5],x:8,z:2,yaw:0},'11,15':{area:'d3',screen:[2,5],x:8,z:2,yaw:0}},
  rows:Array.from({length:16},(_,z)=>z===0||z===15?'WWWWWWWWWWUUWWWWWWWWWW':z===2||z===13?'W.F................F.W':'W....................W'),
}}});

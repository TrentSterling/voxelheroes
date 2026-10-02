import { registerArea } from '../areas.js';
import { registerPlace } from '../../game/places.js';
export const D4_ENTRANCE={area:'d4',screen:[2,3],x:8,z:10.3,yaw:Math.PI};
export const D4_EXIT={area:'tidecoast',screen:[1,0],x:8,z:9,yaw:0};
const screen=(name,doors,props=[],extra={})=>{
  const rows=Array.from({length:16},(_,z)=>Array.from({length:16},(_,x)=>x===0||x===15||z===0||z===15?'#':'.'));
  for(let z=1;z<15;z++)for(let x=1;x<15;x++)if(x===7||x===8||z===8)rows[z][x]=x===8?'u':(x+z)%5===0?'a':z===8?'e':'j';
  for(const side of doors)for(let k=6;k<=9;k++)rows[side==='n'?0:side==='s'?15:k][side==='w'?0:side==='e'?15:k]='.';
  for(const [x,z,ch]of props)rows[z][x]=ch;return {name,...extra,rows:rows.map(r=>r.join(''))};
};
registerArea({id:'tidecoast',name:'Brineglass Coast',kind:'overworld',tileset:'tidecoast',lighting:'day',camera:'A',screen:[16,16],origin:[15,3],start:[0,1],
  groundPalette:{grass:[0x88b5aa,0x669a90,0xafd1bd],sand:[0xd9d4b0,0xb7b99b,0xeee6c8]},spawns:{G:{type:'group',of:['archer','leaper','buzzer'],count:[1,2]}},screens:{
    '0,1':screen('Hookshore Landing',['w','n','e','s'],[[5,5,'i'],[10,11,'G'],[3,11,'v'],[11,4,'T'],[12,4,'T'],[12,3,'T']],{
      signs:{'5,5':['The post islands are behind you. The tide temple lies northeast.','The water keeper keeps an ember wand. Fire wakes the temple lamps and thaws its ice.']},
      spawnsAt:{'5,9':{type:'npc-mara',name:'Keeper Mara'}},
    }),
    '0,0':screen('Shellwatch Bluff',['s','e'],[[8,8,'C'],[4,5,'G'],[12,11,'G'],[3,3,'R'],[4,3,'R']],{chest:{grant:'coins',amount:100}}),
    '1,1':screen('Tide Garden',['w','n','e','s'],[[4,4,'T'],[4,5,'T'],[12,11,'T'],[5,9,'G'],[11,4,'G'],[7,7,'~'],[8,7,'~'],[9,7,'~'],[9,8,'~'],[3,11,'v'],[12,3,'v']]),
    '1,0':screen('The Brineglass Temple',['w','s'],[[8,6,'D'],[7,6,'#'],[9,6,'#'],[6,5,'#'],[7,5,'#'],[8,5,'#'],[9,5,'#'],[10,5,'#'],[4,10,'v'],[11,10,'v'],[4,3,'G']],{warps:{D:D4_ENTRANCE}}),
    '2,1':screen('The Charred Orchard',['w'],[[5,5,'i'],[13,8,'C'],...Array.from({length:14},(_,i)=>[8,i+1,i===6||i===7?';':'#'])],{chest:'heart-piece',signs:{'5,5':['The old trees cannot be cut. Ember fire clears the path.','A fragment of life waits beyond the orchard.']}}),
    '1,2':screen('Pilgrim Strand',['n','e','w'],[[5,5,'G'],[11,10,'G'],[8,7,'i'],[3,11,'v'],[12,4,'R']],{signs:{'8,7':['Four temple lights wake the old tower.','The pilgrim road follows the shore to the east.']}}),
    '0,2':screen('The Last Shore Light',['n','e'],[[8,5,'{'],[8,7,':'],[8,8,':'],[5,11,'i'],[3,4,'R'],[12,4,'R'],[3,12,'v'],[12,12,'v']],{signs:{'5,11':['The keeper left one light for tomorrow. The upper temple kiln holds its missing Ember Lens.','Fire melts the ice. With the lens, one bolt melts two blocks. Send the next flame into the beacon, then look for its memorial in the Silent Year.']}}),
    '2,2':screen('The Fourfold Tower',['w'],[[5,5,'i'],[8,2,'@'],[5,9,'G'],[11,9,'G'],[7,3,';'],[8,3,';'],[9,3,';'],[4,12,'v']],{signs:{'5,5':['Four temple lights open this tower. Burn the old trees and enter beneath the four jewels.','Survive its first reflection. Three memories and the hollow crown wait above.']},warps:{'@':{area:'tower-trial',screen:[0,0],x:11,z:13,yaw:Math.PI}}}),
  },
});
registerPlace({id:'tidecoast',name:'Brineglass Coast',kind:'other',order:50,area:'tidecoast',spot:{area:'tidecoast',screen:[0,1],x:5,z:9,yaw:0}});

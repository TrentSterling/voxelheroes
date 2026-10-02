import { registerArea } from '../areas.js';
import { registerPlace } from '../../game/places.js';
import { registerInn } from '../../game/services.js';

export const D3_ENTRANCE = { area: 'd3', screen: [2,3], x: 8, z: 10.3, yaw: Math.PI };
export const D3_EXIT = { area: 'sunreach', screen: [2,0], x: 8, z: 9, yaw: 0 };
const camp = { area: 'sunreach', screen: [1,1], x: 5, z: 10, yaw: 0 };
const screen = (name, doors, props = [], extra = {}) => {
  const seed=[...name].reduce((n,ch)=>n+ch.charCodeAt(0),0);
  const rows = Array.from({length:16},(_,z)=>Array.from({length:16},(_,x)=>x===0||x===15||z===0||z===15?'#':(x===7||x===8)&&(name==='Sunken Meridian'||z<5)?'f':(x*3+z+seed)%31===0?'o':(x+z*3+seed)%19===0?'j':name==='Sandglass Oasis'&&z>9&&x<6?'a':'s'));
  for (const side of doors) for(let k=6;k<=9;k++) rows[side==='n'?0:side==='s'?15:k][side==='w'?0:side==='e'?15:k]='s';
  for(const [x,z,ch] of props) rows[z][x]=ch;
  return {name,...extra,rows:rows.map(r=>r.join(''))};
};
registerArea({
  id:'sunreach',name:'Sunreach Basin',kind:'overworld',tileset:'sunreach',lighting:'day',camera:'A',screen:[16,16],origin:[12,3],start:[0,1],
  groundPalette:{sand:[0xdab47a,0xbf9460,0xf0cf8d],grass:[0x7c9a69,0x617c51,0x9cb886]},
  spawns:{G:{type:'group',of:['archer','leaper'],count:[1,2]}},
  screens:{
    '0,1':screen('Dustfall Road',['w','e'],[[4,4,'G'],[4,11,'v'],[11,5,'R'],[11,10,'R'],[5,6,'i'],...Array.from({length:14},(_,i)=>[8,i+1,i===6||i===7?'!':'#'])],{
      signs:{'5,6':['Sunreach road. Fallen stone blocks the old caravan route.','A bomb clears the stone. The oasis inn is beyond; the sand temple stands northeast.']},
      spawnsAt:{'3,9':'bomb-supply'},
    }),
    '1,1':screen('Sandglass Oasis',['w','n','e'],[[4,5,'i'],[10,3,'T'],[11,3,'T'],[10,4,'T'],[4,12,'v'],[10,12,'v'],[8,7,'~'],[9,7,'~'],[10,7,'~'],[8,8,'~'],[9,8,'~'],[10,8,'~']],{
      spawnsAt:{'4,9':{type:'npc-inn',inn:'inn-2',name:'Innkeeper Sella'},'12,10':{type:'npc',name:'Caravanner Roan',lines:['The old temple is northeast, beyond the dry river.','Striped posts catch a hook. The old keeper left his grapple inside the temple.']}},
      signs:{'4,5':'Sandglass Inn: a bed, a refill, and a place to return. The temple road leads north.'},
    }),
    '1,0':screen('Dry River Crossing',['s','e'],[[4,4,'G'],[11,11,'G'],[3,11,'v'],[12,4,'v'],[5,3,'R'],[5,4,'R'],[10,10,'R'],[10,11,'R'],...Array.from({length:14},(_,i)=>[i+1,7,i===6||i===7?'=':'~'])]),
    '2,0':screen('The Buried Watch',['w','s'],[[8,6,'D'],[7,6,'#'],[9,6,'#'],[6,5,'#'],[7,5,'#'],[8,5,'#'],[9,5,'#'],[10,5,'#'],[4,10,'v'],[11,10,'v'],[4,3,'G'],[12,12,'G']],{warps:{D:D3_ENTRANCE}}),
    '2,1':screen('Post Islands',['w','n','s','e'],[[5,5,'i'],[12,8,'&'],[13,8,'C'],[8,8,'&'],...Array.from({length:16},(_,i)=>[10,i,'~'])],{
      chest:{grant:'coins',amount:100},signs:{'5,5':['No bridge to the eastern island. Hook the striped post from this bank.','The watchkeeper hid coin caches in places only his grapple could reach.']},
    }),
    '2,2':screen('Quiet Dunes',['n','s'],[[5,5,'G'],[11,10,'G'],[4,10,'v'],[11,4,'v'],[8,9,'C'],[3,3,'R'],[12,12,'R']],{chest:{grant:'coins',amount:65}}),
    '2,3':screen('Sunken Meridian',['n'],[[5,3,'i'],[8,4,'&'],[8,13,'&'],[11,13,'C'],[3,4,'R'],[12,3,'R'],
      ...Array.from({length:6},(_,i)=>Array.from({length:14},(_,k)=>[k+1,i+6,'~'])).flat()],{
      chest:'heart-piece',signs:{'5,3':['SUNREACH TRANSIT: service suspended. The last train carried the whole town across this basin. Nobody wound the clock again.','The far anchor is beyond an ordinary chain. Find the Sun Dial west of the upper Watch landing; it extends your grapple to eight tiles.','Cast south from the edge of this bank. A fragment of the keeper\'s good luck waits beyond the drowned platform.']},
    }),
  },
});
registerPlace({id:'sunreach',name:'Sunreach Basin',kind:'other',order:40,area:'sunreach',spot:camp});
registerPlace({id:'inn-2',name:'Sandglass Inn',kind:'inn',order:41,area:'sunreach',spot:camp});
registerInn({id:'inn-2',name:'Sandglass Inn',place:'inn-2',price:30,bed:camp});

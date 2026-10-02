import { registerArea } from '../areas.js';
import { FAIR } from '../../systems/clockfair.js';
const rows=Array.from({length:16},(_,z)=>Array.from({length:16},(_,x)=>x===0||x===15||z===0||z===15?'#':x>=6&&x<=9?'p':z<10?'.':'o'));
FAIR.bells.forEach(([x,z],i)=>rows[z][x]=String(i+1));FAIR.pots.forEach(([x,z])=>rows[z][x]='v');
rows[13][7]='B';rows[15][7]='X';rows[15][8]='Y';for(const x of[2,4,11,13])for(const z of[10,11])rows[z][x]='u';
registerArea({id:'mossbrook-fair',name:'Mossbrook Clockfair',kind:'interior',tileset:'clockfair',lighting:'day',music:'village',camera:'dungeon',rooms:true,screen:[16,16],at:[6200,300],screens:{'0,0':{name:'The Bells We Borrow',rows:rows.map(r=>r.join('')),spawnsAt:{'7,5':{type:'fair-clock',spawnDelay:0}},warps:{'7,15':{area:'v1',screen:[1,1],x:11.1,z:10.5,yaw:-Math.PI/2},'8,15':{area:'v1',screen:[1,1],x:11.1,z:10.5,yaw:-Math.PI/2}}}}});

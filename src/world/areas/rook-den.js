import { registerArea } from '../areas.js';
import { registerPlace } from '../../game/places.js';

registerArea({
  id:'rook-den',name:'Briar Den',kind:'cave',tileset:'rook-den',lighting:'crypt',camera:'dungeon',rooms:true,
  screen:[16,12],at:[300*16,90],start:[0,2],entrance:{screen:[0,2],x:7.5,z:9.5,yaw:Math.PI},
  warps:{X:{area:'v1',screen:[0,1],x:3.5,z:4.6,yaw:0}},
  screens:{
    '0,2':{name:'Hunter\'s Bench',chest:'bow',spawnsAt:{'5,5':{type:'skeleton',once:true},'11,6':{type:'archer',once:true}},rows:[
      'WWWWWWWddWWWWWWW',
      'W..F........F..W',
      'W..............W',
      'W...S......S...W',
      'W..............W',
      'W.v..........v.W',
      'W..............W',
      'W.&............W',
      'W..............W',
      'W..F........F..W',
      'W..............W',
      'WWWWWWWXXWWWWWWW',
    ]},
    '0,1':{name:'The Arrow Span',rows:[
      'WWWWWWW..WWWWWWW',
      'W..F........F..W',
      'W....%....%....W',
      'W..............W',
      'WOOOOOOOOOOOOOOW',
      'WOOOOOOOOOOOOOOW',
      'WOOOOOOOOOOOOOOW',
      'W.&..........v.W',
      'W..............W',
      'W..F........F..W',
      'W..............W',
      'WWWWWWW..WWWWWWW',
    ]},
    '0,0':{name:'The Dice Vault',chest:'rook-dice',spawnsAt:{'8,5':{type:'barrow-warden',once:true},'11,3':{type:'archer',once:true}},rows:[
      'WWWWWWWWWWWWWWWW',
      'W..F........F..W',
      'W..............W',
      'W...S......S...W',
      'W..............W',
      'W..............W',
      'W..............W',
      'W.&............W',
      'W..............W',
      'W.v..........v.W',
      'W..............W',
      'WWWWWWW..WWWWWWW',
    ]},
  },
});
registerPlace({id:'rook-den',name:'Briar Den',kind:'cave',order:62,
  spot:{area:'v1',screen:[0,1],x:3.5,z:3.5,yaw:0},area:'rook-den'});

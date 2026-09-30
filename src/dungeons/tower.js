import { registerDungeon } from '../game/dungeons.js';
import { registerPlace } from '../game/places.js';
import { registerMusic } from '../game/music.js';
import { TOWER_ENTRY,TOWER_EXIT } from '../world/areas/tower.js';
registerDungeon({id:'tower-trial',name:'The First Reflection',areas:['tower-trial'],entrance:TOWER_ENTRY,exit:TOWER_EXIT,boss:'boss-bishop',bossRoom:'tower-trial:0,0',canvas:[1,1]});
for(const[id,name,boss]of[['tower-hive','Amber Memory','boss-queen'],['tower-watch','Sand Memory','boss-colossus'],['tower-tide','Tide Memory','boss-beast'],['tower-crown','Fourfold Crown','boss-king']]){
 registerDungeon({id,name,areas:[id,id==='tower-crown'?'tower-final':id+'-boss'],entrance:{area:id,screen:[1,2],x:8,z:9.5,yaw:Math.PI},exit:TOWER_EXIT,keyGroup:id,boss,bossRoom:(id==='tower-crown'?'tower-final':id+'-boss')+':0,0',smallKeys:id==='tower-crown'?0:1,music:'tower',canvas:[2,3]});
}
registerMusic({id:'tower',name:'The Fourfold Tower'});
registerPlace({id:'tower',name:'Fourfold Tower',kind:'dungeon',order:105,area:'tower-trial',spot:TOWER_EXIT});

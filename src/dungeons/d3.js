import { registerDungeon } from '../game/dungeons.js';
import { registerPlace } from '../game/places.js';
import { registerMusic } from '../game/music.js';
import { D3_ENTRANCE, D3_EXIT } from '../world/areas/desert.js';
registerDungeon({id:'d3',number:3,name:'The Buried Watch',areas:['d3','d3-boss'],entrance:D3_ENTRANCE,exit:D3_EXIT,keyGroup:'d3',boss:'boss-colossus',bossRoom:'d3-boss:0,0',tool:'grapple',smallKeys:2,music:'dungeon-3',canvas:[5,4],floors:2});
registerMusic({id:'dungeon-3',name:'The Buried Watch'});
registerPlace({id:'d3',name:'The Buried Watch',kind:'dungeon',order:103,area:'d3',spot:D3_EXIT});

import { registerDungeon } from '../game/dungeons.js';
import { registerPlace } from '../game/places.js';
import { registerMusic } from '../game/music.js';
import { D4_ENTRANCE,D4_EXIT } from '../world/areas/coast.js';
registerDungeon({id:'d4',number:4,name:'Brineglass Temple',areas:['d4','d4-boss'],entrance:D4_ENTRANCE,exit:D4_EXIT,keyGroup:'d4',boss:'boss-beast',bossRoom:'d4-boss:0,0',tool:'fire-wand',smallKeys:4,music:'dungeon-4',canvas:[5,4],floors:2});
registerMusic({id:'dungeon-4',name:'Brineglass Temple'});
registerPlace({id:'d4',name:'Brineglass Temple',kind:'dungeon',order:104,area:'d4',spot:D4_EXIT});

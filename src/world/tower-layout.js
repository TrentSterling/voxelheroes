export function towerRoomStyle(name){
  if(name.includes('Rest'))return 'rest';
  if(name.includes('Gate'))return 'mechanism';
  if(name.includes('Crown')||name.includes('Light Above')||name==='The Last Door')return 'ceremony';
  return 'gallery';
}
export function towerFloor(style,x,z,w=16,h=12){
  const border=x===1||x===w-2||z===1||z===h-2;
  if(border)return 'q';
  if(style==='rest')return x>=5&&x<=10&&z>=3&&z<=8?'e':x===7||x===8?'b':'i';
  if(style==='mechanism')return x===3||x===12?'j':x===7||x===8?'b':z===3||z===h-4?'q':'i';
  if(style==='ceremony')return x>=5&&x<=10&&z>=3&&z<=8?'m':x===3||x===12?'e':'b';
  return x===7||x===8?'i':z===2||z===h-3?'e':'b';
}

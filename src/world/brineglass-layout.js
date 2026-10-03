// Room floors describe use and history: clear lanes, a chart inlay, fired clay,
// drained works and quiet ceremonial stone. Props and collision stay authored
// separately, so a decorative plan cannot move a key, post or doorway.
const groups={
  charts:['Tide Charts'],
  kiln:['Ember Cache','Twin Ember Bowls','The Ember Gate','Kiln of the First Light'],
  sluice:['Sluice Counterweight','The Stillwater Gift','Crosscurrents','The Flood Stair','The Tide Bridge'],
  ice:['First Thaw','The Frozen Secret','Cooled Glass Hall'],
  sanctum:['The Warden Legacy','Ash Treasury','The Deep Powder Bag','The Tidekeeper Shield','Crown of the Tide','Fourth Light'],
};
const styles=new Map(Object.entries(groups).flatMap(([style,names])=>names.map(name=>[name,style])));
export const brineglassStyle=name=>styles.get(name)??'gallery';
export function brineglassFloor(style,x,z,w=16,h=12){
  const border=x===1||x===w-2||z===1||z===h-2;
  if(style==='charts')return border?'q':x>=5&&x<=10&&z>=3&&z<=8?'m':x===3||x===12?'a':'d';
  if(style==='kiln')return border?'j':x===7||x===8?'u':z===2||z===h-3?'q':'k';
  if(style==='sluice')return border?'e':x===7||x===8?'j':x===4||x===11?'a':'i';
  if(style==='ice')return border?'p':x===7||x===8?'a':z===2||z===h-3?'e':'b';
  if(style==='sanctum')return border?'q':x>=5&&x<=10&&z>=3&&z<=8?'m':x===3||x===12?'o':'b';
  // Quiet salt courses carry the four weathered accents in the entrance.
  // Each accent occupies a small patch instead of repeating on every row.
  if(x===7||x===8)return 'u';
  if(z===2||z===h-3)return 'e';
  if(x===3&&z===4)return 'a';
  if(x===12&&z===4)return 'j';
  if(x===4&&z===7)return 'o';
  if(x===11&&z===7)return 'p';
  return 'b';
}

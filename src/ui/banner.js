// The big title that fades in and out when you enter a screen or find something.
//
// systems/transitions.js names every screen it enters (screen.name); banner
// discipline (fun audit: banners were spamming every screen change) shows
// that big one only the first time in a new area, never again on a screen
// or room crossed inside it. The small corner name (ui/hud.js's 'area'
// widget) is unaffected: it updates on every screen regardless. Anything
// else that calls this (a key found, a boss's name, a locked door) always
// shows; only a screen's own name is ever held back, and only once its area
// is no longer new.
import { state } from '../core/state.js';
import { currentScreen } from '../world/world.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';
import { fadeLevel } from './overlay.js';
import { hudView } from './hud.js';
import { rewardViewportBounds } from '../core/presentation.js';

const LIFE = 2300; // ms on screen: in over the first 15%, out over the last 25%
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let shown = null; // { text, t0 }
let layout = [];
const live = (now) => !!shown && now - shown.t0 < LIFE;

export function showBanner(text, { reward = false } = {}) {
  const screen = currentScreen();
  const isScreenName = screen && text === screen.name;
  if (isScreenName && state.visitedAreas.has(screen.area.id)) return; // seen this area already: hold back the repeat
  // First step into a new area: announce the area (Barrowfield, Crownhold), not
  // whichever of its screens the hero happened to cross into (Cliff Hollow,
  // West Pasture, ...): the name the player actually recognizes from the
  // objective line and the map.
  if (isScreenName && screen.area.name) text = screen.area.name;
  shown = { text, reward, t0: performance.now() };
  layout = [];
  requestUi();
}

// What the banner says now, for tests: the last text shown and whether it is still up.
export const bannerView = () => ({ text: shown?.text ?? '', visible: live(performance.now()), layout: layout.map(r=>({...r})) });

// Drawn in the UI canvas (ui/canvas/gfx.js), in large letters a fifth of the way down.
registerUiPart({
  id: 'banner',
  order: 40,
  key: () => (live(performance.now()) ? state.mode+'|'+shown.text : '-'),
  busy: live,
  draw(g) {
    layout = [];
    // The treasure pose locks actions already; give its caption the same
    // unobstructed space as dialogue on short touch screens.
    document.body.classList.toggle('reward-caption', live(g.now) && !!shown.reward && ['play','get-item'].includes(state.mode));
    if (!live(g.now)||!['play','boss-intro','get-item'].includes(state.mode)) return;
    const k = (g.now - shown.t0) / LIFE;
    const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    const dy = k < 0.15 ? Math.round(4 * (1 - k / 0.15)) : k > 0.75 ? -Math.round((3 * (k - 0.75)) / 0.25) : 0;
    g.alpha(a * (1 - fadeLevel()));
    const compact=coarse&&g.h<200;
    const size=(shown.reward&&g.w<300)||compact?1:2;
    const lineH=size===1?11:20;
    let lines=g.wrap(shown.text,Math.min(compact?84:Infinity,g.w-g.safe.l-g.safe.r-24),size,1);
    let x=g.w/2;
    const belowHud=Math.max(g.safe.t+72,...hudView().widgets.map(w=>w.y+w.h+8));
    let y=Math.max(Math.round(g.h*(shown.reward ? .72 : .22)),belowHud);
    const prize=shown.reward&&rewardViewportBounds();
    let textH=(lines.length-1)*lineH+g.cap*size;
    if(prize&&y+dy<prize.bottom*g.h&&y+dy+textH>prize.top*g.h){
      const above=Math.floor(prize.top*g.h)-textH-8-dy;
      y=above>=belowHud?above:Math.ceil(prize.bottom*g.h)+8-dy;
    }
    if(prize&&compact&&y+dy+textH>g.h-g.safe.b-4){
      // Short landscape has room beside the prize, while both above and
      // below can be occupied. Keep the complete caption in that column.
      const column=Math.max(32,Math.floor(prize.left*g.w)-g.safe.l-20);
      const width=Math.min(84,column);
      lines=g.wrap(shown.text,width,size,1);
      textH=(lines.length-1)*lineH+g.cap*size;
      x=g.safe.l+8+width/2;
      y=Math.min(Math.max(belowHud,Math.ceil(prize.top*g.h)),g.h-g.safe.b-textH-6)-dy;
    }
    lines.forEach((line,i)=>{
      const w=g.measure(line.text,size,1),ty=y+dy+i*lineH;
      layout.push({x:Math.round(x-w/2),y:ty,w,h:g.cap*size});
      g.text(line.text,x,ty,{size,align:'center',tracking:1,color:COLORS.ink,outline:COLORS.shade});
    });
  },
});

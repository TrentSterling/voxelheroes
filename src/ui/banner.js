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

const LIFE = 2300; // ms on screen: in over the first 15%, out over the last 25%
let shown = null; // { text, t0 }
const live = (now) => !!shown && now - shown.t0 < LIFE;

export function showBanner(text) {
  const screen = currentScreen();
  const isScreenName = screen && text === screen.name;
  if (isScreenName && state.visitedAreas.has(screen.area.id)) return; // seen this area already: hold back the repeat
  // First step into a new area: announce the area (Barrowfield, Crownhold), not
  // whichever of its screens the hero happened to cross into (Cliff Hollow,
  // West Pasture, ...): the name the player actually recognizes from the
  // objective line and the map.
  if (isScreenName && screen.area.name) text = screen.area.name;
  shown = { text, t0: performance.now() };
  requestUi();
}

// What the banner says now, for tests: the last text shown and whether it is still up.
export const bannerView = () => ({ text: shown?.text ?? '', visible: live(performance.now()) });

// Drawn in the UI canvas (ui/canvas/gfx.js), in large letters a fifth of the way down.
registerUiPart({
  id: 'banner',
  order: 40,
  key: () => (live(performance.now()) ? shown.text : '-'),
  busy: live,
  draw(g) {
    if (!live(g.now)) return;
    const k = (g.now - shown.t0) / LIFE;
    const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    const dy = k < 0.15 ? Math.round(4 * (1 - k / 0.15)) : k > 0.75 ? -Math.round((3 * (k - 0.75)) / 0.25) : 0;
    g.alpha(a * (1 - fadeLevel()));
    g.text(shown.text, g.w / 2, Math.round(g.h * 0.22) + dy, { size: 2, align: 'center', tracking: 1, color: COLORS.ink, outline: COLORS.shade });
  },
});

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
import { $ } from './dom.js';

let bannerTimer = 0;

export function showBanner(text) {
  const screen = currentScreen();
  if (screen && text === screen.name && state.visitedAreas.has(screen.area.id)) return;
  const b = $('banner');
  b.hidden = true;
  b.textContent = text;
  void b.offsetWidth; // restart the CSS animation
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (b.hidden = true), 2300);
}

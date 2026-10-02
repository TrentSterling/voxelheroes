// Drawing and camera composition share current shortcut geometry. Hit regions
// are rebuilt during a draw, so earlier HUD parts cannot read them as layout.
import { state } from '../core/state.js';
import { overlayView } from './overlay.js';

// Keep geometry readable from the HUD without importing the transport and hero.
// The party screen binds its live reader before the first rendered frame.
let readParty = () => ({ active: false, count: 0 });
export function setPartyShortcutReader(reader) { readParty = reader; }

export function partyShortcutLayout(g) {
  if (!['title', 'play', 'paused'].includes(state.mode)) return null;
  const view = readParty(), label = view.active ? `Party ${view.count}/8` : 'Play with friends';
  const y = state.mode === 'title' ? overlayView().titlePartyY ?? g.safe.t + 10 : g.safe.t + (state.mode === 'play' ? 36 : 10);
  return { id: 'party-open', label, x: g.w - g.safe.r - g.measure(label) - 24, y, ...g.buttonMetrics(label) };
}

export function journalShortcutLayout(g) {
  if (state.mode !== 'play') return null;
  const label = 'Journal';
  return { id: 'journal-open', label, x: g.w - g.safe.r - g.measure(label) - 24, y: g.safe.t + 52, ...g.buttonMetrics(label) };
}

export function playShortcutBounds(g) {
  if (state.mode !== 'play') return [];
  return [partyShortcutLayout(g), journalShortcutLayout(g)].map(({ id, x, y, w, h }) =>
    ({ id, x: Math.round(x - 3), y: Math.round(y - 3), w: Math.round(w + 6), h: Math.round(h + 6) }));
}

// A short line of feedback at the bottom of the view ("No item selected"), for buttons that do
// nothing yet, so a press is never silent. The same text is not repeated within 2.5 s.
//
// Every call site fires from play (a button pressed with nothing to do, a gift or a
// friendship tick that only ever lands once a conversation has closed), but the bottom
// anchor sits right where a dialog's or a menu's choice list draws (fun audit: a toast
// painted over the smith's options). So the toast holds off while anything is open over
// play, and a toast already showing when one opens is dismissed rather than left floating
// on top of it.
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';

const FADE = 200; // ms in and out
let cur = null; // { text, t0, until }
const lastShown = new Map();
const live = (now) => !!cur && now < cur.until + FADE;

on('mode-change', ({ to }) => {
  if (to !== 'play' && cur) {
    cur = null;
    requestUi();
  }
});

export function toast(text, seconds = 1.6) {
  if (typeof document === 'undefined') return;
  if (state.mode !== 'play') return; // never over a dialog's or a menu's choice list
  const now = performance.now();
  if (now - (lastShown.get(text) ?? -1e9) < 2500) return;
  lastShown.set(text, now);
  cur = { text, t0: now, until: now + seconds * 1000 };
  requestUi();
}

// What the toast says now, for tests.
export const toastView = () => ({ text: cur?.text ?? '', visible: !!cur && performance.now() < cur.until });

// Drawn in the UI canvas: a small plate low in the view, fading in and out.
registerUiPart({
  id: 'toast',
  order: 30,
  key: () => (live(performance.now()) ? cur.text : '-'),
  busy: live,
  draw(g) {
    if (!live(g.now)) return;
    const a = Math.min(1, (g.now - cur.t0) / FADE, (cur.until + FADE - g.now) / FADE);
    g.alpha(a);
    const lines = g.wrap(cur.text, Math.max(24, g.w - g.safe.l - g.safe.r - 32));
    const w = Math.max(...lines.map(line => g.measure(line.text))) + 16;
    const h = 4 + lines.length * 11;
    const y = g.h - 36 - g.safe.b - h;
    g.panel((g.w - w) / 2, y, w, h, { shadow: false });
    lines.forEach((line, i) => g.text(line.text, g.w / 2, y + 4 + i * 11, { align: 'center', color: COLORS.ink }));
  },
});

// The centred panel used by the title, pause and game-over screens, drawn in the UI canvas
// (ui/canvas/gfx.js), and the full-screen black fade used by warps (a plain DOM div: it has no text).
//
// The title's panel is a compact bar along the bottom so the scene is the first thing you see; the
// pause and game-over panels sit in the middle over a dimmed view.
import { state } from '../core/state.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';
import { $ } from './dom.js';

let panel = null; // { title, msg, button, kicker, onAction, secondary, controls }
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

// onAction runs when the panel's main button is pressed. secondary, when given
// ({ label, onAction }), shows a second, lesser button beside it (the title
// screen's "New adventure" next to Continue); left out, that button hides.
// controls, when given ([[label, keys], ...]), lists the keys under the buttons (the title).
export function showOverlay({ title, msg, button, kicker, onAction = null, secondary = null, controls = null }) {
  panel = { title, msg, button, kicker, onAction, secondary, controls };
  requestUi();
}

// Keep the panel's current content but change what its button does.
export function setOverlayAction(onAction) {
  if (panel) panel.onAction = onAction;
}

export function hideOverlay() {
  panel = null;
  requestUi();
}

export const overlayVisible = () => panel !== null;

// What the panel says, for tests (the ui may restyle it but keeps these
// answers): { visible, title, message, button }. The game-over message names
// where the hero will get up.
export const overlayView = () => ({
  visible: panel !== null,
  title: panel?.title ?? '',
  message: panel?.msg ?? '',
  button: panel?.button ?? '',
  secondary: panel?.secondary?.label ?? null,
});

// k: 0 (clear) to 1 (black). at: [x, y] in CSS px of the view, an iris closing on that point (the
// SNES-style wipe onto the hero); without it, or fully open or shut, a plain fade.
let fadeK = 0;
let iris = false;
export const fadeLevel = () => fadeK; // the canvas HUD fades with the black
// The loading card clears ahead of an iris opening (ui/loadcard.js); on a plain fade it just rides the black.
export const cardAlpha = () => (iris ? Math.max(0, 2 * fadeK - 1) : fadeK);

export function setFade(k, at = null) {
  fadeK = Math.max(0, Math.min(1, k));
  iris = !!at && k > 0 && k < 1;
  const el = $('fade');
  if (!at || k <= 0 || k >= 1) {
    el.style.background = '#000';
    el.style.opacity = String(fadeK);
    return;
  }
  const w = el.clientWidth, h = el.clientHeight;
  const R = Math.hypot(Math.max(at[0], w - at[0]), Math.max(at[1], h - at[1])); // to the far corner
  const r = R * (1 - k);
  el.style.background = `radial-gradient(circle at ${at[0].toFixed(1)}px ${at[1].toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + 1.5).toFixed(1)}px)`;
  el.style.opacity = '1';
}

// ---------------------------------------------------------------- drawing
// A dialog box open over the panel has to be answered first.
const press = (which) => () => {
  if (state.mode === 'dialog') return;
  (which === 'main' ? panel?.onAction : panel?.secondary?.onAction)?.();
};

function drawTitle(g) {
  // a dark wash rising from the bottom, so the key art above stays clear
  for (let i = 0; i < 24; i++) {
    const a = 0.88 * Math.max(0, 1 - i / 15);
    if (a <= 0) break;
    g.rect(0, g.h - (i + 1) * Math.ceil(g.h / 40), g.w, Math.ceil(g.h / 40), `rgba(8, 17, 13, ${a.toFixed(3)})`);
  }
  const pw = Math.min(g.w - 16 - g.safe.l - g.safe.r, 520);
  const inner = pw - 24;
  const lines = g.wrap(panel.msg, inner);
  const showControls = panel.controls && !coarse;
  // the controls flow as "Move WASD or arrows" chips, wrapping
  const chips = [];
  let cx = 0;
  let rows = 1;
  if (showControls) {
    for (const [label, keys] of panel.controls) {
      const w = g.measure(label) + 4 + g.measure(keys);
      if (cx > 0 && cx + w > inner) {
        cx = 0;
        rows++;
      }
      chips.push({ label, keys, x: cx, row: rows - 1 });
      cx += w + 14;
    }
  }
  const h = 12 + 12 + lines.length * 11 + 8 + 17 + 6 + (showControls ? 6 + rows * 10 : 0) + 8;
  const x = Math.round((g.w - pw) / 2);
  const y = g.h - 8 - g.safe.b - h;
  g.panel(x, y, pw, h, { accent: true });
  let ty = y + 10;
  g.text(panel.kicker.toUpperCase(), x + 12, ty, { color: COLORS.gold, tracking: 1 });
  ty += 12;
  for (const line of lines) {
    g.text(line.text, x + 12, ty, { color: COLORS.ink, shadow: COLORS.shade });
    ty += 11;
  }
  ty += 8;
  const bw = g.primary('overlay-start', panel.button, x + 12, ty, press('main'));
  if (panel.secondary) g.button('overlay-secondary', panel.secondary.label, x + 12 + bw + 12, ty, press('secondary'), { pad: 8 });
  ty += 17 + 6;
  for (const c of chips) {
    const cy = ty + 6 + c.row * 10;
    g.text(c.label, x + 12 + c.x, cy, { color: COLORS.muted });
    g.text(c.keys, x + 12 + c.x + g.measure(c.label) + 4, cy, { color: COLORS.ink });
  }
}

function drawMiddle(g) {
  g.rect(0, 0, g.w, g.h, 'rgba(8, 17, 13, 0.72)');
  const pw = Math.min(g.w - 24, 300);
  const inner = pw - 32;
  const lines = g.wrap(panel.msg, inner);
  const h = 14 + 12 + 6 + 20 + 8 + lines.length * 11 + 12 + 17 + 14;
  const x = Math.round((g.w - pw) / 2);
  const y = Math.round((g.h - h) / 2);
  g.panel(x, y, pw, h, { accent: true });
  let ty = y + 14;
  g.text(panel.kicker.toUpperCase(), g.w / 2, ty, { align: 'center', color: COLORS.gold, tracking: 1 });
  ty += 18;
  g.text(panel.title, g.w / 2, ty, { size: 2, align: 'center', color: COLORS.ink, shadow: COLORS.shade });
  ty += 20 + 8;
  for (const line of lines) {
    g.text(line.text, g.w / 2, ty, { align: 'center', color: COLORS.muted });
    ty += 11;
  }
  ty += 12;
  const bw = g.measure(panel.button) + 20;
  const sw = panel.secondary ? g.measure(panel.secondary.label) + 16 + 12 : 0;
  const bx = Math.round((g.w - (bw + sw)) / 2);
  g.primary('overlay-start', panel.button, bx, ty, press('main'));
  if (panel.secondary) g.button('overlay-secondary', panel.secondary.label, bx + bw + 12, ty, press('secondary'), { pad: 8 });
}

registerUiPart({
  id: 'overlay',
  order: 60,
  key: () => (panel ? `${state.mode === 'title'}|${panel.title}|${panel.button}|${panel.secondary?.label ?? ''}` : '-'),
  draw(g) {
    if (!panel) return;
    if (state.mode === 'title') drawTitle(g);
    else drawMiddle(g);
  },
});

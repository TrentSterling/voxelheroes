// The centred panel used by the title, pause and game-over screens, drawn in the UI canvas
// (ui/canvas/gfx.js), and the full-screen black fade used by warps (a plain DOM div: it has no text).
//
// The title's panel is a compact bar along the bottom so the scene is the first thing you see; the
// pause and game-over panels sit in the middle over a dimmed view.
import { state } from '../core/state.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';
import { $ } from './dom.js';

let panel = null; // { title, msg, button, kicker, onAction, secondary, controls }
let titlePartyY = null;
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
  titlePartyY: state.mode === 'title' ? titlePartyY : null,
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
  const kickerLines=g.h<180?[{text:g.fit(panel.kicker.toUpperCase(),inner,1,1)}]:g.wrap(panel.kicker.toUpperCase(),inner,1,1);
  const main=g.buttonMetrics(panel.button,{primary:true,maxWidth:inner});
  const secondary=panel.secondary?g.buttonMetrics(panel.secondary.label,{pad:8,maxWidth:inner}):null;
  const stacked=secondary&&(g.h<180||main.w+12+secondary.w>inner);
  const buttonH=stacked?main.h+6+secondary.h:Math.max(main.h,secondary?.h??0);
  const showControls = panel.controls && !coarse && g.w>=300 && g.h>=180;
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
  const h = 10+kickerLines.length*12+lines.length*11+8+buttonH+6+(showControls?6+rows*10:0)+8;
  const x = Math.round((g.w - pw) / 2);
  const y = g.h - 8 - g.safe.b - h;
  g.panel(x, y, pw, h, { accent: true });
  let ty = y + 10;
  for(const line of kickerLines){g.text(line.text,x+12,ty,{color:COLORS.gold,tracking:1});ty+=12;}
  for (const line of lines) {
    g.text(line.text, x + 12, ty, { color: COLORS.ink, shadow: COLORS.shade });
    ty += 11;
  }
  ty += 8;
  titlePartyY = g.h < 180 ? (stacked ? ty + main.h + 6 : ty) : null;
  g.primary('overlay-start',panel.button,x+12,ty,press('main'),{maxWidth:inner});
  if(panel.secondary)g.button('overlay-secondary',panel.secondary.label,stacked?x+12:x+12+main.w+12,stacked?ty+main.h+6:ty,press('secondary'),{pad:8,maxWidth:inner});
  ty += buttonH+6;
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
  const kickerLines=g.wrap(panel.kicker.toUpperCase(),inner,1,1);
  const main=g.buttonMetrics(panel.button,{primary:true,maxWidth:inner});
  const secondary=panel.secondary?g.buttonMetrics(panel.secondary.label,{pad:8,maxWidth:inner}):null;
  const stacked=secondary&&main.w+12+secondary.w>inner;
  const buttonH=stacked?main.h+6+secondary.h:Math.max(main.h,secondary?.h??0);
  const available=g.h-g.safe.t-g.safe.b-16;
  const normalTitle=g.wrap(panel.title,inner,2);
  const normalH=14+kickerLines.length*12+6+normalTitle.length*18+8+lines.length*11+12+buttonH+14;
  const compact=normalH>available,titleSize=compact?1:2,titleLine=compact?12:18;
  const titleLines=compact?g.wrap(panel.title,inner,1):normalTitle;
  const pad=compact?8:14,kickerGap=compact?4:6,messageGap=compact?6:8,actionGap=compact?8:12;
  const h=pad+kickerLines.length*12+kickerGap+titleLines.length*titleLine+messageGap+lines.length*11+actionGap+buttonH+pad;
  const x = Math.round((g.w - pw) / 2);
  const y = g.safe.t+8+Math.round((available-h)/2);
  g.panel(x, y, pw, h, { accent: true });
  let ty = y + pad;
  for(const line of kickerLines){g.text(line.text,g.w/2,ty,{align:'center',color:COLORS.gold,tracking:1});ty+=12;}
  ty+=kickerGap;
  for (const line of titleLines) {
    g.text(line.text, g.w / 2, ty, { size: titleSize, align: 'center', color: COLORS.ink, shadow: COLORS.shade });
    ty += titleLine;
  }
  ty += messageGap;
  for (const line of lines) {
    g.text(line.text, g.w / 2, ty, { align: 'center', color: COLORS.muted });
    ty += 11;
  }
  ty += actionGap;
  const total=stacked?Math.max(main.w,secondary.w):main.w+(secondary?secondary.w+12:0);
  const bx=Math.round((g.w-total)/2);
  g.primary('overlay-start',panel.button,stacked?Math.round((g.w-main.w)/2):bx,ty,press('main'),{maxWidth:inner});
  if(panel.secondary)g.button('overlay-secondary',panel.secondary.label,stacked?Math.round((g.w-secondary.w)/2):bx+main.w+12,stacked?ty+main.h+6:ty,press('secondary'),{pad:8,maxWidth:inner});
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

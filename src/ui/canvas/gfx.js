// The in-canvas UI layer. The game draws its own interface, the way Gems Together does: one
// canvas over the view, immediate mode, our own pixel font (font.js), and hit regions registered as
// things are drawn. No DOM text anywhere in it, so nothing reflows, leaks nodes or thrashes layout.
//
// The canvas is a small logical screen scaled up by whole device pixels (about two CSS pixels per
// logical one), so every pixel stays square and sharp at any window size or zoom.
//
// A part is one piece of interface:
//
//   registerUiPart({
//     id: 'hud', order: 10,           // low draws first, so a dialog sits over the HUD
//     key: () => 'a|b',               // the part's redraw key: the layer repaints when any key changes
//     busy: () => false,              // true while it animates, so the layer repaints every frame
//     draw(g) { g.text('Hello', 8, 8); g.hit('id', x, y, w, h, () => ...); },
//   });
//
// The layer repaints only when a key changed, a part is busy, the size changed or requestUi() was
// called; a still screen costs nothing. `g` (below) is the drawing kit every part gets.
import { drawText, measure, wrap, fit, CAP, LINE } from './font.js';

const parts = [];
let canvas = null;
let ctx = null;
let scale = 2; // device pixels per logical pixel
let dpr = 1;
let devW = 0;
let devH = 0;
let dirty = true;
let lastKey = '';
let hidden = false;
let hits = [];
let hover = null;
let pressed = null;
let drag = null; // the hit region being dragged (a slider)
let repaints = 0;

export function registerUiPart(def) {
  if (parts.some((p) => p.id === def.id)) throw new Error(`UI part "${def.id}" is already registered`);
  parts.push({ order: 50, ...def });
  parts.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  dirty = true;
}

export const requestUi = () => {
  dirty = true;
};

// Hide the whole layer (screenshots for the OG image and the site).
export function setUiHidden(v) {
  hidden = !!v;
  dirty = true;
}

const chamfer = (x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
};
const ring = (x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
};

export const COLORS = {
  panel: 'rgba(18, 24, 43, 0.94)',
  ink: '#f3ecd2',
  muted: '#b5c9d4',
  gold: '#efca7d',
  goldDeep: '#a87b48',
  edge: '#090e20',
  line: 'rgba(243, 236, 210, 0.38)',
  shade: '#151e36',
};

// The drawing kit. All positions are logical pixels and are rounded to whole ones.
export const g = {
  w: 320,
  h: 180,
  safe: { t: 0, r: 0, b: 0, l: 0 }, // a notch or home bar's room, logical pixels
  now: 0,
  cap: CAP,
  line: LINE,
  measure,
  wrap,
  fit,
  buttonMetrics(label,{primary=false,size=1,pad=primary?10:5,maxWidth=Infinity}={}){
    const lines=wrap(String(label),Math.max(1,maxWidth-pad*2),size);
    return{lines,w:Math.max(...lines.map(l=>measure(l.text,size)))+pad*2,h:CAP*size+(primary?10:6)+(lines.length-1)*LINE*size};
  },
  alpha(a) {
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
  },
  rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  },
  // opts: color, size, align, tracking, shadow, outline (see font.js)
  text(str, x, y, opts) {
    drawText(ctx, String(str), Math.round(x), Math.round(y), opts);
  },
  // A picture (a canvas from sprites.js) at whole-number size.
  sprite(img, x, y, size = 1) {
    ctx.drawImage(img, Math.round(x), Math.round(y), img.width * size, img.height * size);
  },
  // An image scaled to w x h (art; smoothing stays off, it is pixel art).
  image(img, x, y, w, h) {
    ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
  },
  // The chamfered dark plate the whole interface uses: a translucent fill, a dark edge, a pale
  // inner line, an optional gold rule across the top, and a hard drop shadow.
  panel(x, y, w, h, opts = {}) {
    x = Math.round(x);
    y = Math.round(y);
    const { fill = COLORS.panel, accent = false, shadow = true, line = COLORS.line } = opts;
    if (shadow) chamfer(x + 2, y + 2, w, h, 'rgba(0, 0, 0, 0.32)');
    chamfer(x, y, w, h, fill);
    ring(x, y, w, h, COLORS.edge);
    ring(x + 1, y + 1, w - 2, h - 2, line);
    if (accent) {
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(x + 2, y + 2, w - 4, 2);
      ctx.fillStyle = COLORS.goldDeep;
      ctx.fillRect(x + 2, y + 4, w - 4, 1);
    }
  },
  // A text button: registers its own hit region, lights up under the pointer, dips when pressed.
  // Returns its width.
  button(id, label, x, y, onPress, opts = {}) {
    const { size = 1, pad = 5, on = false, hitPad = 3 } = opts;
    const {w,h,lines}=g.buttonMetrics(label,{size,pad,maxWidth:opts.maxWidth});
    const hot = hover === id;
    const down = pressed === id;
    const py = y + (down ? 1 : 0);
    g.panel(x, py, w, h, { shadow: !down, fill: on ? 'rgba(241, 194, 50, 0.22)' : hot ? 'rgba(243, 236, 210, 0.16)' : COLORS.panel });
    lines.forEach((line,i)=>g.text(line.text,x+pad,py+3+i*LINE*size,{size,color:hot||on?COLORS.ink:COLORS.muted}));
    g.hit(id, x - hitPad, y - hitPad, w + hitPad * 2, h + hitPad * 2, onPress);
    return w;
  },
  // The gold call-to-action button (a panel's main one). Returns its width.
  primary(id, label, x, y, onPress, opts={}) {
    const {w,h,lines}=g.buttonMetrics(label,{primary:true,maxWidth:opts.maxWidth});
    const hot = hover === id;
    const gold = hot ? '#ffd95a' : COLORS.gold;
    g.rect(x + 1, y + h - 1, w - 2, 2, COLORS.goldDeep);
    g.rect(x, y + 1, w, h - 2, gold);
    g.rect(x + 1, y, w - 2, h, gold);
    lines.forEach((line,i)=>g.text(line.text,x+10,y+5+i*LINE,{color:'#1c1405'}));
    g.hit(id, x - 3, y - 3, w + 6, h + 9, onPress);
    return w;
  },
  // A rectangle that answers a press. Regions drawn later sit on top. onDrag(x, y), when given,
  // gets the pointer's logical position on the press and again on every move until it lifts.
  hit(id, x, y, w, h, onPress, cursor = 'pointer', onDrag = null) {
    hits.push({ id, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), onPress, cursor, onDrag });
  },
  hovered: (id) => hover === id,
};

// The device's safe-area insets (a notch, a home bar), read through a hidden element's padding.
let probe = null;
function readSafeArea() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
  }
  const c = getComputedStyle(probe);
  const px = (v) => Math.ceil(((parseFloat(v) || 0) * dpr) / scale);
  g.safe = { t: px(c.paddingTop), r: px(c.paddingRight), b: px(c.paddingBottom), l: px(c.paddingLeft) };
}

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'ui';
  canvas.setAttribute('aria-hidden', 'true');
  // z-index 6: over the daylight wash (game/clock.js, 5), under speech and the full-screen menus.
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', zIndex: '6', pointerEvents: 'none', imageRendering: 'pixelated' });
  const app = document.getElementById('app') ?? document.body;
  app.insertBefore(canvas, document.getElementById('touch'));
  ctx = canvas.getContext('2d');
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
}

// About two CSS pixels per logical pixel (three on a very tall screen), in whole device pixels.
function fitToWindow() {
  const d = window.devicePixelRatio || 1;
  const dw = Math.max(1, Math.round(innerWidth * d));
  const dh = Math.max(1, Math.round(innerHeight * d));
  if (d === dpr && dw === devW && dh === devH && canvas.width) return;
  dpr = d;
  devW = dw;
  devH = dh;
  scale = Math.max(1, Math.round((innerHeight >= 1100 ? 3 : 2) * d));
  g.w = Math.ceil(devW / scale);
  g.h = Math.ceil(devH / scale);
  canvas.width = g.w;
  canvas.height = g.h;
  canvas.style.width = `${(g.w * scale) / d}px`;
  canvas.style.height = `${(g.h * scale) / d}px`;
  ctx.imageSmoothingEnabled = false;
  readSafeArea();
  dirty = true;
}

// Called once per rendered frame (main.js).
export function refreshUi() {
  if (typeof document === 'undefined') return;
  ensure();
  fitToWindow();
  const now = performance.now();
  g.now = now;
  let key = `${g.w}x${g.h}|${hidden}|${hover}|${pressed}`;
  let busy = false;
  for (const p of parts) {
    if (p.key) key += `|${p.key()}`;
    if (p.busy?.(now)) busy = true;
  }
  if (!busy && !dirty && key === lastKey) return;
  lastKey = key;
  dirty = false;
  repaints++;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, g.w, g.h);
  hits = [];
  if (hidden) return;
  for (const p of parts) {
    ctx.save();
    p.draw(g);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- pointer
const at = (e) => [(e.clientX * dpr) / scale, (e.clientY * dpr) / scale];
const hitAt = (x, y) => {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
  }
  return null;
};

function onDown(e) {
  const h = hitAt(...at(e));
  if (!h) return;
  e.preventDefault();
  pressed = h.id;
  dirty = true;
  if (h.onDrag) {
    drag = h;
    h.onDrag(...at(e));
  } else h.onPress?.(e);
}
function onMove(e) {
  if (drag) {
    drag.onDrag(...at(e));
    dirty = true;
    return;
  }
  const h = e.pointerType === 'touch' ? null : hitAt(...at(e));
  const id = h?.id ?? null;
  if (id !== hover) {
    hover = id;
    document.body.style.cursor = h ? h.cursor : '';
    dirty = true;
  }
}
function onUp() {
  drag = null;
  if (pressed !== null) {
    pressed = null;
    dirty = true;
  }
}

// What the layer shows, for tests: they read this, never pixels: the logical size and every hit
// region (so a test can press a button by id), plus how often it has repainted.
export const uiView = () => ({
  scale,
  w: g.w,
  h: g.h,
  repaints,
  hits: hits.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
});

// Drag a slider region to a fraction (0 to 1) of its width, for tests.
export function dragUi(id, fx) {
  const h = hits.find((x) => x.id === id);
  if (!h?.onDrag) return false;
  h.onDrag(h.x + h.w * fx, h.y + h.h / 2);
  return true;
}

export function pressUi(id) {
  const h = hits.find((x) => x.id === id);
  if (!h) return false;
  h.onPress?.({ preventDefault() {} });
  return true;
}

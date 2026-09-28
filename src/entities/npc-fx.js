// Speech over people's heads: emote bubbles (! ? ♥ ♪ … ✦) and short bark lines. They are HTML laid
// over the view at the speaker's head (projected every frame), not sprites in the scene: the
// depth-of-field pass blurred sprites away wherever the distance showed behind them.
//
//   const b = new Bubble(holder, 1.55);   // the NPC's Object3D, height above the feet
//   b.emote('!');  b.say('Morning!');     // each pops in, holds, fades
//   b.update(dt);  b.dispose();
import * as THREE from 'three';
import { camera, renderer } from '../core/renderer.js';

const EMOTE_COLOR = { '!': '#e0402f', '?': '#3a6fd8', '♥': '#e0407a', '♪': '#2e9a4a', '…': '#5a5a5a', '✦': '#d89a1a' };
const FONT = '"Pixelify Sans", "Courier New", monospace';

// The canvas rect, read once per animation frame no matter how many bubbles ask: every bubble's
// update() used to call getBoundingClientRect() itself, interleaved with the style writes below, so
// N bubbles forced N read/write/read/write layout thrashes instead of one read and N writes. Cached
// here and dropped on the next rAF (scheduled the first time it is asked for in a frame), so it is
// recomputed at most once per frame and self-heals after a resize without anyone calling in.
let cachedRect = null;
let rectResetQueued = false;
function canvasRect() {
  if (!cachedRect) {
    cachedRect = renderer.domElement.getBoundingClientRect();
    if (!rectResetQueued && typeof requestAnimationFrame === 'function') {
      rectResetQueued = true;
      requestAnimationFrame(() => {
        cachedRect = null;
        rectResetQueued = false;
      });
    }
  }
  return cachedRect;
}

let layer = null;
function root() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'speech';
  Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 12, overflow: 'hidden' });
  document.body.append(layer);
  return layer;
}

const _p = new THREE.Vector3();

export class Bubble {
  constructor(holder, height = 1.55) {
    this.holder = holder;
    this.height = height;
    this.e = null; // { t, life }
    this.b = null;
    this.emoteEl = null;
    this.barkEl = null;
  }

  el(kind) {
    const key = kind === 'e' ? 'emoteEl' : 'barkEl';
    if (this[key] || typeof document === 'undefined') return this[key];
    const d = document.createElement('div');
    Object.assign(d.style, { position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap', opacity: '0', willChange: 'transform, opacity' });
    if (kind === 'e') {
      Object.assign(d.style, { width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255, 252, 240, 0.97)', display: 'grid', placeItems: 'center', font: `700 20px/1 ${FONT}`, boxShadow: '0 2px 0 rgba(0,0,0,0.25)' });
    } else {
      Object.assign(d.style, { padding: '4px 10px', borderRadius: '8px', background: 'rgba(20, 22, 20, 0.86)', color: '#f5f1e4', font: `500 14px/1.2 ${FONT}` });
    }
    root().append(d);
    return (this[key] = d);
  }

  emote(sym, life = 1.4) {
    const d = this.el('e');
    if (d) {
      d.textContent = sym;
      d.style.color = EMOTE_COLOR[sym] ?? '#222';
    }
    this.e = { t: 0, life };
  }

  say(text, life = 2.6) {
    const d = this.el('b');
    if (d) d.textContent = text;
    this.b = { t: 0, life };
  }

  get busy() {
    return !!this.b;
  }

  update(dt) {
    const step = (st) => {
      if (!st) return null;
      st.t += dt;
      return st.t >= st.life ? null : st;
    };
    this.e = step(this.e);
    this.b = step(this.b);
    if (!this.emoteEl && !this.barkEl) return;
    // where the head is on screen (hidden when the speaker is, or behind the camera)
    let sx = 0;
    let sy = 0;
    let on = this.holder.visible !== false && !!this.holder.parent;
    if (on) {
      this.holder.getWorldPosition(_p);
      _p.y += this.height;
      _p.project(camera);
      on = _p.z < 1;
      const c = canvasRect();
      sx = c.left + ((_p.x + 1) / 2) * c.width;
      sy = c.top + ((1 - _p.y) / 2) * c.height;
    }
    const place = (d, st, dy) => {
      if (!d) return;
      if (!st || !on) {
        d.style.opacity = '0';
        return;
      }
      const k = st.t < 0.12 ? st.t / 0.12 : st.t > st.life - 0.25 ? (st.life - st.t) / 0.25 : 1;
      const pop = st.t < 0.12 ? 0.6 + 0.4 * k : 1;
      d.style.opacity = String(Math.max(0, Math.min(1, k)));
      d.style.transform = `translate(${sx.toFixed(1)}px, ${(sy + dy).toFixed(1)}px) translate(-50%, -100%) scale(${pop.toFixed(3)})`;
    };
    place(this.emoteEl, this.e, 0);
    place(this.barkEl, this.b, this.e ? -36 : -4);
  }

  dispose() {
    this.emoteEl?.remove();
    this.barkEl?.remove();
    this.emoteEl = this.barkEl = null;
  }
}

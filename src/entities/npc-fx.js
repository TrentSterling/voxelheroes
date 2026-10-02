// Speech over people's heads: emote bubbles (! ? ♥ ♪ … ✦) and short bark lines. They are drawn in the
// UI canvas (ui/canvas/gfx.js) at the speaker's head, projected every update, not sprites in the
// scene: the depth-of-field pass blurred sprites away wherever the distance showed behind them.
// Nothing here touches the DOM, so a bubble can never outlive its speaker as a stray element: one
// whose holder has left the scene (reaped, dormant, hidden) is simply not drawn.
//
//   const b = new Bubble(holder, 1.55);   // the NPC's Object3D, height above the feet
//   b.emote('!');  b.say('Morning!');     // each pops in, holds, fades
//   b.update(dt);  b.dispose();
import * as THREE from 'three';
import { camera, scene } from '../core/renderer.js';
import { g as gfx, registerUiPart, requestUi, COLORS } from '../ui/canvas/gfx.js';
import { disc } from '../ui/canvas/sprites.js';
import { hudBounds } from '../ui/hud.js';
import { playShortcutBounds } from '../ui/shortcuts.js';
import { world, heroScreen } from '../world/world.js';

const EMOTE_COLOR = { '!': '#e0402f', '?': '#3a6fd8', '♥': '#e0407a', '♪': '#2e9a4a', '…': '#5a5a5a', '✦': '#d89a1a' };
const live = new Set(); // bubbles with something to show

const _p = new THREE.Vector3();

// Is the holder really in the scene and unhidden all the way up? A bubble whose speaker was reaped
// with its whole screen (the holder keeps its own parent, the bucket's group has left the scene)
// must not float on as a ghost.
function inScene(o) {
  for (; o; o = o.parent) {
    if (o.visible === false) return false;
    if (o === scene) return true;
  }
  return false;
}

export class Bubble {
  constructor(holder, height = 1.55, owner = null) {
    this.holder = holder;
    this.owner = owner;
    this.height = height;
    this.e = null; // { sym, t, life }
    this.b = null; // { text, t, life }
    this.on = false; // is the head in view
    this.sx = 0; // where it is on the UI canvas, logical pixels
    this.sy = 0;
  }

  emote(sym, life = 1.4) {
    this.e = { sym, t: 0, life };
    live.add(this);
    requestUi();
  }

  say(text, life = 2.6) {
    this.b = { text, t: 0, life };
    live.add(this);
    requestUi();
  }

  get busy() {
    return !!this.b;
  }

  // The mark showing over the head now ('!', '?', ...), or null.
  get mark() {
    return this.e?.sym ?? null;
  }

  update(dt) {
    const step = (st) => {
      if (!st) return null;
      st.t += dt;
      return st.t >= st.life ? null : st;
    };
    this.e = step(this.e);
    this.b = step(this.b);
    if (!this.e && !this.b) {
      live.delete(this);
      return;
    }
    live.add(this);
  }

  dispose() {
    live.delete(this);
    this.e = this.b = null;
    requestUi();
  }
}

// 0 to 1 over the first 0.12 s, held, then out over the last 0.25 s.
const fade = (st) => (st.t < 0.12 ? st.t / 0.12 : st.t > st.life - 0.25 ? (st.life - st.t) / 0.25 : 1);

// Sleeping outdoor buckets retain their last projection. Always project with
// the current camera, and never bring a head outside the view back in by clamping.
const drawable = (b) => {
  const here = heroScreen(), home = world.screens.get(b.owner?.homeKey);
  b.on = inScene(b.holder) && (!home || home.area.id === here?.area.id);
  if (!b.on) return false;
  b.holder.getWorldPosition(_p);
  _p.y += b.height;
  _p.project(camera);
  b.on = _p.z > -1 && _p.z < 1 && Math.abs(_p.x) <= 1 && Math.abs(_p.y) <= 1;
  b.sx = ((_p.x + 1) / 2) * gfx.w;
  b.sy = ((1 - _p.y) / 2) * gfx.h;
  return b.on;
};

// A bubble nearing the top edge fades out before it runs into the HUD's name and goal lines.
const clearOfHud = (top,left,right) => {
  let bottom=22;
  for(const widget of [...hudBounds(gfx),...playShortcutBounds(gfx)])if(left<widget.x+widget.w&&right>widget.x)bottom=Math.max(bottom,widget.y+widget.h);
  return Math.max(0,Math.min(1,(top-bottom)/14));
};

// How many bubbles are on show, for tests (a ghost is one whose speaker is gone).
export const bubblesShown = () => [...live].filter(drawable).length;

registerUiPart({
  id: 'speech',
  order: 5, // over the world, under the HUD and the dialog
  busy: () => live.size > 0,
  key: () => (live.size ? 'speech' : '-'),
  draw(g) {
    for (const b of live) {
      if (!drawable(b)) continue;
      const x = Math.max(12,Math.min(g.w-12,Math.round(b.sx)));
      const y = Math.max(40,Math.min(g.h-4,Math.round(b.sy)));
      if (b.e) {
        const k = fade(b.e);
        const d = 19;
        const rise = b.e.t < 0.12 ? Math.round(3 * (1 - k)) : 0;
        const alpha=Math.max(0, Math.min(1, k)) * clearOfHud(y - d - 1 + rise,x-d/2,x+d/2);
        if (alpha>0) {
          g.alpha(alpha);
          g.sprite(disc(d, 'rgba(255, 252, 240, 0.97)'), x - d / 2, y - d - 1 + rise);
          g.text(b.e.sym, x, y - d + 2 + rise, { size: 2, align: 'center', color: EMOTE_COLOR[b.e.sym] ?? '#222' });
        }
      }
      if (b.b) {
        const k = fade(b.b);
        const text = g.fit(b.b.text,Math.min(200,g.w-24));
        const w = g.measure(text) + 10;
        const bx=Math.max(4+w/2,Math.min(g.w-4-w/2,x));
        const by = y + (b.e ? -22 : -2) - 13;
        const alpha=Math.max(0, Math.min(1, k)) * clearOfHud(by,bx-w/2,bx+w/2);
        if (alpha>0) {
          g.alpha(alpha);
          g.panel(bx - w / 2, by, w, 13, { shadow: false, fill: 'rgba(20, 22, 20, 0.86)', line: 'rgba(243, 236, 210, 0.16)' });
          g.text(text, bx, by + 3, { align: 'center', color: COLORS.ink });
        }
      }
    }
  },
});

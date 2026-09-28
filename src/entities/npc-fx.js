// Speech over people's heads: emote bubbles (! ? ♥ ♪ … ✦) and short bark lines, as camera-facing
// sprites drawn to canvas once per symbol or line and cached. Used by entities/npc.js.
//
//   const b = new Bubble(parent, 1.3);   // parent Object3D, height above the feet
//   b.emote('!');  b.say('Morning!');    // each pops in, holds, fades
//   b.update(dt);
import * as THREE from 'three';

const cache = new Map();
const FONT = '"Pixelify Sans", "Courier New", monospace';

function makeTexture(key, draw, w, h) {
  let tex = cache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  cache.set(key, tex);
  return tex;
}

const EMOTE_COLOR = { '!': '#e0402f', '?': '#3a6fd8', '♥': '#e0407a', '♪': '#2e9a4a', '…': '#5a5a5a', '✦': '#d89a1a' };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function emoteTexture(sym) {
  return makeTexture(`emote:${sym}`, (g, w, h) => {
    g.fillStyle = 'rgba(255, 252, 240, 0.97)';
    roundRect(g, 4, 4, w - 8, h - 20, 18);
    g.fill();
    g.beginPath(); // the tail
    g.moveTo(w / 2 - 9, h - 17);
    g.lineTo(w / 2, h - 4);
    g.lineTo(w / 2 + 9, h - 17);
    g.fill();
    g.fillStyle = EMOTE_COLOR[sym] ?? '#222';
    g.font = `700 52px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(sym, w / 2, (h - 16) / 2 + 3);
  }, 96, 96);
}

function barkTexture(text) {
  const g0 = document.createElement('canvas').getContext('2d');
  g0.font = `500 30px ${FONT}`;
  const tw = Math.ceil(g0.measureText(text).width * 1.15); // room for the pixel face if it loads late
  const w = Math.min(720, tw + 48);
  const tex = makeTexture(`bark:${text}`, (g, W, H) => {
    g.fillStyle = 'rgba(20, 22, 20, 0.84)';
    roundRect(g, 2, 2, W - 4, H - 4, 14);
    g.fill();
    g.fillStyle = '#f5f1e4';
    g.font = `500 30px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + 1, W - 24);
  }, w, 52);
  return { tex, aspect: w / 52 };
}

export class Bubble {
  constructor(parent, height = 1.3) {
    this.height = height;
    this.emoteSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    this.barkSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    for (const s of [this.emoteSprite, this.barkSprite]) {
      s.visible = false;
      s.renderOrder = 20;
      s.userData.noShadow = true;
      parent.add(s);
    }
    this.e = null; // { t, life }
    this.b = null;
  }

  emote(sym, life = 1.4) {
    this.emoteSprite.material.map = emoteTexture(sym);
    this.emoteSprite.material.needsUpdate = true;
    this.e = { t: 0, life };
  }

  say(text, life = 2.6) {
    const { tex, aspect } = barkTexture(text);
    this.barkSprite.material.map = tex;
    this.barkSprite.material.needsUpdate = true;
    this.barkSprite.userData.aspect = aspect;
    this.b = { t: 0, life };
  }

  get busy() {
    return !!this.b;
  }

  update(dt) {
    const pop = (s, st, base, w) => {
      if (!st) {
        s.visible = false;
        return null;
      }
      st.t += dt;
      if (st.t >= st.life) {
        s.visible = false;
        return null;
      }
      const k = st.t < 0.12 ? st.t / 0.12 : st.t > st.life - 0.25 ? (st.life - st.t) / 0.25 : 1;
      const scale = (st.t < 0.12 ? 0.6 + 0.5 * k : 1) * base;
      s.visible = true;
      s.scale.set(scale * w, scale, 1);
      s.material.opacity = Math.max(0, Math.min(1, k));
      return st;
    };
    this.e = pop(this.emoteSprite, this.e, 0.42, 1);
    this.emoteSprite.position.set(0, this.height + 0.1 + (this.e ? Math.sin(this.e.t * 9) * 0.02 : 0), 0);
    this.b = pop(this.barkSprite, this.b, 0.3, this.barkSprite.userData.aspect ?? 4);
    this.barkSprite.position.set(0, this.height + (this.e ? 0.55 : 0.2), 0);
  }
}

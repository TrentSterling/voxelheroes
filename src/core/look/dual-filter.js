// Dual filter (dual Kawase) blur pyramid, after M. Bjørge's "Bandwidth-efficient rendering"
// (SIGGRAPH 2015) and Acerola's blur comparison: each level down reads 5 bilinear taps of the level
// above, each level up reads 8 taps of the level below, so a wide blur costs a handful of cheap
// low-resolution passes instead of a wide full-resolution kernel.
//
//   const P = new DualPyramid(5);          // 5 levels: 1/2 .. 1/32 of the source
//   P.setSize(w, h);
//   P.down(renderer, srcTexture, quad?);   // fills P.levels[0..4]; `quad` replaces the first pass (bloom's bright pass)
//   P.blurTo(renderer, n, target);         // target (half size) = level n blurred back up to 1/2
//   P.sumUp(renderer, weights, target);    // target (half size) = sum of every level, weighted, blurred up
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = /* glsl */ `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const DOWN = /* glsl */ `uniform sampler2D tSrc; uniform vec2 halfTexel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv - halfTexel).rgb;
  c += texture2D(tSrc, vUv + halfTexel).rgb;
  c += texture2D(tSrc, vUv + vec2(halfTexel.x, -halfTexel.y)).rgb;
  c += texture2D(tSrc, vUv - vec2(halfTexel.x, -halfTexel.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

// Up: 8 taps of the smaller level, plus (weight > 0) this level's own downsampled colour.
const UP = /* glsl */ `uniform sampler2D tSrc, tAdd; uniform vec2 halfTexel; uniform float addWeight, srcScale; varying vec2 vUv;
void main() {
  vec2 h = halfTexel;
  vec3 c = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  c *= srcScale / 12.0;
  if (addWeight > 0.0) c += texture2D(tAdd, vUv).rgb * addWeight;
  gl_FragColor = vec4(c, 1.0);
}`;

const mat = (frag, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });

export class DualPyramid {
  constructor(count = 5) {
    this.levels = Array.from({ length: count }, target); // 1/2, 1/4, ...
    this.temps = Array.from({ length: count }, target); // up-chain scratch, same sizes
    this.downQ = new FullScreenQuad(mat(DOWN, { tSrc: { value: null }, halfTexel: { value: new THREE.Vector2() } }));
    this.upQ = new FullScreenQuad(
      mat(UP, { tSrc: { value: null }, tAdd: { value: null }, halfTexel: { value: new THREE.Vector2() }, addWeight: { value: 0 }, srcScale: { value: 1 } })
    );
    this.passes = 0;
  }

  setSize(w, h) {
    this.levels.forEach((rt, i) => {
      const s = 2 ** (i + 1);
      rt.setSize(Math.max(1, Math.ceil(w / s)), Math.max(1, Math.ceil(h / s)));
      this.temps[i].setSize(rt.width, rt.height);
    });
  }

  down(renderer, src, srcW, srcH, first = null) {
    this.passes = 0;
    const u = this.downQ.material.uniforms;
    let tex = src;
    let w = srcW;
    let h = srcH;
    this.levels.forEach((rt, i) => {
      renderer.setRenderTarget(rt);
      if (i === 0 && first) first.render(renderer);
      else {
        u.tSrc.value = tex;
        u.halfTexel.value.set(0.5 / w, 0.5 / h);
        this.downQ.render(renderer);
      }
      this.passes++;
      tex = rt.texture;
      w = rt.width;
      h = rt.height;
    });
  }

  up(renderer, from, out, add = null, addWeight = 0, srcScale = 1) {
    const u = this.upQ.material.uniforms;
    u.srcScale.value = srcScale;
    u.tSrc.value = from.texture;
    u.halfTexel.value.set(0.5 / from.width, 0.5 / from.height);
    u.tAdd.value = add?.texture ?? null;
    u.addWeight.value = add ? addWeight : 0;
    renderer.setRenderTarget(out);
    this.upQ.render(renderer);
    this.passes++;
  }

  // Level n (1 = the 1/2 level) blurred back up to 1/2 size into `out` (a half-size target).
  // n = 1 is the plain downsample; n = k costs k - 1 up passes.
  blurTo(renderer, n, out) {
    let from = this.levels[n - 1];
    if (n === 1) return from;
    for (let k = n - 2; k >= 0; k--) {
      const dst = k === 0 ? out : this.temps[k];
      this.up(renderer, from, dst);
      from = dst;
    }
    return out;
  }

  // Every level weighted (weights[i] for level i + 1) and blurred up into `out` (half size):
  // U_n = w_n D_n, U_k = up(U_k+1) + w_k D_k.
  sumUp(renderer, weights, out) {
    const n = this.levels.length;
    let from = this.levels[n - 1];
    for (let k = n - 2; k >= 0; k--) {
      const dst = k === 0 ? out : this.temps[k];
      this.up(renderer, from, dst, this.levels[k], weights[k], k === n - 2 ? weights[n - 1] : 1);
      from = dst;
    }
    return from;
  }
}

// Polished dungeon floor (art bible section 6, lab DGN_GOLD): a planar Reflector laid 0.002 above the
// floor surface and added to it (additive blending), so the lit walls brighten the floor next to
// them while the black void above adds nothing. The reflection is glossy, not a mirror: a 24-tap
// Vogel-disc blur in reflection-texture uv (twice as tall as wide, `look.reflectBlur`) turns lit
// walls into soft warm pools, and `look.reflectTint` is the polish's own colour. The clip bias
// (0.001) stays smaller than the lift, or the floor would reflect itself and the room would brighten.
//
// The mirror covers the room the camera is on (the screen rectangle around the camera subject), so
// during a slide between rooms it spans both. Content can narrow it with setMirrorRect() (for
// example to leave pits out); the override lasts until the next screen change.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const FloorShader = {
  name: 'PolishedFloor',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.5 },
    blur: { value: 0 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `uniform mat4 textureMatrix; varying vec4 vUv;
    void main() { vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform float strength, blur; uniform vec3 tint; varying vec4 vUv;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 r = vec3(0.0);
      float ws = 0.0;
      for (int i = 0; i < 24; i++) {
        float fi = float(i) + 0.5, rad = sqrt(fi / 24.0), a = fi * 2.39996;
        float w = 1.0 - 0.6 * rad;
        r += texture2D(tDiffuse, uv + vec2(cos(a), 2.0 * sin(a)) * rad * blur).rgb * w;
        ws += w;
      }
      gl_FragColor = vec4(r / ws * strength * tint, 1.0);
    }`,
};

export const MIRROR_LIFT = 0.002;
export const MIRROR_CLIP_BIAS = 0.001;

export class FloorMirror {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.size = [0, 0];
    this.override = null;
  }

  create(w, h) {
    const mesh = new Reflector(new THREE.PlaneGeometry(1, 1), {
      textureWidth: w,
      textureHeight: h,
      clipBias: MIRROR_CLIP_BIAS,
      multisample: 4,
      shader: FloorShader,
    });
    mesh.material.transparent = true;
    mesh.material.depthWrite = false;
    mesh.material.blending = THREE.AdditiveBlending;
    mesh.rotation.x = -Math.PI / 2;
    mesh.name = 'floor-mirror';
    mesh.renderOrder = -1; // first among transparent things, under water and effects
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.size = [w, h];
    return mesh;
  }

  // enabled: look.reflect > 0 and the quality allows it. rect: world x / z of the floor to cover.
  update({ enabled, strength, blur = 0, tint = [1, 1, 1], rect, floorY, width, height }) {
    if (!enabled) {
      if (this.mesh?.parent) this.scene.remove(this.mesh);
      return;
    }
    if (!this.mesh) this.create(width, height);
    else if (this.size[0] !== width || this.size[1] !== height) {
      this.mesh.getRenderTarget().setSize(width, height);
      this.size = [width, height];
    }
    const r = this.override ?? rect;
    const m = this.mesh;
    m.position.set((r.x0 + r.x1) / 2, floorY + MIRROR_LIFT, (r.z0 + r.z1) / 2);
    m.scale.set(r.x1 - r.x0, r.z1 - r.z0, 1);
    const u = m.material.uniforms;
    u.strength.value = strength;
    u.blur.value = blur;
    u.tint.value.setRGB(...tint);
    if (!m.parent) this.scene.add(m);
  }

  // Hidden while something else renders the scene (keeps its reflection pass out of other passes).
  hide() {
    if (this.mesh) this.mesh.visible = false;
  }
  show() {
    if (this.mesh) this.mesh.visible = true;
  }
}

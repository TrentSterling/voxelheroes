// The post stack (art bible section 5), ported from the look lab's LookPipeline:
//
//   scene  -> half-float target, 4x MSAA, with a depth texture
//   GTAO   -> AO from the scene depth (normals rebuilt from depth: no second scene pass)
//   DOF    -> prepare (colour + view depth) -> tile-max CoC (16 px tiles) -> dilate -> Vogel-disc gather
//   bloom  -> UnrealBloomPass, added into the DOF result
//   glare  -> four streaks at 45 degrees from pixels above 3.2 (half resolution), added
//   grade  -> ACES filmic (exposure), grade in display space, edge vignette, dither -> canvas
//
// Depth of field: the circle of confusion is 0 within focusRange of the focus depth and ramps
// linearly to farMaxBlur / nearMaxBlur (px at 720p, scaled by the drawing-buffer height). The
// gather samples a Vogel disc and weighs each sample by its own CoC, so blurred foreground bleeds
// over sharp background but not the other way (lab shader). Unlike the lab, the disc radius is
// the largest CoC in the pixel's 16 px tile and its neighbours instead of the global maximum: the
// samples bunch up where the blur is small, which removes most of the speckle bright water glints
// made in the blur transition, and in-focus tiles skip the gather.
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const DEG = Math.PI / 180;
export const DOF_TILE = 16;

const QUAD_VERTEX = /* glsl */ `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const COC_PARS = /* glsl */ `
uniform float focusDistance, focusRange, farRamp, nearRamp, farMaxBlur, nearMaxBlur;
float coc(float z) {
  float dz = z - focusDistance;
  float a = max(abs(dz) - focusRange, 0.0);
  return dz > 0.0 ? clamp(a / farRamp, 0.0, 1.0) * farMaxBlur : clamp(a / nearRamp, 0.0, 1.0) * nearMaxBlur;
}`;

const cocUniforms = () => ({
  focusDistance: { value: 10 },
  focusRange: { value: 1 },
  farRamp: { value: 6 },
  nearRamp: { value: 3 },
  farMaxBlur: { value: 10 },
  nearMaxBlur: { value: 6 },
});

// Colour plus view depth in one texture, so the gather reads one texel per sample.
const DofPrepareShader = {
  uniforms: { tColor: { value: null }, tDepth: { value: null }, cameraNear: { value: 0.5 }, cameraFar: { value: 400 } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tColor;
    uniform highp sampler2D tDepth;
    uniform float cameraNear, cameraFar;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tColor, vUv).rgb;
      float d = texture2D(tDepth, vUv).x;
      gl_FragColor = vec4(c, -perspectiveDepthToViewZ(d, cameraNear, cameraFar));
    }`,
};

// Largest CoC (px) in each DOF_TILE x DOF_TILE tile.
const DofTileShader = {
  defines: { TILE: DOF_TILE },
  uniforms: { tPrep: { value: null }, ...cocUniforms() },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
    uniform highp sampler2D tPrep;
    ${COC_PARS}
    void main() {
      ivec2 size = textureSize(tPrep, 0);
      ivec2 base = ivec2(gl_FragCoord.xy) * TILE;
      float m = 0.0;
      for (int y = 0; y < TILE; y++) {
        for (int x = 0; x < TILE; x++) {
          ivec2 p = min(base + ivec2(x, y), size - 1);
          m = max(m, coc(texelFetch(tPrep, p, 0).a));
        }
      }
      gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
    }`,
};

// Grow each tile's CoC over the tiles the largest blur can reach.
const DofDilateShader = {
  uniforms: { tTile: { value: null }, reach: { value: 1 } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
    uniform highp sampler2D tTile;
    uniform int reach;
    void main() {
      ivec2 size = textureSize(tTile, 0);
      ivec2 c = ivec2(gl_FragCoord.xy);
      float m = 0.0;
      for (int y = -4; y <= 4; y++) {
        if (y < -reach || y > reach) continue;
        for (int x = -4; x <= 4; x++) {
          if (x < -reach || x > reach) continue;
          ivec2 p = clamp(c + ivec2(x, y), ivec2(0), size - 1);
          m = max(m, texelFetch(tTile, p, 0).r);
        }
      }
      gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
    }`,
};

// Scatter-as-gather over a Vogel disc (after D. Gustafsson), each sample weighted by its own CoC.
const DofGatherShader = {
  defines: { SAMPLES: 96, TILE: DOF_TILE },
  uniforms: { tPrep: { value: null }, tTile: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, ...cocUniforms() },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
    uniform highp sampler2D tPrep;
    uniform highp sampler2D tTile;
    uniform vec2 resolution;
    ${COC_PARS}
    varying vec2 vUv;
    const float GOLDEN = 2.39996323;
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      vec4 c0 = texture2D(tPrep, vUv);
      float maxR = texelFetch(tTile, ivec2(gl_FragCoord.xy) / TILE, 0).r;
      if (maxR < 0.5) { gl_FragColor = vec4(c0.rgb, 1.0); return; }
      float zc = c0.a;
      float cc = coc(zc);
      vec2 px = 1.0 / resolution;
      vec3 acc = c0.rgb;
      float wsum = 1.0;
      float rot = ign(gl_FragCoord.xy) * 6.2831853;
      for (int i = 0; i < SAMPLES; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(SAMPLES)) * maxR;
        float a = fi * GOLDEN + rot;
        vec4 s = texture2D(tPrep, vUv + vec2(cos(a), sin(a)) * r * px);
        float cs = coc(s.a);
        if (s.a > zc) cs = min(cs, cc * 2.0);        // background may not bleed over a sharper foreground
        float w = smoothstep(r - 1.0, r + 1.0, cs);   // does the sample's blur disc reach this pixel?
        acc += s.rgb * w;
        wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`,
};

// ---------------------------------------------------------------- star glare (lab)
const BrightShader = {
  uniforms: { tColor: { value: null }, threshold: { value: 3.2 }, knee: { value: 0.5 } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `uniform sampler2D tColor; uniform float threshold, knee; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tColor, vUv).rgb; float l = max(c.r, max(c.g, c.b));
      float w = clamp((l - threshold + knee) / (2.0 * knee), 0.0, 1.0); w = w * w;
      float k = max(l - threshold, 0.0) + w * knee;
      gl_FragColor = vec4(c * (k / max(l, 1e-4)), 1.0);
    }`,
};
const StreakShader = {
  uniforms: { tColor: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, step: { value: 1 }, atten: { value: 0.9 }, texel: { value: new THREE.Vector2() } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `uniform sampler2D tColor; uniform vec2 dir, texel; uniform float step, atten; varying vec2 vUv;
    void main() {
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int s = 0; s < 4; s++) { float fs = float(s); float w = pow(atten, step * fs);
        acc += w * texture2D(tColor, vUv + dir * texel * step * fs).rgb; wsum += w; }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`,
};
const AddShader = {
  uniforms: { tA: { value: null }, tB: { value: null }, tC: { value: null }, tD: { value: null }, strength: { value: 0.3 } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `uniform sampler2D tA, tB, tC, tD; uniform float strength; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tA, vUv).rgb + texture2D(tB, vUv).rgb + texture2D(tC, vUv).rgb + texture2D(tD, vUv).rgb;
      gl_FragColor = vec4(c * strength, 1.0);
    }`,
};

// ---------------------------------------------------------------- final grade (lab)
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    toneMappingExposure: { value: 1 },
    saturation: { value: 1 },
    contrast: { value: 1 },
    lift: { value: new THREE.Vector3() },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    vignette: { value: 0.06 },
    vignetteSoftness: { value: 0.6 },
    rim: { value: 0.85 },
    rimWidth: { value: 0.033 },
    edge: { value: 0.2 },
    edgeWidth: { value: 0.2 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `precision highp float; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
    attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `precision highp float;
    uniform sampler2D tDiffuse; uniform float saturation, contrast, vignette, vignetteSoftness;
    uniform float rim, rimWidth, edge, edgeWidth;
    uniform vec3 lift, gain; uniform vec2 resolution;
    // Edge darkening measured on the reference captures: a thin dark rim (~24 px at 720p) and a soft
    // falloff over ~144 px from every screen edge; corners multiply both axes.
    float edgeFactor(float d) {
      return (1.0 - rim * (1.0 - smoothstep(0.0, rimWidth, d))) * (1.0 - edge * (1.0 - smoothstep(0.0, edgeWidth, d)));
    }
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = ACESFilmicToneMapping(c.rgb);
      c = sRGBTransferOETF(c);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb = c.rgb * gain + lift * (1.0 - c.rgb);
      vec2 q = vUv - 0.5; q.x *= resolution.x / resolution.y;
      float v = smoothstep(0.9, 0.9 - vignetteSoftness, length(q));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      vec2 px = vUv * resolution;
      c.rgb *= edgeFactor(min(px.x, resolution.x - px.x) / resolution.y) * edgeFactor(min(px.y, resolution.y - px.y) / resolution.y);
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c.rgb += n / 255.0;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);
    }`,
};

function quad(S, extra = {}) {
  return new FullScreenQuad(
    new THREE.ShaderMaterial({
      defines: { ...(S.defines ?? {}) },
      uniforms: THREE.UniformsUtils.clone(S.uniforms),
      vertexShader: S.vertexShader,
      fragmentShader: S.fragmentShader,
      depthTest: false,
      depthWrite: false,
      ...extra,
    })
  );
}

const halfTarget = (w, h, opts = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...opts });

export class LookPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.w = 0;
    this.h = 0;
    this.stats = { passes: 0 };

    // depth + stencil: the depth feeds GTAO and the DOF, the stencil masks the polished floor
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.format = THREE.DepthStencilFormat;
    depthTexture.type = THREE.UnsignedInt248Type;
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true, depthTexture });
    this.aoRT = halfTarget(1, 1);
    this.prepRT = halfTarget(1, 1);
    this.tileRT = halfTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.tileDilRT = this.tileRT.clone();
    this.dofRT = halfTarget(1, 1);
    this.glareRT = { bright: halfTarget(1, 1), ping: halfTarget(1, 1), pong: halfTarget(1, 1), dirs: [0, 1, 2, 3].map(() => halfTarget(1, 1)) };

    this.gtao = null; // built on first use (high quality only)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.88);

    this.prepQ = quad(DofPrepareShader);
    this.tileQ = quad(DofTileShader);
    this.dilateQ = quad(DofDilateShader);
    this.gatherQ = { 96: quad(DofGatherShader) };
    this.brightQ = quad(BrightShader);
    this.streakQ = quad(StreakShader);
    this.addQ = quad(AddShader, { blending: THREE.AdditiveBlending, transparent: true });
    this.copyQ = new FullScreenQuad(new THREE.MeshBasicMaterial({ toneMapped: false }));
    const gm = new THREE.RawShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(GradeShader.uniforms),
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.gradeQ = new FullScreenQuad(gm);
  }

  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sceneRT.setSize(w, h);
    this.aoRT.setSize(w, h);
    this.prepRT.setSize(w, h);
    const tw = Math.ceil(w / DOF_TILE);
    const th = Math.ceil(h / DOF_TILE);
    this.tileRT.setSize(tw, th);
    this.tileDilRT.setSize(tw, th);
    this.dofRT.setSize(w, h);
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    const G = this.glareRT;
    for (const rt of [G.bright, G.ping, G.pong, ...G.dirs]) rt.setSize(hw, hh);
    this.bloom.setSize(w, h);
    this.gtao?.setSize(w, h);
  }

  ensureGtao() {
    if (this.gtao) return this.gtao;
    const g = new GTAOPass(this.scene, this.camera, this.w, this.h);
    g.setGBuffer(this.sceneRT.depthTexture); // normals rebuilt from depth: no normal pass
    g.output = GTAOPass.OUTPUT.Default;
    this.gtao = g;
    return g;
  }

  gatherQuad(samples) {
    if (!this.gatherQ[samples]) this.gatherQ[samples] = quad({ ...DofGatherShader, defines: { ...DofGatherShader.defines, SAMPLES: samples } });
    return this.gatherQ[samples];
  }

  // f: { look, dof, quality, focusDistance, exposure }
  render(f) {
    const { renderer, scene, camera } = this;
    const { look: L, quality: Q } = f;
    let passes = 1;

    renderer.setRenderTarget(this.sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    let src = this.sceneRT;
    if (Q.ao && L.ao && L.ao.intensity > 0) {
      const g = this.ensureGtao();
      g.blendIntensity = L.ao.intensity;
      g.updateGtaoMaterial({ radius: L.ao.radius, distanceExponent: L.ao.distanceExponent, thickness: L.ao.thickness, scale: L.ao.scale ?? 1, samples: L.ao.samples ?? 16 });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      g.render(renderer, this.aoRT, this.sceneRT);
      src = this.aoRT;
      passes += 4;
    }

    if (f.dof && Q.dofSamples > 0) {
      this.renderDof(src, f.dof, f.focusDistance, Q.dofSamples);
      src = this.dofRT;
      passes += 4;
    } else {
      this.copy(src, this.dofRT);
      src = this.dofRT;
      passes += 1;
    }

    if (Q.bloom && L.bloom && L.bloom.strength > 0) {
      const b = this.bloom;
      b.strength = L.bloom.strength;
      b.radius = L.bloom.radius;
      b.threshold = L.bloom.threshold;
      b.render(renderer, null, src, 0, false);
      passes += 13;
    }

    if (Q.glare && L.glare && L.glare.strength > 0) {
      this.renderGlare(src, L.glare);
      passes += 14;
    }

    const g = this.gradeQ.material.uniforms;
    const G = L.grade;
    g.tDiffuse.value = src.texture;
    g.toneMappingExposure.value = f.exposure;
    g.saturation.value = G.saturation;
    g.contrast.value = G.contrast;
    g.lift.value.set(...G.lift);
    g.gain.value.set(...(G.gain ?? [1, 1, 1]));
    g.vignette.value = G.vignette ?? 0;
    g.vignetteSoftness.value = G.vignetteSoftness ?? 0.6;
    g.rim.value = G.rim ?? 0;
    g.rimWidth.value = G.rimWidth ?? 0.033;
    g.edge.value = G.edge ?? 0;
    g.edgeWidth.value = G.edgeWidth ?? 0.2;
    g.resolution.value.set(this.w, this.h);
    renderer.setRenderTarget(null);
    this.gradeQ.render(renderer);
    this.stats.passes = passes + 1;
  }

  renderDof(src, D, focusDistance, samples) {
    const { renderer, camera } = this;
    const scale = this.h / 720;
    const setCoc = (u) => {
      u.focusDistance.value = focusDistance;
      u.focusRange.value = D.focusRange;
      u.farRamp.value = D.farRamp;
      u.nearRamp.value = D.nearRamp;
      u.farMaxBlur.value = D.farMaxBlur * scale;
      u.nearMaxBlur.value = D.nearMaxBlur * scale;
    };
    const p = this.prepQ.material.uniforms;
    p.tColor.value = src.texture;
    p.tDepth.value = this.sceneRT.depthTexture;
    p.cameraNear.value = camera.near;
    p.cameraFar.value = camera.far;
    renderer.setRenderTarget(this.prepRT);
    this.prepQ.render(renderer);

    const t = this.tileQ.material.uniforms;
    t.tPrep.value = this.prepRT.texture;
    setCoc(t);
    renderer.setRenderTarget(this.tileRT);
    this.tileQ.render(renderer);

    const d = this.dilateQ.material.uniforms;
    d.tTile.value = this.tileRT.texture;
    d.reach.value = Math.min(4, Math.max(1, Math.ceil((Math.max(D.farMaxBlur, D.nearMaxBlur) * scale + 1) / DOF_TILE)));
    renderer.setRenderTarget(this.tileDilRT);
    this.dilateQ.render(renderer);

    const gq = this.gatherQuad(samples);
    const u = gq.material.uniforms;
    u.tPrep.value = this.prepRT.texture;
    u.tTile.value = this.tileDilRT.texture;
    u.resolution.value.set(this.w, this.h);
    setCoc(u);
    renderer.setRenderTarget(this.dofRT);
    gq.render(renderer);
  }

  renderGlare(src, gq) {
    const { renderer } = this;
    const G = this.glareRT;
    const bu = this.brightQ.material.uniforms;
    bu.tColor.value = src.texture;
    bu.threshold.value = gq.threshold;
    bu.knee.value = gq.knee ?? 0.3;
    renderer.setRenderTarget(G.bright);
    this.brightQ.render(renderer);
    const su = this.streakQ.material.uniforms;
    su.texel.value.set(1 / G.bright.width, 1 / G.bright.height);
    su.atten.value = gq.attenuation;
    const base = (gq.angle ?? 45) * DEG;
    const aspectFix = G.bright.width / G.bright.height / (this.w / this.h);
    for (let d = 0; d < 4; d++) {
      const a = base + (d * Math.PI) / 2;
      su.dir.value.set(Math.cos(a), Math.sin(a) * aspectFix);
      let input = G.bright;
      for (let pass = 0; pass < 3; pass++) {
        const out = pass === 2 ? G.dirs[d] : pass % 2 ? G.pong : G.ping;
        su.tColor.value = input.texture;
        su.step.value = Math.pow(4, pass);
        renderer.setRenderTarget(out);
        this.streakQ.render(renderer);
        input = out;
      }
    }
    const au = this.addQ.material.uniforms;
    au.tA.value = G.dirs[0].texture;
    au.tB.value = G.dirs[1].texture;
    au.tC.value = G.dirs[2].texture;
    au.tD.value = G.dirs[3].texture;
    au.strength.value = gq.strength;
    renderer.setRenderTarget(src);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    this.addQ.render(renderer);
    renderer.autoClear = ac;
  }

  copy(from, to) {
    this.copyQ.material.map = from.texture;
    this.renderer.setRenderTarget(to);
    this.copyQ.render(this.renderer);
  }

  // Render targets in bytes (for the frame-cost notes in the test hook).
  memory() {
    const px = this.w * this.h;
    const hp = 8; // RGBA half float
    let bytes = px * hp * 4 /* 4x MSAA colour */ + px * 4 * 4 /* MSAA depth */ + px * hp /* resolved */ + px * 4 /* depth texture */;
    bytes += px * hp * 3; // ao, prepare, dof
    bytes += (px / 4) * hp * 7; // glare
    return bytes;
  }
}

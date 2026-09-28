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
import { DualPyramid } from './dual-filter.js';

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

// Fast depth of field (Q.dofMode 'pyramid'): the sharp image and five dual-filter blur levels
// (B_n about 2^n px wide at full size) mixed per pixel by the circle of confusion. A handful of
// low-resolution passes instead of the 96-tap full-resolution gather.
const DofPyramidShader = {
  uniforms: {
    tPrep: { value: null },
    tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, tB4: { value: null }, tB5: { value: null },
    ...cocUniforms(),
  },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
    uniform highp sampler2D tPrep;
    uniform sampler2D tB1, tB2, tB3, tB4, tB5;
    ${COC_PARS}
    varying vec2 vUv;
    vec3 level(int i) {
      if (i <= 1) return texture2D(tB1, vUv).rgb;
      if (i == 2) return texture2D(tB2, vUv).rgb;
      if (i == 3) return texture2D(tB3, vUv).rgb;
      if (i == 4) return texture2D(tB4, vUv).rgb;
      return texture2D(tB5, vUv).rgb;
    }
    void main() {
      vec4 c0 = texture2D(tPrep, vUv);
      float c = coc(c0.a);
      if (c < 0.5) { gl_FragColor = vec4(c0.rgb, 1.0); return; }
      float f = clamp(log2(max(c, 1.0)), 0.0, 5.0);
      vec3 col;
      if (c < 2.0) col = mix(c0.rgb, texture2D(tB1, vUv).rgb, clamp((c - 0.5) / 1.5, 0.0, 1.0));
      else {
        int i = int(floor(f));
        col = mix(level(i), level(i + 1), fract(f));
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Bloom bright pass (dual-filter bloom): the soft-knee threshold of the lab's glare, at half size.
const BloomBrightShader = {
  uniforms: { tColor: { value: null }, threshold: { value: 0.88 }, knee: { value: 0.1 }, halfTexel: { value: new THREE.Vector2() } },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `uniform sampler2D tColor; uniform float threshold, knee; uniform vec2 halfTexel; varying vec2 vUv;
    vec3 bright(vec3 c) {
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      return c * smoothstep(threshold, threshold + knee, l);
    }
    void main() {
      vec3 c = bright(texture2D(tColor, vUv).rgb) * 4.0;
      c += bright(texture2D(tColor, vUv - halfTexel).rgb);
      c += bright(texture2D(tColor, vUv + halfTexel).rgb);
      c += bright(texture2D(tColor, vUv + vec2(halfTexel.x, -halfTexel.y)).rgb);
      c += bright(texture2D(tColor, vUv - vec2(halfTexel.x, -halfTexel.y)).rgb);
      gl_FragColor = vec4(c / 8.0, 1.0);
    }`,
};
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2]; // UnrealBloomPass's mip weights

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

// ---------------------------------------------------------------- GTAO upsample
// GTAO at half resolution (GTAO_SCALE), joint-bilateral upsampled back to full res: the raymarch and
// its Poisson denoise are the two most expensive full-screen taps in the stack, and AO is low
// frequency enough that a naive bilinear upsample would only cost a faint softening at object edges.
// Instead this samples the four half-res AO texels around each full-res pixel and re-weights the
// usual bilinear weights by how close each one's own depth is to the pixel's (a small exp falloff),
// so edges that a straight bilinear blend would leak occlusion across snap back to the nearer depth.
// Output is the same multiplicative blend GTAOPass's own GTAOBlendShader does (mix(1, ao, intensity)),
// applied with the same CustomBlending trick so it lands directly on the scene colour already copied
// into the destination target.
const GTAO_SCALE = 0.5;
const GtaoUpsampleShader = {
  uniforms: {
    tAo: { value: null },
    tDepth: { value: null },
    aoTexel: { value: new THREE.Vector2(1, 1) }, // 1 / (half-res AO target size)
    cameraNear: { value: 0.5 },
    cameraFar: { value: 400 },
    depthSigma: { value: 0.5 },
    intensity: { value: 1 },
  },
  vertexShader: QUAD_VERTEX,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tAo;
    uniform highp sampler2D tDepth;
    uniform vec2 aoTexel;
    uniform float cameraNear, cameraFar, depthSigma, intensity;
    varying vec2 vUv;
    float viewZ(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
    void main() {
      float refZ = viewZ(vUv);
      vec2 h = vUv / aoTexel - 0.5;
      vec2 base = floor(h) * aoTexel + 0.5 * aoTexel;
      vec2 f = fract(h);
      vec2 taps[4] = vec2[4](base, base + vec2(aoTexel.x, 0.0), base + vec2(0.0, aoTexel.y), base + aoTexel);
      float bw[4] = float[4]((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int i = 0; i < 4; i++) {
        float dz = abs(viewZ(taps[i]) - refZ);
        float w = bw[i] * exp(-dz / depthSigma) + bw[i] * 1e-3; // tiny floor: never fully zero out
        acc += texture2D(tAo, taps[i]).rgb * w;
        wsum += w;
      }
      vec3 ao = acc / max(wsum, 1e-5);
      gl_FragColor = vec4(mix(vec3(1.0), ao, intensity), 1.0);
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
    this.dofPyr = new DualPyramid(5);
    this.dofBlur = [0, 1, 2, 3].map(() => halfTarget(1, 1)); // B2..B5 at half size
    this.dofPyrQ = quad(DofPyramidShader);
    this.bloomPyr = new DualPyramid(5);
    this.bloomOut = halfTarget(1, 1);
    this.bloomBrightQ = quad(BloomBrightShader);
    this.bloomAddQ = new FullScreenQuad(
      new THREE.MeshBasicMaterial({ toneMapped: false, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false })
    );

    this.gtaoUpsampleQ = quad(GtaoUpsampleShader, {
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendEquation: THREE.AddEquation,
      blendSrcAlpha: THREE.DstAlphaFactor,
      blendDstAlpha: THREE.ZeroFactor,
      blendEquationAlpha: THREE.AddEquation,
    });
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
    this.dofPyr.setSize(w, h);
    this.bloomPyr.setSize(w, h);
    for (const rt of [...this.dofBlur, this.bloomOut]) rt.setSize(hw, hh);
    if (this.gtao) this.gtao.setSize(Math.max(1, Math.round(w * GTAO_SCALE)), Math.max(1, Math.round(h * GTAO_SCALE)));
  }

  ensureGtao() {
    if (this.gtao) return this.gtao;
    const gw = Math.max(1, Math.round(this.w * GTAO_SCALE));
    const gh = Math.max(1, Math.round(this.h * GTAO_SCALE));
    const g = new GTAOPass(this.scene, this.camera, gw, gh);
    g.setGBuffer(this.sceneRT.depthTexture); // full-res depth; normals rebuilt from it, no normal pass
    // GTAOPass's own output (Default) copies the scene then bilinear-blends the AO onto it; instead
    // we copy the scene ourselves and blend with a depth-aware upsample (GtaoUpsampleShader) below.
    g.output = GTAOPass.OUTPUT.Off;
    this.gtao = g;
    return g;
  }

  // Depth-aware upsample of the half-res GTAO result, blended onto `dst` (already holding the scene
  // colour, see render()) in place: see GtaoUpsampleShader.
  blendGtao(g, dst, intensity, radius) {
    const u = this.gtaoUpsampleQ.material.uniforms;
    u.tAo.value = g.gtaoMap;
    u.tDepth.value = this.sceneRT.depthTexture;
    u.aoTexel.value.set(1 / g.width, 1 / g.height);
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    u.depthSigma.value = Math.max(0.15, radius * 0.5);
    u.intensity.value = intensity;
    const { renderer } = this;
    renderer.setRenderTarget(dst);
    // dst already holds the copied scene colour (render()'s this.copy() call): autoClear would wipe
    // it right before the multiplicative blend reads it back as the CustomBlending dst factor,
    // leaving a blank target (same guard as the bloom/glare add passes below).
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    this.gtaoUpsampleQ.render(renderer);
    renderer.autoClear = ac;
  }

  gatherQuad(samples) {
    if (!this.gatherQ[samples]) this.gatherQ[samples] = quad({ ...DofGatherShader, defines: { ...DofGatherShader.defines, SAMPLES: samples } });
    return this.gatherQ[samples];
  }

  // f: { look, dof, quality, focusDistance, exposure, saturation (x the grade's, default 1) }
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
      g.updateGtaoMaterial({ radius: L.ao.radius, distanceExponent: L.ao.distanceExponent, thickness: L.ao.thickness, scale: L.ao.scale ?? 1, samples: L.ao.samples ?? 16 });
      g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      g.render(renderer, null, null); // output is Off: only fills gtaoMap (half res)
      this.copy(this.sceneRT, this.aoRT);
      this.blendGtao(g, this.aoRT, L.ao.intensity, L.ao.radius ?? 1);
      src = this.aoRT;
      passes += 4;
    }

    if (f.dof && Q.dofMode === 'pyramid') {
      passes += this.renderDofPyramid(src, f.dof, f.focusDistance);
      src = this.dofRT;
    } else if (f.dof && Q.dofSamples > 0) {
      this.renderDof(src, f.dof, f.focusDistance, Q.dofSamples);
      src = this.dofRT;
      passes += 4;
    } else {
      this.copy(src, this.dofRT);
      src = this.dofRT;
      passes += 1;
    }

    if (Q.bloom && L.bloom && L.bloom.strength > 0 && Q.bloomMode === 'dual') {
      passes += this.renderBloomDual(src, L.bloom);
    } else if (Q.bloom && L.bloom && L.bloom.strength > 0) {
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
    g.saturation.value = G.saturation * (f.saturation ?? 1);
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

  // Returns the number of passes.
  renderDofPyramid(src, D, focusDistance) {
    const { renderer, camera } = this;
    const scale = this.h / 720;
    const p = this.prepQ.material.uniforms;
    p.tColor.value = src.texture;
    p.tDepth.value = this.sceneRT.depthTexture;
    p.cameraNear.value = camera.near;
    p.cameraFar.value = camera.far;
    renderer.setRenderTarget(this.prepRT);
    this.prepQ.render(renderer);

    const P = this.dofPyr;
    P.down(renderer, this.prepRT.texture, this.w, this.h);
    let passes = 1 + P.passes;
    const u = this.dofPyrQ.material.uniforms;
    u.tPrep.value = this.prepRT.texture;
    u.tB1.value = P.levels[0].texture;
    [u.tB2, u.tB3, u.tB4, u.tB5].forEach((t, i) => {
      P.passes = 0;
      t.value = P.blurTo(renderer, i + 2, this.dofBlur[i]).texture;
      passes += P.passes;
    });
    u.focusDistance.value = focusDistance;
    u.focusRange.value = D.focusRange;
    u.farRamp.value = D.farRamp;
    u.nearRamp.value = D.nearRamp;
    u.farMaxBlur.value = D.farMaxBlur * scale;
    u.nearMaxBlur.value = D.nearMaxBlur * scale;
    renderer.setRenderTarget(this.dofRT);
    this.dofPyrQ.render(renderer);
    return passes + 1;
  }

  // Dual-filter bloom: bright pass at half size, five levels down, weighted sum back up, added
  // into src. Same strength / radius / threshold meaning as UnrealBloomPass.
  renderBloomDual(src, B) {
    const { renderer } = this;
    const P = this.bloomPyr;
    const bu = this.bloomBrightQ.material.uniforms;
    bu.tColor.value = src.texture;
    bu.threshold.value = B.threshold;
    bu.halfTexel.value.set(0.5 / this.w, 0.5 / this.h);
    P.down(renderer, src.texture, this.w, this.h, this.bloomBrightQ);
    const r = B.radius ?? 0;
    const weights = BLOOM_FACTORS.map((f) => (f + (1.2 - f - f) * r) * (B.strength ?? 0));
    const out = P.sumUp(renderer, weights, this.bloomOut);
    this.bloomAddQ.material.map = out.texture;
    renderer.setRenderTarget(src);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    this.bloomAddQ.render(renderer);
    renderer.autoClear = ac;
    return P.passes + 1;
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

  // Approximate GPU memory of the render targets in bytes (for the frame-cost notes in the test
  // hook): 4x MSAA storage counted in full, half-float colour at 8 bytes a pixel.
  memory({ ao = !!this.gtao, bloom = true, glare = true } = {}) {
    const px = this.w * this.h;
    const hf = 8;
    let bytes = px * (hf * 4 + 4 * 4) + px * (hf + 4); // MSAA colour + depth-stencil, resolved colour + depth
    bytes += px * hf * 2; // DOF prepare + result
    bytes += Math.ceil(px / (DOF_TILE * DOF_TILE)) * hf * 2; // tile CoC maps
    if (ao) bytes += px * hf + (px * GTAO_SCALE * GTAO_SCALE) * hf * 2; // aoRT (full res) + half-res GTAO + denoise
    if (bloom) bytes += (px / 4) * hf * (1 + 2 * 1.33); // bright pass + blur mips
    if (glare) bytes += (px / 4) * hf * 7;
    return bytes;
  }
}

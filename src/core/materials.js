// Shared materials, asked for by kind (art bible section 6). Callers never build their own voxel
// materials: the look (src/core/look/) switches every kind's values with the active lighting preset.
//
//   getMaterial('terrain')    terrain blocks (1/8 tile): faint seams (x0.88)
//   getMaterial('character')  characters, props and pickups (1/16 tile): clear seams (x0.62)
//   getMaterial('fine')       fine floors built at character resolution (dungeon floors, 1/16 tile)
//   makeCharacterMaterial()   a new unshared character material (per-entity hit flash); it keeps the
//                             bevel and seam shader and follows look changes like the shared one
//   makeGlowMaterial(color, intensity)  emissive-only (unlit, HDR) so bloom and glare catch it;
//                             vertex colours multiply the colour, so pass 0xffffff for a voxel model
//                             that carries its own colours
//   makeWaterMaterial()       the lab water: blocky ripples, wave troughs, round glints, grazing sheen
//   setSeams(on)              seam lines on or off everywhere (one uniform, for an options menu)
//
// Voxel materials read the per-face 'faceUv' attribute written by both meshers (src/core/vox.js
// meshVoxels and src/core/voxel.js buildGeometry). Geometry without it renders plain (no bevel, no
// seams) instead of breaking. The procedural touches, all in the fragment shader:
//   bevel      the normal tilts toward the nearest face edge over `bevel` of the face (tilt `bevelTilt`)
//   edge light face edges brighten by `edgeLight` (a catch light)
//   seam       a thin line of half-width `grid.width` darkens to `grid.dark` around every face
import * as THREE from 'three';

export const MATERIAL_KINDS = ['terrain', 'character', 'fine'];

// ---------------------------------------------------------------- shared uniforms
// One seam switch for every kind (the reference has a menu option to hide seam lines).
const seamOn = { value: 1 };
// Flat debug mode ('flat' quality): no bevel, no edge light, no seams.
const flatMode = { value: 0 };

function uniformBag() {
  return {
    bevel: { value: 0.16 },
    bevelTilt: { value: 0.75 },
    edgeLight: { value: 0.08 },
    gridWidth: { value: 0.06 },
    gridDark: { value: 0.88 },
    gridOn: seamOn,
    voxFlat: flatMode,
    voxRoughness: { value: 0.48 },
  };
}

const BAGS = { terrain: uniformBag(), character: uniformBag(), fine: uniformBag() };

// ---------------------------------------------------------------- voxel material
const VOXEL_VERTEX_PARS = /* glsl */ `
attribute vec2 faceUv;
varying vec2 vFaceUv;`;

const VOXEL_FRAGMENT_PARS = /* glsl */ `
varying vec2 vFaceUv;
uniform float bevel, bevelTilt, edgeLight, gridOn, gridWidth, gridDark, voxFlat, voxRoughness;`;

// Procedural bevel: tilt the normal toward the nearest face edge, in a cotangent frame built from
// screen-space derivatives of the view position and the face UV (no tangents in the geometry).
const VOXEL_BEVEL = /* glsl */ `
{
  vec2 f = vFaceUv;
  float bw = bevel * (1.0 - voxFlat);
  vec2 s = vec2(0.0);
  if (bw > 0.0) {
    s.x = f.x < bw ? -(1.0 - f.x / bw) : (f.x > 1.0 - bw ? (1.0 - (1.0 - f.x) / bw) : 0.0);
    s.y = f.y < bw ? -(1.0 - f.y / bw) : (f.y > 1.0 - bw ? (1.0 - (1.0 - f.y) / bw) : 0.0);
  }
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(f), st1 = dFdy(f);
  vec3 N = normal;
  vec3 q1perp = cross(q1, N), q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec3 mapN = normalize(vec3(s * bevelTilt, 1.0));
  normal = normalize(T * (mapN.x * sc) + B * (mapN.y * sc) + N * mapN.z);
}`;

// Edge catch light and the seam grid, antialiased with screen-space derivatives.
const VOXEL_COLOR = /* glsl */ `
{
  vec2 e = min(vFaceUv, 1.0 - vFaceUv);
  float d = min(e.x, e.y);
  float on = 1.0 - voxFlat;
  float edge = 1.0 - smoothstep(0.0, 0.12, d);
  diffuseColor.rgb *= 1.0 + edgeLight * edge * on;
  float aa = max(fwidth(d), 1e-4);
  float line = 1.0 - smoothstep(gridWidth - aa, gridWidth + aa, d);
  diffuseColor.rgb *= mix(1.0, gridDark, line * gridOn * on);
}`;

function patchVoxelShader(shader, U) {
  Object.assign(shader.uniforms, U);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VOXEL_VERTEX_PARS}`)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFaceUv = faceUv;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${VOXEL_FRAGMENT_PARS}`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = voxRoughness;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${VOXEL_BEVEL}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\n${VOXEL_COLOR}`);
}

// A MeshStandardMaterial with vertex colours and the bevel and seam shader. The shader hook is a
// method, not an instance property, so clone() (new this.constructor().copy(this)) keeps it; the
// clone shares the kind's uniforms, so it follows look changes and setSeams().
export class VoxelMaterial extends THREE.MeshStandardMaterial {
  constructor(params = {}, kind = 'terrain') {
    super({ vertexColors: true, metalness: 0, roughness: 0.48, ...params });
    this.isVoxelMaterial = true; // (type stays 'MeshStandardMaterial': three picks the shader by type)
    this.kind = kind;
    this.voxelUniforms = BAGS[kind] ?? BAGS.terrain;
    // Missing attributes: plain face (no bevel, no seam) and white vertex colour.
    this.defaultAttributeValues = { faceUv: [0.5, 0.5], color: [1, 1, 1] };
  }
  onBeforeCompile(shader) {
    patchVoxelShader(shader, this.voxelUniforms);
  }
  customProgramCacheKey() {
    return 'voxel-bevel-seam-v1';
  }
  copy(source) {
    super.copy(source);
    this.kind = source.kind;
    this.voxelUniforms = source.voxelUniforms;
    this.defaultAttributeValues = { ...source.defaultAttributeValues };
    return this;
  }
}

const SHARED = {
  terrain: new VoxelMaterial({}, 'terrain'),
  character: new VoxelMaterial({}, 'character'),
  fine: new VoxelMaterial({}, 'fine'),
};

export function getMaterial(kind = 'terrain') {
  const m = SHARED[kind];
  if (!m) throw new Error(`Unknown material kind "${kind}"`);
  return m;
}

export function makeCharacterMaterial() {
  return SHARED.character.clone();
}

// ---------------------------------------------------------------- glow
// Unlit HDR colour: bloom (threshold ~0.8-0.9) and glare (3.2) pick it up in the post stack; the
// low quality path tone-maps it like everything else.
export function makeGlowMaterial(color = 0xffffff, intensity = 3) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), vertexColors: true });
  mat.defaultAttributeValues = { color: [1, 1, 1] };
  mat.userData.glow = { color, intensity };
  return mat;
}

// ---------------------------------------------------------------- water
// Section 6 (lab water v10): a flat, glossy, translucent plane per water tile with blocky ripple
// normals quantised to 1/16 tile, long diagonal wave troughs that darken the albedo, soft round
// glints on the crests (two offset jittered cell layers, each blob twinkling on its own clock,
// emissive so bloom halos them; they brighten with distance so they survive the depth of field) and
// a pale sky sheen on grazing views. Every value comes from the active look (`water`); a key a look
// leaves out takes the lab default below. The time uniform is shared and driven by the render loop.
export const WATER_DEFAULTS = {
  color: 0x2f8fd8,
  opacity: 0.82,
  roughness: 0.12,
  ripple: 0.18,
  sparkle: 2.5,
  glintSize: 1.0,
  glintDensity: 1.0,
  glintFar: 0.0,
  glintGrow: 0.0,
  trough: 0.0,
  troughDir: [0.8, 0.6],
  troughFreq: 1.6,
  sheen: 0.0,
  sheenColor: 0xc8d0e8,
};

const waterUniforms = {
  waterTime: { value: 0 },
  ripple: { value: WATER_DEFAULTS.ripple },
  sparkle: { value: WATER_DEFAULTS.sparkle },
  glintSize: { value: WATER_DEFAULTS.glintSize },
  glintDensity: { value: WATER_DEFAULTS.glintDensity },
  glintFar: { value: WATER_DEFAULTS.glintFar },
  glintGrow: { value: WATER_DEFAULTS.glintGrow },
  trough: { value: WATER_DEFAULTS.trough },
  troughDir: { value: new THREE.Vector2(...WATER_DEFAULTS.troughDir).normalize() },
  troughFreq: { value: WATER_DEFAULTS.troughFreq },
  sheenColor: { value: new THREE.Color(WATER_DEFAULTS.sheenColor) },
  sheenAmt: { value: WATER_DEFAULTS.sheen },
};
const waterValues = { color: WATER_DEFAULTS.color, opacity: WATER_DEFAULTS.opacity, roughness: WATER_DEFAULTS.roughness };
const waterMaterials = new Set();

const WATER_PARS = /* glsl */ `
varying vec3 vWPos;
uniform float waterTime, ripple, sparkle, glintSize, glintFar, glintGrow, glintDensity, trough, troughFreq, sheenAmt;
uniform vec2 troughDir;
uniform vec3 sheenColor;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
}
// 1 in a wave trough, 0 on a crest: long diagonal bands bent by low-frequency noise
float waterTrough(vec2 xz) {
  float s = dot(xz, troughDir) * troughFreq + 1.4 * wNoise(xz * 0.35) + 0.6 * wNoise(xz * 1.3 + 7.0) + waterTime * 0.15;
  return smoothstep(0.55, 0.95, 0.5 + 0.5 * sin(s * 6.2831853));
}`;

const WATER_COLOR = /* glsl */ `
diffuseColor.rgb *= 1.0 - trough * waterTrough(vWPos.xz);`;

const WATER_GLINTS = /* glsl */ `
{
  float tr = waterTrough(vWPos.xz);
  float dist = length(cameraPosition.xz - vWPos.xz);
  float far = max(dist - 10.0, 0.0);
  float grow = glintSize * (1.0 + glintGrow * far);
  float glint = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 gp = vWPos.xz * (k == 0 ? vec2(4.4, 3.4) : vec2(3.3, 2.6)) / grow + (k == 0 ? vec2(0.0) : vec2(0.37, 0.61));
    vec2 cell = floor(gp);
    float h = fract(sin(dot(cell + float(k) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
    float h2 = fract(h * 91.7), h3 = fract(h * 13.3);
    vec2 c = vec2(0.25 + 0.5 * h2, 0.25 + 0.5 * h3);
    float r = (0.16 + 0.22 * fract(h * 5.1)) * (k == 0 ? 1.0 : 1.15);
    // deeper than wide in world space, so the blob reads round after foreshortening
    float blob = smoothstep(r, r * 0.7, length((fract(gp) - c) * vec2(0.8 + 0.4 * h3, 0.9)));
    float ph = fract(h * 7.0 + waterTime * (0.3 + 0.6 * h));
    float on = step(fract(h * 37.9), glintDensity);
    glint = max(glint, on * blob * smoothstep(0.0, 0.2, ph) * smoothstep(0.75, 0.5, ph));
  }
  glint *= 1.0 - 0.85 * tr; // glints ride the crests
  totalEmissiveRadiance += vec3(0.92, 0.96, 1.0) * glint * sparkle * (1.0 + glintFar * far);
  vec3 V = normalize(cameraPosition - vWPos);
  float fr = smoothstep(0.45, 0.15, V.y); // 0 at the hero's row, 1 on grazing views
  totalEmissiveRadiance += sheenColor * sheenAmt * fr * (1.0 - 0.5 * tr);
}`;

const WATER_RIPPLE = /* glsl */ `
{
  // blocky ripples, quantised to the voxel grid so the water still reads as dots
  vec2 p = floor(vWPos.xz * 16.0) / 16.0;
  float a = sin(p.x * 5.1 + waterTime * 1.3) + sin(p.y * 6.3 - waterTime * 1.1) + sin((p.x + p.y) * 3.7 + waterTime * 0.7);
  float b = cos(p.x * 4.3 - waterTime * 0.9) + cos(p.y * 5.7 + waterTime * 1.2);
  vec3 wn = normalize(vec3(a * ripple, 1.0, b * ripple));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`;

export class WaterMaterial extends THREE.MeshStandardMaterial {
  constructor(params = {}) {
    super({
      color: waterValues.color,
      opacity: waterValues.opacity,
      roughness: waterValues.roughness,
      metalness: 0,
      transparent: true,
      ...params,
    });
    this.isWaterMaterial = true;
    // vertex colours are ignored by default; a missing colour attribute reads as white
    this.defaultAttributeValues = { color: [1, 1, 1] };
  }
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, waterUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${WATER_COLOR}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${WATER_GLINTS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${WATER_RIPPLE}`);
  }
  customProgramCacheKey() {
    return 'water-v10';
  }
  copy(source) {
    super.copy(source);
    this.defaultAttributeValues = { ...source.defaultAttributeValues };
    waterMaterials.add(this);
    return this;
  }
  dispose() {
    waterMaterials.delete(this);
    super.dispose();
  }
}

export function makeWaterMaterial(params = {}) {
  const mat = new WaterMaterial(params);
  waterMaterials.add(mat);
  return mat;
}

export function setWaterTime(t) {
  waterUniforms.waterTime.value = t;
}

// ---------------------------------------------------------------- options and look switching
export function setSeams(on) {
  seamOn.value = on ? 1 : 0;
}
export const seamsOn = () => seamOn.value === 1;

export function setFlatMaterials(on) {
  flatMode.value = on ? 1 : 0;
}

function applyBag(U, M = {}) {
  if (M.bevel !== undefined) U.bevel.value = M.bevel;
  if (M.bevelTilt !== undefined) U.bevelTilt.value = M.bevelTilt;
  if (M.edgeLight !== undefined) U.edgeLight.value = M.edgeLight;
  if (M.grid?.width !== undefined) U.gridWidth.value = M.grid.width;
  if (M.grid?.dark !== undefined) U.gridDark.value = M.grid.dark;
  if (M.roughness !== undefined) U.voxRoughness.value = M.roughness;
}

// Switch every kind to a look's values: `material` is the terrain kind, `charMaterial` and
// `fineMaterial` are merged over it for the other kinds (as the lab does), `water` sets the water.
export function applyMaterialLook(look) {
  const base = look.material ?? {};
  const merge = (over = {}) => ({ ...base, ...over, grid: { ...base.grid, ...over.grid } });
  applyBag(BAGS.terrain, base);
  applyBag(BAGS.character, merge(look.charMaterial));
  applyBag(BAGS.fine, look.fineMaterial ?? base);
  for (const kind of MATERIAL_KINDS) SHARED[kind].roughness = BAGS[kind].voxRoughness.value;
  applyWater({ ...WATER_DEFAULTS, ...(look.water ?? {}) });
}

function applyWater(W) {
  const U = waterUniforms;
  for (const k of ['ripple', 'sparkle', 'glintSize', 'glintDensity', 'glintFar', 'glintGrow', 'trough', 'troughFreq']) U[k].value = W[k];
  U.troughDir.value.set(...W.troughDir).normalize();
  U.sheenColor.value.setHex(W.sheenColor);
  U.sheenAmt.value = W.sheen;
  Object.assign(waterValues, { color: W.color, opacity: W.opacity, roughness: W.roughness });
  for (const m of waterMaterials) {
    m.color.setHex(waterValues.color);
    m.opacity = waterValues.opacity;
    m.roughness = waterValues.roughness;
  }
}

// Current values per kind (for the test hook and debugging).
export function materialValues() {
  const out = {};
  for (const kind of MATERIAL_KINDS) {
    const U = BAGS[kind];
    out[kind] = {
      bevel: U.bevel.value,
      bevelTilt: U.bevelTilt.value,
      edgeLight: U.edgeLight.value,
      grid: { width: U.gridWidth.value, dark: U.gridDark.value },
      roughness: U.voxRoughness.value,
    };
  }
  out.seams = seamOn.value === 1;
  out.flat = flatMode.value === 1;
  const U = waterUniforms;
  out.water = {
    ...waterValues,
    ripple: U.ripple.value,
    sparkle: U.sparkle.value,
    glintSize: U.glintSize.value,
    glintDensity: U.glintDensity.value,
    glintFar: U.glintFar.value,
    trough: U.trough.value,
    sheen: U.sheenAmt.value,
  };
  return out;
}

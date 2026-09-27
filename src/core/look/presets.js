// Look presets: every number of the art bible's look (sections 4 to 6, appendix A) as data.
//
// A lighting preset carries a whole look: background, lights and shadow box, reflection environment,
// the values of every material kind, water, ambient occlusion, bloom, glare, exposure, grade and the
// polished-floor reflection. Areas and screens pick one by name (`lighting: 'crypt'`); new looks are
// registered from content files with registerLighting() (src/core/renderer.js), which deep-merges a
// partial preset over the one it `extends` (default 'day').
//
// Depth of field belongs to the camera, not to the lighting: DOF_PRESETS is keyed by camera preset
// name (A, B, C, D, dungeon). A camera preset can carry its own `dof` block instead.

// ---------------------------------------------------------------- overworld (bible OW_A)
export const LOOK_DAY = {
  background: 0x9cc4ec, // sky where it shows between distant terrain
  lights: {
    // weak violet-blue fill: shadowed grass renders #203229 against lit #77a558
    hemi: { sky: 0xb08cff, ground: 0x6a5a90, intensity: 1.35 },
    // measured sun: from the east and toward the camera, about 50 degrees up
    sun: { color: 0xfff4e6, intensity: 3.0, dir: [0.47, 0.76, 0.45], castShadow: true },
    // 44-tile box centred 8 tiles north of the hero, soft PCF (radius in shadow-map texels)
    shadow: { mapSize: 4096, extent: 44, follow: 'hero', offset: [0, 0, -8], bias: -0.0003, normalBias: 0.01, radius: 2 },
    lamp: { color: 0xffb060, intensity: 4.5, distance: 8, decay: 1.5 },
  },
  // gradient "orb" reflected by glossy surfaces (specular only at this strength)
  env: { zenith: 0x78aef5, horizon: 0xeaf4ff, ground: 0x6f8a4a, sun: 0xfff4e0, sunSize: 0.12, intensity: 0.08 },
  // terrain kind (1/8-tile blocks): faint seams
  material: { roughness: 0.48, bevel: 0.16, bevelTilt: 0.75, edgeLight: 0.08, grid: { width: 0.06, dark: 0.88 } },
  // character kind (1/16 voxels), merged over `material`: clearer seams
  charMaterial: { grid: { width: 0.06, dark: 0.62 } },
  // fine kind (dungeon floors at 1/16): the golden-dungeon material values in every look
  fineMaterial: { roughness: 0.42, bevel: 0.16, bevelTilt: 0.75, edgeLight: 0.05, grid: { width: 0.06, dark: 0.85 } },
  water: { color: 0x1f4fb0, opacity: 0.95, roughness: 0.15, ripple: 0.16, sparkle: 2.2 },
  ao: { intensity: 0.85, radius: 0.35, distanceExponent: 1.4, thickness: 0.8, scale: 1.0, samples: 16 },
  bloom: { strength: 0.32, radius: 0.55, threshold: 0.88 },
  glare: { threshold: 3.2, knee: 0.5, strength: 0.3, attenuation: 0.9, angle: 45 },
  tone: { exposure: 0.88 },
  grade: {
    saturation: 1.12,
    contrast: 1.03,
    lift: [0, 0, 0.012],
    gain: [1, 1, 1],
    vignette: 0.06,
    vignetteSoftness: 0.6,
    rim: 0.85,
    rimWidth: 0.033,
    edge: 0.2,
    edgeWidth: 0.2,
  },
  reflect: 0, // polished floor off
  // brief over-bright exposure on arriving from one of these looks (research note, not measured)
  arrivalFlash: { from: ['crypt'], boost: 0.45, seconds: 1.0 },
};

// ---------------------------------------------------------------- golden dungeon (bible DUNGEON_GOLD)
export const LOOK_CRYPT = {
  background: 0x000000, // the void outside the room; no fog
  lights: {
    // near-neutral fill so shaded walls stay brown instead of orange
    hemi: { sky: 0xe6ded6, ground: 0x6a6258, intensity: 1.4 },
    // warm key from above and behind the camera; soft, faint shadows
    sun: { color: 0xffd4a0, intensity: 1.8, dir: [0.15, 1.0, 0.55], castShadow: true },
    shadow: { mapSize: 2048, extent: 24, follow: 'subject', offset: [0, 0, 0], bias: -0.0004, normalBias: 0.01, radius: 3 },
    // wall sconces (content places them; makeLampLight() reads these)
    lamp: { color: 0xffb060, intensity: 4.5, distance: 8, decay: 1.5 },
  },
  env: { zenith: 0x604a38, horizon: 0x9a7a5a, ground: 0x3a2a1e, sun: 0x000000, sunSize: 0.12, intensity: 0.4 },
  material: { roughness: 0.42, bevel: 0.16, bevelTilt: 0.75, edgeLight: 0.05, grid: { width: 0.06, dark: 0.85 } },
  charMaterial: { grid: { width: 0.06, dark: 0.62 } },
  fineMaterial: { roughness: 0.42, bevel: 0.16, bevelTilt: 0.75, edgeLight: 0.05, grid: { width: 0.06, dark: 0.85 } },
  water: { color: 0x1f78d8, opacity: 0.9, roughness: 0.12, ripple: 0.16, sparkle: 2.5 },
  ao: { intensity: 0.85, radius: 0.35, distanceExponent: 1.4, thickness: 0.8, scale: 1.0, samples: 16 },
  bloom: { strength: 0.5, radius: 0.6, threshold: 0.8 },
  glare: { threshold: 3.2, knee: 0.5, strength: 0.3, attenuation: 0.9, angle: 45 },
  tone: { exposure: 1.1 },
  grade: {
    saturation: 1.0,
    contrast: 1.03,
    lift: [0, 0, 0.012],
    gain: [1, 1, 1],
    vignette: 0.06,
    vignetteSoftness: 0.6,
    rim: 0.85,
    rimWidth: 0.033,
    edge: 0.2,
    edgeWidth: 0.2,
  },
  reflect: 0.5, // additive planar reflection strength (polished floor)
  arrivalFlash: null,
};

// ---------------------------------------------------------------- depth of field per camera preset
// focus = view depth of the hero's feet + focusOffset; no blur within +-focusRange of it; the blur
// radius ramps linearly to farMaxBlur over farRamp tiles behind and to nearMaxBlur over nearRamp
// tiles in front. Blur radii are px at 720p and scale with the screen height.
export const DOF_PRESETS = {
  A: { focusOffset: 0.9, focusRange: 0.3, farRamp: 5, nearRamp: 2.4, farMaxBlur: 16, nearMaxBlur: 10 },
  // B is visibly less blurred (estimated); appendix A sets its focus offset to 0
  B: { focusOffset: 0, focusRange: 2.5, farRamp: 8, nearRamp: 5, farMaxBlur: 7, nearMaxBlur: 4 },
  // C and D are unmeasured cameras: guesses between B and A
  C: { focusOffset: 0, focusRange: 3, farRamp: 10, nearRamp: 6, farMaxBlur: 6, nearMaxBlur: 3 },
  D: { focusOffset: 0.9, focusRange: 0.3, farRamp: 4.5, nearRamp: 2.2, farMaxBlur: 16, nearMaxBlur: 10 },
  // the fixed dungeon camera: nearly sharp frames (lab: focused on the room with no offset)
  dungeon: { focusOffset: 0, focusRange: 3, farRamp: 8, nearRamp: 6, farMaxBlur: 4, nearMaxBlur: 3 },
};

export function dofForCamera(name, preset) {
  return preset?.dof ?? DOF_PRESETS[name] ?? (preset?.fixed ? DOF_PRESETS.dungeon : DOF_PRESETS.A);
}

// ---------------------------------------------------------------- quality levels
//   high    everything
//   medium  no GTAO, 32 DOF samples, no glare
//   low     no post pass: direct render with ACES and the bevel material (no polished floor)
//   flat    no post, no tone mapping, flat materials (no bevel, edge light or seams): for debugging
export const QUALITY_LEVELS = {
  high: { post: true, ao: true, dofSamples: 96, bloom: true, glare: true, reflect: true, msaa: 4, shadowMapMax: 4096 },
  medium: { post: true, ao: false, dofSamples: 32, bloom: true, glare: false, reflect: true, msaa: 4, shadowMapMax: 4096 },
  low: { post: false, ao: false, dofSamples: 0, bloom: false, glare: false, reflect: false, msaa: 0, shadowMapMax: 2048 },
  flat: { post: false, ao: false, dofSamples: 0, bloom: false, glare: false, reflect: false, msaa: 0, shadowMapMax: 2048, flat: true },
};
export const QUALITY_ORDER = ['high', 'medium', 'low', 'flat'];

// ---------------------------------------------------------------- merging
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

// Deep merge for presets: plain objects merge key by key; arrays, numbers and null replace.
export function mergeLook(base, over) {
  if (!isPlain(over)) return over === undefined ? base : over;
  const out = isPlain(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(over)) out[k] = isPlain(v) && isPlain(out[k]) ? mergeLook(out[k], v) : v;
  return out;
}

// The prototype's flat keys (background, sky, ground, hemi, sunColor, sun) mapped onto a look.
export function fromLegacy(preset) {
  const { sky, ground, hemi, sunColor, sun, ...rest } = preset;
  const out = { ...rest };
  const lights = { ...(rest.lights ?? {}) };
  const h = isPlain(hemi) ? hemi : {};
  if (sky !== undefined) h.sky = sky;
  if (ground !== undefined) h.ground = ground;
  if (typeof hemi === 'number') h.intensity = hemi;
  if (Object.keys(h).length) lights.hemi = { ...(lights.hemi ?? {}), ...h };
  const s = isPlain(sun) ? sun : {};
  if (sunColor !== undefined) s.color = sunColor;
  if (typeof sun === 'number') s.intensity = sun;
  if (Object.keys(s).length) lights.sun = { ...(lights.sun ?? {}), ...s };
  if (Object.keys(lights).length) out.lights = lights;
  return out;
}

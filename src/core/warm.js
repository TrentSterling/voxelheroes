// Shader warm-up for a whole look frame, before the first one is drawn (main.js).
//
// three.js makes a shader program the moment a draw first needs it and asks it for its uniforms
// right away, which waits for the driver to finish linking it: on ANGLE / Direct3D 11 that was
// ~1 s for the first frame (the scene's materials as the look draws them, into its own linear
// target, ~470 ms; the GTAO denoiser alone ~450 ms; the rest of the post stack ~100 ms), one long
// task right after the title showed. Here every one of those programs is created ahead with
// renderer.compileAsync, which with KHR_parallel_shader_compile links them on the driver's own
// threads and resolves once all are done; the first frame then only draws.
//
// What it compiles:
//   the scene   for the target the look draws it into (look.pipeline.sceneRT, linear, no tone
//               mapping) when the quality has a post stack, else for the canvas with the tone
//               mapping the look sets there (ACES; none for 'flat')
//   the post    every material the look pipeline's passes draw with (found through its fields:
//               full-screen quads, bloom, the blur pyramids, and GTAO, built first when the
//               quality uses it), on a stand-in quad, for its linear targets, and the last pass
//               (the grade) for the canvas
//   stubs       (opts.stubs) a stand-in mesh for every kind of mesh the game draws that the scene
//               may not hold yet (STUBS below): dungeon glow and void, the sword's slab and swipe
// Lights: see below (the point-light count). Shadow-map depth programs are left to the first
// frame: two of them, ~12 ms together.
// The look (core/look) runs this with stubs behind the title (look.warmUp); main.js runs it again
// once the start ring is in, and a load's black hold once more (systems/transitions.js). It only
// ever compiles (it changes nothing the look draws).
//
// Why it matters most in Firefox: it has no KHR_parallel_shader_compile, so every program links on
// the spot, 50-150 ms each for the lit ones on ANGLE / D3D11, and the frame after waits for all of
// them. Entering D1 there was one ~750 ms frame: the load's compile ran with the canvas as the
// target (13 programs for a variant no frame ever draws) and the dungeon's own programs (glow, void,
// polished floor) had never been made with the lamps' light count. A program is keyed by its target,
// the point-light count and a few mesh traits (vertex colours with alpha, normals, instancing), not
// by the look, so what is made here once serves every look.
import * as THREE from 'three';
import { QUALITY_LEVELS } from './look/presets.js';
import { MAX_LIT_LAMPS } from './look/lights.js';
import { MATERIAL_KINDS, getMaterial, getBackdropMaterial, makeGlowMaterial } from './materials.js';
import { waterMaterial } from '../world/terrain.js';

// Stand-ins for meshes the start screen does not hold, one per program they need: every voxel kind
// and the backdrop, water, the unlit glow (dungeon lamps, flames, braziers, the void's 'unlit-black'
// layer, beams, eyes), the full-life sword's plain slab and its swipe (vertex colours with alpha, no
// normals; systems/sword-fx.js builds both the first time the hero swings). A new kind of mesh that
// is first drawn in play (and would stall a Firefox frame) gets a line here. The stand-ins' own
// materials are kept for good: three.js frees a program when the last material holding it is
// disposed, and these hold the programs until the real meshes arrive.
const STUBS = [
  ...MATERIAL_KINDS.map((k) => () => [getMaterial(k), { normal: 3, uv: 2 }]),
  () => [getBackdropMaterial(), { normal: 3, uv: 2 }],
  () => [waterMaterial(), { normal: 3, uv: 2 }],
  () => [makeGlowMaterial(), { normal: 3, uv: 2, color: 3 }],
  () => [makeGlowMaterial(), { normal: 3, color: 3 }],
  () => [new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.45, metalness: 0 }), { normal: 3, uv: 2 }],
  () => [new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), { color: 4 }],
];
let stubMeshes = null;

// Add the stand-ins to `scene` (invisible: compile() walks the graph whatever is visible); returns
// the function that takes them out again.
export function addWarmStubs(scene) {
  stubMeshes ??= STUBS.map((f) => {
    const [material, attrs] = f();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    for (const [name, n] of Object.entries(attrs)) geo.setAttribute(name, new THREE.Float32BufferAttribute(new Array(3 * n).fill(0), n));
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'warm-stub';
    mesh.visible = false;
    mesh.castShadow = true;
    return mesh;
  });
  for (const m of stubMeshes) scene.add(m);
  return () => {
    for (const m of stubMeshes) scene.remove(m);
  };
}

// Materials reachable from `root` through its own fields (arrays, plain objects, class instances),
// never through the renderer, scenes, cameras, textures or render targets; a mesh gives its
// material only.
function materialsOf(root, depth = 4) {
  const found = new Set();
  const seen = new Set();
  const visit = (v, d) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (v.isMaterial) return void found.add(v);
    if (v.isWebGLRenderer || v.isScene || v.isCamera || v.isTexture || v.isRenderTarget || v.isWebGLRenderTarget || v.isBufferGeometry) return;
    if (v.isMesh) {
      for (const m of [v.material].flat()) if (m?.isMaterial) found.add(m);
      return;
    }
    if (v.isObject3D || d <= 0 || ArrayBuffer.isView(v)) return;
    for (const k of Object.keys(v)) visit(v[k], d - 1);
  };
  visit(root, depth);
  return found;
}

// Compile everything the next look frame will draw with; resolves when the driver has linked it.
// stubs: add the stand-ins (STUBS) for the compile; post: false leaves the post stack out (a load's
// black hold: the passes do not change with the area, and were made at boot).
export function warmLookFrame({ renderer, scene, camera, look, stubs = false, post = true }) {
  const quality = QUALITY_LEVELS[look.quality?.()] ?? QUALITY_LEVELS.high;
  const pipe = look.pipeline;
  const was = { target: renderer.getRenderTarget(), toneMapping: renderer.toneMapping };
  const jobs = [];
  // The lit programs bake in how many point lights are on, and the look always keeps exactly
  // MAX_LIT_LAMPS on (real lamps near the view, topped up with zero-intensity pads,
  // core/look/lights.js cullLamps), but only while it draws: switch pads on for the compile too.
  const layers = [];
  let lit = 0;
  scene.traverse((o) => {
    if (o.isPointLight || o.isSpotLight) {
      layers.push([o, o.layers.mask]);
      if (o.layers.test(camera.layers)) lit++;
    }
  });
  for (const [o] of layers) if (lit < MAX_LIT_LAMPS && o.userData.isPad && !o.layers.test(camera.layers)) {
    o.layers.enable(0);
    lit++;
  }
  const unstub = stubs ? addWarmStubs(scene) : null;
  // A mesh with no vertices yet (the sword's swipe before the first spin) would make a program for
  // a geometry no frame ever draws: kept out of the compile.
  const empty = [];
  scene.traverse((o) => {
    if (o.isMesh && o.material && !o.geometry?.attributes?.position) {
      empty.push([o, o.material]);
      o.material = null;
    }
  });
  try {
    if (quality.post && pipe?.sceneRT) {
      renderer.setRenderTarget(pipe.sceneRT);
      renderer.toneMapping = THREE.NoToneMapping;
      jobs.push(renderer.compileAsync(scene, camera));
    }
    if (quality.post && pipe?.sceneRT && post) {
      if (quality.ao) pipe.ensureGtao?.();
      const stand = new THREE.Scene();
      // the same triangle a FullScreenQuad draws (position and uv only: normals would be another program)
      const quad = new THREE.BufferGeometry();
      quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
      quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
      // the canvas: only the last pass draws there (the grade), so only it needs that variant, and
      // only there
      const last = pipe.gradeQ?.material;
      for (const m of materialsOf(pipe)) if (m !== last) stand.add(new THREE.Mesh(quad, m));
      jobs.push(renderer.compileAsync(stand, camera)); // linear targets (no lights, no fog: a pass draws its quad alone)
      renderer.setRenderTarget(null);
      const onCanvas = last ? new THREE.Scene().add(new THREE.Mesh(quad, last)) : stand;
      jobs.push(renderer.compileAsync(onCanvas, camera));
      Promise.allSettled(jobs).then(() => quad.dispose());
    } else if (!(quality.post && pipe?.sceneRT)) {
      renderer.setRenderTarget(null);
      renderer.toneMapping = quality.flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      jobs.push(renderer.compileAsync(scene, camera));
    }
  } finally {
    for (const [o, m] of empty) o.material = m;
    unstub?.();
    renderer.setRenderTarget(was.target);
    renderer.toneMapping = was.toneMapping;
    for (const [o, mask] of layers) o.layers.mask = mask;
  }
  return Promise.allSettled(jobs);
}

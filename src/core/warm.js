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
//               quality uses it), on a stand-in quad, for its linear targets and for the canvas
// Lights: see below (the point-light count). Shadow-map depth programs are left to the first
// frame: two of them, ~12 ms together.
// The look (core/look) could do all this in its own warmUp; until it does, this reads it from the
// outside and only ever compiles (it changes nothing the look draws).
import * as THREE from 'three';
import { QUALITY_LEVELS } from './look/presets.js';
import { MAX_LIT_LAMPS } from './look/lights.js';

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
export function warmLookFrame({ renderer, scene, camera, look }) {
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
  try {
    if (quality.post && pipe?.sceneRT) {
      renderer.setRenderTarget(pipe.sceneRT);
      renderer.toneMapping = THREE.NoToneMapping;
      jobs.push(renderer.compileAsync(scene, camera));
      if (quality.ao) pipe.ensureGtao?.();
      const stand = new THREE.Scene();
      // the same triangle a FullScreenQuad draws (position and uv only: normals would be another program)
      const quad = new THREE.BufferGeometry();
      quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
      quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
      for (const m of materialsOf(pipe)) stand.add(new THREE.Mesh(quad, m));
      jobs.push(renderer.compileAsync(stand, camera)); // linear targets (no lights, no fog: a pass draws its quad alone)
      renderer.setRenderTarget(null);
      jobs.push(renderer.compileAsync(stand, camera)); // the canvas (the last pass)
      Promise.allSettled(jobs).then(() => quad.dispose());
    } else {
      renderer.setRenderTarget(null);
      renderer.toneMapping = quality.flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      jobs.push(renderer.compileAsync(scene, camera));
    }
  } finally {
    renderer.setRenderTarget(was.target);
    renderer.toneMapping = was.toneMapping;
    for (const [o, mask] of layers) o.layers.mask = mask;
  }
  return Promise.allSettled(jobs);
}

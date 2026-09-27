// Reflection environment: a small gradient "orb" (zenith, horizon, ground and an optional sun spot)
// prefiltered with PMREM, standing in for the per-area sphere maps the reference reflects (art bible
// section 4). scene.environmentIntensity sets its strength; three.js uses that value instead of each
// material's envMapIntensity for scene.environment, as the lab did.
import * as THREE from 'three';

const cache = new Map();

function makeGradientEnv(renderer, { zenith, horizon, ground, sun = 0x000000, sunSize = 0.12 }, sunDir) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 64, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      zenith: { value: new THREE.Color(zenith) },
      horizon: { value: new THREE.Color(horizon) },
      ground: { value: new THREE.Color(ground) },
      sun: { value: new THREE.Color(sun) },
      sunDir: { value: new THREE.Vector3(...sunDir).normalize() },
      sunSize: { value: sunSize },
    },
    vertexShader: /* glsl */ `varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 zenith, horizon, ground, sun, sunDir; uniform float sunSize; varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(horizon, zenith, pow(y, 0.6)) : mix(horizon, ground, pow(-y, 0.45));
        c += sun * smoothstep(1.0 - sunSize, 1.0, dot(normalize(vDir), sunDir));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  return rt.texture;
}

// One prefiltered texture per distinct gradient, built on first use and kept.
export function gradientEnvironment(renderer, env, sunDir = [0, 1, 0]) {
  const key = JSON.stringify([env.zenith, env.horizon, env.ground, env.sun ?? 0, env.sunSize ?? 0.12, sunDir]);
  let tex = cache.get(key);
  if (!tex) {
    tex = makeGradientEnv(renderer, env, sunDir);
    cache.set(key, tex);
  }
  return tex;
}

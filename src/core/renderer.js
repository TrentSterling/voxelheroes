// WebGL renderer, the one scene, the camera object and the two lights.
//
// Lighting is data: LIGHTING maps a preset name to background, sky and sun
// values. Areas and screens pick a preset by name (`lighting: 'crypt'`), and
// new looks are added with registerLighting() instead of editing this file.
import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10201a);

// Framing (fov, distance, pitch) is owned by core/camera.js.
export const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

export const hemi = new THREE.HemisphereLight(0xe4f2ff, 0x55603a, 1.5);
scene.add(hemi);

export const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// background: scene clear colour; sky/ground: hemisphere colours; sun: key light.
export const LIGHTING = {
  day: { background: 0x10201a, sky: 0xe4f2ff, ground: 0x55603a, hemi: 1.5, sunColor: 0xfff0d0, sun: 2.4 },
  crypt: { background: 0x0b0910, sky: 0x9fa8d8, ground: 0x55603a, hemi: 0.9, sunColor: 0xffc890, sun: 1.6 },
};

export function registerLighting(name, preset) {
  LIGHTING[name] = { ...LIGHTING.day, ...preset };
}

let currentLighting = null;

export function applyLighting(name = 'day') {
  const L = LIGHTING[name];
  if (!L) throw new Error(`Unknown lighting preset "${name}"`);
  currentLighting = name;
  scene.background.setHex(L.background);
  hemi.intensity = L.hemi;
  hemi.color.setHex(L.sky);
  hemi.groundColor.setHex(L.ground);
  sun.intensity = L.sun;
  sun.color.setHex(L.sunColor);
}

export const lightingName = () => currentLighting;

// The sun (and its shadow box) follows whatever the camera looks at.
export function followSun(target) {
  sun.position.set(target.x - 7, 20, target.z + 9);
  sun.target.position.copy(target);
}

export function mountRenderer(container) {
  container.appendChild(renderer.domElement);
}

export function renderScene() {
  renderer.render(scene, camera);
}

// Light rigs (art bible section 4): a hemisphere fill, one shadow-casting key light and the point
// lights content places (wall lamps).
//
// The key light's shadow box follows the hero in the overworld (44 tiles wide, centred 8 tiles north
// of the hero) and the camera subject in dungeons (the room centre). Its centre snaps to whole
// shadow-map texels in light space so shadow edges do not crawl while the hero walks.
//
// Point lights: three.js shades every lit fragment with every point light in the scene, and the world
// keeps every screen built, so lamps far from the camera are switched off (their layer 0 bit is
// cleared, which leaves `visible` to content). Lamps never cast shadows.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _c = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class LightRig {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xb08cff, 0x6a5a90, 1.35);
    this.sun = new THREE.DirectionalLight(0xfff4e6, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    this.dir = new THREE.Vector3(0.47, 0.76, 0.45).normalize();
    this.shadow = { extent: 44, follow: 'hero', offset: [0, 0, -8], mapSize: 4096 };
    scene.add(this.hemi, this.sun, this.sun.target);
    this.lamps = [];
    this.lampScanAge = Infinity;
  }

  // Colours, intensities and the shadow setup of a look (L = look.lights), capped by quality.
  apply(L, quality) {
    const { hemi, sun } = this;
    hemi.color.setHex(L.hemi.sky);
    hemi.groundColor.setHex(L.hemi.ground);
    hemi.intensity = L.hemi.intensity;
    sun.color.setHex(L.sun.color);
    sun.intensity = L.sun.intensity;
    this.dir.set(...L.sun.dir).normalize();
    const S = L.shadow ?? {};
    sun.castShadow = L.sun.castShadow !== false && !!L.shadow;
    const mapSize = Math.min(S.mapSize ?? 2048, quality.shadowMapMax ?? 4096);
    if (sun.shadow.mapSize.x !== mapSize) {
      sun.shadow.mapSize.set(mapSize, mapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null; // re-created at the new size on the next render
    }
    const half = (S.extent ?? 44) / 2;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = S.bias ?? -0.0003;
    sun.shadow.normalBias = S.normalBias ?? 0.01;
    sun.shadow.radius = S.radius ?? 2;
    this.shadow = { extent: half * 2, follow: S.follow ?? 'hero', offset: S.offset ?? [0, 0, 0], mapSize };
    this.lamp = L.lamp ?? null;
  }

  // Aim the key light and its shadow box. hero and subject are ground points (x, z).
  place(hero, subject) {
    const S = this.shadow;
    const from = S.follow === 'subject' || !hero ? subject : hero;
    _c.set(from.x + S.offset[0], S.offset[1], from.z + S.offset[2]);
    // snap the box centre to shadow-map texels, in the light camera's own x / y axes
    const texel = S.extent / S.mapSize;
    _x.crossVectors(UP, this.dir).normalize();
    _y.crossVectors(this.dir, _x);
    const px = _c.dot(_x);
    const py = _c.dot(_y);
    _c.addScaledVector(_x, Math.round(px / texel) * texel - px).addScaledVector(_y, Math.round(py / texel) * texel - py);
    this.sun.position.copy(_c).addScaledVector(this.dir, 30);
    this.sun.target.position.copy(_c);
    this.sun.updateMatrixWorld();
    this.sun.target.updateMatrixWorld();
  }

  // Switch point lights on only near the view (rect in world x / z, grown by `margin`).
  cullLamps(rect, margin = 2) {
    if (++this.lampScanAge > 30) this.scanLamps();
    for (const l of this.lamps) {
      if (!l.parent) continue;
      l.castShadow = false;
      l.getWorldPosition(_v);
      const near = _v.x > rect.x0 - margin && _v.x < rect.x1 + margin && _v.z > rect.z0 - margin && _v.z < rect.z1 + margin;
      if (near) l.layers.enable(0);
      else l.layers.disable(0);
    }
  }

  scanLamps() {
    this.lampScanAge = 0;
    this.lamps.length = 0;
    this.scene.traverse((o) => {
      if (o.isPointLight || o.isSpotLight) this.lamps.push(o);
    });
  }
}

// A wall-lamp light with the active look's lamp values (bible: warm #ffb060, 4.5, range 8, decay 1.5).
export function makeLampLightFrom(lamp, overrides = {}) {
  const L = { color: 0xffb060, intensity: 4.5, distance: 8, decay: 1.5, ...(lamp ?? {}), ...overrides };
  const light = new THREE.PointLight(L.color, L.intensity, L.distance, L.decay);
  light.castShadow = false;
  light.name = 'lamp';
  return light;
}

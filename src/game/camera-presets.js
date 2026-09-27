// Camera presets more than one M2 stream uses, registered once here so no
// stream has to (a missing preset throws when a screen names it, and a
// second registerCameraPreset silently replaces the first). Contracts owns
// this file; world owns core/camera.js.
//
//   'boss'        the boss arena (gameplay spec 4.2): pitch 41.5, fov 28,
//                 height TUNING.camera.bossHeight (17.5), fixed on the arena.
//                 Arena screens say camera: 'boss' (D1's and foes-dungeon's
//                 test arena alike).
//   'boss-intro'  the intro's push-in: the same lens TUNING.camera.bossIntro.zoom
//                 (30%) closer. foes-dungeon's 'boss-intro' mode tweens to it
//                 over bossIntro.in s and back to 'boss' over bossIntro.out s
//                 (core/camera.js startCameraTween / stepCameraTween).
//
// Neither is a player choice (selectable: false). On main, presets fill
// their missing fields from preset A; after feat/world they carry pitch,
// fov, height, lead and fixed.
import { TUNING } from '../core/tuning.js';
import { registerCameraPreset } from '../core/camera.js';

const C = TUNING.camera;

registerCameraPreset('boss', { label: 'Boss arena', selectable: false, pitch: 41.5, fov: 28, height: C.bossHeight, lead: 0, fixed: true });
registerCameraPreset('boss-intro', {
  label: 'Boss intro',
  selectable: false,
  pitch: 41.5,
  fov: 28,
  height: C.bossHeight * (1 - C.bossIntro.zoom),
  lead: 0,
  fixed: true,
});

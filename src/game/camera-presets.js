// Camera presets more than one M2 stream uses, registered once here so no
// stream has to (a missing preset throws when a screen names it, and a
// second registerCameraPreset silently replaces the first). Contracts owns
// this file; world owns core/camera.js.
//
//   'boss'        the boss arena: the art bible's large-room rig (section 3,
//                 DGN_BIG: pitch 52.978, fov 37.07, height
//                 TUNING.camera.bossHeight, 15.103), following the hero,
//                 clamped to the arena (section 9).
//                 Arena screens say camera: 'boss' (D1's and foes-dungeon's
//                 test arena alike).
//   'boss-intro'  the intro's push-in: the same lens TUNING.camera.bossIntro.zoom
//                 (30%) closer. foes-dungeon's 'boss-intro' mode tweens to it
//                 over bossIntro.in s and back to 'boss' over bossIntro.out s
//                 (core/camera.js startCameraTween / stepCameraTween).
//
// Neither is a player choice (selectable: false). registerCameraPreset
// needs pitch, fov and height and fills in the rest (lead 0, not fixed, not
// selectable); these give every field.
import { TUNING } from '../core/tuning.js';
import { registerCameraPreset } from '../core/camera.js';

const C = TUNING.camera;

const BIG = { pitch: 52.978, fov: 37.07, lead: 0, follow: true, fixed: false };
registerCameraPreset('boss', { label: 'Boss arena', selectable: false, ...BIG, height: C.bossHeight });
registerCameraPreset('boss-intro', { label: 'Boss intro', selectable: false, ...BIG, height: C.bossHeight * (1 - C.bossIntro.zoom) });

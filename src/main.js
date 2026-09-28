// Bootstrap: register all content, build the world, start the loop.
// Module map and extension points: docs/ARCHITECTURE.md.
import './style.css';
import './content.js';
import * as THREE from 'three';
import { scene, mountRenderer, renderScene, look, camera } from './core/renderer.js';
import { setCutaway } from './core/materials.js';
import { hitstopTick } from './core/hitstop.js';
import { GROUND_Y } from './core/constants.js';
import { initCamera, placeCamera, followSubject, cameraPreset, currentCameraPreset } from './core/camera.js';
import { initInput, input } from './core/input.js';
import { initAudio } from './core/audio.js';
import { startLoop, isManual } from './core/loop.js';
import { setMode, updateMode } from './core/modes.js';
import { state, serializeState, loadState } from './core/state.js';
import { world, currentScreen } from './world/world.js';
import { allAreas } from './world/areas.js';
import { player } from './entities/player.js';
import { initParticles, updateParticles } from './systems/particles.js';
import { updateCritters } from './systems/critters.js';
import { tickClock } from './game/clock.js';
import { placeAtStart, loadGame } from './systems/flow.js';
import { applyScreenAmbience, syncScreenVisibility, shownRect } from './systems/transitions.js';
import { initHud, refreshHud, setAreaLabel, toggleMuteUi } from './ui/hud.js';
import { initOverlay } from './ui/overlay.js';
import { initLoadCard } from './ui/loadcard.js';
import { installTestHook } from './debug/testhook.js';
import { initCheats } from './debug/cheats.js';

mountRenderer(document.getElementById('game'));
initCamera();
// The look reads the hero (shadow box, depth-of-field focus) and the camera preset (DOF band).
look.bind({ hero: player, cameraPreset: currentCameraPreset, cameraPresetName: cameraPreset, roomRect: shownRect });
initInput();
input.onGesture(initAudio); // browsers only allow sound after a key press or tap
initOverlay();
initLoadCard();
initCheats();
initParticles(scene);
world.build(scene, allAreas());
scene.add(player.object);
initHud();
placeAtStart();
applyScreenAmbience(currentScreen());
setAreaLabel(currentScreen().name);
setMode('title');

// One simulation step. Every mode shares the world animation, particles and
// camera; the mode decides what else moves.
function update(dt) {
  if (hitstopTick(dt)) {
    placeCamera();
    return; // held presses stay buffered for the step after the hold
  }
  state.time += dt;
  world.update(state.time, dt);
  if (input.pressed('mute')) toggleMuteUi();
  updateMode(dt);
  tickClock(dt);
  updateParticles(dt);
  updateCritters(dt);
  world.flush();
  // Far screens of a fresh area: in 8 ms slices while the loading card holds, else 2 ms (at least
  // one screen per step either way).
  world.buildPending(state.mode === 'warp' ? 8 : 2);
  syncScreenVisibility();
  followSubject(player, currentScreen());
  placeCamera();
  input.endFrame();
}

const _cutHero = new THREE.Vector3();
const _cutCam = new THREE.Vector3();
function render() {
  refreshHud();
  setCutaway(_cutHero.set(player.x, GROUND_Y + 0.5, player.z), camera.getWorldPosition(_cutCam), GROUND_Y);
  renderScene();
}

// The real-time loop's draw. It also feeds the look's frame-time watchdog, which drops one
// quality level when frames stay slow. In manual mode (play-tests) the page only draws when the
// test hook asks (render()): a full look frame takes seconds in software GL.
function loopRender() {
  if (isManual()) {
    refreshHud();
    return;
  }
  render();
  look.sampleFrame(performance.now());
}

installTestHook({ update, render });

// claude.ai hot reload: keep the run going across code edits.
function start(data = {}) {
  if (data && data.mode && data.mode !== 'title' && data.save) {
    try {
      loadGame(data.save);
    } catch {
      loadState({});
    }
  }
  placeCamera();
  startLoop(update, loopRender);
}

const hot = window.claude?.hot;
try {
  hot?.snapshot?.(() => ({
    mode: ['scroll', 'warp', 'dead'].includes(state.mode) ? 'title' : state.mode,
    save: serializeState(),
  }));
} catch {
  // hot reload is optional
}
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

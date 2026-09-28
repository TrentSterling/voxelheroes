// Title screen: the hero idles at the start screen behind the title panel
// (its content is the #overlay markup in index.html). Enter/Space or the
// button starts the game.
import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode } from '../../core/modes.js';
import { player } from '../../entities/player.js';
import { startGame } from '../../systems/flow.js';
import { showOverlay, setOverlayAction } from '../overlay.js';
import { $ } from '../dom.js';
import { scene } from '../../core/renderer.js';
import { GROUND_Y } from '../../core/constants.js';
import { makeLogo } from '../../models/logo.js';

// The key art: the boxel logo stands in the courtyard behind the hero, and the panel is a compact
// bar along the bottom (body.title-mode in style.css) so the scene is the first thing you see.
let logo = null;

// The panel as index.html draws it, restored when returning to the title.
let titlePanel = null;

registerMode('title', {
  enter() {
    if (!logo) logo = makeLogo();
    logo.position.set(player.x, GROUND_Y + 1.35, player.z - 3.2);
    scene.add(logo);
    document.body.classList.add('title-mode');
    if (!titlePanel) {
      titlePanel = {
        title: $('overlay-title').textContent,
        msg: $('overlay-msg').textContent,
        button: $('start').textContent,
        kicker: document.querySelector('#overlay .kicker').textContent,
      };
      setOverlayAction(startGame);
    } else {
      showOverlay({ ...titlePanel, onAction: startGame });
    }
  },
  exit() {
    if (logo) scene.remove(logo);
    document.body.classList.remove('title-mode');
  },
  update(dt) {
    if (logo) {
      logo.position.y = GROUND_Y + 1.35 + Math.sin(state.time * 1.4) * 0.06;
      logo.rotation.y = Math.sin(state.time * 0.5) * 0.06;
    }
    // The hero looks around while waiting.
    player.yaw = Math.sin(state.time * 0.8) * 0.6;
    player.animate(dt, false);
    if (input.pressed('confirm')) startGame();
  },
});

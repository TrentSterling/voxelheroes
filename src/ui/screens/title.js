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

// The panel as index.html draws it, restored when returning to the title.
let titlePanel = null;

registerMode('title', {
  enter() {
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
  update(dt) {
    // The hero looks around while waiting.
    player.yaw = Math.sin(state.time * 0.8) * 0.6;
    player.animate(dt, false);
    if (input.pressed('confirm')) startGame();
  },
});

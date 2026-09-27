// Pause: Start (Enter, Esc or P) in play pushes this mode; Start again or the
// button returns to play.
import { input } from '../../core/input.js';
import { registerMode } from '../../core/modes.js';
import { currentScreen } from '../../world/world.js';
import { resumeGame } from '../../systems/flow.js';
import { showOverlay, hideOverlay } from '../overlay.js';

registerMode('paused', {
  enter() {
    showOverlay({
      title: 'Paused',
      msg: 'Take a breather. The slimes will wait.',
      button: 'Resume',
      kicker: currentScreen().name,
      onAction: resumeGame,
    });
  },
  exit() {
    hideOverlay();
  },
  update() {
    if (input.pressed('menu')) resumeGame();
  },
});

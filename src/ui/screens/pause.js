// Pause: Start (Enter, Esc or P) in play pushes this mode; Start again or the
// button returns to play.
import { input } from '../../core/input.js';
import { registerMode } from '../../core/modes.js';
import { currentScreen } from '../../world/world.js';
import { resumeGame } from '../../systems/flow.js';
import { showOverlay, hideOverlay } from '../overlay.js';
import { openEquipment } from './equipment.js';

registerMode('paused', {
  enter() {
    showOverlay({
      title: 'Paused',
      msg: 'Take a breather. The slimes will wait.',
      button: 'Resume',
      kicker: currentScreen().name,
      onAction: resumeGame,
      secondary: { label: 'Equipment', onAction: openEquipment },
    });
  },
  exit() {
    hideOverlay();
  },
  update() {
    if (input.pressed('inventory')) { openEquipment(); return; }
    if (input.pressed('menu')) resumeGame();
  },
});

// Falling: the hero tips over, enemies spin, then the game-over panel offers a
// fresh start with full health (startGame) at the entrance of the dungeon he
// fell in, or else at the respawn point.
import { GROUND_Y } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode } from '../../core/modes.js';
import { entitiesOfKind } from '../../entities/manager.js';
import { player } from '../../entities/player.js';
import { startGame, continueScreen } from '../../systems/flow.js';
import { showOverlay, overlayVisible } from '../overlay.js';

const PANEL_DELAY = 1.2; // seconds before the panel appears and input counts

registerMode('dead', {
  update(dt) {
    state.deadT += dt;
    const k = Math.min(1, state.deadT / 0.5);
    const root = player.hero.root;
    root.rotation.z = k * (Math.PI / 2);
    root.position.y = GROUND_Y + 0.25 * k;
    root.visible = true;
    for (const e of entitiesOfKind('enemy')) e.object.rotation.y += dt * 2;
    if (state.deadT <= PANEL_DELAY) return;
    if (!overlayVisible()) {
      const where = continueScreen()?.name ?? 'the start';
      const gems = state.gems;
      showOverlay({
        title: 'You fell',
        msg: `You collected ${gems} gem${gems === 1 ? '' : 's'}. Get back up and try again from the ${where}.`,
        button: 'Try again',
        kicker: 'Game over',
        onAction: startGame,
      });
    }
    if (input.pressed('confirm')) startGame();
  },
});

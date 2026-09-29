// Title screen: the hero idles at the start screen behind the title panel
// (its content is the #overlay markup in index.html). Enter/Space or the
// button starts the game.
import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode } from '../../core/modes.js';
import { player } from '../../entities/player.js';
import { startNewGame } from '../../game/progress.js';
import { slotSummary, loadSlot } from '../../game/saves.js';
import { getArea } from '../../world/areas.js';
import { showOverlay } from '../overlay.js';
import { $ } from '../dom.js';
import { scene } from '../../core/renderer.js';
import { GROUND_Y } from '../../core/constants.js';
import { makeLogo } from '../../models/logo.js';

// The key art: the boxel logo stands in Mossbrook Square behind the hero, and the panel is a
// compact bar along the bottom (body.title-mode in style.css) so the scene is the first thing you see.
let logo = null;
// Hovering just behind the hero and well above him, so it sits in front of the square's
// houses in depth (they clipped its ends at 3.2 back) and in the DOF focus band with him.
const LOGO_Y = 3.0;
const LOGO_BACK = 0.6;
const LOGO_SCALE = 0.78;

// The story text as index.html draws it, restored when returning to the title (the buttons below
// are rebuilt fresh every time, since which save exists can change between visits).
let titlePanel = null;

const SAVE_SLOT = 1; // the one slot autosave and Continue use (game/saves.js has 3; no picker yet)

// A fresh start, whatever state the title was left in (a died run, an old load): the
// prologue (CONTRACTS 8.16), unarmed in Mossbrook Square until the king's grants arm him.
// Continue (loadSlot) never goes through this: a loaded save keeps whatever it saved.
function newAdventure() {
  startNewGame({ prologue: true });
}

// { button, onAction, secondary } for the panel: Continue (with a short summary) over New
// adventure when a save exists, else the plain Start adventure of a first run.
function titleButtons() {
  const s = slotSummary(SAVE_SLOT);
  if (!s?.ok) return { button: 'Start adventure', onAction: newAdventure, secondary: null };
  const area = getArea(s.area)?.name ?? 'Mossbrook';
  const mins = Math.max(0, Math.round((s.playTime ?? 0) / 60));
  return {
    button: `Continue: ${area} · ♥${Math.round(s.hearts)} · ${mins}m`,
    onAction: () => loadSlot(SAVE_SLOT),
    secondary: { label: 'New adventure', onAction: newAdventure },
  };
}

registerMode('title', {
  enter() {
    if (!logo) logo = makeLogo();
    logo.position.set(player.x, GROUND_Y + LOGO_Y, player.z - LOGO_BACK);
    scene.add(logo);
    document.body.classList.add('title-mode');
    if (!titlePanel) {
      titlePanel = {
        title: $('overlay-title').textContent,
        msg: $('overlay-msg').textContent,
        kicker: document.querySelector('#overlay .kicker').textContent,
      };
    }
    showOverlay({ ...titlePanel, ...titleButtons() });
  },
  exit() {
    if (logo) scene.remove(logo);
    document.body.classList.remove('title-mode');
  },
  update(dt) {
    if (logo) {
      logo.position.y = GROUND_Y + LOGO_Y + Math.sin(state.time * 1.4) * 0.06;
      logo.rotation.y = Math.sin(state.time * 0.5) * 0.06;
      // Narrower than 16:9 (portrait phones) shrinks it to stay inside the screen.
      logo.scale.setScalar(LOGO_SCALE * Math.min(1, innerWidth / innerHeight / (16 / 9)));
    }
    // The hero looks around while waiting.
    player.yaw = Math.sin(state.time * 0.8) * 0.6;
    player.animate(dt, false);
    if (input.pressed('confirm')) (slotSummary(SAVE_SLOT)?.ok ? loadSlot(SAVE_SLOT) : newAdventure());
  },
});

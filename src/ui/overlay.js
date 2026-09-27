// The centred panel used by the title, pause and game-over screens, and the
// full-screen black fade used by warps.
import { state } from '../core/state.js';
import { $ } from './dom.js';

let action = null;

// onAction runs when the panel's button is clicked.
export function showOverlay({ title, msg, button, kicker, onAction = null }) {
  $('overlay-title').textContent = title;
  $('overlay-msg').textContent = msg;
  $('start').textContent = button;
  document.querySelector('#overlay .kicker').textContent = kicker;
  $('overlay').hidden = false;
  action = onAction;
}

// Keep the panel's current content but change what its button does.
export function setOverlayAction(onAction) {
  action = onAction;
}

export function hideOverlay() {
  $('overlay').hidden = true;
}

export const overlayVisible = () => !$('overlay').hidden;

export function setFade(opacity) {
  $('fade').style.opacity = String(opacity);
}

export function initOverlay() {
  // Only while the panel shows: a focused button must not fire again after
  // the keyboard has already acted (Space on a focused button clicks on keyup).
  // A dialog box open over the panel has to be answered first.
  $('start').addEventListener('click', () => {
    if (overlayVisible() && state.mode !== 'dialog') action?.();
  });
}

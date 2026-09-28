// The centred panel used by the title, pause and game-over screens, and the
// full-screen black fade used by warps.
import { state } from '../core/state.js';
import { $ } from './dom.js';

let action = null;
let secondaryAction = null;

// onAction runs when the panel's main button is clicked. secondary, when given
// ({ label, onAction }), shows a second, lesser button beside it (the title
// screen's "New adventure" next to Continue); left out, that button hides.
export function showOverlay({ title, msg, button, kicker, onAction = null, secondary = null }) {
  $('overlay-title').textContent = title;
  $('overlay-msg').textContent = msg;
  $('start').textContent = button;
  document.querySelector('#overlay .kicker').textContent = kicker;
  $('overlay').hidden = false;
  action = onAction;
  setSecondary(secondary);
}

// Keep the panel's current content but change what its button does.
export function setOverlayAction(onAction) {
  action = onAction;
}

function setSecondary(secondary) {
  const el = $('start-secondary');
  if (!el) return; // an older markup without the second button: the main one still works
  secondaryAction = secondary?.onAction ?? null;
  el.textContent = secondary?.label ?? '';
  el.hidden = !secondary;
}

export function hideOverlay() {
  $('overlay').hidden = true;
}

export const overlayVisible = () => !$('overlay').hidden;

// What the panel says, for tests (the ui may restyle it but keeps these
// answers): { visible, title, message, button }. The game-over message names
// where the hero will get up.
export const overlayView = () => ({
  visible: overlayVisible(),
  title: $('overlay-title')?.textContent ?? '',
  message: $('overlay-msg')?.textContent ?? '',
  button: $('start')?.textContent ?? '',
  secondary: $('start-secondary')?.hidden === false ? $('start-secondary').textContent : null,
});

// k: 0 (clear) to 1 (black). at: [x, y] in CSS px of the view, an iris closing on that point (the
// SNES-style wipe onto the hero); without it, or fully open or shut, a plain fade.
export function setFade(k, at = null) {
  const el = $('fade');
  const card = $('load-card'); // inside #fade: under an iris it clears ahead of the opening
  if (!at || k <= 0 || k >= 1) {
    el.style.background = '#000';
    el.style.opacity = String(Math.max(0, Math.min(1, k)));
    if (card) card.style.opacity = '1';
    return;
  }
  if (card) card.style.opacity = String(Math.max(0, 2 * k - 1));
  const w = el.clientWidth, h = el.clientHeight;
  const R = Math.hypot(Math.max(at[0], w - at[0]), Math.max(at[1], h - at[1])); // to the far corner
  const r = R * (1 - k);
  el.style.background = `radial-gradient(circle at ${at[0].toFixed(1)}px ${at[1].toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + 1.5).toFixed(1)}px)`;
  el.style.opacity = '1';
}

export function initOverlay() {
  // Only while the panel shows: a focused button must not fire again after
  // the keyboard has already acted (Space on a focused button clicks on keyup).
  // A dialog box open over the panel has to be answered first.
  $('start').addEventListener('click', () => {
    if (overlayVisible() && state.mode !== 'dialog') action?.();
  });
  $('start-secondary')?.addEventListener('click', () => {
    if (overlayVisible() && state.mode !== 'dialog') secondaryAction?.();
  });
}

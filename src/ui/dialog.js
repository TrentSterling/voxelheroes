// Dialog box for signs, villagers and shops.
//
//   await showDialog(['Welcome to the village.', 'The smith is up the hill.'], { speaker: 'Old Wren' });
//   const choice = await showDialog('Buy a bomb bag for 30 gems?', { choices: ['Buy', 'Not now'] });
//
// Each string is one page. Text types out; A (or Enter/Space, or a tap on the
// box) finishes the page, then turns it. While the box is open the game is
// paused in the 'dialog' mode. The promise resolves when the box closes, with
// the chosen index when `choices` were given (on the last page).
// Calls made while a box is open wait their turn.
//
// If the mode is replaced while a box is open (teleport, load, new game, the
// title's start button), the box closes and every open or waiting dialog
// resolves with undefined, choice dialogs included, so `if (choice === 0)`
// code never takes the yes path by accident.
//
// Code after `await showDialog(...)` runs between two ticks, like any promise
// continuation; tests step with __voxelHeroes.step()/tick(), which let it run.
import './dialog.css';
import { registerMode, pushMode, popMode } from '../core/modes.js';
import { input } from '../core/input.js';
import { state } from '../core/state.js';
import { el } from './dom.js';

const TYPE_SPEED = 45; // characters per second

let box = null;
let active = null;
const queue = [];

function ensureBox() {
  if (box) return box;
  const speaker = el('div', { class: 'dialog-speaker' });
  const text = el('p', { class: 'dialog-text' });
  const choices = el('ul', { class: 'dialog-choices' });
  const more = el('div', { class: 'dialog-more', 'aria-hidden': 'true' }, '▼');
  const root = el('div', { id: 'dialog', class: 'dialog', role: 'dialog', 'aria-live': 'polite', hidden: true }, speaker, text, choices, more);
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    input.tap('confirm');
  });
  document.getElementById('app').append(root);
  box = { root, speaker, text, choices, more };
  return box;
}

export function showDialog(lines, opts = {}) {
  return new Promise((resolve) => {
    queue.push({ pages: Array.isArray(lines) ? lines : [lines], opts, resolve });
    if (!active) openNext();
  });
}

export const dialogOpen = () => active !== null;

function openNext() {
  const next = queue.shift();
  if (!next) return;
  const b = ensureBox();
  active = { ...next, page: 0, shown: 0, drawn: -1, choice: 0 };
  b.speaker.textContent = next.opts.speaker ?? '';
  b.speaker.hidden = !next.opts.speaker;
  b.root.hidden = false;
  drawPage();
  if (state.mode !== 'dialog') pushMode('dialog');
}

const pageText = () => active.pages[active.page];
const lastPage = () => active.page === active.pages.length - 1;
const choices = () => (lastPage() ? active.opts.choices ?? null : null);

function drawPage() {
  const b = box;
  const text = pageText();
  const n = Math.floor(active.shown);
  if (n !== active.drawn) {
    b.text.textContent = text.slice(0, n);
    active.drawn = n;
  }
  const done = n >= text.length;
  const list = choices();
  b.choices.hidden = !(done && list);
  if (done && list) {
    b.choices.replaceChildren(
      ...list.map((c, i) => el('li', { class: i === active.choice ? 'selected' : null, 'aria-selected': String(i === active.choice) }, c))
    );
  }
  b.more.hidden = !done || !!list;
}

function close() {
  const { resolve, opts } = active;
  const result = opts.choices ? active.choice : undefined;
  active = null;
  box.root.hidden = true;
  if (queue.length) {
    openNext();
  } else {
    popMode();
  }
  resolve(result);
}

// Close the box and settle every open and waiting dialog with undefined.
function cancelAll() {
  const pending = [active, ...queue.splice(0)].filter(Boolean);
  active = null;
  if (box) box.root.hidden = true;
  for (const d of pending) d.resolve(undefined);
}

registerMode('dialog', {
  // close() clears `active` before it pops, so this only runs when something
  // else replaced the mode (setMode unwinds the whole stack).
  exit({ suspended }) {
    if (!suspended && active) cancelAll();
  },
  update(dt) {
    if (!active) {
      popMode();
      return;
    }
    const text = pageText();
    active.shown = Math.min(text.length, active.shown + dt * (active.opts.speed ?? TYPE_SPEED));
    const done = active.shown >= text.length;
    const list = choices();
    if (done && list) {
      if (input.pressed('up') || input.pressed('left')) active.choice = (active.choice + list.length - 1) % list.length;
      if (input.pressed('down') || input.pressed('right')) active.choice = (active.choice + 1) % list.length;
    }
    if (input.pressed('sword') || input.pressed('confirm')) {
      if (!done) active.shown = text.length;
      else if (!lastPage()) {
        active.page += 1;
        active.shown = 0;
        active.drawn = -1;
      } else {
        close();
        return;
      }
    }
    if (list && input.pressed('cancel') && done) {
      active.choice = list.length - 1;
      close();
      return;
    }
    drawPage();
  },
});

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
//
// Options (game/settings.js): text types at the textSpeed setting (opts.speed
// overrides it, in characters per second); largeText draws double-size text.
// "{hero}" in a line becomes the hero's name. ask(text, choices, opts) is
// showDialog with choices.
//
// The box is drawn in the UI canvas (ui/canvas/gfx.js), not the DOM. dialogView()
// describes the open box for tests and other code, so they never read pixels (the ui
// may restyle the box, and put yes/no in a box of its own): null when closed, else
// { speaker, text (the whole page), shown
// (the part typed so far), choices (the list once the page is typed, else
// null), choice (the index selected), large, page, pages }. Keys: A, Space
// or Enter turns the page and picks; up/left and down/right move the choice.
import { registerMode, pushMode, popMode } from '../core/modes.js';
import { input } from '../core/input.js';
import { state } from '../core/state.js';
import { textSpeed } from '../game/settings.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';

let active = null;
const queue = [];
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const heroName = () => state.profile?.name || 'Hero';
const fill = (text) => String(text).replaceAll('{hero}', heroName());

export function showDialog(lines, opts = {}) {
  return new Promise((resolve) => {
    queue.push({ pages: (Array.isArray(lines) ? lines : [lines]).map(fill), opts, resolve });
    if (!active) openNext();
  });
}

export const ask = (text, choices, opts = {}) => showDialog(text, { ...opts, choices });

export const dialogOpen = () => active !== null;

export function dialogView() {
  if (!active) return null;
  const text = pageText();
  const done = active.shown >= text.length;
  const list = choices();
  return {
    speaker: active.opts.speaker ?? null,
    text,
    shown: text.slice(0, Math.floor(active.shown)),
    choices: done && list ? [...list] : null,
    choice: active.choice,
    large: active.large,
    page: active.page,
    pages: active.pages.length,
  };
}

function openNext() {
  const next = queue.shift();
  if (!next) return;
  active = { ...next, page: 0, shown: 0, choice: 0, large: !!state.settings.largeText };
  requestUi();
  if (state.mode !== 'dialog') pushMode('dialog');
}

const pageText = () => active.pages[active.page];
const lastPage = () => active.page === active.pages.length - 1;
const choices = () => (lastPage() ? active.opts.choices ?? null : null);

function close() {
  const { resolve, opts } = active;
  const result = opts.choices ? active.choice : undefined;
  active = null;
  requestUi();
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
  requestUi();
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
    active.shown = Math.min(text.length, active.shown + dt * (active.opts.speed ?? textSpeed()));
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
      } else {
        close();
        return;
      }
    }
    if (list && input.pressed('cancel') && done) {
      active.choice = list.length - 1;
      close();
    }
  },
});

// ---------------------------------------------------------------- drawing
const SPEAKER_INK = '#1c1405';

// The choices flow left to right and wrap; positions are relative to the box's text area.
function layoutChoices(g, list, size, maxW) {
  const out = [];
  let x = 0;
  let row = 0;
  list.forEach((label, i) => {
    const w = 10 * size + g.measure(label, size);
    if (x > 0 && x + w > maxW) {
      x = 0;
      row++;
    }
    out.push({ i, label, x, row, w });
    x += w + 14;
  });
  return { items: out, rows: row + 1 };
}

function drawBox(g) {
  const size = active.large ? 2 : 1;
  const lineH = g.line * size;
  const boxW = Math.min(g.w - 16, active.large ? 440 : 340);
  const padX = 10;
  const textW = boxW - padX * 2;
  const text = pageText();
  const lines = g.wrap(text, textW, size);
  const n = Math.floor(active.shown);
  const done = active.shown >= text.length;
  const list = choices();
  const opts = list ? layoutChoices(g, list, size, textW) : null;
  const speaker = active.opts.speaker;
  const textTop = 10 + (speaker ? 5 : 0);
  const textH = Math.max(2, lines.length) * lineH;
  const boxH = textTop + textH + (opts ? 4 + opts.rows * lineH : 0) + 8;
  const x = Math.round((g.w - boxW) / 2);
  const y = g.h - 10 - g.safe.b - boxH;

  g.panel(x, y, boxW, boxH, { accent: true });
  g.hit('dialog', x, y, boxW, boxH, () => input.tap('confirm'), 'default');
  if (speaker) {
    const label = speaker.toUpperCase();
    const w = g.measure(label, 1, 1) + 12;
    g.rect(x + 8, y - 7, w, 12, COLORS.gold);
    g.rect(x + 8, y + 5, w, 2, COLORS.goldDeep);
    g.text(label, x + 14, y - 4, { color: SPEAKER_INK, tracking: 1 });
  }
  lines.forEach((line, i) => {
    const shown = line.text.slice(0, Math.max(0, Math.min(line.text.length, n - line.start)));
    if (shown) g.text(shown, x + padX, y + textTop + i * lineH, { size, color: COLORS.ink, shadow: COLORS.shade });
  });
  if (opts && done) {
    const cy = y + textTop + textH + 4;
    for (const c of opts.items) {
      const on = c.i === active.choice;
      const cx = x + padX + c.x;
      const ry = cy + c.row * lineH;
      if (on) g.text('▶', cx, ry, { size, color: COLORS.gold });
      g.text(c.label, cx + 10 * size, ry, { size, color: on ? COLORS.ink : COLORS.muted, shadow: COLORS.shade });
      g.hit(`dialog-choice-${c.i}`, cx - 2, ry - 2, c.w + 4, lineH + 2, () => {
        active.choice = c.i;
        input.tap('confirm');
      });
    }
  } else if (done && (calm || Math.floor(g.now / 450) % 2 === 0)) {
    g.text('▼', x + boxW - padX - 5, y + boxH - 8 - g.cap * size, { size, color: COLORS.gold });
  }
}

registerUiPart({
  id: 'dialog',
  order: 100, // over the HUD and everything else
  busy: () => active !== null, // the typewriter and the blinking arrow
  key: () => (active ? `${active.page}|${Math.floor(active.shown)}|${active.choice}` : '-'),
  draw(g) {
    if (active) drawBox(g);
  },
});

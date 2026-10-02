// Dialog box for signs, villagers and shops.
//
//   await showDialog(['Welcome to the village.', 'The smith is up the hill.'], { speaker: 'Old Wren' });
//   const choice = await showDialog('Buy a bomb bag for 30 gems?', { choices: ['Buy', 'Not now'] });
//
// Each string is an authored page, split into readable screenfuls when needed.
// Text types out; A (or Enter/Space, or a tap on the
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
// { speaker, text (the remaining authored page), shown
// (the part typed so far), choices (the list once the page is typed, else
// null), choice (the index selected), large, page, pages }. Keys: A, Space
// or Enter turns the page and picks; up/left and down/right move the choice.
import { registerMode, pushMode, popMode } from '../core/modes.js';
import { input } from '../core/input.js';
import { state } from '../core/state.js';
import { textSpeed } from '../game/settings.js';
import { speakNpcSegment, stopNpcSpeech } from '../game/npc-voices.js';
import { registerUiPart, requestUi, COLORS, g as canvasG } from './canvas/gfx.js';

let active = null;
const queue = [];
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const heroName = () => state.profile?.name || 'Hero';
const fill = (text) => String(text).replaceAll('{hero}', heroName());

export function showDialog(lines, opts = {}) {
  return new Promise((resolve) => {
    const authored = (Array.isArray(lines) ? lines : [lines]).map(String);
    queue.push({ pages: authored.map(fill), voicePages: authored, opts, resolve });
    if (!active) openNext();
  });
}

export const ask = (text, choices, opts = {}) => showDialog(text, { ...opts, choices });

export const dialogOpen = () => active !== null;

export function dialogView() {
  if (!active) return null;
  const text = pageText();
  const layout=dialogLayout(canvasG);
  const done=active.shown>=layout.limit;
  const list=layout.lastSegment?choices():null;
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
  active = { ...next, page: 0, offset:0, shown: 0, choice: 0, large: !!state.settings.largeText };
  requestUi();
  if (state.mode !== 'dialog') pushMode('dialog');
  speakSegment();
}

function speakSegment() {
  speakNpcSegment(active.voicePages[active.page], active.opts.voiceSpeakers?.[active.page] ?? active.opts.speaker, { ...active.opts, continuation: active.offset > 0 });
}

const pageText = () => active.pages[active.page].slice(active.offset);
const lastPage = () => active.page === active.pages.length - 1;
const choices = () => (lastPage() ? active.opts.choices ?? null : null);

function close() {
  stopNpcSpeech();
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
  stopNpcSpeech();
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
    const layout=dialogLayout(canvasG);
    active.shown=Math.min(layout.limit,active.shown+dt*(active.opts.speed??textSpeed()));
    const done=active.shown>=layout.limit;
    const list=layout.lastSegment?choices():null;
    if (done && list) {
      if (input.pressed('up') || input.pressed('left')) active.choice = (active.choice + list.length - 1) % list.length;
      if (input.pressed('down') || input.pressed('right')) active.choice = (active.choice + 1) % list.length;
    }
    if (input.pressed('sword') || input.pressed('confirm')) {
      if (!done) active.shown = layout.limit;
      else if(!layout.lastSegment){active.offset+=layout.limit;active.shown=0;speakSegment();}
      else if (!lastPage()) {
        active.page += 1;
        active.offset=0;
        active.shown = 0;
        speakSegment();
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
  let height=0;
  list.forEach((label, i) => {
    const lines=g.wrap(label,maxW-10*size,size),h=lines.length*g.line*size;
    out.push({i,lines,w:Math.max(...lines.map(l=>g.measure(l.text,size)))+10*size,y:height,h});height+=h;
  });
  return {items:out,height};
}

function dialogLayout(g){
  const size = active.large ? 2 : 1;
  const lineH = g.line * size;
  const boxW=Math.min(g.w-16-g.safe.l-g.safe.r,active.large?440:340);
  const padX = 10;
  const textW = boxW - padX * 2;
  const text = pageText();
  const lines = g.wrap(text, textW, size);
  const list = choices();
  const speaker = active.opts.speaker;
  const textTop = 10 + (speaker ? 5 : 0);
  const maxH=g.h-g.safe.t-g.safe.b-34;
  let opts=list?layoutChoices(g,list,size,textW):null;
  if(opts){
    const budget=Math.max(lineH,Math.floor(maxH*.45));let start=0;
    while(start<active.choice&&opts.items[active.choice].y+opts.items[active.choice].h-opts.items[start].y>budget)start++;
    let height=0;const shown=[];
    for(const item of opts.items.slice(start)){if(shown.length&&height+item.h>budget)break;shown.push({...item,y:height});height+=item.h;}
    opts={items:shown,height};
  }
  const capacity=Math.max(1,Math.floor((maxH-textTop-8-(opts?opts.height+4:0))/lineH));
  const limit=lines.length>capacity?lines[capacity].start:text.length;
  const visible=lines.slice(0,capacity),textH=Math.max(2,visible.length)*lineH;
  const boxH=textTop+textH+(opts?4+opts.height:0)+8;
  return{size,lineH,boxW,padX,textW,visible,limit,lastSegment:limit>=text.length,opts,speaker,textTop,textH,boxH};
}

function drawBox(g) {
  const {size,lineH,boxW,padX,textW,visible,limit,lastSegment,opts,speaker,textTop,textH,boxH}=dialogLayout(g);
  const n=Math.floor(active.shown),done=active.shown>=limit;
  const x = Math.round((g.w - boxW) / 2);
  const y = g.h - 10 - g.safe.b - boxH;

  g.panel(x, y, boxW, boxH, { accent: true });
  g.hit('dialog', x, y, boxW, boxH, () => input.tap('confirm'), 'default');
  if (speaker) {
    const label = g.fit(speaker.toUpperCase(),boxW-28,1,1);
    const w = g.measure(label, 1, 1) + 12;
    g.rect(x + 8, y - 7, w, 12, COLORS.gold);
    g.rect(x + 8, y + 5, w, 2, COLORS.goldDeep);
    g.text(label, x + 14, y - 4, { color: SPEAKER_INK, tracking: 1 });
  }
  visible.forEach((line, i) => {
    const shown = line.text.slice(0, Math.max(0, Math.min(line.text.length, n - line.start)));
    if (shown) g.text(shown, x + padX, y + textTop + i * lineH, { size, color: COLORS.ink, shadow: COLORS.shade });
  });
  if (opts && done && lastSegment) {
    const cy = y + textTop + textH + 4;
    for (const c of opts.items) {
      const on = c.i === active.choice;
      const cx = x + padX;
      const ry = cy + c.y;
      if (on) g.text('▶', cx, ry, { size, color: COLORS.gold });
      c.lines.forEach((line,i)=>g.text(line.text,cx+10*size,ry+i*lineH,{size,color:on?COLORS.ink:COLORS.muted,shadow:COLORS.shade}));
      g.hit(`dialog-choice-${c.i}`, cx - 2, ry - 2, textW + 4, c.h + 2, () => {
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

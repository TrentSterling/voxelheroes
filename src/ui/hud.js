// The heads-up display, drawn from state every rendered frame.
//
// The HUD is a list of widgets. Each widget turns state into a short key
// string, and is redrawn only when that key changes, so nothing else has to
// remember to "update the HUD". A feature adds a widget from its own file in
// src/ui/hud/ (loaded automatically):
//
//   registerHudWidget({
//     id: 'bombs',
//     mount({ hud, right }) { ...create elements inside #hud or #hud-right... },
//     key: (state) => String(state.bombs),
//     render(state) { ...update the elements... },
//   });
import { state } from '../core/state.js';
import { toggleMute } from '../core/audio.js';
import { keyCount } from '../systems/keys.js';
import { $ } from './dom.js';

const widgets = [];
let mounted = false;
let areaLabel = '';

export function registerHudWidget(w) {
  if (widgets.some((x) => x.id === w.id)) throw new Error(`HUD widget "${w.id}" is already registered`);
  widgets.push({ ...w, last: null });
  if (mounted) w.mount?.(hudSlots());
}

const hudSlots = () => ({ hud: $('hud'), right: $('hud-right') });

// The screen name shown in the middle of the HUD. It changes when a screen is
// entered, not while the camera is still sliding towards it.
export function setAreaLabel(text) {
  areaLabel = text;
}

export function refreshHud() {
  for (const w of widgets) {
    const k = w.key(state);
    if (k === w.last) continue;
    w.last = k;
    w.render(state);
  }
}

export function toggleMuteUi() {
  const m = toggleMute();
  $('mute').textContent = m ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(m));
}

export function initHud() {
  mounted = true;
  const slots = hudSlots();
  for (const w of widgets) w.mount?.(slots);
  $('mute').addEventListener('click', (e) => {
    toggleMuteUi();
    e.currentTarget.blur();
  });
}

// ---------------------------------------------------------------- core widgets
const HEART_ROWS = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

export function heartSVG(fill) {
  let rects = '';
  HEART_ROWS.forEach((row, y) =>
    row.split('').forEach((ch, x) => {
      if (ch !== 'X') return;
      const on = fill === 2 || (fill === 1 && x <= 3);
      const hi = on && x === 1 && y === 1;
      const c = hi ? '#ffb0bc' : on ? '#e8364a' : '#3b2a2f';
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    })
  );
  return `<svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

registerHudWidget({
  id: 'hearts',
  key: (s) => `${s.hp}/${s.maxHp}`,
  render(s) {
    let html = '';
    for (let i = 0; i < s.maxHp / 2; i++) {
      const v = s.hp - i * 2;
      html += heartSVG(v >= 2 ? 2 : v === 1 ? 1 : 0);
    }
    $('hearts').innerHTML = html;
    $('hearts').setAttribute('aria-label', `Health ${s.hp / 2} of ${s.maxHp / 2} hearts`);
  },
});

registerHudWidget({
  id: 'area',
  key: () => areaLabel,
  render() {
    $('area').textContent = areaLabel;
  },
});

registerHudWidget({
  id: 'gems',
  key: (s) => String(s.gems),
  render(s) {
    $('gems').textContent = String(s.gems);
  },
});

registerHudWidget({
  id: 'keys',
  key: () => String(keyCount()),
  render() {
    const n = keyCount();
    $('keys').hidden = n === 0;
    $('key-count').textContent = String(n);
  },
});

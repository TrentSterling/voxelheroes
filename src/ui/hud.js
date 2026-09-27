// The heads-up display, drawn from state every rendered frame.
//
// The HUD is a list of widgets. Each widget turns state into a short key
// string, and is redrawn only when that key changes, so nothing else has to
// remember to "update the HUD". A feature adds a widget from its own file in
// src/ui/hud/ (loaded automatically):
//
//   registerHudWidget({
//     id: 'bombs',
//     region: 'right',        // 'left' | 'center' | 'right' (default 'right')
//     order: 25,              // position in the region, low first (default 50)
//     mount({ host }) { host.append(...my elements...); },
//     key: (state) => String(state.bombs),
//     render(state) { ...update the elements... },
//   });
//
// Every widget gets its own slot element `host` in its region, placed by
// order (then id), so the HUD reads the same whatever order the files load
// in. The host is display: contents, so the widget's elements line up in the
// region's row.
// Orders in use: left: hearts 10; center: area 10; right: item-slot 20,
// gems 30, keys 40 (the Sound button stays last).
import { state } from '../core/state.js';
import { toggleMute } from '../core/audio.js';
import { keyCount } from '../systems/keys.js';
import { $ } from './dom.js';

const REGIONS = { left: 'hud-left', center: 'hud-center', right: 'hud-right' };
const widgets = [];
let mounted = false;
let areaLabel = '';

const before = (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function registerHudWidget(def) {
  if (widgets.some((x) => x.id === def.id)) throw new Error(`HUD widget "${def.id}" is already registered`);
  const w = { region: 'right', order: 50, ...def, last: null, host: null };
  if (!REGIONS[w.region]) throw new Error(`HUD widget "${w.id}": region must be left, center or right, not "${w.region}"`);
  widgets.push(w);
  if (mounted) mountWidget(w);
}

// Give the widget a slot in its region, after every mounted widget that sorts
// before it, and let it fill the slot.
function mountWidget(w) {
  const region = $(REGIONS[w.region]);
  const host = document.createElement('div');
  host.className = 'hud-widget';
  host.dataset.widget = w.id;
  const next = widgets.filter((o) => o.host && o.region === w.region && before(w, o) < 0).sort(before)[0];
  region.insertBefore(host, next?.host ?? (w.region === 'right' ? $('mute') : null));
  w.host = host;
  w.mount?.({ host, region, hud: $('hud') });
}

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
  for (const w of [...widgets].sort(before)) mountWidget(w);
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
  region: 'left',
  order: 10,
  mount: ({ host }) => host.append($('hearts')),
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
  region: 'center',
  order: 10,
  mount: ({ host }) => host.append($('area')),
  key: () => areaLabel,
  render() {
    $('area').textContent = areaLabel;
  },
});

registerHudWidget({
  id: 'gems',
  region: 'right',
  order: 30,
  mount: ({ host }) => host.append($('purse')),
  key: (s) => String(s.gems),
  render(s) {
    $('gems').textContent = String(s.gems);
  },
});

registerHudWidget({
  id: 'keys',
  region: 'right',
  order: 40,
  mount: ({ host }) => host.append($('keys')),
  key: () => String(keyCount()),
  render() {
    const n = keyCount();
    $('keys').hidden = n === 0;
    $('key-count').textContent = String(n);
  },
});

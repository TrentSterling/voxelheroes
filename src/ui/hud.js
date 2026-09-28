// The heads-up display, drawn from state every rendered frame.
//
// The HUD is a list of widgets. Each widget turns state into a short key
// string, and is redrawn only when that key changes, so nothing else has to
// remember to "update the HUD". The ui stream owns the HUD and its widgets
// (src/ui/hud/*, loaded automatically); other streams do not add widgets:
// they put what should show in state or emit an event (docs/CONTRACTS.md,
// "HUD").
//
//   registerHudWidget({
//     id: 'bombs',
//     region: 'counters',     // a region below (default 'right')
//     order: 25,              // position in the region, low first (default 50)
//     mount({ host }) { host.append(...my elements...); },
//     key: (state) => String(state.inventory.ammo.bombs ?? 0),
//     render(state) { ...update the elements... },
//   });
//
// Regions follow the art bible's HUD (section 12): vitals (top left: hearts
// and mana gems), counters (under them: money, bombs, arrows), slots (top
// centre-right: the item and weapon slots), minimap (top right), prompts
// (bottom right: the prompt bar) and toast (the key toast and short
// notices). Until the ui lays them out, each maps onto one of M1's three
// containers, and M1's names left, center and right stay as aliases.
//
// Every widget gets its own slot element `host` in its region, placed by
// order (then id), so the HUD reads the same whatever order the files load
// in. The host is display: contents, so the widget's elements line up in the
// region's row.
// Orders in use: left: hearts 10; center: area 10; right: item-slot 20,
// gems 30, keys 40 (the Sound button stays last).
import { state } from '../core/state.js';
import { keyCount } from '../systems/keys.js';
import { setSetting, registerSettingApplier } from '../game/settings.js';
import { openSettings } from './settings-panel.js';
import { $ } from './dom.js';

export const REGIONS = {
  vitals: 'hud-left',
  counters: 'hud-left',
  slots: 'hud-center',
  minimap: 'hud-right',
  prompts: 'hud-right',
  toast: 'hud-center',
  // M1 names (aliases until the ui's layout lands)
  left: 'hud-left',
  center: 'hud-center',
  right: 'hud-right',
};
const widgets = [];
let mounted = false;
let areaLabel = '';

const before = (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function registerHudWidget(def) {
  if (widgets.some((x) => x.id === def.id)) throw new Error(`HUD widget "${def.id}" is already registered`);
  const w = { region: 'right', order: 50, ...def, last: null, host: null };
  if (!REGIONS[w.region]) throw new Error(`HUD widget "${w.id}": region must be one of ${Object.keys(REGIONS).join(', ')}, not "${w.region}"`);
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
  const same = (o) => REGIONS[o.region] === REGIONS[w.region];
  const next = widgets.filter((o) => o.host && same(o) && before(w, o) < 0).sort(before)[0];
  region.insertBefore(host, next?.host ?? (REGIONS[w.region] === 'hud-right' ? $('mute') : null));
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

// What the Sound button says ('Sound on' / 'Sound off'), for tests: the ui
// may restyle or hide the button but keeps this answer.
export const muteLabel = () => $('mute')?.textContent ?? (state.settings.muted ? 'Sound off' : 'Sound on');

// Mute is an option (game/settings.js 'muted', kept across visits): the N
// key and the Sound button flip it, and the button shows it.
export function toggleMuteUi() {
  setSetting('muted', !state.settings.muted);
}

function drawMute(m) {
  const b = $('mute');
  if (!b) return;
  b.textContent = m ? 'Sound off' : 'Sound on';
  b.setAttribute('aria-pressed', String(!!m));
}

export function initHud() {
  mounted = true;
  for (const w of [...widgets].sort(before)) mountWidget(w);
  registerSettingApplier('muted', drawMute);
  $('settings-btn')?.addEventListener('click', (e) => {
    e.currentTarget.blur();
    openSettings();
  });
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

// A quick scale pop on the element (fun audit: pickups read as silent
// without one), restarted on every call so a fast run of hits still reads.
function pop(el) {
  if (!el) return;
  el.classList.remove('hud-pop');
  void el.offsetWidth;
  el.classList.add('hud-pop');
}

// Counts a HUD number up (or down) instead of snapping to it (fun audit).
function tickTo(el, to, ms = 260) {
  if (!el) return;
  const from = Number(el.textContent) || 0;
  if (from === to) {
    el.textContent = String(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const f = Math.min(1, (now - t0) / ms);
    const eased = 1 - (1 - f) ** 3;
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (f < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let lastHp = null;

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
    if (lastHp != null && s.hp > lastHp) pop($('hearts')); // a gain (a heart pickup); a hit taken has its own hurt flash
    lastHp = s.hp;
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
    const el = $('gems');
    const from = Number(el.textContent) || 0;
    tickTo(el, s.gems);
    if (s.gems > from) pop($('purse'));
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

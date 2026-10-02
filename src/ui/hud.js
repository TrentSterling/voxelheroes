// The heads-up display, drawn in the UI canvas (ui/canvas/gfx.js) from state, never DOM.
//
// The HUD is a list of widgets laid out in regions. Each widget turns state into a short key
// string and is asked to draw only when the layer repaints; the layer repaints when any key
// changes, so nothing else has to remember to "update the HUD". The ui stream owns the HUD and its
// widgets (src/ui/hud/*, loaded automatically); other streams do not add widgets: they put what
// should show in state or emit an event (docs/CONTRACTS.md, "HUD").
//
//   registerHudWidget({
//     id: 'bombs',
//     region: 'counters',   // a region below (default 'slots')
//     order: 25,            // position in the region, low first (default 50)
//     key: (state) => String(state.inventory.ammo.bombs ?? 0),
//     render(state) {},     // optional: runs when the key changes (side effects, popHud('bombs'))
//     measure(g, state, maxW) { return [w, h]; },   // its size in logical pixels, or null to hide
//     draw(g, state, x, y, w, h) { g.text('x3', x, y); },
//   });
//
// Regions (each is a row that flows from its side; the centre is a stack):
//   vitals    top left, first row     hearts
//   magic     top left, below life    magic reserve
//   counters  top left, below magic   coins, keys
//   center    top centre, stacked     the area name, the Next: line
//   system    top right, first row    the Settings and Sound buttons
//   slots     top right, second row   the item on B, the clock
// left and right stay as aliases for vitals and slots.
import { state } from '../core/state.js';
import { keyCount } from '../systems/keys.js';
import { timeLabel } from '../game/clock.js';
import { setSetting, registerSettingApplier } from '../game/settings.js';
import { openSettings } from './settings-panel.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';
import * as sprites from './canvas/sprites.js';
import { overlayVisible, fadeLevel } from './overlay.js';
import { playShortcutBounds } from './shortcuts.js';

export const REGIONS = {
  vitals: { name: 'vitals', side: 'left', row: 0 },
  magic: { name: 'magic', side: 'left', row: 1 },
  counters: { name: 'counters', side: 'left', row: 2 },
  center: { name: 'center', side: 'center', row: 0 },
  system: { name: 'system', side: 'right', row: 0 },
  slots: { name: 'slots', side: 'right', row: 1 },
};
REGIONS.left = REGIONS.vitals;
REGIONS.right = REGIONS.slots;

const M = 8; // margin from the edge, logical pixels
const GAP = 6; // between widgets in a row
const ROW_GAP = 3;
const POP_MS = 280;

const widgets = [];
let areaLabel = '';
let placed = [];
let dimAlpha = 1;
const pops = new Map(); // widget id -> start time

const before = (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function registerHudWidget(def) {
  if (widgets.some((x) => x.id === def.id)) throw new Error(`HUD widget "${def.id}" is already registered`);
  const region = REGIONS[def.region ?? 'slots'];
  if (!region) throw new Error(`HUD widget "${def.id}": region must be one of ${Object.keys(REGIONS).join(', ')}, not "${def.region}"`);
  widgets.push({ order: 50, ...def, region: region.name, last: null });
  widgets.sort(before);
  requestUi();
}

// The screen name shown at the top. It changes when a screen is entered, not while the camera is
// still sliding towards it.
export function setAreaLabel(text) {
  areaLabel = text;
  requestUi();
}
export const areaName = () => areaLabel;

// A small hop on a widget (a heart picked up, a new goal): pickups read as silent without one.
export function popHud(id) {
  pops.set(id, performance.now());
  requestUi();
}
const hop = (id, now) => {
  const t0 = pops.get(id);
  if (t0 === undefined) return 0;
  const k = (now - t0) / POP_MS;
  if (k >= 1) return 0;
  return -Math.round(3 * Math.sin(Math.PI * k));
};

// What the Sound button says ('Sound on' / 'Sound off'), for tests.
export const muteLabel = () => (state.settings.muted ? 'Sound off' : 'Sound on');

// Mute is an option (game/settings.js 'muted', kept across visits): the N key and the Sound
// button flip it.
export function toggleMuteUi() {
  setSetting('muted', !state.settings.muted);
}

export function initHud() {
  registerSettingApplier('muted', () => requestUi());
}

// Where every widget sits after the last draw, for tests: [{ id, region, x, y, w, h }], plus the
// alpha the HUD is drawn at and whether it shows at all.
export const hudView = () => ({
  visible: state.mode !== 'title',
  alpha: dimAlpha,
  area: areaLabel,
  widgets: placed.map((p) => ({ id: p.w.id, region: p.w.region, x: p.x, y: p.y, w: p.sw, h: p.sh })),
});

// Current layout without drawing, including newly equipped items and vitals.
export const hudBounds = (g) => layout(g, state).map(p => ({ id: p.w.id, region: p.w.region,
  x: p.x, y: p.y, w: p.sw, h: p.sh }));

// ---------------------------------------------------------------- layout
const rowOf = (items) => ({
  w: items.reduce((a, it, i) => a + it.sw + (i ? GAP : 0), 0),
  h: items.reduce((a, it) => Math.max(a, it.sh), 0),
});

function layout(g, s) {
  const list = widgets.filter((w) => w.measure);
  const sized = (w, maxW) => {
    const sz = w.measure(g, s, maxW);
    return sz ? { w, sw: sz[0], sh: sz[1] } : null;
  };
  const rows = { left: [[], [], []], right: [[], [], []] };
  const { t: top, l: leftEdge, r: rightEdge } = g.safe;
  for (const w of list) {
    const r = REGIONS[w.region];
    if (r.side === 'center') continue;
    const it = sized(w, g.w);
    if (it) rows[r.side][r.row].push(it);
  }
  const out = [];
  const colH = { left: 0, right: 0 };
  const rowW0 = { left: 0, right: 0 };
  for (const side of ['left', 'right']) {
    let y = M + top;
    rows[side].forEach((items, ri) => {
      if (!items.length) return;
      const { w, h } = rowOf(items);
      if (ri === 0) rowW0[side] = w;
      let x = side === 'left' ? M + leftEdge : g.w - M - rightEdge - w;
      for (const it of items) {
        out.push({ ...it, x, y: y + Math.round((h - it.sh) / 2) });
        x += it.sw + GAP;
      }
      y += h + ROW_GAP;
    });
    colH[side] = y - ROW_GAP;
  }
  const reserved = [
    ...out.map(p => ({ x: p.x, y: p.y, w: p.sw, h: p.sh, side: REGIONS[p.w.region].side })),
    ...playShortcutBounds(g).map(p => ({ ...p, side: 'right' })),
  ];
  const belowSides = Math.max(colH.left, colH.right, ...reserved.map(p => p.y + p.h)) + ROW_GAP + 2;
  const fullWidth = g.w - 2 * M - leftEdge - rightEdge;
  // The centre stack sits between the two sides; where they leave it too little room (a phone held
  // upright) it drops below them instead.
  let cy = M + top;
  const room = g.w - 2 * (M + Math.max(rowW0.left + leftEdge, rowW0.right + rightEdge) + GAP);
  let maxW = room;
  if (maxW < 110) {
    cy = belowSides;
    maxW = fullWidth;
  }
  for (const w of list) {
    if (REGIONS[w.region].side !== 'center') continue;
    let it = sized(w, maxW);
    if (!it) continue;
    // A narrower objective can gain a line and meet a lower shortcut. Measure
    // again until its entire height fits, then keep it inside that free span.
    let width = maxW, left = M + leftEdge, right = g.w - M - rightEdge;
    for (let pass = 0; pass <= reserved.length; pass++) {
      left = M + leftEdge; right = g.w - M - rightEdge;
      for (const side of reserved) {
        if (side.y >= cy + it.sh || side.y + side.h <= cy) continue;
        if (side.side === 'left') left = Math.max(left, side.x + side.w + GAP);
        else right = Math.min(right, side.x - GAP);
      }
      const available = Math.min(width, right - left);
      if (available < 44) {
        cy = Math.max(cy, belowSides);
        left = M + leftEdge; right = g.w - M - rightEdge;
        it = sized(w, fullWidth);
        break;
      }
      if (available === width) break;
      width = available;
      it = sized(w, width);
      if (!it) break;
    }
    if (!it) continue;
    const center = (g.w + leftEdge - rightEdge) / 2;
    out.push({ ...it, x: Math.max(left, Math.min(Math.round(center - it.sw / 2), right - it.sw)), y: cy });
    cy += it.sh + ROW_GAP;
  }
  return out;
}

// ---------------------------------------------------------------- the part
registerUiPart({
  id: 'hud',
  order: 10,
  key() {
    let k = `${areaLabel}|${state.mode === 'title'}|${Math.round(fadeLevel() * 24)}|${overlayVisible()}`;
    for (const w of widgets) {
      const wk = w.key(state);
      if (wk !== w.last) {
        w.last = wk;
        w.render?.(state);
      }
      k += `|${wk}`;
    }
    return k;
  },
  busy(now) {
    for (const [id, t0] of pops) if (now - t0 >= POP_MS) pops.delete(id);
    return pops.size > 0 || widgets.some((w) => w.busy?.(now));
  },
  draw(g) {
    placed = [];
    if (state.mode === 'title') return;
    dimAlpha = (1 - fadeLevel()) * (overlayVisible() ? 0.45 : 1);
    if (dimAlpha <= 0.01) return;
    g.alpha(dimAlpha);
    placed = layout(g, state);
    for (const p of placed) p.w.draw(g, state, p.x, p.y + hop(p.w.id, g.now), p.sw, p.sh);
  },
});

// ---------------------------------------------------------------- core widgets
const OUTLINE = { outline: COLORS.shade };

let lastHp = null;
registerHudWidget({
  id: 'hearts',
  region: 'vitals',
  order: 10,
  key: (s) => `${s.hp}/${s.maxHp}`,
  render(s) {
    if (lastHp != null && s.hp > lastHp) popHud('hearts'); // a gain (a heart pickup); a hit taken has its own hurt flash
    lastHp = s.hp;
  },
  measure(g, s) {
    const n = Math.ceil(s.maxHp / 2);
    return [Math.min(n, 10) * 15 + 3, Math.ceil(n / 10) * 13 + 3];
  },
  draw(g, s, x, y) {
    for (let i = 0; i < Math.ceil(s.maxHp / 2); i++) {
      const v = s.hp - i * 2;
      g.sprite(sprites.heart(v >= 2 ? 2 : v === 1 ? 1 : 0), x + (i % 10) * 15, y + Math.floor(i / 10) * 13, 2);
    }
  },
});

// The purse counts up (or down) to a new total instead of snapping to it.
const purse = { from: 0, to: 0, t0: -1e9, init: false };
const PURSE_MS = 260;
const purseShown = (now) => {
  const f = Math.min(1, (now - purse.t0) / PURSE_MS);
  return Math.round(purse.from + (purse.to - purse.from) * (1 - (1 - f) ** 3));
};
registerHudWidget({
  id: 'coins',
  region: 'counters',
  order: 10,
  key: (s) => String(s.coins),
  render(s) {
    if (!purse.init) {
      Object.assign(purse, { from: s.coins, to: s.coins, t0: -1e9, init: true }); // first sight (a loaded save): no count-up
      return;
    }
    const now = performance.now();
    const from = purseShown(now);
    if (s.coins > purse.to) popHud('coins');
    Object.assign(purse, { from, to: s.coins, t0: now });
  },
  busy: (now) => now - purse.t0 < PURSE_MS,
  measure: (g, s) => [11 + g.measure(String(Math.max(s.coins, purseShown(g.now))), 1) + 1, 11],
  draw(g, s, x, y) {
    g.sprite(sprites.coin(), x, y + 1);
    g.text(purseShown(g.now), x + 12, y + 2, { color: COLORS.ink, ...OUTLINE });
  },
});

registerHudWidget({
  id: 'keys',
  region: 'counters',
  order: 20,
  key: () => String(keyCount()),
  measure: (g) => (keyCount() ? [12 + g.measure(String(keyCount()), 1) + 1, 11] : null),
  draw(g, s, x, y) {
    g.sprite(sprites.key(), x, y);
    g.text(keyCount(), x + 12, y + 2, { color: COLORS.ink, ...OUTLINE });
  },
});

registerHudWidget({
  id: 'area',
  region: 'center',
  order: 10,
  key: () => areaLabel,
  measure: (g, s, maxW) => {
    const t = g.fit(areaLabel.toUpperCase(), maxW-2, 1, 1);
    return [g.measure(t, 1, 1) + 2, 9];
  },
  draw(g, s, x, y, w) {
    g.text(g.fit(areaLabel.toUpperCase(), w-2, 1, 1), x + 1, y + 1, { color: COLORS.muted, tracking: 1, ...OUTLINE });
  },
});

registerHudWidget({
  id: 'clock',
  region: 'slots',
  order: 30,
  key: () => timeLabel(),
  measure: (g) => [g.measure(timeLabel()) + 2, 9],
  draw(g, s, x, y) {
    g.text(timeLabel(), x + 1, y + 1, { color: COLORS.muted, ...OUTLINE });
  },
});

registerHudWidget({
  id: 'settings',
  region: 'system',
  order: 10,
  key: () => 'settings',
  measure: (g) => [g.measure('Settings') + 10, 13],
  draw: (g, s, x, y) => g.button('hud-settings', 'Settings', x, y, () => openSettings()),
});

registerHudWidget({
  id: 'sound',
  region: 'system',
  order: 20,
  key: (s) => String(!!s.settings.muted),
  measure: (g, s) => (g.w < 300 ? null : [g.measure(muteLabel()) + 10, 13]),
  draw: (g, s, x, y) => g.button('hud-sound', muteLabel(), x, y, () => toggleMuteUi()),
});

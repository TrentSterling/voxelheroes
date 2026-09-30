// The Settings panel, drawn in the UI canvas: the HUD's Settings button (or O) opens it as a mode
// over play (gameplay stops on its own, like the map); Close, Esc/Enter/P or a click outside
// closes it. Each row edits one option in game/settings.js through setSetting, so the choices are
// saved for the browser and apply at once. Rows cycle with < > (left/right, or a click on either
// half of the value); the level rows are sliders you drag or nudge with left/right. Up/down picks
// a row.
import { input } from '../core/input.js';
import { state } from '../core/state.js';
import { registerMode, pushMode, popMode } from '../core/modes.js';
import { setSetting } from '../game/settings.js';
import { registerUiPart, requestUi, COLORS } from './canvas/gfx.js';

const ROWS = [
  { key: 'look', label: 'Quality', options: [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
  { key: 'renderScale', label: 'Resolution', options: [[1, '100%'], [0.75, '75%'], [0.5, '50%']] },
  { key: 'blur', label: 'Blur', options: [[0, 'Off'], [0.5, 'Low'], [1, 'Full']] },
  { key: 'bloom', label: 'Glow', options: [[true, 'On'], [false, 'Off']] },
  { key: 'seams', label: 'Voxel grid', options: [[true, 'On'], [false, 'Off']] },
  { key: 'autosave', label: 'Autosave', options: [[true, 'On'], [false, 'Off']] },
  { key: 'camera', label: 'Camera', options: [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']] },
  { key: 'brightness', label: 'Brightness', range: [0.5, 1.5, 0.05] },
  { key: 'volume', label: 'Volume', range: [0, 1, 0.05] },
  { key: 'music', label: 'Music', range: [0, 1, 0.05] },
  { key: 'sfx', label: 'Effects', range: [0, 1, 0.05] },
  { key: 'npcVoices', label: 'NPC voices', options: [[true, 'On'], [false, 'Off']] },
];

let open = false;
let sel = 0; // the picked row; ROWS.length is the Close button

export function openSettings() {
  if (state.mode !== 'settings') pushMode('settings');
}
export function closeSettings() {
  if (state.mode === 'settings') popMode();
}
export const settingsOpen = () => open;

registerMode('settings', {
  enter() {
    open = true;
    sel = 0;
    requestUi();
  },
  exit() {
    open = false;
    requestUi();
  },
  update() {
    if (input.pressed('menu') || input.pressed('cancel') || input.pressed('settings')) return void closeSettings();
    if (input.pressed('up')) sel = (sel + ROWS.length) % (ROWS.length + 1);
    if (input.pressed('down')) sel = (sel + 1) % (ROWS.length + 1);
    const dir = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0);
    if (sel === ROWS.length) {
      if (input.pressed('confirm')) closeSettings();
    } else if (dir || input.pressed('confirm')) nudge(ROWS[sel], dir || 1);
    if (input.pressed('up') || input.pressed('down') || dir) requestUi();
  },
});

const optionIndex = (R) => Math.max(0, R.options.findIndex(([o]) => o === state.settings[R.key]));

const snap = (v, [lo, hi, step]) => Math.round((Math.min(hi, Math.max(lo, v)) - lo) / step) * step + lo;

// One step along a row: to the next or previous choice (wrapping), or a tenth along a slider.
function nudge(R, dir) {
  if (R.range) {
    const [lo, hi, step] = R.range;
    setSetting(R.key, snap(state.settings[R.key] + dir * Math.max(step, (hi - lo) / 10), R.range));
  } else {
    setSetting(R.key, R.options[(optionIndex(R) + dir + R.options.length) % R.options.length][0]);
  }
  requestUi();
}

// The rows and their values, for tests.
export const settingsView = () => ({
  open,
  sel,
  rows: ROWS.map((R) => ({ key: R.key, value: state.settings[R.key], text: R.range ? null : R.options[optionIndex(R)][1] })),
});

// ---------------------------------------------------------------- drawing
const ROW_H = 13;
const COL_W = 176;
const CTRL_W = 92;

function drawRow(g, R, i, x, y, columnWidth=COL_W,rowHeight=ROW_H) {
  const on = sel === i;
  const stacked=columnWidth<156;
  const controlWidth=stacked?Math.min(CTRL_W,columnWidth-8):CTRL_W;
  if (on) g.rect(x - 4, y - 2, columnWidth + 4, rowHeight, 'rgba(243, 236, 210, 0.09)');
  if (on) g.text('▶', x - 3, y, { color: COLORS.gold });
  g.text(R.label, x + 6, y, { color: on ? COLORS.ink : COLORS.muted });
  const cx = stacked?x+6:x+columnWidth-controlWidth-2;
  y+=stacked?11:0;
  if (R.range) {
    const [lo, hi] = R.range;
    const f = (state.settings[R.key] - lo) / (hi - lo);
    g.rect(cx, y + 1, controlWidth, 5, '#1a2e26');
    g.rect(cx + 1, y + 2, Math.round((controlWidth - 2) * f), 3, COLORS.gold);
    g.rect(cx + Math.round((controlWidth - 3) * f), y - 1, 3, 9, COLORS.ink);
    g.hit(`setting-${R.key}`, cx - 3, y - 3, controlWidth + 6, ROW_H, null, 'ew-resize', (px) => {
      setSetting(R.key, snap(lo + Math.min(1, Math.max(0, (px - cx) / controlWidth)) * (hi - lo), R.range));
      sel = i;
    });
  } else {
    const text = R.options[optionIndex(R)][1];
    g.text('<', cx, y, { color: COLORS.gold });
    g.text('>', cx + controlWidth - 5, y, { color: COLORS.gold });
    g.text(text, cx + controlWidth / 2, y, { align: 'center', color: COLORS.ink });
    g.hit(`setting-${R.key}-prev`, cx - 3, y - 3, controlWidth / 2 + 3, ROW_H, () => ((sel = i), nudge(R, -1)));
    g.hit(`setting-${R.key}-next`, cx + controlWidth / 2, y - 3, controlWidth / 2 + 3, ROW_H, () => ((sel = i), nudge(R, 1)));
  }
}

function drawSettings(g) {
  g.rect(0, 0, g.w, g.h, 'rgba(8, 17, 13, 0.7)');
  g.hit('settings-scrim', 0, 0, g.w, g.h, () => closeSettings(), 'default');
  // as many columns as the view is short of rows
  const maxCols=Math.max(1,Math.floor((g.w-30)/(COL_W+14)));
  const columnWidth=Math.min(COL_W,g.w-44);
  const rowHeight=columnWidth<156?24:ROW_H;
  const perCol=Math.max(1,Math.min(ROWS.length,Math.floor((g.h-87)/rowHeight)));
  const cols=Math.min(maxCols,Math.ceil(ROWS.length/perCol));
  const pageSize=cols*perCol,pages=Math.ceil(ROWS.length/pageSize),page=Math.min(pages-1,Math.floor(sel/pageSize));
  const pw = cols * columnWidth + (cols - 1) * 14 + 28;
  const ph = 14 + 20 + perCol * rowHeight + 10 + 17 + 14;
  const px = Math.round((g.w - pw) / 2);
  const py = Math.max(6, Math.round((g.h - ph) / 2));
  g.panel(px, py, pw, ph, { accent: true });
  g.hit('settings-panel', px, py, pw, ph, () => {}, 'default');
  g.text('Settings', px + 14, py + 12, { color: COLORS.gold, tracking: 1 });
  const top = py + 14 + 20;
  ROWS.slice(page*pageSize,(page+1)*pageSize).forEach((R, local) => {
    const c = Math.floor(local / perCol),i=page*pageSize+local;
    drawRow(g,R,i,px+18+c*(columnWidth+14),top+(local%perCol)*rowHeight,columnWidth,rowHeight);
  });
  const by = top + perCol * rowHeight + 10;
  if(pages>1){
    g.button('settings-prev-page','<',px+12,by,()=>{sel=((page+pages-1)%pages)*pageSize;requestUi();});
    g.text(`${page+1}/${pages}`,px+31,by+4,{color:COLORS.muted});
    g.button('settings-next-page','>',px+52,by,()=>{sel=((page+1)%pages)*pageSize;requestUi();});
  }
  const w = g.measure('Close') + 20;
  if (sel === ROWS.length) g.rect(px + pw - 12 - w - 3, by - 3, w + 6, 23, 'rgba(243, 236, 210, 0.16)');
  g.primary('settings-close', 'Close', px + pw - 12 - w, by, () => closeSettings());
}

registerUiPart({
  id: 'settings',
  order: 80,
  key: () => (open ? `${sel}|${ROWS.map((R) => state.settings[R.key]).join(',')}` : '-'),
  draw(g) {
    if (open) drawSettings(g);
  },
});

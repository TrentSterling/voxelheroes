// The Settings panel: the HUD's Settings button opens it (and pauses play); Close, Esc or a click
// outside closes it. Each row edits one option in game/settings.js through setSetting, so the
// choices are saved for the browser and apply at once.
import { state } from '../core/state.js';
import { setSetting } from '../game/settings.js';
import { pauseGame, resumeGame } from '../systems/flow.js';

const ROWS = [
  { key: 'look', label: 'Quality', options: [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
  { key: 'renderScale', label: 'Resolution', options: [[1, '100%'], [0.75, '75%'], [0.5, '50%']] },
  { key: 'blur', label: 'Blur', options: [[0, 'Off'], [0.5, 'Low'], [1, 'Full']] },
  { key: 'bloom', label: 'Glow', options: [[true, 'On'], [false, 'Off']] },
  { key: 'seams', label: 'Voxel grid', options: [[true, 'On'], [false, 'Off']] },
  { key: 'camera', label: 'Camera', options: [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']] },
  { key: 'brightness', label: 'Brightness', range: [0.5, 1.5, 0.05] },
  { key: 'volume', label: 'Volume', range: [0, 1, 0.05] },
  { key: 'music', label: 'Music', range: [0, 1, 0.05] },
  { key: 'sfx', label: 'Effects', range: [0, 1, 0.05] },
];

let root = null;
let pausedByUs = false;

function build() {
  root = document.createElement('div');
  root.id = 'settings';
  root.hidden = true;
  root.innerHTML = `<div class="settings-panel" role="dialog" aria-label="Settings">
    <h2>Settings</h2><div class="settings-rows"></div>
    <button type="button" class="settings-close">Close</button></div>`;
  const rows = root.querySelector('.settings-rows');
  for (const R of ROWS) {
    const row = document.createElement('label');
    row.className = 'settings-row';
    row.innerHTML = `<span>${R.label}</span>`;
    let el;
    if (R.range) {
      el = document.createElement('input');
      el.type = 'range';
      [el.min, el.max, el.step] = R.range;
      el.addEventListener('input', () => setSetting(R.key, Number(el.value)));
    } else {
      el = document.createElement('select');
      R.options.forEach(([v, text], i) => el.add(new Option(text, String(i))));
      el.addEventListener('change', () => setSetting(R.key, R.options[Number(el.value)][0]));
    }
    el.dataset.key = R.key;
    row.append(el);
    rows.append(row);
  }
  root.querySelector('.settings-close').addEventListener('click', closeSettings);
  root.addEventListener('click', (e) => e.target === root && closeSettings());
  root.addEventListener('keydown', (e) => {
    e.stopPropagation(); // arrows and Enter drive the controls, not the hero
    if (e.key === 'Escape') closeSettings();
  });
  root.addEventListener('keyup', (e) => e.stopPropagation());
  document.getElementById('app')?.append(root) ?? document.body.append(root);
}

function sync() {
  for (const R of ROWS) {
    const el = root.querySelector(`[data-key="${R.key}"]`);
    const v = state.settings[R.key];
    if (R.range) el.value = String(v);
    else el.value = String(Math.max(0, R.options.findIndex(([o]) => o === v)));
  }
}

export function openSettings() {
  if (!root) build();
  pausedByUs = state.mode === 'play';
  if (pausedByUs) pauseGame();
  sync();
  root.hidden = false;
  root.querySelector('select, input')?.focus();
}

export function closeSettings() {
  if (!root || root.hidden) return;
  root.hidden = true;
  if (pausedByUs) resumeGame();
  pausedByUs = false;
}

export const settingsOpen = () => !!root && !root.hidden;

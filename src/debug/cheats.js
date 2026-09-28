// Dev cheat menu: ` (backquote) toggles it; ?dev=1 opens it at start. Gear, life, coins, every item
// and sword, god mode, killing the screen's enemies, teleporting to any area, the camera preset,
// look quality and the boxel hero. Everything goes through the game's own APIs, so what it
// grants is what play would grant.
import { state } from '../core/state.js';
import { grant } from '../systems/grants.js';
import { allItems } from '../items/registry.js';
import { allSwords, giveSword, equipSword } from '../game/swords.js';
import { setLife, addMaxLife, addCoins, UNITS_PER_HEART } from '../game/vitals.js';
import { hero } from '../game/hero.js';
import { allAreas } from '../world/areas.js';
import { teleport } from '../systems/flow.js';
import { liveEntities } from '../entities/manager.js';
import { playerCameraPresets, setCameraPreset } from '../core/camera.js';
import { look } from '../core/renderer.js';
import { QUALITY_ORDER } from '../core/look/presets.js';

export const cheats = { god: false };

// God mode: hits do nothing.
const receiveHit = hero.receiveHit?.bind(hero);
if (receiveHit) hero.receiveHit = (hit) => (cheats.god ? null : receiveHit(hit));

const CSS = `
#cheats { position: fixed; top: calc(12px + env(safe-area-inset-top, 0px)); right: 12px; z-index: 50; width: min(340px, calc(100vw - 24px));
  max-height: calc(100% - 24px); overflow-y: auto; background: rgba(14, 18, 16, 0.94); color: #e6ece4; border: 1px solid #3c4a40;
  border-radius: 8px; font: 13px/1.4 ui-monospace, "Cascadia Mono", Consolas, monospace; padding: 12px; display: grid; gap: 10px; }
#cheats h2 { margin: 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #9fd49f; display: flex; justify-content: space-between; }
#cheats h3 { margin: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #8a978d; }
#cheats .row { display: flex; flex-wrap: wrap; gap: 6px; }
#cheats button, #cheats select { font: inherit; background: #243029; color: #e6ece4; border: 1px solid #3c4a40; border-radius: 5px; padding: 4px 8px; cursor: pointer; }
#cheats button:hover, #cheats select:hover { background: #2f3d34; }
#cheats button[aria-pressed="true"] { background: #3e7a45; border-color: #5aa061; }
#cheats button:focus-visible, #cheats select:focus-visible { outline: 2px solid #e3a444; outline-offset: 1px; }
#cheats .note { color: #8a978d; font-size: 11px; }
`;

let panel = null;

function button(label, fn, { toggle = null } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (toggle) b.setAttribute('aria-pressed', String(toggle()));
  b.addEventListener('click', () => {
    fn();
    if (toggle) b.setAttribute('aria-pressed', String(toggle()));
    b.blur(); // keys go back to the game
  });
  return b;
}

function select(id, options, current, fn) {
  const s = document.createElement('select');
  s.id = id;
  for (const [value, label] of options) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if (value === current) o.selected = true;
    s.append(o);
  }
  s.addEventListener('change', () => {
    fn(s.value);
    s.blur();
  });
  return s;
}

function section(title, ...children) {
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.gap = '6px';
  const h = document.createElement('h3');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  row.append(...children);
  wrap.append(h, row);
  return wrap;
}

function build() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  panel = document.createElement('div');
  panel.id = 'cheats';
  panel.hidden = true;
  const title = document.createElement('h2');
  title.innerHTML = '<span>Dev cheats</span><span class="note">` to close</span>';
  const url = new URLSearchParams(location.search);
  panel.append(
    title,
    section('Life',
      button('God mode', () => (cheats.god = !cheats.god), { toggle: () => cheats.god }),
      button('Full heal', () => setLife(state.maxHp, 'cheat')),
      button('+1 heart', () => { addMaxLife(UNITS_PER_HEART, 'cheat'); setLife(state.maxHp, 'cheat'); }),
      button('+500 coins', () => addCoins(500, 'cheat')),
    ),
    section('Gear',
      button('Sprint Boots', () => grant('boots-dash', 1, { source: 'cheat' })),
      button('Bog Boots', () => grant('boots-swamp', 1, { source: 'cheat' })),
      button('Shield +1', () => (state.gear.shield = Math.min(6, (state.gear.shield ?? 0) + 1))),
      button('All items', () => { for (const it of allItems()) grant(it.id, it.ammo ? 99 : 1, { source: 'cheat', quiet: true }); }),
      button('All swords', () => { for (const s of allSwords()) giveSword(s.id); if (!state.swords.equipped && allSwords()[0]) equipSword(allSwords()[0].id); }),
    ),
    section('World',
      button('Kill screen enemies', () => { for (const e of liveEntities()) if (e.kind === 'enemy') e.die ? e.die({ source: 'cheat' }) : e.remove(); }),
      select('cheat-area', allAreas().filter((a) => !/^test-|kitroom/.test(a.id)).map((a) => [a.id, a.name ?? a.id]), state.area, (id) => teleport(id)),
    ),
    section('View',
      select('cheat-camera', playerCameraPresets().map((p) => [p, `Camera ${p}`]), null, (p) => setCameraPreset(p)),
      select('cheat-look', QUALITY_ORDER.map((q) => [q, `Look: ${q}`]), look.quality(), (q) => look.setQuality(q)),
      button(url.get('hero') === 'v2' ? 'Old hero' : 'Boxel hero v2', () => {
        if (url.get('hero') === 'v2') url.delete('hero'); else url.set('hero', 'v2');
        url.set('dev', '1');
        location.search = url.toString();
      }),
    ),
  );
  document.body.append(panel);
}

export function toggleCheats(open = panel ? panel.hidden : true) {
  if (!panel) build();
  panel.hidden = !open;
}

export function initCheats() {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.repeat) return;
    e.preventDefault();
    toggleCheats();
  });
  if (new URLSearchParams(location.search).get('dev') === '1') toggleCheats(true);
}

// The map screen (fun audit: the map button did nothing). Map / M / LB /
// touch Map opens it over play, pushed like pause and settings
// (core/modes.js: gameplay stops on its own, nothing here has to pause it);
// Map again, Esc/Start, the Close button or a click outside all close it.
//
// In the overworld: every outdoor screen the hero has charted (fog on the
// rest), his position, and the dungeon doors he has found. Inside a
// dungeon: its rooms instead, only the ones he has walked into until the
// map chest is his (game/dungeons.js hasMap), the boss room marked apart
// from the rest.
//
// Built once, lazily, the way ui/settings-panel.js builds its own panel.
import { input } from '../../core/input.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { registerPlayHook } from '../../systems/flow.js';
import { world, currentScreen } from '../../world/world.js';
import { player } from '../../entities/player.js';
import { areaKind, hasVisited, screenId, places, placeVisited, resolveSpot } from '../../game/places.js';
import { currentDungeon, dungeonRooms, hasMap } from '../../game/dungeons.js';
import { el } from '../dom.js';

// The play mode's documented shape for a feature that opens over it
// (systems/flow.js, registerPlayHook's doc comment gives this exact example).
registerPlayHook({
  id: 'map',
  phase: 'input',
  update() {
    if (input.pressed('map')) pushMode('map');
  },
});

registerMode('map', {
  enter() {
    if (!root) build();
    renderMap();
    root.hidden = false;
  },
  exit() {
    root.hidden = true;
  },
  update() {
    if (input.pressed('map') || input.pressed('menu')) popMode();
  },
});

let root = null;

function build() {
  root = el('div', { id: 'map-screen', hidden: true, role: 'dialog', 'aria-label': 'Map' });
  root.innerHTML = `<div class="map-panel">
    <h2 class="map-title">Map</h2>
    <div class="map-canvas"></div>
    <p class="map-hint"></p>
    <button type="button" class="map-close">Close</button>
  </div>`;
  root.querySelector('.map-close').addEventListener('click', () => popMode());
  root.addEventListener('click', (e) => e.target === root && popMode());
  (document.getElementById('app') ?? document.body).append(root);
}

function renderMap() {
  const d = currentDungeon();
  root.querySelector('.map-title').textContent = d ? d.name : 'Map';
  const canvas = root.querySelector('.map-canvas');
  const hint = root.querySelector('.map-hint');
  canvas.className = 'map-canvas';
  canvas.innerHTML = '';
  canvas.style.width = '';
  canvas.style.height = '';
  hint.textContent = '';
  if (d) renderDungeon(canvas, hint, d);
  else renderOverworld(canvas, hint);
}

// ---------------------------------------------------------------- overworld
const OUTDOOR_KINDS = new Set(['overworld', 'town', 'castle', 'cave']);
const MAP_W = 520; // the canvas box; CSS gives .map-panel the room for it
const MAP_H = 320;

function renderOverworld(canvas, hint) {
  canvas.classList.add('map-overworld');
  const screens = [...world.screens.values()].filter((s) => OUTDOOR_KINDS.has(areaKind(s.area)));
  if (!screens.length) {
    hint.textContent = 'Nothing charted yet.';
    return;
  }
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const s of screens) {
    minX = Math.min(minX, s.x0);
    minZ = Math.min(minZ, s.z0);
    maxX = Math.max(maxX, s.x1);
    maxZ = Math.max(maxZ, s.z1);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min(MAP_W / spanX, MAP_H / spanZ);
  canvas.style.width = `${spanX * scale}px`;
  canvas.style.height = `${spanZ * scale}px`;
  for (const s of screens) {
    const seen = hasVisited(screenId(s));
    const cell = el('div', { class: `map-cell ${seen ? 'seen' : 'fog'}` });
    place(cell, (s.x0 - minX) * scale, (s.z0 - minZ) * scale, Math.max(1, (s.x1 - s.x0) * scale - 1), Math.max(1, (s.z1 - s.z0) * scale - 1));
    canvas.append(cell);
  }
  for (const p of places('dungeon')) {
    if (!placeVisited(p.id)) continue;
    const r = resolveSpot(p.spot);
    if (!r) continue;
    const mark = el('div', { class: 'map-mark map-mark-dungeon', title: p.name });
    place(mark, (r.screen.x0 + r.x - minX) * scale, (r.screen.z0 + r.z - minZ) * scale);
    canvas.append(mark);
  }
  const hero = el('div', { class: 'map-mark map-mark-hero', title: 'You' });
  place(hero, (player.x - minX) * scale, (player.z - minZ) * scale);
  canvas.append(hero);
  hint.textContent = 'Fog hides screens you have not seen yet.';
}

function place(node, left, top, w = null, h = null) {
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  if (w != null) node.style.width = `${w}px`;
  if (h != null) node.style.height = `${h}px`;
}

// ---------------------------------------------------------------- dungeon
const ROOM_CELL = 22;

function renderDungeon(canvas, hint, d) {
  canvas.classList.add('map-dungeon');
  const rooms = dungeonRooms(d.id);
  const full = hasMap(d.id);
  const mainRooms = rooms.filter((r) => r.room && (full || r.visited));
  const bossRooms = rooms.filter((r) => !r.room && (full || r.visited));
  if (!mainRooms.length && !bossRooms.length) {
    hint.textContent = 'Nothing mapped yet. Find a room first.';
    return;
  }
  hint.textContent = full ? 'The dungeon map is yours: every room shows.' : 'Only the rooms you have walked into show; the map chest reveals the rest.';
  const [cols, floorRows] = d.canvas ?? [8, 10];
  const here = currentScreen();
  const floors = [...new Set(mainRooms.map((r) => r.floor))].sort((a, b) => a - b);
  for (const floor of floors) {
    const band = el('div', { class: 'map-floor' });
    if (floors.length > 1) band.append(el('div', { class: 'map-floor-label', text: `Floor ${floor + 1}` }));
    const grid = el('div', { class: 'map-rooms' });
    grid.style.gridTemplateColumns = `repeat(${cols}, ${ROOM_CELL}px)`;
    grid.style.gridTemplateRows = `repeat(${floorRows}, ${ROOM_CELL}px)`;
    for (const r of mainRooms.filter((x) => x.floor === floor)) {
      const m = /^([A-J])-([1-8])$/.exec(r.room);
      if (!m) continue;
      const cell = el('div', { class: `map-room${r.boss ? ' boss' : ''}${here?.key === r.key ? ' here' : ''}`, title: r.name });
      cell.style.gridColumn = String(Number(m[2]));
      cell.style.gridRow = String(m[1].charCodeAt(0) - 64);
      grid.append(cell);
    }
    band.append(grid);
    canvas.append(band);
  }
  if (bossRooms.length) {
    const band = el('div', { class: 'map-floor map-boss-band' });
    band.append(el('div', { class: 'map-floor-label', text: 'Boss chamber' }));
    const row = el('div', { class: 'map-rooms map-rooms-boss' });
    for (const r of bossRooms) row.append(el('div', { class: `map-boss-room${here?.key === r.key ? ' here' : ''}`, title: r.name }));
    band.append(row);
    canvas.append(band);
  }
}

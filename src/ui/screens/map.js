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
// Drawn in the UI canvas (ui/canvas/gfx.js). The chart is worked out once when the map opens
// (play is stopped behind it), then drawn from that model.
import { input } from '../../core/input.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { registerPlayHook } from '../../systems/flow.js';
import { world, currentScreen } from '../../world/world.js';
import { player } from '../../entities/player.js';
import { areaKind, hasVisited, screenId, places, placeVisited, resolveSpot } from '../../game/places.js';
import { currentDungeon, dungeonRooms, hasMap } from '../../game/dungeons.js';
import { registerUiPart, requestUi, COLORS } from '../canvas/gfx.js';

// The play mode's documented shape for a feature that opens over it
// (systems/flow.js, registerPlayHook's doc comment gives this exact example).
registerPlayHook({
  id: 'map',
  phase: 'input',
  update() {
    if (input.pressed('map')) pushMode('map');
  },
});

let open = false;
let model = null;

registerMode('map', {
  enter() {
    model = buildModel();
    open = true;
    requestUi();
  },
  exit() {
    open = false;
    requestUi();
  },
  update() {
    if (input.pressed('map') || input.pressed('menu')) popMode();
  },
});

// What the map shows, for tests: { open, title, kind, cells, hero, rooms, hint }.
export const mapView = () => ({
  open,
  title: model?.title ?? '',
  kind: model?.kind ?? null,
  cells: model?.cells?.length ?? 0,
  hero: !!model?.hero,
  rooms: model?.floors?.reduce((n, f) => n + f.rooms.length, 0) ?? 0,
  hint: model?.hint ?? '',
});

// ---------------------------------------------------------------- the model
const OUTDOOR_KINDS = new Set(['overworld', 'town', 'castle', 'cave']);
// Areas of the fun-audit test rigs and scenario probes (columns 410-479,
// docs/ARCHITECTURE.md "Global regions"): reached only by teleport, so they
// have no business filling up the real overworld's map. An id prefix catches
// them even where a test area's `kind` happens to default to 'overworld'.
const isPlayableArea = (area) => !area.id.startsWith('test-') && OUTDOOR_KINDS.has(areaKind(area));

function buildModel() {
  const d = currentDungeon();
  return d ? dungeonModel(d) : overworldModel();
}

function overworldModel() {
  const m = { kind: 'overworld', title: 'Map', hint: '', cells: [], marks: [], hero: null, minX: 0, minZ: 0, spanX: 1, spanZ: 1 };
  const screens = [...world.screens.values()].filter((s) => isPlayableArea(s.area));
  if (!screens.length) {
    m.hint = 'Nothing charted yet.';
    return m;
  }
  // Frame what has been explored plus a screen of fog around it; the whole world's extent is
  // far wider than tall, and scaling it into the box left a one-pixel sliver.
  const seen = screens.filter((s) => hasVisited(screenId(s)));
  const framed = seen.length ? seen : screens;
  const pad = seen.length ? 16 : 0;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const s of framed) {
    minX = Math.min(minX, s.x0);
    minZ = Math.min(minZ, s.z0);
    maxX = Math.max(maxX, s.x1);
    maxZ = Math.max(maxZ, s.z1);
  }
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  Object.assign(m, { minX, minZ, spanX: Math.max(1, maxX - minX), spanZ: Math.max(1, maxZ - minZ) });
  for (const s of screens) {
    if (s.x1 <= minX || s.x0 >= maxX || s.z1 <= minZ || s.z0 >= maxZ) continue; // outside the frame
    m.cells.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, seen: hasVisited(screenId(s)) });
  }
  for (const p of places('dungeon')) {
    if (!placeVisited(p.id)) continue;
    const r = resolveSpot(p.spot);
    if (r) m.marks.push({ x: r.screen.x0 + r.x, z: r.screen.z0 + r.z, name: p.name });
  }
  m.hero = { x: player.x, z: player.z };
  m.hint = 'Fog hides screens you have not seen yet.';
  return m;
}

function dungeonModel(d) {
  const m = { kind: 'dungeon', title: d.name, hint: '', floors: [], boss: [] };
  const rooms = dungeonRooms(d.id);
  const full = hasMap(d.id);
  const mainRooms = rooms.filter((r) => r.room && (full || r.visited));
  const bossRooms = rooms.filter((r) => !r.room && (full || r.visited));
  if (!mainRooms.length && !bossRooms.length) {
    m.hint = 'Nothing mapped yet. Find a room first.';
    return m;
  }
  m.hint = full ? 'The dungeon map is yours: every room shows.' : 'Only the rooms you have walked into show; the map chest reveals the rest.';
  const [cols, rows] = d.canvas ?? [8, 10];
  const here = currentScreen();
  const floors = [...new Set(mainRooms.map((r) => r.floor))].sort((a, b) => a - b);
  for (const floor of floors) {
    const band = { label: floors.length > 1 ? `Floor ${floor + 1}` : null, cols, rows, rooms: [] };
    for (const r of mainRooms.filter((x) => x.floor === floor)) {
      const c = /^([A-J])-([1-8])$/.exec(r.room);
      if (!c) continue;
      band.rooms.push({ col: Number(c[2]) - 1, row: c[1].charCodeAt(0) - 65, boss: !!r.boss, here: here?.key === r.key });
    }
    m.floors.push(band);
  }
  m.boss = bossRooms.map((r) => ({ here: here?.key === r.key }));
  return m;
}

// ---------------------------------------------------------------- drawing
const CHART = '#0a1712';
const SEEN = '#1c3226';
const CELL = 11; // a dungeon room, logical pixels (a 1px gap between)

const frame = (g, x, y, w, h, color) => {
  g.rect(x, y, w, 1, color);
  g.rect(x, y + h - 1, w, 1, color);
  g.rect(x, y + 1, 1, h - 2, color);
  g.rect(x + w - 1, y + 1, 1, h - 2, color);
};

// A small round mark: a plus-shaped blob r pixels across, centred on x, y.
const blob = (g, x, y, r, color) => {
  g.rect(x - r + 1, y - r, r * 2 - 1, r * 2 + 1, color);
  g.rect(x - r, y - r + 1, r * 2 + 1, r * 2 - 1, color);
};

function chartSize(g,cell=CELL,maxHeight=g.h-100) {
  if (model.kind === 'overworld') {
    if (!model.cells.length) return [120, 40];
    const boxW = Math.min(260, g.w - 48);
    const boxH = Math.max(1,Math.min(160,maxHeight));
    const scale = Math.min(boxW / model.spanX, boxH / model.spanZ);
    return [Math.max(40, Math.round(model.spanX * scale)), Math.max(30, Math.round(model.spanZ * scale)), scale];
  }
  let w = 60;
  let h = 8;
  const columns=model.floors.length>1&&g.w>=350&&g.h<240;
  if(columns){
    w=Math.max(w,model.floors.reduce((sum,f)=>sum+Math.max(g.measure(f.label??''),f.cols*(cell+1)-1),0)+(model.floors.length-1)*16+12);
    h+=Math.max(...model.floors.map(f=>(f.label?11:0)+f.rows*(cell+1)+6));
  }
  for (const f of model.floors) {
    if(columns)continue;
    w = Math.max(w,f.cols*(cell+1)-1+12,f.label?g.measure(f.label):0);
    h += (f.label ? 11 : 0) + f.rows * (cell + 1) + 6;
  }
  if (model.boss.length) {
    w = Math.max(w,model.boss.length*(cell+2)+12,g.measure('Boss chamber')+12);
    h += 11 + cell + 6;
  }
  return [w,h,cell,columns];
}

function drawChart(g, x, y, w, h, scale,columns=false) {
  g.rect(x, y, w, h, CHART);
  frame(g, x - 1, y - 1, w + 2, h + 2, COLORS.line);
  if (model.kind === 'overworld') {
    for (const c of model.cells) {
      const cx = x + Math.round((c.x0 - model.minX) * scale);
      const cy = y + Math.round((c.z0 - model.minZ) * scale);
      const cw = Math.max(1, Math.round((c.x1 - c.x0) * scale) - 1);
      const ch = Math.max(1, Math.round((c.z1 - c.z0) * scale) - 1);
      // stay inside the chart at the padded frame's edge
      const x2 = Math.min(x + w, cx + cw);
      const y2 = Math.min(y + h, cy + ch);
      if (x2 <= Math.max(x, cx) || y2 <= Math.max(y, cy)) continue;
      g.rect(Math.max(x, cx), Math.max(y, cy), x2 - Math.max(x, cx), y2 - Math.max(y, cy), c.seen ? SEEN : CHART);
      frame(g, Math.max(x, cx), Math.max(y, cy), x2 - Math.max(x, cx), y2 - Math.max(y, cy), 'rgba(243, 236, 210, 0.12)');
    }
    for (const mk of model.marks) {
      const mx = x + Math.round((mk.x - model.minX) * scale);
      const my = y + Math.round((mk.z - model.minZ) * scale);
      blob(g, mx, my, 3, COLORS.goldDeep);
      blob(g, mx, my, 2, '#6a4a34');
    }
    if (model.hero) {
      const hx = x + Math.round((model.hero.x - model.minX) * scale);
      const hy = y + Math.round((model.hero.z - model.minZ) * scale);
      const big = Math.floor(g.now / 700) % 2 === 0;
      blob(g, hx, hy, big ? 5 : 4, 'rgba(241, 194, 50, 0.35)');
      blob(g, hx, hy, 3, COLORS.gold);
    }
    return;
  }
  let cy = y + 6;
  const cell=scale??CELL;
  const widths=model.floors.map(f=>Math.max(g.measure(f.label??''),f.cols*(cell+1)-1));
  let fx=x+Math.round((w-widths.reduce((a,b)=>a+b,0)-(widths.length-1)*16)/2);
  const top=cy;
  for (const [index,f] of model.floors.entries()) {
    if(columns)cy=top;
    const gw = f.cols * (cell + 1) - 1;
    const gx = columns?fx+Math.round((widths[index]-gw)/2):x+Math.round((w-gw)/2);
    if (f.label) {
      g.text(f.label,columns?fx+widths[index]/2:x+w/2,cy,{align:'center',color:COLORS.muted});
      cy += 11;
    }
    for (const r of f.rooms) {
      const rx = gx + r.col * (cell + 1);
      const ry = cy + r.row * (cell + 1);
      g.rect(rx, ry, cell, cell, r.here ? COLORS.gold : r.boss ? '#6a2030' : SEEN);
      frame(g, rx, ry, cell, cell, r.here ? '#ffe28a' : 'rgba(243, 236, 210, 0.15)');
    }
    cy += f.rows * (cell + 1) + 6;
    if(columns)fx+=widths[index]+16;
  }
  if(columns)cy=top+Math.max(...model.floors.map(f=>(f.label?11:0)+f.rows*(cell+1)+6));
  if (model.boss.length) {
    g.text('Boss chamber', x + w / 2, cy, { align: 'center', color: COLORS.muted });
    cy += 11;
    const bw = model.boss.length * (cell+2) - 2;
    let bx = x + Math.round((w - bw) / 2);
    for (const r of model.boss) {
      g.rect(bx, cy, cell, cell, r.here ? COLORS.gold : '#6a2030');
      frame(g, bx, cy, cell, cell, r.here ? '#ffe28a' : 'rgba(243, 236, 210, 0.15)');
      bx += cell+2;
    }
  }
}

function drawMap(g) {
  g.rect(0, 0, g.w, g.h, 'rgba(8, 17, 13, 0.6)');
  g.hit('map-scrim', 0, 0, g.w, g.h, () => popMode(), 'default'); // a click outside the panel closes it
  let cell=CELL,budget=Math.max(20,g.h-100);
  const layout=()=>{
    const [cw,ch,scale,columns]=chartSize(g,cell,budget);
    const pw=Math.min(g.w-16,Math.max(cw+28,170,Math.min(300,g.measure(model.hint)+28),Math.min(300,g.measure(model.title,1,1)+28))),inner=pw-28;
    const hintLines=g.wrap(model.hint,inner),titleLines=g.wrap(model.title,inner,1,1);
    return{cw,ch,scale,columns,pw,hintLines,titleLines,ph:14+titleLines.length*11+7+ch+8+hintLines.length*11+8+17+12};
  };
  let box=layout();
  while(box.ph>g.h-12&&(model.kind==='overworld'?budget>20:cell>4)){
    if(model.kind==='overworld')budget--;else cell--;
    box=layout();
  }
  const {cw,ch,scale,columns,pw,hintLines,titleLines,ph}=box;
  const px = Math.round((g.w - pw) / 2);
  const py = Math.max(6, Math.round((g.h - ph) / 2));
  g.panel(px, py, pw, ph, { accent: true });
  g.hit('map-panel', px, py, pw, ph, () => {}, 'default');
  let y = py + 12;
  for(const line of titleLines){g.text(line.text,px+14,y,{color:COLORS.gold,tracking:1});y+=11;}
  y+=7;
  drawChart(g,px+Math.round((pw-cw)/2),y,cw,ch,scale,columns);
  y += ch + 8;
  for (const line of hintLines) {
    g.text(line.text, g.w / 2, y, { align: 'center', color: COLORS.muted });
    y += 11;
  }
  y += 8;
  const w = g.measure('Close') + 20;
  g.primary('map-close', 'Close', px + pw - 12 - w, y, () => popMode());
}

registerUiPart({
  id: 'map',
  order: 70,
  busy: () => open, // the hero's mark pulses
  key: () => (open ? 'open' : '-'),
  draw(g) {
    if (open && model) drawMap(g);
  },
});

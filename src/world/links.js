// How screens meet at their edges, worked out from the global tile grid.
//
//   areaGroups(world)  areas joined through touching screens (the whole
//                      overworld is one group; a dungeon or a house stands
//                      alone). Screens of the hero's group are drawn.
//   edgeReport(world)  { links, mismatches }: links are the places where a
//                      screen of one area touches a screen of another (walking
//                      across one changes area); mismatches are edge tiles that
//                      are open on one side and a permanent wall on the other,
//                      which strand the hero in a dead end or a wall. Tiles
//                      that open (doors, bushes: `becomes`) count as open.
import { getTile, isSolidDef } from './tiles.js';

// Every edge tile of a screen with the global tile just outside it.
function edgeTiles(screen) {
  const out = [];
  for (let x = 0; x < screen.w; x++) {
    out.push({ dir: 'north', lx: x, lz: 0, ox: screen.x0 + x, oz: screen.z0 - 1 });
    out.push({ dir: 'south', lx: x, lz: screen.h - 1, ox: screen.x0 + x, oz: screen.z1 });
  }
  for (let z = 0; z < screen.h; z++) {
    out.push({ dir: 'west', lx: 0, lz: z, ox: screen.x0 - 1, oz: screen.z0 + z });
    out.push({ dir: 'east', lx: screen.w - 1, lz: z, ox: screen.x1, oz: screen.z0 + z });
  }
  return out;
}

// 'open' (walkable), 'door' (solid until opened, cut or blown) or 'wall'.
function openness(screen, lx, lz) {
  const def = getTile(screen.tileset, screen.base[lz][lx]);
  if (!isSolidDef(def, null)) return 'open';
  return def.becomes ? 'door' : 'wall';
}

export function areaGroups(world) {
  const parent = new Map([...world.areas.keys()].map((id) => [id, id]));
  const find = (id) => {
    while (parent.get(id) !== id) id = parent.get(id);
    return id;
  };
  for (const s of world.screens.values())
    for (const e of edgeTiles(s)) {
      const other = world.screenAt(e.ox, e.oz);
      if (other && other.area !== s.area) parent.set(find(s.area.id), find(other.area.id));
    }
  const groups = new Map(); // area id -> Set of area defs in its group
  for (const id of world.areas.keys()) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(world.areas.get(id));
  }
  const byArea = new Map();
  for (const set of groups.values()) for (const a of set) byArea.set(a.id, set);
  return byArea;
}

export function edgeReport(world) {
  const links = new Map();
  const mismatches = [];
  for (const s of world.screens.values())
    for (const e of edgeTiles(s)) {
      const at = world.locate(e.ox, e.oz);
      if (!at) continue;
      const inside = openness(s, e.lx, e.lz);
      const outside = openness(at.screen, at.lx, at.lz);
      if (inside === 'open' && outside === 'wall')
        mismatches.push({ screen: s.key, name: s.name, dir: e.dir, x: e.lx, z: e.lz, facing: at.screen.key });
      if (at.screen.area === s.area) continue;
      const key = `${s.key}>${at.screen.key}`;
      const link = links.get(key) ?? { from: s.key, to: at.screen.key, dir: e.dir, crossings: 0 };
      if (inside !== 'wall' && outside !== 'wall') link.crossings++;
      links.set(key, link);
    }
  return { links: [...links.values()], mismatches };
}

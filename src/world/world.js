// The world: every screen of every area, built into voxel meshes at startup.
//
// World knows nothing about specific tiles. It parses each area's ASCII rows,
// asks the tile registry (world/tiles.js) how to build each char, keeps the
// props (bushes, doors, chests, flames) as separate meshes, answers collision
// queries and dispatches tile hooks (onEnter, onPush, onSword, onBomb, ...).
//
// Changing a tile at run time:
//   world.setTile(tx, tz, '.', { rebuild: false })  // only the prop changes (bush cut)
//   world.setTile(tx, tz, '.')                      // re-mesh the screen (cracked wall blown)
//   world.setTile(tx, tz, '.', { persist: true })   // also remembered in save data
// Rebuilds keep every other tile's colours: each tile replays the random
// stream it used on the first build.
//
// Addressing: screens have per-area sizes (areas.js), so a screen is looked
// up by area and local position (world.screen('crypt', 0, 1), or its key
// 'crypt:0,1'), or from a global tile (world.locate(tx, tz)) through a coarse
// spatial index. Each screen carries its footprint: w, h, x0, z0, x1, z1.
import * as THREE from 'three';
import { VoxelGrid, buildGeometry, voxelMaterial, rng } from '../core/voxel.js';
import { R, TV } from '../core/constants.js';
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { CAMERA_PRESETS } from '../core/camera.js';
import { LIGHTING } from '../core/renderer.js';
import { getTile, tilesetFloor, isSolidDef } from './tiles.js';
import { areaScreenSize, areaCorner, areaStart } from './areas.js';
import { screenKey, tileKey } from './grid.js';
import { edgeReport } from './links.js';

// The spatial index: square cells of CELL tiles, each listing the screens
// that overlap it.
const CELL = 32;
const cellKey = (cx, cz) => `${cx},${cz}`;

// Room side walls (area.rooms) are drawn half a tile inward, so their
// collision reaches that far past their own column.
export const WALL_INSET = 0.5;

// The solid box [x0, z0, x1, z1] of a solid tile located by locate().
function solidExtent(at, tx, tz) {
  if (at.screen.area.rooms) {
    if (at.lx === 0) return [tx, tz, tx + 1 + WALL_INSET, tz + 1];
    if (at.lx === at.screen.w - 1) return [tx - WALL_INSET, tz, tx + 1, tz + 1];
  }
  return [tx, tz, tx + 1, tz + 1];
}

const waterMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.78,
});

// Terrain layers. A tile builder writes into ctx.g (terrain) or ctx.layer(name);
// every non-empty layer becomes one mesh per screen with its own material.
export const LAYERS = {
  terrain: { material: voxelMaterial, castShadow: true, receiveShadow: true },
  water: {
    material: waterMaterial,
    castShadow: false,
    receiveShadow: true,
    tick: (mesh, t) => {
      mesh.position.y = Math.sin(t * 1.6) * 0.025 - 0.01;
    },
  },
};

export function registerLayer(name, def) {
  if (LAYERS[name]) throw new Error(`Layer "${name}" is already registered`);
  LAYERS[name] = def;
}

export class World {
  constructor() {
    this.scene = null;
    this.screens = new Map(); // 'area:i,j' -> screen
    this.areas = new Map(); // id -> area def
    this.cells = new Map(); // spatial index: 'cx,cz' -> screens overlapping that cell
    this.lastHit = null; // the screen the last tile lookup found
    this.ticking = new Set(); // props with userData.tick(t, dt)
    this.dirty = new Set(); // screens waiting to be re-meshed
  }

  // ---------------------------------------------------------------- setup
  build(scene, areas) {
    this.scene = scene;
    for (const area of areas) this.addArea(area);
    this.validate();
    this.checkEdges();
    for (const screen of this.screens.values()) {
      this.buildScreen(screen);
      this.buildProps(screen);
    }
    on('explosion', (explosion) => {
      for (const [tx, tz] of this.tilesInRadius(explosion.x, explosion.z, explosion.radius ?? 1))
        this.trigger(tx, tz, 'onBomb', { explosion });
    });
    on('light', (light) => {
      for (const [tx, tz] of this.tilesInRadius(light.x, light.z, light.radius ?? 0.5))
        this.trigger(tx, tz, 'onLight', { light });
    });
  }

  addArea(area) {
    this.areas.set(area.id, area);
    const [ax, az] = areaCorner(area); // global tile of local screen 0,0's corner
    const [w, h] = areaScreenSize(area);
    const areaTileset = area.tileset ?? 'overworld';
    for (const [key, def] of Object.entries(area.screens)) {
      const [lx, ly] = key.split(',').map(Number);
      const x0 = ax + lx * w; // north-west corner, global tiles
      const z0 = az + ly * h;
      const sx = x0 / w; // global screen, counted in this area's screen size (fractional for some `at`)
      const sy = z0 / h;
      const tileset = def.tileset ?? areaTileset;
      const markers = { ...area.spawns, ...def.spawns };
      const floor = def.floor ?? area.floor ?? tilesetFloor(tileset);
      const spawns = [];
      const tiles = def.rows.map((row, z) =>
        row.split('').map((ch, x) => {
          const m = markers[ch];
          if (!m) return ch;
          const { type, tile, once, ...opts } = typeof m === 'string' ? { type: m } : m;
          const tx = x0 + x;
          const tz = z0 + z;
          spawns.push({ type, x, z, opts, flag: once ? `taken:${tx},${tz}` : null });
          return tile ?? floor;
        })
      );
      const screen = {
        key: screenKey(area.id, lx, ly),
        sx,
        sy,
        lx,
        ly,
        w, // tiles, west to east
        h, // tiles, north to south
        x0,
        z0,
        x1: x0 + w,
        z1: z0 + h,
        area,
        def,
        name: def.name,
        tileset,
        lighting: def.lighting ?? area.lighting ?? 'day',
        camera: def.camera ?? area.camera ?? null,
        base: tiles.map((r) => [...r]), // tiles as the map drew them (markers replaced)
        tiles, // current tiles
        spawns,
        props: new Map(), // 'x,z' (local) -> Object3D
        meshes: [], // { name, mesh, layer }
        rngStates: null, // per-tile random state from the first build
        built: null, // tiles as last meshed, to skip needless rebuilds
      };
      this.index(screen);
      this.screens.set(screen.key, screen);
    }
  }

  // Add a screen to the spatial index; two screens may never share a tile.
  index(screen) {
    for (let cx = Math.floor(screen.x0 / CELL); cx <= Math.floor((screen.x1 - 1) / CELL); cx++)
      for (let cz = Math.floor(screen.z0 / CELL); cz <= Math.floor((screen.z1 - 1) / CELL); cz++) {
        const k = cellKey(cx, cz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        for (const o of list)
          if (o.x0 < screen.x1 && screen.x0 < o.x1 && o.z0 < screen.z1 && screen.z0 < o.z1)
            throw new Error(
              `Screen ${screen.key} (tiles x ${screen.x0}-${screen.x1 - 1}, z ${screen.z0}-${screen.z1 - 1}) overlaps ` +
                `screen ${o.key} (x ${o.x0}-${o.x1 - 1}, z ${o.z0}-${o.z1 - 1}): give one of the areas another origin (or at)`
            );
        list.push(screen);
      }
  }

  // Catch map typos, bad warp targets and unknown camera or lighting names at
  // startup, with a readable message.
  validate() {
    for (const s of this.screens.values()) {
      s.tiles.forEach((row, z) =>
        row.forEach((ch, x) => {
          const def = getTile(s.tileset, ch);
          if (!def)
            throw new Error(`Unknown tile "${ch}" in area "${s.area.id}" screen ${s.lx},${s.ly} ("${s.name}") at ${x},${z} (tileset "${s.tileset}")`);
          if (def.onEnter?.isWarp && !this.warpSpec(s, ch))
            throw new Error(`Warp tile "${ch}" at ${x},${z} of ${s.key} ("${s.name}") has no destination in the screen's or the area's warps`);
        })
      );
      if (s.camera && !CAMERA_PRESETS[s.camera])
        throw new Error(`Screen ${s.key} ("${s.name}") names unknown camera preset "${s.camera}" (core/camera.js registerCameraPreset)`);
      if (!LIGHTING[s.lighting]) throw new Error(`Screen ${s.key} ("${s.name}") names unknown lighting "${s.lighting}" (core/renderer.js registerLighting)`);
      for (const [ch, spec] of Object.entries(s.def.warps ?? {})) this.checkSpot(`Warp "${ch}" of ${s.key}`, this.resolveWarp(s.area, spec));
    }
    for (const area of this.areas.values()) {
      for (const [ch, spec] of Object.entries(area.warps ?? {})) this.checkSpot(`Warp "${ch}" of area "${area.id}"`, this.resolveWarp(area, spec));
      if (area.entrance) this.checkSpot(`The entrance of area "${area.id}"`, this.resolveSpot(area.entrance, area));
    }
  }

  // A destination must be inside its screen, on a tile the hero can stand on,
  // and not on a warp tile (he would warp straight on, back and forth).
  checkSpot(what, { screen, x, z }) {
    if (!(x >= 0 && x < screen.w && z >= 0 && z < screen.h))
      throw new Error(`${what} lands at ${x},${z}, outside screen ${screen.key} (${screen.w} x ${screen.h} tiles)`);
    const tx = screen.x0 + Math.floor(x);
    const tz = screen.z0 + Math.floor(z);
    if (this.isSolid(tx, tz)) throw new Error(`${what} lands on a solid tile at ${x},${z} of ${screen.key} ("${screen.name}")`);
    if (this.tileDefAt(tx, tz)?.onEnter?.isWarp)
      throw new Error(
        `${what} lands on warp tile "${this.tile(tx, tz)}" at ${x},${z} of ${screen.key} ("${screen.name}"): the hero would warp straight on, so put it a tile off the doorway`
      );
  }

  // Edges that strand the hero, found at startup: an open edge tile facing a
  // wall across the edge (a mismatch), or, in a room, a doorway onto no
  // screen at all. Both throw. An open outdoor edge onto no screen only
  // warns: the hero stops at the edge of the map there.
  checkEdges() {
    const { mismatches, deadEnds } = edgeReport(this);
    const where = (m) => `${m.name} (${m.screen}) ${m.dir} edge tile ${m.x},${m.z}`;
    if (mismatches.length)
      throw new Error(`Edge tiles open on one side and a wall on the other:\n  ${mismatches.map((m) => `${where(m)} faces a wall in ${m.facing}`).join('\n  ')}`);
    const inRooms = deadEnds.filter((d) => this.screens.get(d.screen).area.rooms);
    if (inRooms.length) throw new Error(`Doorways onto no room:\n  ${inRooms.map(where).join('\n  ')}`);
    const outdoors = deadEnds.filter((d) => !this.screens.get(d.screen).area.rooms);
    if (outdoors.length) console.warn(`Open edge tiles onto no screen (the hero stops there):\n  ${outdoors.map(where).join('\n  ')}`);
  }

  // ---------------------------------------------------------------- queries
  // A screen by area and local position, world.screen('crypt', 0, 1), or by
  // key, world.screen('crypt:0,1'). null if there is none.
  screen(areaOrKey, lx, ly) {
    if (typeof areaOrKey !== 'string')
      throw new Error(
        'world.screen(sx, sy) is gone (screens have per-area sizes): use world.screen(areaId, lx, ly), world.screen(key) or world.locate(tx, tz)'
      );
    return this.screens.get(lx === undefined ? areaOrKey : screenKey(areaOrKey, lx, ly)) ?? null;
  }

  // The screen whose footprint holds world point or tile (x, z), or null.
  screenAt(x, z) {
    const last = this.lastHit;
    if (last && x >= last.x0 && x < last.x1 && z >= last.z0 && z < last.z1) return last;
    const list = this.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (list) for (const s of list) if (x >= s.x0 && x < s.x1 && z >= s.z0 && z < s.z1) return (this.lastHit = s);
    return null;
  }

  // The screen holding global tile (tx, tz) and the tile's local coordinates.
  locate(tx, tz) {
    const screen = this.screenAt(tx, tz);
    return screen ? { screen, lx: tx - screen.x0, lz: tz - screen.z0 } : null;
  }

  tileDef(screen, ch) {
    return getTile(screen.tileset, ch);
  }

  // Global tile lookup; null when outside every screen.
  tile(tx, tz) {
    const at = this.locate(tx, tz);
    return at ? at.screen.tiles[at.lz][at.lx] : null;
  }

  // Tile definition at a global tile; null when outside every screen.
  tileDefAt(tx, tz) {
    const at = this.locate(tx, tz);
    return at ? getTile(at.screen.tileset, at.screen.tiles[at.lz][at.lx]) : null;
  }

  // Outside the world counts as solid, so nobody walks off the map.
  isSolid(tx, tz, body = null) {
    const def = this.tileDefAt(tx, tz);
    return def === null || isSolidDef(def, body);
  }

  // The solid part of global tile (tx, tz) for a body as [x0, z0, x1, z1], or
  // null when the tile does not stop it. Outside every screen is solid. Room
  // side walls reach their visible face (see WALL_INSET).
  solidBox(tx, tz, body = null) {
    const at = this.locate(tx, tz);
    if (!at) return [tx, tz, tx + 1, tz + 1];
    if (!isSolidDef(getTile(at.screen.tileset, at.screen.tiles[at.lz][at.lx]), body)) return null;
    return solidExtent(at, tx, tz);
  }

  // Does a body at (x, z) with radius r (a square of half-size r) overlap
  // anything solid? Touching an edge does not count.
  blocked(x, z, r, body = null) {
    for (let tx = Math.floor(x - r - WALL_INSET); tx <= Math.floor(x + r + WALL_INSET); tx++)
      for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++) {
        const b = this.solidBox(tx, tz, body);
        if (b && x + r > b[0] && x - r < b[2] && z + r > b[1] && z - r < b[3]) return true;
      }
    return false;
  }

  // Does this tile stop projectiles? Water is solid to walkers but not to shots.
  blocksShot(tx, tz) {
    const def = this.tileDefAt(tx, tz);
    if (def === null) return true;
    return def.blocksShots ?? isSolidDef(def, null);
  }

  // Does something at world point (x, z) stop a projectile? Like blocksShot,
  // but room side walls count from their visible face.
  shotBlockedAt(x, z) {
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (this.blocksShot(tx, tz)) return true;
    for (const nx of [tx - 1, tx + 1]) {
      const at = this.locate(nx, tz);
      if (!at?.screen.area.rooms || !this.blocksShot(nx, tz)) continue;
      const b = solidExtent(at, nx, tz);
      if (x >= b[0] && x < b[2]) return true;
    }
    return false;
  }

  // Global tiles whose centre lies within radius of (x, z).
  tilesInRadius(x, z, radius) {
    const out = [];
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++)
      for (let tz = Math.floor(z - radius); tz <= Math.floor(z + radius); tz++)
        if (Math.hypot(tx + 0.5 - x, tz + 0.5 - z) <= radius) out.push([tx, tz]);
    return out;
  }

  // The warp spec for tile char `ch` on a screen: the screen's own warps
  // first, then its area's. null if neither has one.
  warpSpec(screen, ch) {
    return screen.def.warps?.[ch] ?? screen.area.warps?.[ch] ?? null;
  }

  // Warp destination for the tile at (tx, tz), or null.
  warpAt(tx, tz) {
    const at = this.locate(tx, tz);
    if (!at) return null;
    const spec = this.warpSpec(at.screen, at.screen.tiles[at.lz][at.lx]);
    return spec ? this.resolveWarp(at.screen.area, spec) : null;
  }

  // A spot names a place the way content does: { area, screen: [i, j], x, z,
  // yaw }, with the area's local screen and tile coordinates inside it (x and
  // z default to the middle of the screen; screen to the area's start, else
  // its first screen; area to fromArea).
  // Returns { screen, x, z, yaw }, x and z still local to that screen.
  resolveSpot(spot, fromArea = null) {
    const area = spot.area ? this.areas.get(spot.area) : fromArea;
    const from = fromArea ? ` from "${fromArea.id}"` : '';
    if (!area) throw new Error(`A spot${from} points at unknown area "${spot.area}"`);
    const [i, j] = spot.screen ?? areaStart(area);
    const screen = this.screen(area.id, i, j);
    if (!screen) throw new Error(`A spot${from} points at missing screen ${i},${j} of "${area.id}"`);
    return { screen, x: spot.x ?? screen.w / 2, z: spot.z ?? screen.h / 2, yaw: spot.yaw ?? 0 };
  }

  // Warp specs are spots; kept under this name for older callers.
  resolveWarp(fromArea, spec) {
    return this.resolveSpot(spec, fromArea);
  }

  // Where a body of radius r can stand on a screen, nearest local (x, z): the
  // point itself if it is clear, else the nearest clear tile centre. Clear:
  // nothing solid under the body and no onEnter hook (warp, pit) under its
  // centre. null if the screen has no such spot.
  freeSpot(screen, x = screen.w / 2, z = screen.h / 2, r = 0.3) {
    const clear = (lx, lz) =>
      !this.blocked(screen.x0 + lx, screen.z0 + lz, r) && !getTile(screen.tileset, screen.tiles[Math.floor(lz)]?.[Math.floor(lx)])?.onEnter;
    if (x >= 0 && x < screen.w && z >= 0 && z < screen.h && clear(x, z)) return { x, z };
    let best = null;
    for (let tz = 0; tz < screen.h; tz++)
      for (let tx = 0; tx < screen.w; tx++) {
        const d = Math.hypot(tx + 0.5 - x, tz + 0.5 - z);
        if ((!best || d < best.d) && clear(tx + 0.5, tz + 0.5)) best = { x: tx + 0.5, z: tz + 0.5, d };
      }
    return best && { x: best.x, z: best.z };
  }

  // ---------------------------------------------------------------- hooks
  // Call a tile's hook (onPush, onSword, ...) if it has one; returns its result.
  trigger(tx, tz, hook, extra = {}) {
    const at = this.locate(tx, tz);
    if (!at) return undefined;
    const ch = at.screen.tiles[at.lz][at.lx];
    const def = getTile(at.screen.tileset, ch);
    const fn = def?.[hook];
    if (!fn) return undefined;
    return fn.call(def, { world: this, screen: at.screen, area: at.screen.area, tx, tz, x: at.lx, z: at.lz, ch, def, ...extra });
  }

  // ---------------------------------------------------------------- changes
  setTile(tx, tz, ch, { rebuild = true, persist = false, reason = null } = {}) {
    const at = this.locate(tx, tz);
    if (!at) return false;
    const { screen, lx, lz } = at;
    const from = screen.tiles[lz][lx];
    if (from === ch) return false;
    const def = getTile(screen.tileset, ch);
    if (!def) throw new Error(`setTile: unknown tile "${ch}" in tileset "${screen.tileset}"`);
    screen.tiles[lz][lx] = ch;
    this.removeProp(screen, lx, lz);
    if (def.prop) this.addProp(screen, lx, lz);
    if (rebuild) this.dirty.add(screen);
    if (persist) state.tileEdits[tileKey(tx, tz)] = ch;
    emit('tile-changed', { tx, tz, from, to: ch, screen, reason });
    return true;
  }

  // Tiles marked `regrow` (bushes) come back each time a screen is entered.
  regrow(screen) {
    for (let z = 0; z < screen.h; z++)
      for (let x = 0; x < screen.w; x++) {
        const base = screen.base[z][x];
        if (screen.tiles[z][x] !== base && getTile(screen.tileset, base).regrow)
          this.setTile(screen.x0 + x, screen.z0 + z, base, { rebuild: false, reason: 'regrow' });
      }
  }

  // Re-mesh screens changed by setTile. Runs at the end of every update.
  flush() {
    for (const screen of this.dirty) this.buildScreen(screen);
    this.dirty.clear();
  }

  // Back to the maps plus state.tileEdits, e.g. after a new game or a load.
  // Props are rebuilt too so they pick up flags (opened chests).
  reset() {
    for (const screen of this.screens.values())
      for (let z = 0; z < screen.h; z++) screen.tiles[z] = [...screen.base[z]];
    for (const [key, ch] of Object.entries(state.tileEdits)) {
      const [tx, tz] = key.split(',').map(Number);
      const at = this.locate(tx, tz);
      if (at && getTile(at.screen.tileset, ch)) at.screen.tiles[at.lz][at.lx] = ch;
    }
    for (const screen of this.screens.values()) {
      for (const k of [...screen.props.keys()]) {
        const [x, z] = k.split(',').map(Number);
        this.removeProp(screen, x, z);
      }
      this.buildProps(screen);
      if (screen.built !== screen.tiles.map((r) => r.join('')).join('\n')) this.dirty.add(screen);
    }
    this.flush();
  }

  // ---------------------------------------------------------------- building
  buildScreen(screen) {
    for (const m of screen.meshes) {
      this.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
    }
    screen.meshes = [];

    const rand = rng(screen.sx * 131 + screen.sy * 977 + 7);
    const grids = new Map();
    const layer = (name) => {
      let g = grids.get(name);
      if (!g) {
        if (!LAYERS[name]) throw new Error(`Unknown terrain layer "${name}"`);
        g = new VoxelGrid(rand);
        grids.set(name, g);
      }
      return g;
    };
    const g = layer('terrain');
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const first = !screen.rngStates;
    if (first) screen.rngStates = new Array(screen.w * screen.h);

    for (let z = 0; z < screen.h; z++) {
      for (let x = 0; x < screen.w; x++) {
        const i = z * screen.w + x;
        if (first) screen.rngStates[i] = rand.getState();
        else rand.setState(screen.rngStates[i]);
        const ch = screen.tiles[z][x];
        const def = getTile(screen.tileset, ch);
        if (!def.build) continue;
        def.build({
          world: this,
          screen,
          area: screen.area,
          x,
          z,
          tx: screen.x0 + x,
          tz: screen.z0 + z,
          bx: x * R,
          bz: z * R,
          ch,
          def,
          g,
          layer,
          rand,
          pick,
          tileAt: (dx, dz) => screen.tiles[z + dz]?.[x + dx],
        });
      }
    }

    const ox = screen.x0;
    const oz = screen.z0;
    for (const [name, grid] of grids) {
      if (name !== 'terrain' && !grid.map.size) continue;
      const L = LAYERS[name];
      const mesh = new THREE.Mesh(buildGeometry(grid, TV), L.material);
      mesh.position.set(ox, 0, oz);
      mesh.castShadow = !!L.castShadow;
      mesh.receiveShadow = !!L.receiveShadow;
      this.scene.add(mesh);
      screen.meshes.push({ name, mesh, layer: L });
    }
    screen.built = screen.tiles.map((r) => r.join('')).join('\n');
  }

  buildProps(screen) {
    for (let z = 0; z < screen.h; z++)
      for (let x = 0; x < screen.w; x++) if (getTile(screen.tileset, screen.tiles[z][x]).prop) this.addProp(screen, x, z);
  }

  addProp(screen, x, z) {
    const ch = screen.tiles[z][x];
    const def = getTile(screen.tileset, ch);
    const tx = screen.x0 + x;
    const tz = screen.z0 + z;
    const obj = def.prop({ world: this, screen, area: screen.area, x, z, tx, tz, cx: tx + 0.5, cz: tz + 0.5, ch, def });
    if (!obj) return null;
    obj.castShadow = true;
    obj.receiveShadow = true;
    this.scene.add(obj);
    screen.props.set(`${x},${z}`, obj);
    if (obj.userData.tick) this.ticking.add(obj);
    return obj;
  }

  removeProp(screen, x, z) {
    const k = `${x},${z}`;
    const obj = screen.props.get(k);
    if (!obj) return;
    this.scene.remove(obj);
    this.ticking.delete(obj);
    screen.props.delete(k);
  }

  // The prop standing on global tile (tx, tz), if any.
  propAt(tx, tz) {
    const at = this.locate(tx, tz);
    return at ? at.screen.props.get(`${at.lx},${at.lz}`) ?? null : null;
  }

  // ---------------------------------------------------------------- per frame
  update(t, dt) {
    for (const s of this.screens.values()) for (const m of s.meshes) m.layer.tick?.(m.mesh, t, dt);
    for (const obj of this.ticking) obj.userData.tick(t, dt);
  }
}

export const world = new World();

// The screen the hero is on (or sliding into): its key is state.screenKey.
export const currentScreen = () => (state.screenKey ? world.screens.get(state.screenKey) ?? null : null);

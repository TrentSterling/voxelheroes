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
// Rebuilds keep every other tile's look: tile builders are deterministic per
// tile (terrain.js), and each screen is built with a margin of its
// neighbours' tiles so edges match.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { getTile, tilesetFloor, isSolidDef } from './tiles.js';
import { screenKey, tileKey } from './grid.js';
import { buildScreenTerrain, buildBackdrops, marginScreens } from './terrain.js';

// Terrain layers and the mesh building live in terrain.js (tile kits: world/tiles/).
export { LAYERS, registerLayer } from './terrain.js';

export class World {
  constructor() {
    this.scene = null;
    this.screens = new Map(); // 'sx,sy' -> screen
    this.areas = new Map(); // id -> area def
    this.ticking = new Set(); // props with userData.tick(t, dt)
    this.dirty = new Set(); // screens waiting to be re-meshed
  }

  // ---------------------------------------------------------------- setup
  build(scene, areas) {
    this.scene = scene;
    for (const area of areas) this.addArea(area);
    this.validate();
    for (const screen of this.screens.values()) {
      this.buildScreen(screen);
      this.buildProps(screen);
    }
    buildBackdrops(this);
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
    const [ox, oy] = area.origin ?? [0, 0];
    const areaTileset = area.tileset ?? 'overworld';
    for (const [key, def] of Object.entries(area.screens)) {
      const [lx, ly] = key.split(',').map(Number);
      const sx = ox + lx;
      const sy = oy + ly;
      const gkey = screenKey(sx, sy);
      const clash = this.screens.get(gkey);
      if (clash) throw new Error(`Screen ${gkey} belongs to both area "${clash.area.id}" and area "${area.id}"`);
      const tileset = def.tileset ?? areaTileset;
      const markers = { ...area.spawns, ...def.spawns };
      const floor = def.floor ?? area.floor ?? tilesetFloor(tileset);
      const spawns = [];
      const tiles = def.rows.map((row, z) =>
        row.split('').map((ch, x) => {
          const m = markers[ch];
          if (!m) return ch;
          const { type, tile, once, ...opts } = typeof m === 'string' ? { type: m } : m;
          const tx = sx * SCREEN_W + x;
          const tz = sy * SCREEN_H + z;
          spawns.push({ type, x, z, opts, flag: once ? `taken:${tx},${tz}` : null });
          return tile ?? floor;
        })
      );
      this.screens.set(gkey, {
        key: gkey,
        sx,
        sy,
        lx,
        ly,
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
      });
    }
  }

  // Catch map typos and bad warp targets at startup, with a readable message.
  validate() {
    for (const s of this.screens.values()) {
      s.tiles.forEach((row, z) =>
        row.forEach((ch, x) => {
          if (!getTile(s.tileset, ch))
            throw new Error(`Unknown tile "${ch}" in area "${s.area.id}" screen ${s.lx},${s.ly} ("${s.name}") at ${x},${z} (tileset "${s.tileset}")`);
        })
      );
      for (const spec of Object.values(s.def.warps ?? {})) this.resolveWarp(s.area, spec);
    }
    for (const area of this.areas.values()) for (const spec of Object.values(area.warps ?? {})) this.resolveWarp(area, spec);
  }

  // ---------------------------------------------------------------- queries
  screen(sx, sy) {
    return this.screens.get(screenKey(sx, sy)) || null;
  }

  // The screen holding global tile (tx, tz) and the tile's local coordinates.
  locate(tx, tz) {
    const sx = Math.floor(tx / SCREEN_W);
    const sy = Math.floor(tz / SCREEN_H);
    const screen = this.screens.get(screenKey(sx, sy));
    return screen ? { screen, lx: tx - sx * SCREEN_W, lz: tz - sy * SCREEN_H } : null;
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

  // Does a circle at (x, z) with radius r overlap a solid tile?
  blocked(x, z, r, body = null) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++)
      for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++) if (this.isSolid(tx, tz, body)) return true;
    return false;
  }

  // Does this tile stop projectiles? Water is solid to walkers but not to shots.
  blocksShot(tx, tz) {
    const def = this.tileDefAt(tx, tz);
    if (def === null) return true;
    return def.blocksShots ?? isSolidDef(def, null);
  }

  // Global tiles whose centre lies within radius of (x, z).
  tilesInRadius(x, z, radius) {
    const out = [];
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++)
      for (let tz = Math.floor(z - radius); tz <= Math.floor(z + radius); tz++)
        if (Math.hypot(tx + 0.5 - x, tz + 0.5 - z) <= radius) out.push([tx, tz]);
    return out;
  }

  // Warp destination for the tile at (tx, tz), or null.
  warpAt(tx, tz) {
    const at = this.locate(tx, tz);
    if (!at) return null;
    const ch = at.screen.tiles[at.lz][at.lx];
    const spec = at.screen.def.warps?.[ch] ?? at.screen.area.warps?.[ch];
    return spec ? this.resolveWarp(at.screen.area, spec) : null;
  }

  // { area?, screen: [x, y] (area-local), x, z, yaw } -> global { sx, sy, x, z, yaw }
  resolveWarp(fromArea, spec) {
    const area = spec.area ? this.areas.get(spec.area) : fromArea;
    if (!area) throw new Error(`Warp from "${fromArea.id}" points at unknown area "${spec.area}"`);
    const [ox, oy] = area.origin ?? [0, 0];
    const sx = ox + spec.screen[0];
    const sy = oy + spec.screen[1];
    if (!this.screen(sx, sy)) throw new Error(`Warp from "${fromArea.id}" points at missing screen ${spec.screen} of "${area.id}"`);
    return { sx, sy, x: spec.x, z: spec.z, yaw: spec.yaw ?? 0 };
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
    if (rebuild) {
      this.dirty.add(screen);
      for (const s of marginScreens(this, screen, tx, tz)) this.dirty.add(s);
    }
    if (persist) state.tileEdits[tileKey(tx, tz)] = ch;
    emit('tile-changed', { tx, tz, from, to: ch, screen, reason });
    return true;
  }

  // Tiles marked `regrow` (bushes) come back each time a screen is entered.
  regrow(screen) {
    for (let z = 0; z < SCREEN_H; z++)
      for (let x = 0; x < SCREEN_W; x++) {
        const base = screen.base[z][x];
        if (screen.tiles[z][x] !== base && getTile(screen.tileset, base).regrow)
          this.setTile(screen.sx * SCREEN_W + x, screen.sy * SCREEN_H + z, base, { rebuild: false, reason: 'regrow' });
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
      for (let z = 0; z < SCREEN_H; z++) screen.tiles[z] = [...screen.base[z]];
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
  // Mesh a screen's tiles (terrain.js): terrain, fine floor, detail and
  // water meshes plus fixtures such as lamp lights, all in screen.meshes.
  buildScreen(screen) {
    buildScreenTerrain(this, screen);
  }

  buildProps(screen) {
    for (let z = 0; z < SCREEN_H; z++)
      for (let x = 0; x < SCREEN_W; x++) if (getTile(screen.tileset, screen.tiles[z][x]).prop) this.addProp(screen, x, z);
  }

  addProp(screen, x, z) {
    const ch = screen.tiles[z][x];
    const def = getTile(screen.tileset, ch);
    const tx = screen.sx * SCREEN_W + x;
    const tz = screen.sy * SCREEN_H + z;
    const obj = def.prop({ world: this, screen, area: screen.area, x, z, tx, tz, cx: tx + 0.5, cz: tz + 0.5, ch, def });
    if (!obj) return null;
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.noShadow) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
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

// The screen the hero is on (or scrolling into).
export const currentScreen = () => world.screen(state.sx, state.sy);

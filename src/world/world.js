// The world: every screen of every area, parsed at startup. What is built into voxel meshes and
// props is what is near the hero: outdoors a ring of screens around him, streamed in and out as he
// walks, across area edges (systems/streaming.js); anywhere else his area, built at black on a
// load unless it was built ahead while he stood near its entrance (see "loads and streaming").
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
//
// Addressing: screens have per-area sizes (areas.js), so a screen is looked
// up by area and local position (world.screen('crypt', 0, 1), or its key
// 'crypt:0,1'), or from a global tile (world.locate(tx, tz)) through a coarse
// spatial index. Each screen carries its footprint: w, h, x0, z0, x1, z1.
import { state, setTileKeyCodec } from '../core/state.js';
import { isManual } from '../core/loop.js';
import { on, emit } from '../core/events.js';
import { CAMERA_PRESETS } from '../core/camera.js';
import { LIGHTING } from '../core/renderer.js';
import { getTile, tilesetFloor, isSolidDef } from './tiles.js';
import { areaScreenSize, areaCorner, areaStart } from './areas.js';
import { screenKey, tileKey } from './grid.js';
import { edgeReport } from './links.js';
import { partyHooks } from '../multiplayer/adapters.js';
import { entities, bucketOf } from '../entities/manager.js';
import { player } from '../entities/player.js';

// The spatial index: square cells of CELL tiles, each listing the screens
// that overlap it.
const CELL = 32;

// Tilesets whose screens (outside rooms) stream as one seamless outdoors (see loadArea).
export const OUTDOOR_TILESETS = ['overworld', 'town'];

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
import { buildScreenTerrain, screenTerrainSteps, disposeScreenTerrain, buildBackdrops, marginScreens, tilesKey } from './terrain.js';

// Terrain layers and the mesh building live in terrain.js (tile kits: world/tiles/).
export { LAYERS, registerLayer } from './terrain.js';

// 'x,z' -> [x, z] for a tile inside a screen of w x h tiles, else null.
function parsePos(key, w, h) {
  const m = /^(\d+),(\d+)$/.exec(key);
  if (!m) return null;
  const x = +m[1];
  const z = +m[2];
  return x < w && z < h ? [x, z] : null;
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
    this.warned = new Set();
    this.loaded = null; // the id of the one area whose meshes and props exist
  }

  // ---------------------------------------------------------------- setup
  build(scene, areas) {
    this.scene = scene;
    for (const area of areas) this.addArea(area);
    this.outdoorRects();
    this.validate();
    this.checkEdges();
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
      // Record a spawn at local (x, z); returns the tile it asks for, if any.
      const addSpawn = (m, x, z) => {
        const { type, tile, once, ...opts } = typeof m === 'string' ? { type: m } : m;
        const tx = x0 + x;
        const tz = z0 + z;
        spawns.push({ type, x, z, opts, flag: once ? `taken:${tx},${tz}` : null });
        return tile;
      };
      const where = `Area "${area.id}" screen ${key}`;
      const tiles = def.rows.map((row, z) =>
        row.split('').map((ch, x) => {
          const m = markers[ch];
          if (!m) return ch;
          // A marker char that is also a tile would make that tile impossible to place here.
          const hidden = getTile(tileset, ch);
          if (hidden)
            throw new Error(`${where}: spawn marker "${ch}" hides the "${hidden.name}" tile of tileset "${tileset}"; pick another marker char or use spawnsAt`);
          return addSpawn(m, x, z) ?? floor;
        })
      );
      // Spawns by position: spawnsAt: { 'x,z': type | spec } in local tiles. The map tile stays (unless `tile` is given).
      for (const [pos, m] of Object.entries(def.spawnsAt ?? {})) {
        const p = parsePos(pos, w, h);
        if (!p) throw new Error(`${where}: spawnsAt key "${pos}" must be "x,z" inside the ${w} x ${h} screen`);
        const tile = addSpawn(m, p[0], p[1]);
        if (tile) tiles[p[1]][p[0]] = tile;
      }
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
        streams: !area.rooms && OUTDOOR_TILESETS.includes(tileset), // part of the seamless outdoors
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
    // The area's bounding rect: follow cameras (A, D) clamp to it, not to the screen (streamed
    // screens get their neighbourhood's instead, once every area is in: build()).
    const own = [...this.screens.values()].filter((s) => s.area === area);
    const rect = { x0: Math.min(...own.map((s) => s.x0)), z0: Math.min(...own.map((s) => s.z0)), x1: Math.max(...own.map((s) => s.x1)), z1: Math.max(...own.map((s) => s.z1)), area };
    for (const s of own) s.areaRect = rect;
  }

  // Outdoors, a follow camera (A, D) clamps to the rect around a streamed screen and every streamed
  // screen touching it, whatever their areas: the outdoors is one space, and past a screen with no
  // neighbour the world ends there. The rect depends only on the hero's screen (not on what the
  // ring has built so far), and the frame is less than a screen wide, so it never jumps as he
  // crosses a line: the next screen's rect holds the same frame.
  outdoorRects() {
    for (const s of this.screens.values()) {
      if (!s.streams) continue;
      const near = this.screensNear(s, 1, (o) => o.streams);
      s.areaRect = { x0: Math.min(...near.map((o) => o.x0)), z0: Math.min(...near.map((o) => o.z0)), x1: Math.max(...near.map((o) => o.x1)), z1: Math.max(...near.map((o) => o.z1)), area: s.area };
    }
  }

  // ---------------------------------------------------------------- loads and streaming
  // What exists in the scene. `live` screens have their props, and their terrain is built or on
  // its way (a job in `pending`); only a live screen with built terrain is drawn (transitions.js).
  //
  //   outdoors  screens that stream (screen.streams: an overworld or town screen, not a room) are
  //             made live and freed one by one around the hero by systems/streaming.js, across
  //             area edges: areas are addresses there, not loads. `previews` are streamed screens
  //             kept as scenery a ring further out (terrain only, no props, no people).
  //   areas     any other area (a dungeon, a cave, a house) is live as a whole while the hero is in
  //             it, or kept (`keep`, systems/streaming.js) while he is near its entrance, so the
  //             fade into it has nothing left to build. The outdoor ring stays live meanwhile
  //             (hidden), so the way back out is instant too.
  //
  // Terrain is built by jobs (terrain.js screenTerrainSteps) that pump() runs within a per-frame
  // time budget, nearest (lowest priority number) first, meshing in workers where it can
  // (world/meshing.js); ensureBuilt() finishes one now when it must be drawn this frame.

  // The area the hero is in, and the screen he stands on: that screen is built now, and the rest
  // of its area (not outdoors, where systems/streaming.js keeps the ring) is queued behind it.
  // Returns true if the area changed.
  loadArea(id, focus = null) {
    if (!this.areas.has(id)) throw new Error(`loadArea: unknown area "${id}"`);
    const changed = this.loaded !== id;
    this.loaded = id;
    this.focus = focus;
    if (focus?.streams) {
      this.addLive(focus, -1);
      this.ensureBuilt(focus);
      return changed;
    }
    for (const s of [...this.live]) if (!s.streams && s.area.id !== id && !this.keep.has(s.area.id)) this.unbuild(s);
    this.liveArea(id, focus);
    if (focus) this.ensureBuilt(focus);
    return changed;
  }

  // Make every screen of area `id` live, the ones nearest `focus` first (after anything already
  // queued at priority `base` or less).
  liveArea(id, focus = null, base = 0) {
    for (const s of this.screens.values())
      if (s.area.id === id) this.addLive(s, s === focus ? base - 1 : base + (focus ? this.screenDist(focus, s) : 0) / 100);
  }

  previews = new Set(); // streamed screens kept as scenery (terrain only) past the live ring
  keep = new Set(); // ids of other areas kept live near their entrances (systems/streaming.js)
  live = new Set();
  pending = new Set(); // screens with a terrain job queued or running
  jobs = new Map(); // screen -> { steps, priority, waiting }
  focus = null;
  // Build accounting: ms pump() spent this frame, the most it spent in any frame and in any one
  // step, steps run, screens built, and builds that could not wait for pump() (ensureBuilt).
  stats = { frameMs: 0, maxFrameMs: 0, maxStepMs: 0, steps: 0, builds: 0, now: 0 };
  stepMs = 0.5; // a build step's running average
  onBuilt = null; // fn(screen) once a job has put a screen's new terrain in (systems/streaming.js)

  isBuilt = (screen) => this.live.has(screen);

  // Terrain queued (a lower priority number builds sooner) unless it is built already; props
  // come with it (finished), so a screen is never seen half made.
  addLive(screen, priority = 0) {
    if (!this.live.has(screen)) {
      this.live.add(screen);
      this.previews.delete(screen);
    }
    if (screen.built && !screen.propsOn) this.buildProps(screen);
    this.want(screen, priority);
  }

  removeProps(screen) {
    for (const k of [...screen.props.keys()]) {
      const [x, z] = k.split(',').map(Number);
      this.removeProp(screen, x, z);
    }
    screen.propsOn = false;
  }

  // Terrain only: a scenery screen (see previews).
  addScenery(screen, priority = 0) {
    if (this.live.has(screen)) return;
    this.previews.add(screen);
    this.want(screen, priority);
  }

  // Queue a screen's terrain build (or move a queued one up to `priority`) unless it is built.
  want(screen, priority = 0) {
    const job = this.jobs.get(screen);
    if (job) job.priority = Math.min(job.priority, priority);
    else if (!screen.built) this.queue(screen, priority);
  }

  queue(screen, priority) {
    this.jobs.set(screen, { steps: screenTerrainSteps(this, screen, { worker: true }), priority, waiting: false });
    this.pending.add(screen);
  }

  cancel(screen) {
    const job = this.jobs.get(screen);
    if (!job) return;
    this.jobs.delete(screen);
    this.pending.delete(screen);
    job.steps.return?.();
  }

  // Run build steps, lowest priority number first, until `budgetMs` is spent (at least one step
  // when anything can run). Returns how many screens are still pending.
  pump(budgetMs = 3) {
    const t0 = performance.now();
    // a drawn screen's rebuild (a wall blown open: priority -2, flush) takes up to 8 ms a frame, so
    // its new meshes follow the change within a frame or two
    for (const j of this.jobs.values()) if (j.priority <= -2 && !j.waiting) budgetMs = Math.max(budgetMs, 8);
    let ran = 0;
    for (;;) {
      let job = null;
      let screen = null;
      for (const [s, j] of this.jobs) if (!j.waiting && (!job || j.priority < job.priority)) [job, screen] = [j, s];
      // stop before a step that would likely run past the budget (steps average stepMs)
      if (!job || (ran && performance.now() - t0 + this.stepMs >= budgetMs)) break;
      ran++;
      const t1 = performance.now();
      this.stepJob(screen, job);
      const dt = performance.now() - t1;
      this.stepMs += (dt - this.stepMs) * 0.1;
      this.stats.maxStepMs = Math.max(this.stats.maxStepMs, dt);
    }
    const ms = performance.now() - t0;
    this.stats.frameMs = ms;
    this.stats.maxFrameMs = Math.max(this.stats.maxFrameMs, ms);
    this.stats.steps += ran;
    return this.pending.size;
  }

  stepJob(screen, job) {
    let r;
    try {
      r = job.steps.next();
    } catch (e) {
      // a worker failed (world/meshing.js meshes on this thread from then on): start over here
      if (job.retried) throw e;
      this.jobs.set(screen, { steps: screenTerrainSteps(this, screen), priority: job.priority, waiting: false, retried: true });
      return;
    }
    if (r.done) return this.finished(screen, job);
    const wait = r.value?.wait;
    if (wait) {
      job.waiting = true;
      wait.then(() => {
        job.waiting = false;
      });
    }
  }

  finished(screen, job) {
    if (this.jobs.get(screen) === job) {
      this.jobs.delete(screen);
      this.pending.delete(screen);
    }
    this.stats.builds++;
    screen.shown = null; // new meshes: the visibility sync looks at them again
    if (this.live.has(screen) && !screen.propsOn) this.buildProps(screen);
    if (screen.built !== tilesKey(screen)) this.dirty.add(screen); // a tile changed while it was built
    this.onBuilt?.(screen);
  }

  // Build a screen's terrain now if it is not built or a job is still on it (it is about to be
  // drawn): on this thread, dropping the job (a worker's answer to it is ignored).
  ensureBuilt(screen) {
    const job = this.jobs.get(screen);
    if (screen.built && !job) return false;
    this.cancel(screen);
    buildScreenTerrain(this, screen);
    this.stats.now++;
    this.finished(screen, job ?? null);
    return true;
  }

  // The old name: run pending builds for `budgetMs`.
  buildPending(budgetMs = 8) {
    return this.pump(budgetMs);
  }

  // Free a screen's meshes and props (its tiles stay).
  unbuild(screen) {
    this.cancel(screen);
    disposeScreenTerrain(this, screen);
    this.removeProps(screen);
    this.live.delete(screen);
    this.previews.delete(screen);
    this.dirty.delete(screen);
    screen.shown = null;
  }

  // A live screen back to scenery: its props go, its terrain stays.
  toScenery(screen) {
    this.removeProps(screen);
    this.live.delete(screen);
    this.previews.add(screen);
    screen.shown = null;
  }

  // How many screens apart two screens are: 0 the same one, 1 touching (corners too), 2 with one
  // screen's worth of tiles between them, and so on (counted in `a`'s screen size).
  screenDist(a, b) {
    if (a === b) return 0;
    const gx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
    const gz = Math.max(0, b.z0 - a.z1, a.z0 - b.z1);
    return 1 + Math.max(Math.floor(gx / a.w), Math.floor(gz / a.h));
  }

  // Screens within `r` of `screen` (screenDist), found through the spatial index.
  screensNear(screen, r, filter = null) {
    const out = [];
    const seen = new Set();
    const [x0, z0, x1, z1] = [screen.x0 - r * screen.w, screen.z0 - r * screen.h, screen.x1 + r * screen.w, screen.z1 + r * screen.h];
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor((x1 - 1) / CELL); cx++)
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor((z1 - 1) / CELL); cz++)
        for (const s of this.cells.get(cellKey(cx, cz)) ?? []) {
          if (seen.has(s)) continue;
          seen.add(s);
          if (this.screenDist(screen, s) <= r && (!filter || filter(s))) out.push(s);
        }
    return out;
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
  // startup, with a readable message. A warp (or entrance) into an area that
  // is not registered (another branch adds it) only warns; the warp does
  // nothing until the area exists.
  validate() {
    for (const s of this.screens.values()) {
      s.tiles.forEach((row, z) =>
        row.forEach((ch, x) => {
          const def = getTile(s.tileset, ch);
          if (!def)
            throw new Error(`Unknown tile "${ch}" in area "${s.area.id}" screen ${s.lx},${s.ly} ("${s.name}") at ${x},${z} (tileset "${s.tileset}")`);
          if (def.onEnter?.isWarp && !this.warpSpec(s, x, z))
            throw new Error(`Warp tile "${ch}" at ${x},${z} of ${s.key} ("${s.name}") has no destination in the screen's or the area's warps`);
        })
      );
      if (s.camera && !CAMERA_PRESETS[s.camera])
        throw new Error(`Screen ${s.key} ("${s.name}") names unknown camera preset "${s.camera}" (core/camera.js registerCameraPreset)`);
      if (!LIGHTING[s.lighting]) throw new Error(`Screen ${s.key} ("${s.name}") names unknown lighting "${s.lighting}" (core/renderer.js registerLighting)`);
      for (const [k, spec] of Object.entries(s.def.warps ?? {})) {
        if (k.length > 1 && !parsePos(k, s.w, s.h))
          throw new Error(`Area "${s.area.id}" screen ${s.lx},${s.ly}: warp key "${k}" must be a tile char or "x,z" inside the ${s.w} x ${s.h} screen`);
        this.checkWarp(`Warp "${k}" of ${s.key}`, s.area, spec);
      }
    }
    for (const area of this.areas.values()) {
      for (const [ch, spec] of Object.entries(area.warps ?? {})) this.checkWarp(`Warp "${ch}" of area "${area.id}"`, area, spec);
      if (area.entrance) this.checkWarp(`The entrance of area "${area.id}"`, area, area.entrance);
    }
  }

  // A warp into an area that is not registered warns once and is skipped
  // (warpAt returns null for it); any other must land somewhere the hero can
  // stand (checkSpot).
  checkWarp(what, fromArea, spec) {
    if (spec.area && !this.areas.has(spec.area)) {
      const msg = `${what} points at area "${spec.area}", which is not registered; it does nothing until that area exists`;
      if (!this.warned.has(msg)) console.warn(msg);
      this.warned.add(msg);
      return;
    }
    this.checkSpot(what, this.resolveWarp(fromArea, spec));
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

  // The tile [tx, tz] that stops a projectile at world point (x, z), or null.
  // Like blocksShot, but room side walls count from their visible face, so
  // near one it can be the wall beside the tile the shot is over. Its onShot
  // hook is the one to call.
  shotBlockerAt(x, z) {
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (this.blocksShot(tx, tz)) return [tx, tz];
    for (const nx of [tx - 1, tx + 1]) {
      const at = this.locate(nx, tz);
      if (!at?.screen.area.rooms || !this.blocksShot(nx, tz)) continue;
      const b = solidExtent(at, nx, tz);
      if (x >= b[0] && x < b[2]) return [nx, tz];
    }
    return null;
  }

  // Does something at world point (x, z) stop a projectile?
  shotBlockedAt(x, z) {
    return this.shotBlockerAt(x, z) !== null;
  }

  // Global tiles whose centre lies within radius of (x, z).
  tilesInRadius(x, z, radius) {
    const out = [];
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++)
      for (let tz = Math.floor(z - radius); tz <= Math.floor(z + radius); tz++)
        if (Math.hypot(tx + 0.5 - x, tz + 0.5 - z) <= radius) out.push([tx, tz]);
    return out;
  }

  // The warp spec for the tile at local (lx, lz) of a screen: the screen's
  // warps by the tile's position ('8,1'), then by its char, then the area's
  // warps by its char. null if none has one.
  warpSpec(screen, lx, lz) {
    const ch = screen.tiles[lz]?.[lx];
    const w = screen.def.warps;
    return w?.[`${lx},${lz}`] ?? w?.[ch] ?? screen.area.warps?.[ch] ?? null;
  }

  // Warp destination for the tile at (tx, tz) as { screen, x, z, yaw } (x, z
  // local to that screen), or null: no warp there, or one into an area that
  // is not registered.
  warpAt(tx, tz) {
    const at = this.locate(tx, tz);
    if (!at) return null;
    const spec = this.warpSpec(at.screen, at.lx, at.lz);
    if (!spec || (spec.area && !this.areas.has(spec.area))) return null;
    return this.resolveWarp(at.screen.area, spec);
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
  freeSpot(screen, x = screen.w / 2, z = screen.h / 2, r = 0.3, { body = null, occupied = () => false } = {}) {
    const clear = (lx, lz) =>
      !this.blocked(screen.x0 + lx, screen.z0 + lz, r, body) &&
      !occupied(screen.x0 + lx, screen.z0 + lz) &&
      !getTile(screen.tileset, screen.tiles[Math.floor(lz)]?.[Math.floor(lx)])?.onEnter &&
      !getTile(screen.tileset, screen.tiles[Math.floor(lz)]?.[Math.floor(lx)])?.hazard;
    if (x >= 0 && x < screen.w && z >= 0 && z < screen.h && clear(x, z)) return { x, z };
    let best = null;
    for (let tz = 0; tz < screen.h; tz++)
      for (let tx = 0; tx < screen.w; tx++) {
        const d = Math.hypot(tx + 0.5 - x, tz + 0.5 - z);
        if ((!best || d < best.d) && clear(tx + 0.5, tz + 0.5)) best = { x: tx + 0.5, z: tz + 0.5, d };
      }
    return best && { x: best.x, z: best.z };
  }

  // A tile named by place: 'area:i,j:x,z', its area, local screen and local
  // tile. Unlike the global tile it stays the same when an area is moved in
  // the global grid, so save data names tiles this way (see the tile-key
  // codec below). null outside every screen.
  placeKey(tx, tz) {
    const at = this.locate(tx, tz);
    return at ? `${at.screen.key}:${at.lx},${at.lz}` : null;
  }

  // The global tile [tx, tz] a place key names, or null if no screen has it now.
  placeTile(key) {
    const m = /^([\w-]+:-?\d+,-?\d+):(-?\d+),(-?\d+)$/.exec(key);
    const s = m && this.screens.get(m[1]);
    if (!s) return null;
    const [x, z] = [Number(m[2]), Number(m[3])];
    return x >= 0 && x < s.w && z >= 0 && z < s.h ? [s.x0 + x, s.z0 + z] : null;
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
    const routed = partyHooks.trigger({ screen: at.screen, tx, tz, hook, extra });
    if (routed !== null) return routed;
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
    partyHooks.tile({ tx, tz, to: ch, screen: screen.key, persist, rebuild, reason });
    emit('tile-changed', { tx, tz, from, to: ch, screen, reason });
    return true;
  }

  // Tiles marked `regrow` (bushes) come back each time a screen is entered.
  regrow(screen) {
    if (!partyHooks.regrow(screen)) return;
    const bodies = [player, ...entities, ...bucketOf(screen)].filter((e) => !e.removed && (e === player || e.solid || e.kind === 'enemy'));
    for (let z = 0; z < screen.h; z++)
      for (let x = 0; x < screen.w; x++) {
        const base = screen.base[z][x];
        const now = screen.tiles[z][x];
        if (now === base) continue;
        const b = getTile(screen.tileset, base);
        const n = getTile(screen.tileset, now);
        // cut bushes and broken pots come back (props: no re-mesh); a pushed statue goes back where
        // it stood and its new spot clears (terrain: re-mesh)
        if (b?.regrow || (n?.regrow && n.onPush)) {
          const tx = screen.x0 + x, tz = screen.z0 + z;
          const box = solidExtent(this.locate(tx, tz), tx, tz);
          // A wanderer or hero may now occupy the cleared pot. Restore it
          // on a later visit, rather than growing solid scenery through them.
          if (bodies.some((e) => isSolidDef(b, e) && e.x + e.r > box[0] && e.x - e.r < box[2] && e.z + e.r > box[1] && e.z - e.r < box[3])) continue;
          this.setTile(tx, tz, base, { rebuild: !b?.prop && !n?.prop, reason: 'regrow' });
        }
      }
  }

  // Re-mesh screens changed by setTile. Runs at the end of every update. A drawn screen's rebuild
  // is a job at the front of the queue: the old meshes stay until the new ones are all made, a
  // few frames later. In manual mode (play-tests) it happens at once, as a test expects.
  flush() {
    for (const screen of this.dirty) {
      if (!this.live.has(screen) && !this.previews.has(screen)) continue;
      if (isManual() || !screen.built) this.buildScreen(screen);
      else {
        this.cancel(screen);
        this.queue(screen, -2);
      }
    }
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
    for (const screen of this.live) {
      if (!screen.propsOn) continue;
      this.removeProps(screen);
      this.buildProps(screen);
      if (screen.built !== tilesKey(screen)) this.dirty.add(screen);
    }
    for (const screen of this.previews) if (screen.built !== tilesKey(screen)) this.dirty.add(screen);
    this.flush();
    emit('world:reset', {}); // everyone's people start over (systems/streaming.js)
  }

  // ---------------------------------------------------------------- building
  // Mesh a screen's tiles (terrain.js): terrain, fine floor, detail and
  // water meshes plus fixtures such as lamp lights, all in screen.meshes.
  buildScreen(screen) {
    this.cancel(screen);
    buildScreenTerrain(this, screen);
    this.finished(screen, null);
  }

  // A screen's props (bushes, doors, chests, flames): with its terrain, once that is built.
  buildProps(screen) {
    screen.propsOn = true;
    for (let z = 0; z < screen.h; z++)
      for (let x = 0; x < screen.w; x++) if (getTile(screen.tileset, screen.tiles[z][x]).prop) this.addProp(screen, x, z);
  }

  addProp(screen, x, z) {
    if (!screen.propsOn) return null; // built with the rest of the screen's props (buildProps)
    const ch = screen.tiles[z][x];
    const def = getTile(screen.tileset, ch);
    const tx = screen.x0 + x;
    const tz = screen.z0 + z;
    const obj = def.prop({ world: this, screen, area: screen.area, x, z, tx, tz, cx: tx + 0.5, cz: tz + 0.5, ch, def });
    if (!obj) return null;
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.noShadow) return;
      o.receiveShadow = true;
      // Flat decor (moss, cracks, rune circles, puddle decals: under 0.1 units of local geometry
      // height) casts no shadow anyone could see, so it skips the shadow-map draw entirely; geometry
      // is shared across placements of the same prop, so the bounding-box compute is amortised.
      const geo = o.geometry;
      const box = geo?.boundingBox ?? (geo?.computeBoundingBox(), geo?.boundingBox);
      const flat = box && box.max.y - box.min.y < 0.1;
      o.castShadow = !flat;
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
    for (const s of this.live) if (s.shown) for (const m of s.meshes) m.layer.tick?.(m.mesh, t, dt);
    for (const obj of this.ticking) obj.userData.tick(t, dt);
  }
}

export const world = new World();

// Save data names tiles by place (world.placeKey), so a save stays right
// when an area is moved in the global grid; in play they are global tiles
// ('tx,tz'; core/state.js). A tile on no screen keeps its global key, and a
// place no screen has today keeps its place key, so neither is lost.
setTileKeyCodec({
  save: (key) => {
    const [tx, tz] = key.split(',').map(Number);
    return world.placeKey(tx, tz);
  },
  load: (key) => {
    const t = world.placeTile(key);
    return t ? tileKey(t[0], t[1]) : null;
  },
});

// The screen the hero is on (or sliding into): its key is state.screenKey. While the entity
// manager updates the people and foes of another live screen (entities/manager.js), it is that
// screen instead: "my screen" to them (the bounds they keep to, the shots they fire).
let simScreen = null;
export const heroScreen = () => (state.screenKey ? world.screens.get(state.screenKey) ?? null : null);
export const currentScreen = () => simScreen ?? heroScreen();
export function withScreen(screen, fn) {
  const was = simScreen;
  simScreen = screen;
  try {
    return fn();
  } finally {
    simScreen = was;
  }
}

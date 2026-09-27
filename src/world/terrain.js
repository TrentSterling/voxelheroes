// Terrain building: a screen's tiles become voxel meshes (art bible sections 2, 8 and 9).
//
// Tile builders (def.build in world/tiles/) write voxels into three layers; each layer becomes one
// mesh per screen with a shared material kind (core/materials.js):
//   ctx.T  terrain  1/8 tile blocks      getMaterial('terrain')    ground, cliffs, trees, rocks, walls
//   ctx.F  fine     1/16 tile voxels     getMaterial('fine')       dungeon floors
//   ctx.D  detail   1/16 tile voxels     getMaterial('character')  small static things (flowers)
// plus flat water planes (ctx.water(), makeWaterMaterial) and fixtures (ctx.fixture(obj): lamp
// lights, glow strips), which the screen owns like its meshes. Layers added with registerLayer
// (a terrain-resolution grid with its own material) are written through ctx.voxelLayer(name).
//
// Coordinates are global, so a tile looks the same whichever screen builds it:
//   terrain block X = tx * 8 + i (i = 0..7, east), Z = tz * 8 + k (k = 0..7, south); Y = 0 is the
//   ground's top layer (its top face is GROUND_Y), Y < 0 lies below, Y > 0 above. ctx.X0, ctx.Z0 are
//   the tile's north-west block. Raised ground of level L has its top layer at Y = L * LEVEL.
//   fine and detail voxels: X = tx * 16 + i, Z = tz * 16 + k (ctx.FX0, ctx.FZ0); Y = 0 is the top
//   layer of a fine floor (top face at GROUND_Y), things standing on the ground start at Y = 1.
// Writers: set(X, Y, Z, c), box(X0, Y0, Z0, X1, Y1, Z1, c) (upper bounds exclusive; c is a colour,
// null to clear, or fn(X, Y, Z) returning a colour, null, or undefined to leave the voxel alone),
// clear(...), get / has / color(X, Y, Z).
//
// Each screen is built with a MARGIN of its neighbours' tiles around it and meshes only its own
// tiles, so faces and ambient occlusion match across screen edges. Builders must therefore be
// deterministic per tile: vary colours with hash3 on global coordinates, and use ctx.rand (seeded
// per tile) only for decisions made before drawing, never per voxel.
//
// Tile definition fields the kits read (all optional):
//   level        raised ground level (tiles of height; 0 = the ground)
//   ground       surface kind for transitions: 'grass', 'dirt', 'path', 'sand'
//   water        true for water tiles (banks and bridges look at it)
//   height       blocks the tile reaches above its level's top layer (sizes the grid; default 16)
//   detailHeight fine voxels the tile's detail reaches above the ground (default 0)
//
// Backdrops (registerBackdrop): tiles outside every screen of an area can be filled by a generator,
// so the camera sees the world continue (art bible section 8, "The far distance").
import * as THREE from 'three';
import { DenseGrid, meshVoxels, FACE_ALL, FACE_NZ } from '../core/vox.js';
import { rng } from '../core/voxel.js';
import { getMaterial, makeWaterMaterial } from '../core/materials.js';
import { SCREEN_W, SCREEN_H, GROUND_Y } from '../core/constants.js';
import { on } from '../core/events.js';
import { getTile } from './tiles.js';

export const BPT = 8; // terrain blocks per tile edge
export const BLOCK = 1 / BPT;
export const FPT = 16; // fine (character) voxels per tile edge
export const FINE = 1 / FPT;
export const LEVEL = 8; // blocks per raised ground level (one tile)
export const MARGIN = 1; // tiles of the neighbours built around each screen
export const WATER_DROP = 0.35; // water surface, in blocks below the ground's top
export const WATER_Y = GROUND_Y - WATER_DROP * BLOCK;

const TERRAIN_BELOW = 4; // blocks kept below the ground's top layer
const FINE_BELOW = 3;
const FINE_ABOVE = 3;

// ---------------------------------------------------------------- layers
// Built-in layers and any registered with registerLayer (old builders reach them through
// ctx.layer(name); a registered layer is a terrain-resolution grid with its own material).
export const LAYERS = {
  terrain: { res: BPT, kind: 'terrain', castShadow: true, receiveShadow: true },
  fine: { res: FPT, kind: 'fine', castShadow: false, receiveShadow: true },
  detail: { res: FPT, kind: 'character', castShadow: true, receiveShadow: true },
  water: { water: true, castShadow: false, receiveShadow: true },
};

export function registerLayer(name, def) {
  if (LAYERS[name]) throw new Error(`Layer "${name}" is already registered`);
  LAYERS[name] = { res: BPT, castShadow: true, receiveShadow: true, ...def };
}

const layerMaterial = (L) => L.material ?? getMaterial(L.kind ?? 'terrain');

let waterMat = null;
export const waterMaterial = () => (waterMat ??= makeWaterMaterial());

// ---------------------------------------------------------------- voxel writer
// A window of global voxel space [x0, x0 + sx) x [yMin, yMax) x [z0, z0 + sz) backed by a DenseGrid
// that is allocated on the first write. Writes outside the window are dropped; writes outside its
// height are counted in `lost` (the grid was sized too small).
export class VoxelLayer {
  constructor(res, x0, z0, sx, sz, yMin, yMax) {
    this.res = res;
    this.x0 = x0;
    this.z0 = z0;
    this.yMin = yMin;
    this.sx = sx;
    this.sy = yMax - yMin;
    this.sz = sz;
    this.grid = null;
    this.lost = 0;
  }

  get g() {
    return (this.grid ??= new DenseGrid(this.sx, this.sy, this.sz));
  }

  set(X, Y, Z, c) {
    const x = X - this.x0;
    const z = Z - this.z0;
    if (x < 0 || z < 0 || x >= this.sx || z >= this.sz) return this;
    const y = Y - this.yMin;
    if (y < 0 || y >= this.sy) {
      if (c != null) this.lost++;
      return this;
    }
    this.g.set(x, y, z, c);
    return this;
  }

  get(X, Y, Z) {
    return this.grid ? this.grid.get(X - this.x0, Y - this.yMin, Z - this.z0) : 0;
  }

  has(X, Y, Z) {
    return this.get(X, Y, Z) !== 0;
  }

  color(X, Y, Z) {
    return this.get(X, Y, Z) & 0xffffff;
  }

  // Every voxel of the box is visited (even outside the window) so colour functions see the same
  // sequence of calls whichever screen builds the tile.
  box(X0, Y0, Z0, X1, Y1, Z1, c) {
    const fn = typeof c === 'function';
    for (let Z = Z0; Z < Z1; Z++)
      for (let Y = Y0; Y < Y1; Y++)
        for (let X = X0; X < X1; X++) {
          const v = fn ? c(X, Y, Z) : c;
          if (v !== undefined) this.set(X, Y, Z, v);
        }
    return this;
  }

  clear(X0, Y0, Z0, X1, Y1, Z1) {
    return this.box(X0, Y0, Z0, X1, Y1, Z1, null);
  }

  // Filled ellipsoid around (cx, cy, cz) in voxel units; c as in box().
  ellipsoid(cx, cy, cz, rx, ry, rz, c) {
    const fn = typeof c === 'function';
    for (let Z = Math.floor(cz - rz); Z <= Math.ceil(cz + rz); Z++)
      for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++)
        for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
          const dx = (X + 0.5 - cx) / rx;
          const dy = (Y + 0.5 - cy) / ry;
          const dz = (Z + 0.5 - cz) / rz;
          if (dx * dx + dy * dy + dz * dz > 1) continue;
          const v = fn ? c(X, Y, Z) : c;
          if (v !== undefined) this.set(X, Y, Z, v);
        }
    return this;
  }

  // Copy a model grid (DenseGrid, see src/models/) into the layer with its voxel (0, 0, 0) at
  // (X, Y, Z). Empty voxels leave the layer alone.
  stamp(grid, X, Y, Z) {
    for (let z = 0; z < grid.sz; z++)
      for (let y = 0; y < grid.sy; y++)
        for (let x = 0; x < grid.sx; x++) {
          const v = grid.get(x, y, z);
          if (v) this.set(X + x, Y + y, Z + z, v & 0xffffff);
        }
    return this;
  }

  // Mesh the voxels inside [tx0, tx1) x [tz0, tz1) (tiles) with positions relative to tile
  // (ox, oz); the rest of the window only hides faces and darkens corners.
  mesh(tx0, tz0, tx1, tz1, ox, oz, opts = {}) {
    if (!this.grid) return null;
    const r = this.res;
    const region = [tx0 * r - this.x0, 0, tz0 * r - this.z0, tx1 * r - this.x0, this.sy, tz1 * r - this.z0];
    // y origin: block Y's bottom sits at Y / 8 (terrain); fine voxel Y's bottom at (Y + 1) / 16,
    // so both put the ground's top layer just under GROUND_Y.
    const lift = r === BPT ? 0 : GROUND_Y * r - 1;
    const geo = meshVoxels(this.grid, {
      region,
      origin: [ox * r - this.x0, -this.yMin - lift, oz * r - this.z0],
      scale: 1 / r,
      skipBottom: opts.skipBottom ?? -this.yMin + 1, // no bottom faces at or below the ground's top
      faces: opts.faces ?? FACE_ALL,
    });
    return geo.index.count ? geo : (geo.dispose(), null);
  }
}

// A writer with the old VoxelGrid interface (world/tiles code written for M1): coordinates in
// blocks from the screen's north-west corner, inclusive boxes, colour jitter from ctx.rand.
function legacyGrid(layer, baseX, baseZ, rand) {
  const hex = (c) => (typeof c === 'number' ? c : new THREE.Color(c).getHex());
  const jit = (c, j = 0.07) => {
    const k = 1 + (rand() * 2 - 1) * j;
    const h = hex(c);
    const ch = (s) => Math.max(0, Math.min(255, Math.round(((h >> s) & 255) * k)));
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const g = {
    set(x, y, z, c, j) {
      layer.set(baseX + x, y, baseZ + z, jit(c, j));
    },
    has: (x, y, z) => layer.has(baseX + x, y, baseZ + z),
    delete: (x, y, z) => layer.set(baseX + x, y, baseZ + z, null),
    box(x0, x1, y0, y1, z0, z1, c, j) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) g.set(x, y, z, c, j);
    },
    ellipsoid(cx, cy, cz, rx, ry, rz, colorFn, j) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
          for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
            const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
            if (d > 1) continue;
            const c = colorFn(x, y, z, d);
            if (c != null) g.set(x, y, z, c, j);
          }
    },
  };
  return g;
}

// ---------------------------------------------------------------- lookups
// A screen's footprint in global tiles (works with the 16 x 11 lattice and with per-area sizes).
export function screenBox(screen) {
  const w = screen.w ?? screen.tiles[0].length;
  const h = screen.h ?? screen.tiles.length;
  const x0 = screen.x0 ?? screen.sx * SCREEN_W;
  const z0 = screen.z0 ?? screen.sy * SCREEN_H;
  return { x0, z0, w, h, x1: x0 + w, z1: z0 + h };
}

const backdropTiles = new Map(); // 'tx,tz' -> { ch, def, backdrop: true }
const tkey = (tx, tz) => `${tx},${tz}`;

// The tile at global (tx, tz): { ch, def, screen } from a screen (the `prefer` screen first, so a
// screen taller than the lattice still finds its own rows), a backdrop tile ({ ch, def, screen:
// null }), or null outside the world.
export function cellAt(world, tx, tz, prefer = null) {
  if (prefer) {
    const b = prefer._box ?? (prefer._box = screenBox(prefer));
    if (tx >= b.x0 && tx < b.x1 && tz >= b.z0 && tz < b.z1) {
      const ch = prefer.tiles[tz - b.z0][tx - b.x0];
      return { ch, def: getTile(prefer.tileset, ch), screen: prefer };
    }
  }
  const at = world.locate(tx, tz);
  if (at) {
    const ch = at.screen.tiles[at.lz]?.[at.lx];
    if (ch !== undefined) return { ch, def: getTile(at.screen.tileset, ch), screen: at.screen };
  }
  return backdropTiles.get(tkey(tx, tz)) ?? null;
}

// Screens other than `screen` whose built margin shows global tile (tx, tz): changing that tile
// must re-mesh them too.
export function marginScreens(world, screen, tx, tz) {
  const out = new Set();
  for (let dz = -MARGIN; dz <= MARGIN; dz++)
    for (let dx = -MARGIN; dx <= MARGIN; dx++) {
      const at = world.locate(tx + dx, tz + dz);
      if (at && at.screen !== screen) out.add(at.screen);
    }
  return out;
}

// ---------------------------------------------------------------- building
// Counters for tests: rectangles built, voxels lost outside a grid's height (a sizing bug).
export const terrainStats = { rects: 0, lost: 0 };

const hashTile = (tx, tz) => (Math.imul(tx | 0, 73856093) ^ Math.imul(tz | 0, 19349663) ^ 0x5bd1e995) >>> 0;

// Build one rectangle of tiles (a screen or a backdrop chunk). Returns the meshes and fixtures.
// env: { x0, z0, w, h, screen, cells(tx, tz) -> cell | null for the rectangle's own tiles,
// ring(tx, tz) -> cell | null for the margin (rooms: drawn with the rectangle, meshed apart),
// margin: { n, s, w, e } tiles built around the rectangle (default MARGIN on every side) }.
function buildRect(world, env) {
  const { x0, z0, w, h } = env;
  const mg = env.margin ?? { n: MARGIN, s: MARGIN, w: MARGIN, e: MARGIN };
  // the window built, in tiles: the rectangle and its margin
  const wx0 = x0 - mg.w;
  const wz0 = z0 - mg.n;
  const wx1 = x0 + w + mg.e;
  const wz1 = z0 + h + mg.s;
  const cells = [];
  let top = 1;
  let detailTop = 0;
  const voids = [];
  for (let tz = wz0; tz < wz1; tz++)
    for (let tx = wx0; tx < wx1; tx++) {
      const inside = tx >= x0 && tx < x0 + w && tz >= z0 && tz < z0 + h;
      const cell = inside ? env.cells(tx, tz) : env.ring ? env.ring(tx, tz) : cellAt(world, tx, tz, env.screen);
      const own = inside || !!env.ring;
      if (!cell && !inside) voids.push([tx, tz]);
      if (!cell?.def?.build) continue;
      cells.push({ tx, tz, own, cell });
      const d = cell.def;
      top = Math.max(top, (d.level ?? 0) * LEVEL + (d.height ?? 16) + 1);
      detailTop = Math.max(detailTop, d.detailHeight ?? 0);
    }

  const wx = wx1 - wx0;
  const wz = wz1 - wz0;
  const T = new VoxelLayer(BPT, wx0 * BPT, wz0 * BPT, wx * BPT, wz * BPT, -TERRAIN_BELOW, top);
  const F = new VoxelLayer(FPT, wx0 * FPT, wz0 * FPT, wx * FPT, wz * FPT, -FINE_BELOW, FINE_ABOVE);
  const D = new VoxelLayer(FPT, wx0 * FPT, wz0 * FPT, wx * FPT, wz * FPT, -1, Math.max(4, detailTop + 2));
  const custom = new Map(); // legacy registered layers
  const water = [];
  const fixtures = [];

  const layerFor = (name) => {
    if (name === 'terrain') return T;
    if (name === 'fine') return F;
    if (name === 'detail') return D;
    let l = custom.get(name);
    if (!l) {
      if (!LAYERS[name]) throw new Error(`Unknown terrain layer "${name}"`);
      l = new VoxelLayer(BPT, T.x0, T.z0, T.sx, T.sz, -TERRAIN_BELOW, top);
      custom.set(name, l);
    }
    return l;
  };

  for (const { tx, tz, own, cell } of cells) {
    const { ch, def } = cell;
    const rand = rng(hashTile(tx, tz));
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const near = (dx, dz) => cellAt(world, tx + dx, tz + dz, cell.screen ?? env.screen);
    const bx = (tx - x0) * BPT;
    const bz = (tz - z0) * BPT;
    let legacy = null;
    const ctx = {
      world,
      screen: env.screen, // the screen being built (null for a backdrop chunk)
      owner: cell.screen, // the screen the tile belongs to (null for backdrop tiles)
      area: cell.screen?.area ?? null,
      own, // false while the tile is only built as another screen's margin
      x: tx - x0,
      z: tz - z0,
      tx,
      tz,
      X0: tx * BPT,
      Z0: tz * BPT,
      FX0: tx * FPT,
      FZ0: tz * FPT,
      ch,
      def,
      cell, // what the lookup returned (ring cells carry their own fields)
      level: def.level ?? 0,
      T,
      F,
      D,
      rand,
      pick,
      cellAt: near,
      tileAt: (dx, dz) => near(dx, dz)?.ch ?? null,
      defAt: (dx, dz) => near(dx, dz)?.def ?? null,
      // A water surface on this tile, `drop` blocks below the ground's top (or at world y).
      water: ({ drop = WATER_DROP, y = null } = {}) => {
        if (own) water.push([tx, tz, y ?? GROUND_Y - drop * BLOCK]);
      },
      // An Object3D in world coordinates owned by the screen (lamp lights, glow strips).
      fixture: (obj) => {
        if (own) fixtures.push(obj);
        return obj;
      },
      // A registered layer (registerLayer) as a writer in global block coordinates, like ctx.T.
      voxelLayer: (name) => layerFor(name),
      // M1 interface: ctx.g / ctx.layer(name) take blocks from the screen's corner.
      get g() {
        return (legacy ??= legacyGrid(T, x0 * BPT, z0 * BPT, rand));
      },
      bx,
      bz,
      layer: (name) => (name === 'terrain' ? ctx.g : legacyLayer(name)),
    };
    let wet = false;
    const legacyLayer = (name) => {
      if (name === 'water') {
        // old water layers: any voxel written makes the tile a water plane
        const mark = () => {
          if (!wet) ctx.water();
          wet = true;
        };
        return { set: mark, box: mark, ellipsoid: mark, has: () => false, delete() {} };
      }
      return legacyGrid(layerFor(name), x0 * BPT, z0 * BPT, rand);
    };
    def.build(ctx);
  }

  // Backdrops: nothing is ever seen from beyond the edge of the world, so the void around a chunk
  // counts as solid and the faces toward it are not built.
  if (env.solidVoid) for (const [tx, tz] of voids) T.box(tx * BPT, T.yMin, tz * BPT, (tx + 1) * BPT, T.yMin + T.sy, (tz + 1) * BPT, 1);

  const lost = T.lost + F.lost + D.lost;
  if (lost) {
    terrainStats.lost += lost;
    if (import.meta.env.DEV) console.warn(`terrain: ${lost} voxels fell outside the grid height around tiles ${x0},${z0}`);
  }
  terrainStats.rects++;

  const meshes = [];
  const add = (name, geo, L) => {
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, layerMaterial(L));
    mesh.name = name;
    mesh.position.set(x0, 0, z0);
    mesh.castShadow = !!L.castShadow;
    mesh.receiveShadow = !!L.receiveShadow;
    meshes.push({ name, mesh, layer: L });
  };
  const faces = env.faces ?? FACE_ALL;
  // the rectangle's own tiles
  const [mx0, mz0, mx1, mz1] = [x0, z0, x0 + w, z0 + h];
  const terrainGeo = env.coarse ? coarseMesh(T, x0, z0, w, h, faces) : T.mesh(mx0, mz0, mx1, mz1, x0, z0, { faces });
  add('terrain', terrainGeo, { ...LAYERS.terrain, ...(env.terrainLayer ?? {}) });
  add('fine', F.mesh(mx0, mz0, mx1, mz1, x0, z0, { faces }), LAYERS.fine);
  add('detail', D.mesh(mx0, mz0, mx1, mz1, x0, z0, { faces }), LAYERS.detail);
  for (const [name, l] of custom) add(name, l.mesh(mx0, mz0, mx1, mz1, x0, z0), LAYERS[name]);
  // the ring around a room: the rest of the window, meshed in strips into a group of its own
  if (env.ring) {
    const group = ringGroup();
    const strips = [
      [wx0, wz0, wx1, z0], // north
      [wx0, z0 + h, wx1, wz1], // south
      [wx0, z0, x0, z0 + h], // west
      [x0 + w, z0, wx1, z0 + h], // east
    ];
    for (const [sx0, sz0, sx1, sz1] of strips) {
      if (sx1 <= sx0 || sz1 <= sz0) continue;
      for (const [name, V] of [['terrain', T], ['fine', F], ['detail', D]]) {
        const geo = V.mesh(sx0, sz0, sx1, sz1, x0, z0, { faces });
        if (!geo) continue;
        const L = LAYERS[name];
        const mesh = new THREE.Mesh(geo, layerMaterial(L));
        mesh.name = `ring ${name}`;
        mesh.castShadow = !!L.castShadow;
        mesh.receiveShadow = !!L.receiveShadow;
        mesh.visible = ringsShown;
        group.add(mesh);
      }
    }
    if (group.children.length) {
      group.position.set(x0, 0, z0);
      meshes.push({ name: 'ring', mesh: group, layer: { ring: true } });
    }
  }
  if (water.length) {
    const mesh = new THREE.Mesh(waterGeometry(water, x0, z0), waterMaterial());
    mesh.name = 'water';
    mesh.position.set(x0, 0, z0);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    meshes.push({ name: 'water', mesh, layer: LAYERS.water });
  }
  for (const obj of fixtures) meshes.push({ name: obj.name || 'fixture', mesh: obj, layer: {} });
  return meshes;
}

// Mesh a terrain layer at half resolution (blocks of 1/4 tile) for the far backdrop, where depth
// of field blurs the lattice anyway: a coarse block is solid when at least half of its eight blocks
// are, and takes the colour of its highest block. Coarse layer k holds blocks Y = 2k - 1 and 2k, so
// ground and plateau tops stay at their heights.
function coarseMesh(T, x0, z0, w, h, faces) {
  if (!T.grid) return null;
  const g = T.grid;
  const kMin = Math.ceil((T.yMin + 1) / 2);
  const kMax = Math.floor((T.yMin + T.sy - 1) / 2) + 1; // exclusive
  const cx = g.sx >> 1;
  const cz = g.sz >> 1;
  const cy = kMax - kMin;
  const c = new DenseGrid(cx, cy, cz);
  for (let z = 0; z < cz; z++)
    for (let k = 0; k < cy; k++)
      for (let x = 0; x < cx; x++) {
        let n = 0;
        let col = 0;
        const Y1 = 2 * (k + kMin) - T.yMin; // upper block's index
        for (const y of [Y1, Y1 - 1])
          for (let dz = 0; dz < 2; dz++)
            for (let dx = 0; dx < 2; dx++) {
              const v = g.get(2 * x + dx, y, 2 * z + dz);
              if (!v) continue;
              n++;
              if (!col) col = v & 0xffffff;
            }
        if (n >= 4) c.set(x, k, z, col);
      }
  const M = MARGIN * (BPT >> 1);
  const geo = meshVoxels(c, {
    region: [M, 0, M, M + w * (BPT >> 1), cy, M + h * (BPT >> 1)],
    origin: [M, -kMin + 0.5, M],
    scale: 2 * BLOCK,
    skipBottom: -kMin + 1,
    faces,
  });
  return geo.index.count ? geo : (geo.dispose(), null);
}

// Flat quads, one per water tile, relative to tile (ox, oz).
export function waterGeometry(tiles, ox = 0, oz = 0) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let o = 0;
  for (const [tx, tz, y] of tiles) {
    const x = tx - ox;
    const z = tz - oz;
    pos.push(x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1);
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    o += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// Remove meshes from the scene and free their geometry (materials are shared and stay).
function disposeMeshes(scene, list) {
  for (const m of list) {
    scene.remove(m.mesh);
    ringGroups.delete(m.mesh);
    m.mesh.traverse?.((o) => {
      if (o.isMesh && !o.userData.sharedGeometry) o.geometry?.dispose();
    });
  }
}

// (Re)build a screen's terrain meshes. They go into world.scene and screen.meshes as
// { name, mesh, layer } (fixtures included), which is what shows and hides a screen.
export function buildScreenTerrain(world, screen) {
  disposeMeshes(world.scene, screen.meshes ?? []);
  const b = (screen._box = screenBox(screen));
  const ring = screen.area?.rooms ? rings.get(screen.tileset) : null;
  const meshes = buildRect(world, {
    x0: b.x0,
    z0: b.z0,
    w: b.w,
    h: b.h,
    screen,
    cells: (tx, tz) => {
      const ch = screen.tiles[tz - b.z0][tx - b.x0];
      return { ch, def: getTile(screen.tileset, ch), screen };
    },
    ring: ring ? (tx, tz) => ring.fn(screen, tx, tz) : null,
    margin: ring ? ring.margin : null,
  });
  for (const m of meshes) world.scene.add(m.mesh);
  screen.meshes = meshes;
  screen.built = screen.tiles.map((r) => r.join('')).join('\n');
  return meshes;
}

// ---------------------------------------------------------------- rooms
// Room areas (area.rooms, art bible section 9) are drawn one room at a time with black all around.
// A room is built with a ring around it that holds what its tileset's ring function returns instead
// of the neighbouring rooms' tiles (corridors and floors running out of its doorways; null for
// black). The ring reaches `north`, `south`, `west` and `east` tiles out (default MARGIN).
//   registerRing(tileset, (room, tx, tz) -> { ch, def, screen: null, ... } | null, { north, ... })
// The ring is meshed apart from the room, into a group that is the screen mesh named 'ring'
// ({ name: 'ring', mesh: group, layer: { ring: true } }). It overlaps the neighbouring rooms, which
// are drawn too while the view slides from room to room, so every ring is hidden from the moment
// a screen is left ('screen-leave') until the next one is entered ('screen-enter'); the group's own
// `visible` stays with whoever shows and hides the room.
const rings = new Map();

export function registerRing(tileset, fn, { north = MARGIN, south = MARGIN, west = MARGIN, east = MARGIN } = {}) {
  rings.set(tileset, { fn, margin: { n: north, s: south, w: west, e: east } });
}

const ringGroups = new Set();
let ringsShown = true;

function ringGroup() {
  const group = new THREE.Group();
  group.name = 'ring';
  ringGroups.add(group);
  return group;
}

function showRings(on) {
  ringsShown = on;
  for (const g of ringGroups) for (const m of g.children) m.visible = on;
}

on('screen-leave', () => showRings(false));
on('screen-enter', () => showRings(true));

// ---------------------------------------------------------------- backdrops
// registerBackdrop(tileset, { charAt(tx, tz, info) -> char, north, south, side, spread })
// fills the tiles around every area of that tileset. info: { area, rect, d (tiles outside the
// area's rectangle), dn / ds / dw / de (tiles north / south / west / east of it), edge (the nearest
// screen cell) }, always for the nearest area of the tileset, so areas that touch share one band.
// The band reaches `north` tiles north and `south` south; sideways it reaches `side` tiles plus
// `spread` tiles for every tile further from the camera, which is how a view looking north widens.
const backdrops = new Map();

export function registerBackdrop(tileset, def) {
  backdrops.set(tileset, { north: 24, south: 3, side: 3, sideMax: 20, spread: 0.72, eye: 9, ...def });
}

export const backdropTile = (tx, tz) => backdropTiles.get(tkey(tx, tz)) ?? null;

const CHUNK = 8;
const QUARTER = CHUNK / 2;

// Fill and mesh the backdrop around every area whose tileset has one. Meshes go into world.scene
// and world.backdrop ({ name, mesh, layer } like screen meshes). Call after the screens are built.
export function buildBackdrops(world) {
  for (const m of world.backdrop ?? []) {
    world.scene.remove(m.mesh);
    m.mesh.geometry?.dispose();
  }
  world.backdrop = [];
  backdropTiles.clear();
  // One rectangle per area whose tileset has a backdrop.
  const byArea = new Map();
  for (const s of world.screens.values()) {
    if (!backdrops.has(s.tileset)) continue;
    const b = screenBox(s);
    let r = byArea.get(s.area);
    if (!r) byArea.set(s.area, (r = { area: s.area, tileset: s.tileset, x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 }));
    r.x0 = Math.min(r.x0, b.x0);
    r.z0 = Math.min(r.z0, b.z0);
    r.x1 = Math.max(r.x1, b.x1);
    r.z1 = Math.max(r.z1, b.z1);
  }
  const rects = [...byArea.values()];
  // Tiles from a rectangle along each axis, and the squared distance to break ties.
  const offset = (r, tx, tz) => {
    const dx = Math.max(r.x0 - tx, 0, tx - r.x1 + 1);
    const dz = Math.max(r.z0 - tz, 0, tz - r.z1 + 1);
    return { d: Math.max(dx, dz), e: dx * dx + dz * dz };
  };
  // Every tile some area's band reaches is filled by the band of the nearest area of that tileset,
  // so the bands of areas that touch (joined areas) meet seamlessly and each continues its own
  // area's edge.
  const seen = new Set();
  const chunks = new Map();
  for (const rect of rects) {
    const B = backdrops.get(rect.tileset);
    for (let tz = rect.z0 - B.north; tz < rect.z1 + B.south; tz++) {
      const far = rect.z1 + B.eye - tz; // tiles from a camera behind the area's south row
      const side = Math.min(B.sideMax, Math.ceil(B.side + Math.max(0, B.spread * far - 8)));
      for (let tx = rect.x0 - side; tx < rect.x1 + side; tx++) {
        const k = tkey(tx, tz);
        if (seen.has(k)) continue;
        seen.add(k);
        if (world.locate(tx, tz)) continue;
        let R = rect;
        let best = offset(rect, tx, tz);
        for (const r of rects) {
          if (r === rect || r.tileset !== rect.tileset) continue;
          const o = offset(r, tx, tz);
          if (o.d < best.d || (o.d === best.d && o.e < best.e)) [R, best] = [r, o];
        }
        const cx = Math.min(Math.max(tx, R.x0), R.x1 - 1);
        const cz = Math.min(Math.max(tz, R.z0), R.z1 - 1);
        const edge = cellAt(world, cx, cz);
        const dn = Math.max(0, R.z0 - tz);
        const ds = Math.max(0, tz - R.z1 + 1);
        const dw = Math.max(0, R.x0 - tx);
        const de = Math.max(0, tx - R.x1 + 1);
        const ch = B.charAt(tx, tz, { area: R.area, rect: R, dn, ds, dw, de, d: Math.max(dn, ds, dw, de), edge });
        if (ch == null) continue;
        const def = getTile(R.tileset, ch);
        if (!def) throw new Error(`Backdrop of "${R.tileset}" made unknown tile "${ch}"`);
        backdropTiles.set(k, { ch, def, screen: null, backdrop: true });
        const ck = tkey(Math.floor(tx / CHUNK), Math.floor(tz / CHUNK));
        if (!chunks.has(ck)) chunks.set(ck, { cx: Math.floor(tx / CHUNK), cz: Math.floor(tz / CHUNK) });
      }
    }
  }
  // Tiles between a square piece [x0, x0 + n) x [z0, z0 + n) and the nearest play area (0: touching).
  const gapOf = (x0, z0, n) => {
    let gap = Infinity;
    for (const r of rects) gap = Math.min(gap, Math.max(r.x0 - (x0 + n), x0 - r.x1, r.z0 - (z0 + n), z0 - r.z1, 0));
    return gap;
  };
  for (const { cx, cz } of chunks.values()) {
    const X0 = cx * CHUNK;
    const Z0 = cz * CHUNK;
    const Q = QUARTER;
    // A chunk touching a play area is meshed in quarters, and only the quarters touching one are at
    // full resolution (the first one to four tiles out). Every other piece is meshed at half
    // resolution, without north faces and without casting shadows (onto the play area or anything).
    const parts =
      gapOf(X0, Z0, CHUNK) > 0
        ? [[X0, Z0, CHUNK]]
        : [[X0, Z0, Q], [X0 + Q, Z0, Q], [X0, Z0 + Q, Q], [X0 + Q, Z0 + Q, Q]];
    for (const [x0, z0, n] of parts) {
      const far = gapOf(x0, z0, n) > 0;
      const meshes = buildRect(world, {
        x0,
        z0,
        w: n,
        h: n,
        screen: null,
        cells: (tx, tz) => backdropTiles.get(tkey(tx, tz)) ?? null,
        solidVoid: true,
        coarse: far,
        faces: far ? FACE_ALL & ~FACE_NZ : FACE_ALL,
        terrainLayer: far ? { castShadow: false } : null,
      });
      for (const m of meshes) {
        m.mesh.name = `backdrop ${x0},${z0} ${m.name}`;
        world.scene.add(m.mesh);
        world.backdrop.push(m);
      }
    }
  }
  return world.backdrop;
}

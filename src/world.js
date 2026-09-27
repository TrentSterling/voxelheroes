import * as THREE from 'three';
import { VoxelGrid, buildGeometry, voxelMaterial, rng } from './core/voxel.js';
import { SCREENS, SCREEN_W, SCREEN_H } from './maps.js';

// Terrain resolution: 8 voxels per tile edge.
export const R = 8;
export const TV = 1 / R;
export const GROUND_Y = TV; // top of the grass layer

const SOLID = new Set(['T', 'R', '#', '~', 'B', 'W', 'S', 'F', 'L', 'C']);

const C = {
  grassA: 0x62b84a,
  grassB: 0x57ab42,
  grassDark: 0x3f8a33,
  dirt: 0x7a5230,
  path: 0xd6b377,
  sand: 0xe9d59c,
  bed: 0x9c8757,
  water: 0x3a8fd8,
  trunk: 0x6e4a2a,
  leaf: 0x2f8f3a,
  leafLight: 0x49ad45,
  leafDark: 0x236e2c,
  rock: 0x8d9299,
  rockLight: 0xadb2b8,
  moss: 0x6a9a4a,
  cliffA: 0x8a7a68,
  cliffB: 0x76685a,
  flowers: [0xfaf6e8, 0xf6d23a, 0xf07aa8, 0x8fb6ff],
  bush: 0x3c9440,
  bushLight: 0x57b152,
  berry: 0xd8334a,
  // crypt
  under: 0x2a2633,
  floorA: 0x6f6b7d,
  floorB: 0x656176,
  grout: 0x4f4b5c,
  brickA: 0x756d8c,
  brickB: 0x686180,
  mortar: 0x4a4560,
  wallTop: 0x5a5474,
  pillar: 0x8c879c,
  pillarLight: 0xa7a2b8,
  stair: 0xb9b3c8,
  darkBed: 0x2c3548,
  darkWater: 0x2b5f9e,
  wood: 0x7a4a26,
  woodDark: 0x5e371b,
  iron: 0x3a3a44,
  gold: 0xf1c232,
  void: 0x120e0c,
};

const flameMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

const waterMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.78,
});

export class World {
  constructor(scene) {
    this.scene = scene;
    this.screens = new Map();
    this.bushGeo = makeBushGeometry();
    this.doorGeo = makeDoorGeometry();
    this.flameGeo = makeFlameGeometry();
    this.chestGeo = makeChestGeometry();
    this.waterMeshes = [];
    this.flames = [];
    this.flags = new Set(); // opened doors and chests, keys taken

    for (const [key, def] of Object.entries(SCREENS)) {
      const [sx, sy] = key.split(',').map(Number);
      const tiles = def.rows.map((r) => r.split(''));
      const spawns = [];
      let keySpot = null;
      tiles.forEach((row, z) =>
        row.forEach((ch, x) => {
          if (ch === 'e' || ch === 'o') {
            spawns.push({ type: ch === 'e' ? 'slime' : 'spitter', x, z });
            row[x] = '.';
          } else if (ch === 'K') {
            keySpot = { x, z };
            row[x] = '.';
          }
        })
      );
      const screen = { sx, sy, name: def.name, dark: !!def.dark, tiles, spawns, keySpot, props: new Map() };
      this.screens.set(key, screen);
    }
    for (const screen of this.screens.values()) this.buildScreen(screen);
  }

  screen(sx, sy) {
    return this.screens.get(`${sx},${sy}`) || null;
  }

  // Global tile lookup; null when outside every screen.
  tile(tx, tz) {
    const sx = Math.floor(tx / SCREEN_W);
    const sy = Math.floor(tz / SCREEN_H);
    const s = this.screen(sx, sy);
    if (!s) return null;
    return s.tiles[tz - sy * SCREEN_H][tx - sx * SCREEN_W];
  }

  isSolid(tx, tz) {
    const t = this.tile(tx, tz);
    return t === null || SOLID.has(t);
  }

  // Does a circle at (x, z) with radius r overlap a solid tile?
  blocked(x, z, r) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++)
      for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++)
        if (this.isSolid(tx, tz)) return true;
    return false;
  }

  locate(tx, tz) {
    const sx = Math.floor(tx / SCREEN_W);
    const sy = Math.floor(tz / SCREEN_H);
    const s = this.screen(sx, sy);
    return s ? { s, lx: tx - sx * SCREEN_W, lz: tz - sy * SCREEN_H } : null;
  }

  // Turn a tile into floor and drop whatever prop stood on it.
  clearTile(tx, tz, expect) {
    const at = this.locate(tx, tz);
    if (!at || at.s.tiles[at.lz][at.lx] !== expect) return false;
    at.s.tiles[at.lz][at.lx] = '.';
    const k = `${at.lx},${at.lz}`;
    const prop = at.s.props.get(k);
    if (prop) {
      this.scene.remove(prop);
      at.s.props.delete(k);
    }
    return true;
  }

  cutBush(tx, tz) {
    return this.clearTile(tx, tz, 'B');
  }

  // Opens a locked door and its twin tile next to it.
  openDoor(tx, tz) {
    if (!this.clearTile(tx, tz, 'L')) return false;
    this.flags.add(`door:${tx},${tz}`);
    for (const dx of [-1, 1])
      if (this.clearTile(tx + dx, tz, 'L')) this.flags.add(`door:${tx + dx},${tz}`);
    return true;
  }

  openChest(tx, tz) {
    const at = this.locate(tx, tz);
    if (!at || at.s.tiles[at.lz][at.lx] !== 'C' || this.flags.has(`chest:${tx},${tz}`)) return false;
    this.flags.add(`chest:${tx},${tz}`);
    const chest = at.s.props.get(`${at.lx},${at.lz}`);
    if (chest) chest.userData.opening = true;
    return true;
  }

  // Bushes grow back each time a screen is entered, like the originals.
  regrowBushes(screen) {
    const def = SCREENS[`${screen.sx},${screen.sy}`];
    def.rows.forEach((row, z) =>
      row.split('').forEach((ch, x) => {
        if (ch === 'B' && screen.tiles[z][x] !== 'B') {
          screen.tiles[z][x] = 'B';
          this.addProp(screen, x, z, 'bush');
        }
      })
    );
  }

  addProp(screen, x, z, type) {
    const cx = screen.sx * SCREEN_W + x + 0.5;
    const cz = screen.sy * SCREEN_H + z + 0.5;
    let obj;
    if (type === 'bush') {
      obj = new THREE.Mesh(this.bushGeo, voxelMaterial);
      obj.rotation.y = ((x * 7 + z * 3) % 4) * (Math.PI / 2);
      obj.position.set(cx, GROUND_Y, cz);
    } else if (type === 'door') {
      obj = new THREE.Mesh(this.doorGeo, voxelMaterial);
      obj.position.set(cx, GROUND_Y, cz);
    } else if (type === 'flame') {
      obj = new THREE.Mesh(this.flameGeo, flameMaterial);
      obj.position.set(cx, GROUND_Y + 5 * TV, cz);
      obj.userData.phase = x * 1.7 + z * 2.3;
      this.flames.push(obj);
    } else if (type === 'chest') {
      obj = new THREE.Group();
      const base = new THREE.Mesh(this.chestGeo.base, voxelMaterial);
      const lid = new THREE.Mesh(this.chestGeo.lid, voxelMaterial);
      lid.position.set(0, 5 * TV, -2.5 * TV);
      base.castShadow = lid.castShadow = true;
      obj.add(base, lid);
      obj.userData.lid = lid;
      obj.position.set(cx, GROUND_Y, cz);
    }
    obj.castShadow = true;
    obj.receiveShadow = true;
    this.scene.add(obj);
    screen.props.set(`${x},${z}`, obj);
  }

  buildScreen(screen) {
    const rand = rng(screen.sx * 131 + screen.sy * 977 + 7);
    const g = new VoxelGrid(rand);
    const water = new VoxelGrid(rand);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    for (let z = 0; z < SCREEN_H; z++) {
      for (let x = 0; x < SCREEN_W; x++) {
        const ch = screen.tiles[z][x];
        const bx = x * R;
        const bz = z * R;
        const grass = (x + z) % 2 ? C.grassA : C.grassB;
        const top = ch === 'p' ? C.path : ch === 's' ? C.sand : grass;
        if (screen.dark) {
          this.buildCryptTile(screen, g, water, x, z, ch, rand);
          continue;
        }

        if (ch === '~') {
          g.box(bx, bx + R - 1, -2, -2, bz, bz + R - 1, C.bed, 0.1);
          water.box(bx, bx + R - 1, -1, -1, bz, bz + R - 1, C.water, 0.05);
          continue;
        }

        g.box(bx, bx + R - 1, -2, -1, bz, bz + R - 1, C.dirt, 0.08);
        g.box(bx, bx + R - 1, 0, 0, bz, bz + R - 1, top, ch === 'p' || ch === 's' ? 0.08 : 0.06);

        if (ch === '.' && rand() < 0.35) {
          // a few tufts of grass
          for (let i = 0; i < 3; i++) {
            const gx = bx + Math.floor(rand() * R);
            const gz = bz + Math.floor(rand() * R);
            g.set(gx, 1, gz, C.grassDark);
          }
        } else if (ch === ',') {
          for (let i = 0; i < 5; i++) {
            const fx = bx + 1 + Math.floor(rand() * (R - 2));
            const fz = bz + 1 + Math.floor(rand() * (R - 2));
            g.set(fx, 1, fz, C.grassDark);
            g.set(fx, 2, fz, pick(C.flowers), 0.03);
          }
        } else if (ch === 'T') {
          const cx = bx + 3.5;
          const cz = bz + 3.5;
          g.box(bx + 3, bx + 4, 1, 5, bz + 3, bz + 4, C.trunk);
          const ry = 3 + rand() * 0.8;
          const rr = 4.3 + rand() * 0.6;
          g.ellipsoid(cx, 7.5, cz, rr, ry, rr, (vx, vy, vz) => {
            if (vy > 8 && vx - cx + vz - cz < 0) return C.leafLight;
            if (vy < 6) return C.leafDark;
            return rand() < 0.1 ? C.leafLight : C.leaf;
          });
        } else if (ch === 'R') {
          const cx = bx + 3.5;
          const cz = bz + 3.5;
          g.ellipsoid(cx, 1, cz, 3.8, 4.2, 3.6, (vx, vy) => {
            if (vy < 1) return null;
            if (vy >= 4 && rand() < 0.35) return C.moss;
            return vy >= 3 ? C.rockLight : C.rock;
          }, 0.1);
        } else if (ch === '#') {
          for (let y = 1; y <= 8; y++)
            g.box(bx, bx + R - 1, y, y, bz, bz + R - 1, Math.floor(y / 2) % 2 ? C.cliffA : C.cliffB, 0.09);
          g.box(bx, bx + R - 1, 9, 9, bz, bz + R - 1, grass);
        } else if (ch === 'B') {
          this.addProp(screen, x, z, 'bush');
        } else if (ch === 'D') {
          // Cliff with a dark doorway carved into its south face.
          for (let vx = 0; vx < R; vx++)
            for (let vz = 0; vz < R; vz++)
              for (let y = 1; y <= 9; y++) {
                const edge = (x > 0 && screen.tiles[z][x - 1] !== 'D' && vx === 0) || (screen.tiles[z][x + 1] !== 'D' && vx === R - 1);
                const carved = !edge && y <= 6 && vz >= 1;
                if (carved) continue;
                const c = y === 9 ? grass : y === 7 && vz === R - 1 ? C.stair : Math.floor(y / 2) % 2 ? C.cliffA : C.cliffB;
                g.set(bx + vx, y, bz + vz, c, 0.09);
              }
          g.box(bx, bx + R - 1, 0, 0, bz, bz + R - 1, C.void, 0.1);
        }
      }
    }

    const ox = screen.sx * SCREEN_W;
    const oz = screen.sy * SCREEN_H;
    const mesh = new THREE.Mesh(buildGeometry(g, TV), voxelMaterial);
    mesh.position.set(ox, 0, oz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (water.map.size) {
      const wm = new THREE.Mesh(buildGeometry(water, TV), waterMaterial);
      wm.position.set(ox, 0, oz);
      wm.receiveShadow = true;
      this.scene.add(wm);
      this.waterMeshes.push(wm);
    }
  }

  buildCryptTile(screen, g, water, x, z, ch, rand) {
    const bx = x * R;
    const bz = z * R;
    if (ch === '~') {
      g.box(bx, bx + R - 1, -2, -2, bz, bz + R - 1, C.darkBed, 0.1);
      water.box(bx, bx + R - 1, -1, -1, bz, bz + R - 1, C.darkWater, 0.06);
      return;
    }
    g.box(bx, bx + R - 1, -2, -1, bz, bz + R - 1, C.under, 0.08);
    if (ch === 'W') {
      // Walls along the bottom edge stay low so they never hide the hero.
      const h = z === SCREEN_H - 1 ? 3 : 10;
      for (let vx = 0; vx < R; vx++)
        for (let vz = 0; vz < R; vz++)
          for (let y = 0; y <= h; y++) {
            const course = Math.floor(y / 3);
            const brick = Math.floor((vx + bx + vz + bz + (course % 2) * 2) / 4) % 2;
            const c = y === h ? C.wallTop : y % 3 === 0 ? C.mortar : brick ? C.brickA : C.brickB;
            g.set(bx + vx, y, bz + vz, c, 0.08);
          }
      return;
    }
    // stone floor with grout lines between tiles
    for (let vx = 0; vx < R; vx++)
      for (let vz = 0; vz < R; vz++) {
        const grout = vx === 0 || vz === 0;
        g.set(bx + vx, 0, bz + vz, grout ? C.grout : (x + z) % 2 ? C.floorA : C.floorB, grout ? 0.05 : 0.07);
      }
    if (ch === 'S') {
      g.box(bx + 2, bx + 5, 1, 8, bz + 2, bz + 5, C.pillar, 0.08);
      g.box(bx + 1, bx + 6, 9, 9, bz + 1, bz + 6, C.pillarLight, 0.06);
      g.box(bx + 1, bx + 6, 1, 1, bz + 1, bz + 6, C.pillarLight, 0.06);
    } else if (ch === 'F') {
      g.box(bx + 2, bx + 5, 1, 3, bz + 2, bz + 5, C.pillar, 0.08);
      g.box(bx + 1, bx + 6, 4, 4, bz + 1, bz + 6, C.iron, 0.08);
      this.addProp(screen, x, z, 'flame');
    } else if (ch === 'X') {
      g.box(bx + 1, bx + 6, 1, 1, bz + 1, bz + 6, C.stair, 0.05);
      g.box(bx + 1, bx + 6, 2, 2, bz + 1, bz + 4, C.stair, 0.05);
      g.box(bx + 1, bx + 6, 3, 3, bz + 1, bz + 2, C.pillarLight, 0.05);
    } else if (ch === 'L') {
      this.addProp(screen, x, z, 'door');
    } else if (ch === 'C') {
      this.addProp(screen, x, z, 'chest');
    } else if (rand() < 0.08) {
      g.set(bx + 1 + Math.floor(rand() * 6), 0, bz + 1 + Math.floor(rand() * 6), C.grout, 0.05);
    }
  }

  update(t, dt) {
    for (const wm of this.waterMeshes) wm.position.y = Math.sin(t * 1.6) * 0.025 - 0.01;
    for (const f of this.flames) {
      const p = f.userData.phase;
      f.scale.set(1 + Math.sin(t * 13 + p) * 0.08, 1 + Math.sin(t * 9 + p * 2) * 0.2 + Math.sin(t * 23 + p) * 0.08, 1);
      f.rotation.y = Math.sin(t * 3 + p) * 0.3;
    }
    for (const s of this.screens.values())
      for (const prop of s.props.values()) {
        if (!prop.userData.opening) continue;
        const lid = prop.userData.lid;
        lid.rotation.x = Math.max(-1.9, lid.rotation.x - dt * 6);
      }
  }
}

function makeDoorGeometry() {
  const g = new VoxelGrid(rng(43));
  for (let x = 0; x < R; x++)
    for (let y = 1; y <= 10; y++) {
      const band = y === 3 || y === 8;
      g.box(x, x, y, y, 3, 4, band ? C.iron : x % 2 ? C.wood : C.woodDark, 0.08);
    }
  g.box(3, 4, 5, 6, 5, 5, C.gold, 0.04);
  g.set(3, 5, 5, C.void, 0);
  g.set(4, 5, 5, C.void, 0);
  return buildGeometry(g, TV, [-4, 0, -4]);
}

function makeFlameGeometry() {
  const g = new VoxelGrid(rng(44));
  g.box(-1, 1, 0, 0, -1, 1, 0xff5a1f, 0.1);
  g.box(-1, 1, 1, 1, -1, 1, 0xff8a1f, 0.1);
  g.box(-1, 0, 2, 2, -1, 0, 0xffb12e, 0.08);
  g.set(0, 2, 1, 0xffb12e, 0.08);
  g.set(0, 3, 0, 0xffe27a, 0.05);
  g.set(0, 4, 0, 0xfff4c4, 0.03);
  return buildGeometry(g, TV, [-0.5, 0, -0.5]);
}

function makeChestGeometry() {
  const base = new VoxelGrid(rng(45));
  for (let x = -3; x <= 3; x++)
    for (let y = 1; y <= 4; y++)
      for (let z = -2; z <= 2; z++) {
        const trim = Math.abs(x) === 3 || y === 4;
        base.set(x, y, z, trim ? C.gold : C.wood, 0.06);
      }
  base.set(0, 3, 3, C.gold, 0);
  const lid = new VoxelGrid(rng(46));
  for (let x = -3; x <= 3; x++)
    for (let y = 0; y <= 1; y++)
      for (let z = 0; z <= 4; z++) {
        const trim = Math.abs(x) === 3 || z === 4 || x === 0;
        lid.set(x, y, z, trim ? C.gold : C.woodDark, 0.06);
      }
  return {
    base: buildGeometry(base, TV, [-0.5, 0, -0.5]),
    lid: buildGeometry(lid, TV, [-0.5, 0, 0]),
  };
}

function makeBushGeometry() {
  const g = new VoxelGrid(rng(42));
  g.ellipsoid(0, 2.5, 0, 3.6, 3.2, 3.6, (x, y, z) => {
    if (y < 0) return null;
    if ((x * 3 + y * 5 + z * 7) % 11 === 0 && y > 1) return C.berry;
    return y > 3 ? C.bushLight : C.bush;
  });
  return buildGeometry(g, TV, [-0.5, 0, -0.5]);
}

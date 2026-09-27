# Voxel Heroes architecture

This is the map of the code after the M1 foundation work, and the rulebook
for adding to it. The short version:

- **Content registers itself.** Tiles, areas, entities, items, HUD widgets and
  UI screens each live in their own file inside an auto-loaded folder
  (`src/content.js`). Adding one means adding a file. Nothing else imports it.
- **Features talk through registries and events**, not through each other's
  modules. A bomb emits `'explosion'`; a cracked wall's `onBomb` hook reacts.
  Neither knows the other exists.
- **Tuning is data.** Sword stats, drop tables, camera presets, lighting
  presets and key bindings are plain objects with small registration helpers.
- **The simulation is deterministic.** Gameplay randomness is seeded, time
  comes from `dt`, and tests step the game by hand through
  `window.__voxelHeroes`.

Contents: [Module map](#module-map) ·
[Frame, modes and coordinates](#frame-modes-and-coordinates) ·
[Registries](#registries) · [Events](#events) · [How to add things](#how-to-add-things) ·
[Kits and models](#kits-and-models) · [Test hook](#test-hook) · [Play-test harness](#play-test-harness) ·
[Working in parallel (M2)](#working-in-parallel-m2) · [Build rules](#build-rules) ·
[Known quirks](#known-quirks-kept-from-the-prototype)

## Module map

```
index.html              HUD, overlay panel, touch controls (markup only)
src/
  main.js               bootstrap: mount, build the world, start the loop (small, rarely edited)
  content.js            eager import.meta.glob of every content folder below
  style.css             base page, HUD, overlay and touch styles
  core/                 engine pieces with no game content
    constants.js        SCREEN_W 16, SCREEN_H 11, R 8 (terrain voxels per tile), TV, GROUND_Y, DEG
    renderer.js         WebGL renderer, scene, lights; LIGHTING presets + registerLighting
    camera.js           CAMERA_PRESETS (pitch/fov/pad/zoom) + registerCameraPreset, slide tween
    input.js            actions (sword, item, menu, confirm, ...): held / pressed / released, touch
    loop.js             requestAnimationFrame loop; setManual() for tests
    events.js           on / once / off / emit bus
    state.js            the state object, defineState / registerSaveField, serialize / load
    modes.js            mode stack: registerMode, setMode, pushMode, popMode
    save.js             localStorage slots (writeSlot, readSlot, listSlots), all in try/catch
    audio.js            WebAudio voices; sfx table + registerSfx
    voxel.js            seeded rng, VoxelGrid, face-culled mesher, shared voxel material
    random.js           random() gameplay RNG (seeded), fxRandom() for effects
    math.js             lerpAngle, clamp, dist2d, yawDir
  world/
    tiles.js            TILE REGISTRY: defineTileset, registerTile, getTile
    tiles/overworld.js  overworld kit (1/8 tile blocks): ground, trees, rocks, cliffs, caves, water, bridge, fence, props
    tiles/dungeon.js    dungeon kit: walls by room position, fine floors, lamps, doors, room pieces, the room ring
    tiles/farband.js    the far distance: a backdrop of forest and plateaus around overworld areas
    terrain.js          terrain builder: layers (terrain 1/8, fine and detail 1/16), margins, room rings, backdrops
    tilekit.js          shared tile behaviour: bush/door/chest/flame props, cutPlant, unlockDoor, openChest
    palette.js          terrain colours
    areas.js            AREA REGISTRY: registerArea, getArea, START
    areas/overworld.js  the six overworld screens
    areas/crypt.js      the four crypt rooms
    world.js            builds every screen, collision, props, tile hooks, setTile, terrain LAYERS
    grid.js             screen/tile coordinate helpers
  entities/
    registry.js         ENTITY REGISTRY: registerEntity, createEntity
    manager.js          live entity list: spawn, removeEntity, updateEntities, entitiesNear
    entity.js           Entity base class (the contract every entity follows)
    enemy.js            Enemy base: pop-in, knockback, stun, flash, contact damage, death burst, loot
    pickup.js           Pickup base: bounce, spin, blink, collect
    player.js           the hero (one instance, `player`)
    enemies/            slime.js, spitter.js
    projectiles/        rock-shot.js
    pickups/            heart.js, gem.js (gem, gem5), key.js
  models/               voxel models at 1/16 tile: hero.js (+ sword), characters.js, pickups.js, props.js, icons.js
    kit.js, palette.js  model cache, PoseMesh, contact shadows; the character palette (see Kits and models)
  systems/
    sword.js            SWORD stats (data), swing, blade pose, blade hit tests; setSwordStats
    combat.js           hurtPlayer, shield, enemiesLeft, room-cleared
    drops.js            DROP_TABLES + addDrop / registerDropTable / rollDrop
    grants.js           GRANT REGISTRY: grant('heart-container'), registerGrant
    keys.js             small keys per dungeon (keyGroup)
    interact.js         A talks before it swings (onInteract on entities and tiles)
    physics.js          moveBody: circle vs solid tiles, screen bounds
    particles.js        voxel bursts (instanced cubes)
    spawner.js          map markers -> entities on screen entry
    transitions.js      edge slide, warps, entering a screen; chooseCameraPreset
    flow.js             'play' mode, start / pause / respawn, new game, load, save slots, teleport
  items/
    registry.js         ITEM REGISTRY for B-button sub-items (empty in M1)
    inventory.js        owned items, ammo, selection, useSelectedItem; saved state
  ui/
    dom.js, banner.js, overlay.js   helpers, the big screen-name banner, the centred panel + fade
    hud.js              HUD WIDGET REGISTRY + hearts, area name, gems, keys
    hud/item-slot.js    B item slot (hidden while the inventory is empty)
    dialog.js           showDialog(lines, opts) -> Promise, 'dialog' mode
    screens/            title.js, pause.js ('paused'), gameover.js ('dead')
  debug/testhook.js     window.__voxelHeroes
scripts/
  build-artifact.mjs    dist/ -> one self-contained HTML page
  playtest.mjs          play-test library + CLI
  lib/bot.js            in-page bot: walkTo, exit, fight, waitFor
  scenarios/            default.mjs (the M1 play-through), screens.mjs (screenshot gallery)
```

Dependency direction: `core` imports nothing from the game. `world`, `entities`,
`systems`, `items` and `ui` import `core` and each other's registries or small
APIs. Content files (a tile, an enemy, an item) import what they need, and
only `content.js` imports them, except for helpers a content file exports on
purpose (the kit helpers in `tiles/overworld.js` and `tiles/dungeon.js`,
see [Kits and models](#kits-and-models)).

## Frame, modes and coordinates

**One frame** (`main.js`): `state.time += dt`, `world.update` (water, flames),
the mute key, `updateMode(dt)`, particles, `world.flush()` (re-mesh changed
screens), camera placement, `input.endFrame()`. Rendering then refreshes the
HUD widgets and draws the scene. The loop clamps `dt` to 1/30 s. In manual mode
the loop keeps rendering but only tests advance the simulation.

**Modes** (`core/modes.js`) decide what a frame does. `state.mode` is the top
of a stack.

| Mode | Registered in | What it does |
|------|---------------|--------------|
| `title` | ui/screens/title.js | hero idles behind the title panel; confirm starts |
| `play` | systems/flow.js | Start pauses; hero, items and entities update |
| `scroll` | systems/transitions.js | the 0.85 s slide to the next screen |
| `warp` | systems/transitions.js | fade out, move, fade in (doors, stairs) |
| `paused` | ui/screens/pause.js | pushed over play; Start or the button resumes |
| `dialog` | ui/dialog.js | pushed while a dialog box is open |
| `dead` | ui/screens/gameover.js | hero tips over; then the game-over panel |

`setMode(name)` replaces the whole stack, `pushMode(name)` suspends the current
mode, `popMode()` resumes it. Every switch calls `exit` on the old mode and
`enter` on the new one, clears latched button presses (so one press never acts
twice) and emits `'mode-change'`.

**Input** (`core/input.js`) is read as actions, never raw keys:

| Action | Keys | Touch |
|--------|------|-------|
| `up` `down` `left` `right` / `input.move()` | arrows, WASD | stick |
| `sword` (A) | Space, J, Z | A button |
| `item` (B) | K, X | B button (shown once an item is owned) |
| `menu` (Start) | Enter, Escape, P | Menu button |
| `next-item` / `prev-item` | E / Q | |
| `confirm` / `cancel` | Enter, Space / Escape, Backspace | tap the dialog |
| `mute` | M | |

`input.held(a)`, `input.pressed(a)` and `input.released(a)` (latched until the
end of the tick) are enough for charge attacks. `input.bind(action, codes)`
adds or rebinds an action from a feature's own file.

**Coordinates.** One world unit is one tile. x grows east, z grows south, y is
up. A screen is 16 x 11 tiles. All screens of all areas sit on one global grid
of screens; global tile (tx, tz) belongs to screen (floor(tx / 16),
floor(tz / 11)). An area's `origin` places its local screen `'0,0'`. Map rows are
local. `yaw` 0 faces +z (towards the camera); use `Math.atan2(dx, dz)`. Health
is counted in half-hearts (`START_HP` 6 = three hearts). Terrain voxels are
1/8 of a tile, character voxels 1/14.

**Randomness and time.** Gameplay code uses `random()` from
`core/random.js` (seeded; `?seed=N` or the hook's `seed(n)`), visual-only code
uses `fxRandom()`, terrain uses the per-screen `ctx.rand`. Never
`Math.random()` or wall-clock time in gameplay: it breaks play-test
determinism.

## Registries

Registries throw on a duplicate id, so two branches that pick the same name
find out at startup. (Lighting presets, camera presets and drop tables are
plain tables: registering an existing name replaces it on purpose.)

### Tiles: `src/world/tiles.js`

Map characters mean different things in different tilesets. A tileset can
inherit from another: `defineTileset('town', { parent: 'overworld', floor: '.' })`
(`floor` is the tile put under spawn markers).

```js
registerTile(tileset, char, {
  name: 'push-block',            // readable id
  solid: true,                   // boolean or (body) => boolean; default false
  blocksShots: true,             // default: same as solid (water sets false)
  build(ctx) {},                 // voxels baked into the screen mesh
  prop(ctx) { return object3d },  // separate object on the tile (ctx.cx, ctx.cz = centre)
  regrow: false,                 // restored every time its screen is entered (bushes)
  becomes: '.',                  // what it turns into when destroyed or opened
  onEnter(ctx) {}, onLeave(ctx) {},  // hero's centre moves onto / off the tile
  onPush(ctx) {},                // hero walks into it (every frame; ctx.player, ctx.dt)
  onSword(ctx) {},               // a blade sample lands on it (ctx.hit, ctx.player, ctx.px, ctx.pz)
  onBomb(ctx) {},                // an 'explosion' event covers it (ctx.explosion)
  onLight(ctx) {},               // a 'light' event covers it (ctx.light)
  onInteract(ctx) {},            // A pressed facing it; return true to use up the press
});
```

`build(ctx)` gets `{ g, layer(name), rand, pick, x, z, bx, bz, tx, tz, ch, def,
screen, area, world, tileAt(dx, dz) }`: `g` is the screen's terrain
`VoxelGrid` (8 voxels per tile, this tile's corner at `bx, bz`; y 0 is the
ground layer), `layer('water')` another mesh layer (`registerLayer` in
`world.js` adds more), `x, z` local and `tx, tz` global tile coordinates. Draw
only from `ctx.rand` so screens look the same on every load; the world replays
each tile's random stream when a screen is re-meshed, so changing one tile
never recolours its neighbours.

The kits build with a richer `ctx` (`ctx.T`, `ctx.F`, `ctx.D` in global voxel
coordinates, `ctx.water()`, `ctx.fixture()`, neighbour lookups) and read more
tile fields (`level`, `ground`, `water`, `height`, `detailHeight`, `doorway`):
see [Kits and models](#kits-and-models).

Hooks get `{ world, screen, area, tx, tz, x, z, ch, def, ...extra }`. To change
a tile at run time use `world.setTile(tx, tz, ch, opts)`:
`{ rebuild: false }` when only the prop changes (a cut bush), the default
re-meshes the screen at the end of the frame, `{ persist: true }` records it in
`state.tileEdits` so it survives save/load (an opened door, a blown wall). It
emits `'tile-changed'`. `world.trigger(tx, tz, hookName, extra)` calls a hook
directly. Chest contents come from the screen definition
(`chest: 'heart-container'` or `chests: { 'x,z': contents }`); `openChest` in
`tilekit.js` grants them.

### Areas: `src/world/areas.js`

```js
registerArea({
  id: 'crypt', name: 'Cairn Crypt',
  tileset: 'dungeon',            // tile registry set for the rows
  lighting: 'crypt',             // LIGHTING preset (renderer.js)
  camera: 'dungeon',             // CAMERA_PRESETS entry; omit to use the player's choice
  origin: [0, 10],               // global screen of local '0,0' (areas must not overlap)
  start: [0, 1],                 // local screen used by teleport('crypt')
  keyGroup: 'crypt',             // small keys count per group (default: id)
  spawns: { e: { type: 'slime', variant: 'blue' }, K: { type: 'key', once: true } },
  warps: { X: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 } },
  onScreenEnter(screen) {},      // optional
  screens: {
    '0,1': { name: 'Sunken Gate', rows: [/* 11 strings of 16 chars */] },
  },
});
```

`spawns` maps a marker character to an entity type (a string, or an object
whose extra fields go to the entity factory; `tile` sets the tile left under
it, `once: true` means it never returns after `markDone()`). Markers spawn
each time the screen is entered, staggered for enemies. A marker naming an
entity type that is not registered is skipped with a console warning, so a
map can name a type another branch provides. `warps` maps a tile character to
a destination; tiles with `onEnter: enterWarp` use it. Screens can override
`lighting`, `camera`, `tileset`, `spawns`, `warps`, and add `onEnter(screen)`.
The world validates every tile character and warp at startup.

### Entities: `src/entities/registry.js`

`registerEntity('bat', (opts) => new Bat(opts))`. `opts` holds `x, z` (world
position), `spawnIndex`, `spawnFlag`, `screen` and the spawn table's extra
fields. The `Entity` contract (`entities/entity.js`): `x, z, r, yaw, kind`
(`'enemy' | 'projectile' | 'pickup' | 'npc' | ...`), `priority` (update order:
enemies 0, projectiles 10, pickups 20, others 30), `object` (added to and
removed from the scene for you), `screenScoped` (removed when the screen is
left, default true), `swordable` + `canBeHit(hit)` + `onSword(hit)`,
`hurt(hit)`, optional `onInteract(player)` and `interactRange`, `update(dt)`,
`remove()`, `markDone()`.

`Enemy` (`entities/enemy.js`) takes stats `{ hp, r, speed, colors, geometry,
contactDamage, drops }` and calls `think(dt, { toP, dist, bounds })` when not
stunned. `countsForClear = false` leaves an enemy out of room-cleared checks.
`Pickup` (`entities/pickup.js`) takes a geometry and calls `collect()`.
`spawn(type, opts)`, `entitiesNear(x, z, radius, filter)`, `entitiesOfKind(kind)`
come from `entities/manager.js`; removal is deferred, so removing anything at
any time is safe.

### Items: `src/items/registry.js`

```js
registerItem({
  id: 'bombs', name: 'Bombs', icon: '<svg ...>', order: 20,
  ammo: 'bombs', maxAmmo: 10, startAmmo: 5,
  use(ctx) {},        // B pressed; return true if it was used
  update(dt, ctx) {}, // optional, every play frame while owned
  passive: false,     // true: owned but never on B
});
```

`ctx` is `{ item, player, state, world, spawn, ammo(), useAmmo(n) }`. The
inventory (`items/inventory.js`, saved as `state.inventory`) owns the rest:
`giveItem`, `hasItem`, `addAmmo`, `useAmmo`, `selectItem`, `cycleItem` (E/Q),
`selectableItems`. `grant(id)` works for every item id and ammo counter. The
HUD B slot and touch B button appear once a selectable item is owned. The item
is used on B unless the sword is mid-swing.

### Modes: `src/core/modes.js`

`registerMode(name, { enter({ from, resumed }), update(dt), exit({ to, suspended }) })`.
UI screens are modes in `src/ui/screens/`.

### HUD widgets: `src/ui/hud.js`

```js
registerHudWidget({
  id: 'bombs',
  mount({ hud, right }) {},        // create elements in #hud / #hud-right
  key: (state) => String(...),     // redraw only when this string changes
  render(state) {},
});
```

Widgets are redrawn from state every rendered frame when their key changes, so
game code never calls "update HUD".

### Grants: `src/systems/grants.js`

`registerGrant(id, (amount, ctx) => {...})`; `grant(id, amount)` or
`grant({ grant: 'gems', amount: 20 })`. Chests, shops, NPCs and the test hook's
`give()` all go through it. Built in: `gems`, `gem`, `heart`, `key`,
`heart-container`, plus every item and ammo id. Unknown ids warn and return
false.

### Drop tables: `src/systems/drops.js`

`DROP_TABLES.enemy` / `.bush` are lists of `{ chance, type, when }` tried
against one roll (`type` may be a function; a failed `when` passes its share
on). `addDrop('enemy', { chance: 0.1, type: 'arrows', when: () => hasItem('bow') })`,
`registerDropTable(name, entries)`, `rollDrop(table, x, z)`. Enemies name their
table with the `drops` stat.

### Save fields: `src/core/state.js`

```js
defineState('bombBag', () => 1);                              // saved, reset on new game
defineState('seen', () => new Set(), { toJSON: (s) => [...s], fromJSON: (a) => new Set(a) });
defineState('bossPhase', () => 0, { persist: false });        // runtime only
registerSaveField('pos', { save, load, reset });              // data kept outside `state`
```

`serializeState()` returns `{ version, fields }` (plain JSON). `loadState(data)`
restores every registered field and resets fields the data lacks, so older
saves keep loading when fields are added. Core fields: `hp`, `maxHp`, `gems`,
`keys` (per key group), `flags` (a Set of strings), `tileEdits`,
`inventory`, `respawn` (an inn sets it), `pos`. `state.settings` (camera
choice) is a preference, not part of a save. Slots: `saveToSlot(n)`,
`loadFromSlot(n)`, `activeSlot()` in `systems/flow.js` on top of
`core/save.js` (`writeSlot`, `readSlot`, `listSlots`, `deleteSlot`).

Flag names in use: `taken:tx,tz` (once-spawns), `door:tx,tz`,
`chest:tx,tz`. Prefix new ones by feature (`boss:crypt`, `talked:smith`).

### Presets and small tables

| What | Where | Add from your own file |
|------|-------|------------------------|
| Lighting | `core/renderer.js` `LIGHTING` | `registerLighting('cave', { background, sky, ground, hemi, sunColor, sun })` |
| Camera | `core/camera.js` `CAMERA_PRESETS` (A default, B, C, D, dungeon) | `registerCameraPreset('boss', { pitch, fov, padX, padZ, zoom, distance })`; player choice: `chooseCameraPreset(name)` |
| Terrain layers | `world/world.js` `LAYERS` | `registerLayer('lava', { material, castShadow, receiveShadow, tick })` |
| Sounds | `core/audio.js` `sfx` | `registerSfx('bomb', () => noise(0.5, { freq: 300 }))` |
| Key bindings | `core/input.js` `BINDINGS` | `input.bind('map', ['KeyG'])` |
| Sword stats | `systems/sword.js` `SWORD` | `setSwordStats(() => stats)` |

## Events

`core/events.js`: `const off = on(name, fn)`, `once`, `off`, `emit(name, payload)`.
Handlers run synchronously in subscription order.

| Event | Payload | Emitted by |
|-------|---------|------------|
| `screen-enter` | `{ screen }` | transitions.js, after the screen's spawns appear |
| `screen-leave` | `{ screen }` | transitions.js, before its entities are cleared |
| `warp` | `{ dest }` | a warp starts |
| `mode-change` | `{ from, to }` | modes.js |
| `sword-swing` | `{ player, stats }` | sword.js |
| `sword-hit` | `{ target, hit }` | sword.js, when the blade connects (the target's `onSword` returned true) |
| `enemy-killed` | `{ entity, hit }` | Enemy.die |
| `room-cleared` | `{ screen }` | the last enemy that counts dies |
| `player-hurt` | `{ amount, hp, fromX, fromZ }` | combat.js |
| `player-died` | `{}` | combat.js |
| `pickup` | `{ entity, type }` | Pickup, when collected |
| `tile-changed` | `{ tx, tz, from, to, screen, reason }` | world.setTile |
| `door-opened` | `{ tx, tz }` | tilekit unlockDoor |
| `chest-opened` | `{ tx, tz, contents }` | tilekit openChest |
| `item-gained` / `item-selected` / `item-used` | `{ id }` | items/inventory.js |
| `explosion` | `{ x, z, radius, source }` | reserved for bombs: calls `onBomb` on covered tiles |
| `light` | `{ x, z, radius, source }` | reserved for the lantern / fire: calls `onLight` |

Emit `explosion` and `light` in world coordinates; the world turns them into
tile hooks. Hurting entities caught in a blast is the bomb's job
(`entitiesNear`).

## How to add things

### (a) A tile

A bombable cracked wall for dungeons, in a new file
`src/world/tiles/cracked-wall.js` (loaded automatically):

```js
import { GROUND_Y } from '../../core/constants.js';
import { hash3 } from '../../core/vox.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../systems/particles.js';
import { registerTile } from '../tiles.js';
import { wallColor } from './dungeon.js';

const CRACK = 0x2a2230;

registerTile('dungeon', '%', {
  name: 'cracked-wall',
  solid: true,
  height: 16, // blocks above the ground (sizes the terrain grid)
  becomes: '.',
  build(ctx) {
    // a block of wall on the floor (terrain blocks of 1/8 tile; this tile's north-west block is
    // X0, Z0 and block Y = 1 stands on the floor), the wall pattern with dark cracks in it
    const { T, X0, Z0 } = ctx;
    T.box(X0, 1, Z0, X0 + 8, 17, Z0 + 8, (X, Y, Z) =>
      hash3(X, Y, Z, 5) < 0.12 ? CRACK : wallColor(X, Y - 1, Z0 + 7 - Z));
  },
  onBomb(ctx) {
    ctx.world.setTile(ctx.tx, ctx.tz, ctx.def.becomes, { persist: true, reason: 'bombed' });
    burst(ctx.tx + 0.5, GROUND_Y + 0.5, ctx.tz + 0.5, [0xd09a50, CRACK], 30);
    sfx.door();
  },
});
```

Then use `%` in a dungeon map. Pick characters that are free in the tileset
(`listTilesets()` or the hook's `registries.tilesets()` shows them).

### (b) An enemy

The bat's two wing frames are already in `models/characters.js` (a new model
is a function returning a `DenseGrid`, cached with `model(key, make)`; see
[Kits and models](#kits-and-models)). The behaviour goes in
`src/entities/enemies/bat.js`:

```js
// src/entities/enemies/bat.js
import { state } from '../../core/state.js';
import { random } from '../../core/random.js';
import { CHARACTER_MODELS } from '../../models/characters.js';
import { moveBody } from '../../systems/physics.js';
import { Enemy } from '../enemy.js';
import { registerEntity } from '../registry.js';

class Bat extends Enemy {
  constructor(opts) {
    super(opts, { hp: 1, r: 0.3, speed: 3, poses: { up: CHARACTER_MODELS.bat0(), down: CHARACTER_MODELS.bat1() } });
  }
  think(dt, { toP, dist, bounds }) {
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.4 + random() * 0.6;
      const a = dist < 4 ? Math.atan2(toP.x, toP.z) + (random() - 0.5) : random() * Math.PI * 2;
      this.dx = Math.sin(a);
      this.dz = Math.cos(a);
    }
    moveBody(this, this.dx * this.speed * dt, this.dz * this.speed * dt, bounds);
    this.yaw = Math.atan2(this.dx, this.dz);
    this.mesh.setPose(Math.floor(state.time * 8) % 2 ? 'down' : 'up'); // flap: frames swapped like cels
  }
}

registerEntity('bat', (opts) => new Bat(opts));
```

Place it with a spawn marker (`spawns: { b: 'bat' }` in an area, then `b` in
the rows), or try it at once with `__voxelHeroes.spawn('bat', 8, 5)`.
Projectiles are entities too (`kind: 'projectile'`, see `rock-shot.js`).
Bosses are enemies with more state; use `countsForClear`, events and
`defineState(..., { persist: false })` for phases.

### (c) An item

`src/items/bombs.js`, plus a `bomb` entity that emits the explosion:

```js
import { registerItem } from './registry.js';

registerItem({
  id: 'bombs',
  name: 'Bombs',
  icon: '<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="2" y="2" width="4" height="4" fill="#223"/></svg>',
  order: 20,
  ammo: 'bombs',
  maxAmmo: 10,
  startAmmo: 5,
  use(ctx) {
    if (!ctx.useAmmo(1)) return false;
    ctx.spawn('bomb', { x: ctx.player.x + Math.sin(ctx.player.yaw) * 0.6, z: ctx.player.z + Math.cos(ctx.player.yaw) * 0.6 });
    return true;
  },
});
```

```js
// in the bomb entity's update, when the fuse runs out:
emit('explosion', { x: this.x, z: this.z, radius: 1.5, source: this });
for (const e of entitiesNear(this.x, this.z, 1.5, (e) => e.kind === 'enemy')) e.hurt({ damage: 2, fromX: this.x, fromZ: this.z, source: 'bomb' });
this.remove();
```

Give it with a chest (`chest: 'bombs'`), a shop, or `__voxelHeroes.give('bombs')`.
More ammo: `grant('bombs', 5)` or an ammo pickup plus `addDrop(...)`.

### (d) An area

`src/world/areas/<id>.js` with `registerArea({...})` (see
[Areas](#areas-srcworldareasjs)), an `origin` from the
[origin table](#screen-origins), and a way in: a warp tile in another area
(`warps: { D: { area: 'your-id', screen: [0, 0], x: 8, z: 9, yaw: Math.PI } }`),
or a screen that borders another area's screen on the global grid (walking off
the edge slides into it). New tiles go in `src/world/tiles/`. If the area needs
its own tileset, `defineTileset('cave', { parent: 'dungeon' })`. For lighting
or a fixed camera, register presets and name them in the area. Check it with
`node scripts/playtest.mjs --scenario screens`, which photographs every screen.

### (e) A UI screen

A screen is a mode plus DOM. `src/ui/screens/map.js`:

```js
import './map.css';
import { input } from '../../core/input.js';
import { registerMode, popMode } from '../../core/modes.js';
import { el } from '../dom.js';

let panel = null;

registerMode('map', {
  enter() {
    panel ??= document.getElementById('app').appendChild(el('div', { class: 'map-panel' }));
    panel.hidden = false;
    // draw the rooms from world.screens and state.flags
  },
  update() {
    if (input.pressed('menu') || input.pressed('cancel')) popMode();
  },
  exit() {
    panel.hidden = true;
  },
});
```

Open it with `pushMode('map')` (from a key: `input.bind('map', ['KeyG'])` and
a check in the mode that should open it). Put its CSS in a file next to it and
import it; do not grow `style.css`. The pause screen is the `'paused'` mode in
`ui/screens/pause.js` (play pushes it on Start), the title is `'title'`, game
over is `'dead'`: replacing those files is how the UI feature reworks them.
Use `showDialog(lines, { speaker, choices })` for talk and yes/no questions;
it returns a promise.

### (f) Save fields

Call `defineState` in the file that owns the data, at module level:

```js
// src/systems/sword-levels.js
import { state, defineState } from '../core/state.js';
defineState('sword', () => ({ id: 'starter', length: 1, width: 1 }));
// read and write state.sword anywhere; it is saved, loaded and reset for you
```

Test it with `__voxelHeroes.save()` / `load(data)` or
`saveToSlot(n)` / `loadFromSlot(n)`. Do not rename existing keys; add new
ones. Bump `SAVE_VERSION` only for a change `loadState` cannot absorb.

## Kits and models

The content look of the art bible (sections 2 and 7 to 11): terrain at 1/8
tile per block; characters, props, pickups and dungeon floors at 1/16 tile per
voxel. Every mesh is a `DenseGrid` meshed by `meshVoxels` (`core/vox.js`) and
drawn with the material kinds of `core/materials.js` (see Look). Content makes
no materials of its own beyond the contract: `getMaterial('terrain' |
'character' | 'fine')`, `makeCharacterMaterial()` (an enemy's own hit flash),
`makeGlowMaterial(color, intensity)` (flames, lamp strips, sparks, and black for
the unlit south wall; pass `0xffffff` and set `vertexColors` for models that
carry their own colours) and `makeWaterMaterial()`.

| What | Where |
|------|-------|
| Terrain builder: layers, margins, rings, backdrops | `world/terrain.js` |
| Overworld kit (section 8) | `world/tiles/overworld.js`; colours `TP`, `GROUND`, `PROP` in `world/palette.js` |
| The far distance around overworld areas | `world/tiles/farband.js` |
| Dungeon kit (section 9), the golden temple | `world/tiles/dungeon.js`; colours `GOLD` in `world/palette.js` |
| Props on tiles and their behaviours | `world/tilekit.js`; models in `models/props.js` |
| Model kit: cache, poses, contact shadows | `models/kit.js`; character palette `CP` in `models/palette.js` |
| Hero and sword (section 10) | `models/hero.js`; animation in `entities/player.js` |
| Enemies and NPCs | `models/characters.js` |
| Pickups and HUD icons | `models/pickups.js`, `models/icons.js` |
| Effects (section 11) | `systems/particles.js` |
| Kit test areas | `world/areas/kitroom.js` (`?kitroom=1`) |

### Terrain: `world/terrain.js`

`world.js` builds each screen with `buildScreenTerrain(world, screen)` and,
once every screen exists, the far distance with `buildBackdrops(world)`. A
tile's `build(ctx)` writes voxels into three layers, each meshed once per
screen:

| Layer | Resolution | Material | For |
|-------|------------|----------|-----|
| `ctx.T` terrain | blocks of 1/8 tile | `terrain` | ground, cliffs, trees, rocks, walls |
| `ctx.F` fine | voxels of 1/16 tile | `fine` | dungeon floors |
| `ctx.D` detail | voxels of 1/16 tile | `character` | small static models: flowers, signs, graves, statues, braziers |

plus `ctx.water({ drop, y })`, a flat water plane on the tile (by default
0.35 block below the ground's top, `WATER_Y`), and `ctx.fixture(object3d)`,
an object in world coordinates (lamp lights, glow strips) that the screen owns
like its meshes. Everything ends up in `screen.meshes` as
`{ name, mesh, layer }`, which is what shows, hides and disposes a screen.

Coordinates are global, so a tile looks the same whichever screen builds it.
Terrain block `X = tx * 8 + i`, `Z = tz * 8 + k` (`ctx.X0`, `ctx.Z0`: the
tile's north-west block); `Y = 0` is the ground's top layer (top face at
`GROUND_Y`) and raised ground of level L has its top layer at `Y = L * 8`.
Fine and detail voxels: `X = tx * 16 + i` (`ctx.FX0`, `ctx.FZ0`); `Y = 0` is a
fine floor's top layer and things standing on the ground start at `Y = 1`.
Writers: `set(X, Y, Z, c)`, `box(X0, Y0, Z0, X1, Y1, Z1, c)` (upper bounds
exclusive; `c` a colour, `null` to clear, or `fn(X, Y, Z)` returning either),
`ellipsoid`, `clear`, `stamp(grid, X, Y, Z)` (a model grid into the layer),
`get` / `has` / `color`.

The rest of `ctx`: `x, z` (local) and `tx, tz` (global) tile coordinates,
`ch`, `def`, `level`, `rand` / `pick` (seeded per tile), `cellAt(dx, dz)`,
`tileAt(dx, dz)` and `defAt(dx, dz)` (neighbours, across screen edges and into
the backdrop), `screen` (the screen being built; null for a backdrop chunk),
`owner` (the screen the tile belongs to), `own` (false while the tile is only
built as another screen's margin), `world`, `area`, and
`voxelLayer(name)`: a layer added with `registerLayer(name, { material,
castShadow, receiveShadow })` (terrain resolution, its own material), written
like `ctx.T`. M1 builders still work: `ctx.g` and `ctx.layer(name)` write
terrain blocks counted from the screen's corner (`ctx.bx`, `ctx.bz`).

Rules:

- **Seamless edges.** A screen is built with a one-tile margin of its
  neighbours' tiles and meshes only its own, so faces and ambient occlusion
  match across screen edges; `setTile` re-meshes every screen whose margin
  shows the tile (`marginScreens`). So builders must be deterministic per
  tile: vary colours with `hash3` on global coordinates, and use `ctx.rand`
  only for decisions made before drawing, never per voxel.
- **No bottom faces** at or below the ground's top. Faces facing north stay on
  shadow casters (three.js shadow maps render back faces).
- **Tile fields the kits read**: `level` (raised ground, in tiles), `ground`
  (`'grass'`, `'dirt'`, `'path'`, `'sand'`: kinds bleed raggedly into each
  other), `water` (banks and bridges look at it), `height` (blocks above the
  level's top layer; sizes the grid, default 16), `detailHeight` (fine voxels
  of detail above the ground), `doorway` (a solid tile that still counts as a
  doorway of a room wall, like a locked door).

**Rooms.** Areas with `rooms: true` are drawn one room at a time with black
around them. `registerRing(tileset, (room, tx, tz) => cell | null, { north,
south, west, east })` supplies the tiles around a room in place of the
neighbouring rooms' tiles, reaching the given number of tiles out (default 1).
The dungeon ring draws a corridor with its own side walls five tiles north
from a north doorway (to the top of the frame), one tile of floor out of the
other doorways, the stairs going on down, and black elsewhere. The ring is
meshed apart from the room into the screen mesh named `'ring'` (a Group,
`layer.ring` true). Rings overlap the neighbouring rooms, which are drawn too
during a slide, so every ring hides itself from `'screen-leave'` until the next
`'screen-enter'`; the group's own `visible` stays with whoever shows and hides
the room.

**Backdrops.** `registerBackdrop(tileset, { charAt(tx, tz, info), north,
south, side, spread })` fills the tiles around every area of that tileset with
ordinary tiles, so the camera sees the world go on (section 8, "The far
distance"). They are meshed in chunks of 8 x 8 tiles; chunks four or more
tiles from the play area are meshed at half resolution (1/4 tile blocks),
without north faces and without casting shadows. `cellAt` returns backdrop
tiles too, so a screen's edge tiles blend into them. The overworld's band
(`farband.js`) continues the edge tiles for a tile, then forest, then plateaus
of one, two and four levels fronted by tree lines, up to 19 tiles north: the
top of the frame in camera A shows distant plateaus and trees, with sky only
in the corners.

### Overworld kit: `world/tiles/overworld.js`

```
.  grass       ,  flowers      p  dirt path    s  sand        d  dirt
T  tree        R  rock         B  bush (cut it with the sword; grows back)
#  raised ground, one level (cliff faces where it drops)     2  two levels
D  cave mouth in a raised tile's south face (warp)           ^  stairs cut into it
~  water       =  stone bridge over water                    f  wooden fence
g  gravestone  i  signpost     v  clay pot     C  chest (walk into it)
4, u, t, w     backdrop only: four levels; a tree on ground of level 1, 2, 4
```

Ground (`land(ctx)`) is a two-block slab: soil under a top layer of the tile's
kind with the fixed 8 x 8 accent pattern (two-block dashes, dark and light,
staggered by half a tile) and a 1.5 % brightness jitter per block
(`surfaceColor`). Its border blocks may take a same-level neighbour's kind,
so transitions are ragged. Raised ground stands 8 blocks a level; where it
drops the cliff face is tan with darker and lighter clumps (`cliffColor`),
has runs of full-height ridges, the odd extra block on top, a ragged dirt rim
along the edge and thin dark cracks. Cave mouths are 4 blocks wide and 6 tall,
stairs are one-block steps cut into the face. One tree per tile (`tree`),
rocks (`rock`), water planes with banks, a stone bridge, a fence of posts and
two rails. Bushes, pots and chests are props, so cutting or opening one does
not re-mesh the screen. The signpost and gravestone are character models
stamped into the detail layer.

### Dungeon kit: `world/tiles/dungeon.js`

```
.  floor           W  wall (its look depends on where it stands in its room)
S  statue on a plinth           F  brazier with a flame
~  dark water      X  stairs out (warp)      O  pit (a black hole)
L  locked door (walk into it with a small key)   C  chest (walk into it)
_  pressure plate, X mark       =  pressure plate, ring mark
P  push block (solid for now)   *  spike ball (solid for now)
```

Walls are 16 blocks tall: a darker base course, a band of long slabs, a teal
trim, tall panels split by grooves every 8 blocks, a second trim, an upper
tier set back one block and a lit ledge 5 blocks deep, then black
(`wallColor(along, h, depth)`). A `W` takes its look from its place in the
room that owns it: row 0 is the north wall with its inner face between rows 0
and 1 and two lamps at +-4.4 tiles from the room centre; the last row is the
south wall, one tile tall, pure black and unlit like the lab's (the
`'unlit-black'` layer, `makeGlowMaterial(0x000000)`, no shadow; a screen with
`southWall: false` shows floor there instead); the first and last columns
are side walls, drawn half a tile inward in room areas (13 tiles of floor
show); a `W` anywhere else is a full block of wall. So the same maps work in
16 x 11 screens and in the 16 x 12 room layout. Doorways are gaps in a wall; a
locked door is a pair of leaves one tile wide each and the full wall height,
flush with the wall's inner face (`doorProp`). Floors are fine voxels
(`fineFloor(ctx)`, `floorColor(X, Z)`): rounded-square tiles with a grout
line, a lighter ring and a darker centre.

A lamp is a small dark sconce on the wall, a glow strip on it and a warm point
light, all fixtures of the screen. The light comes from `makeLampLight()` in
`core/renderer.js` when the renderer has it, else it is a single
`PointLight(0xffb060, 4.5, 8, 1.5)`; lamps never cast shadows.

### Models: `models/`

A model is a `DenseGrid` at 16 voxels per tile, facing +z (south, toward the
camera), x east, y up, standing on y = 0 (the mesh origin is the bottom
centre). Nothing bends: poses and animation frames are whole models swapped
like sprite cels.

```js
import { model, modelMesh, PoseMesh, contactShadow, settleShadow, jitter } from './kit.js';
const m = model('pot', () => pot());          // { key, grid, geometry, colors }, built once
const mesh = modelMesh(m);                     // shared character material, casts and receives shadows
const own = modelMesh(m, makeCharacterMaterial()); // an own material (hit flash)
const body = new PoseMesh({ tall: slimeModel(0), squat: slimeModel(1) }, material);
body.setPose('squat');                         // body.pose, body.model
const blob = contactShadow(0.36);              // soft dark disc under a character (radius, tiles)
settleShadow(blob, heightAboveGround, 0.36);   // shrinks and fades it while hopping
```

`model(key, make, { origin, scale })` caches by key; `colors` lists the
model's colours by weight, which is what bursts use. `jitter(hex, x, y, z)`
varies a voxel's brightness reproducibly.

**The hero** (`models/hero.js`): 16 x 16 x 16, one tile tall, the body plan of
section 10 with seven colour slots (`HERO_SLOTS`).

```js
const hero = makeHero(material);  // { root, sway, body, figure, swordPivot, sword, shadow, ... }
hero.setPose('walk1');            // HERO_POSES: stand, walk1, walk2, cheer, swordOut, windUp
hero.pose();                      // the current pose name
hero.setSword(mesh);              // another blade; makeSwordMesh(material, length, width) builds one
```

Aliases (`HERO_ALIASES`): idle, walkA, walkB, raise, attack, attack1 and
attack2 (the last three are swordOut). `root` stands at the feet; `sway` rolls
the whole model while walking; `body` is what the sword system twists;
`swordPivot` (YXZ, at hand height `PIVOT_Y`) carries the sword with its grip
at `SWORD_GRIP` in the swordOut hand, so turning the pivot sweeps the blade
through the arc the hit test uses. `armR`, `armL`, `legL`, `legR` are inert
handles kept for M1 code. `entities/player.js` animates him: walking swaps
walk1 and walk2 8 times a second, standing still he walks in place at 2.5,
the whole model sways with the steps, swordOut is held while a swing lasts
(`attackT > 0`; the sword is only shown then), and `player.cheer(seconds)`
holds the cheer pose (on `'chest-opened'`, `'item-gained'` and a key pickup).

**Enemies** pass their look to the `Enemy` base: `model` (one frame),
`poses` (`{ name: model }`, swapped with `this.mesh.setPose(name)`) or
`geometry`, plus `shadow` (contact shadow radius; default `r * 1.15`). The
burst colours default to the model's. Slimes (`slimeModel(frame, variant)`,
green, red or blue; frames tall and squat) and the spitter (`spitterModel`,
idle and aiming) are in the game; `CHARACTER_MODELS` holds the ported
thornbug, skeleton, bat (two frames), sentry, golem, elder, a leader's gem and
an alert mark for the features that will use them, and `stoneBrute()` builds a
large enemy from parts. Pickups: `heartModel`, `gemModel(value)`,
`keyModel`, `coinModel`. `ICONS` are small grids for HUD glyphs (heart and vial
with a fill level, coin, key); the HUD does not use them yet. Props:
`models/props.js` (bush, pot, signpost, gravestone, flowers, chest base and
lid, brazier and two flame frames, door leaves, statue, spike ball, push
block), placed by `world/tilekit.js` (`bushProp`, `potProp`, `chestProp`,
`doorProp`, `flameProp`, `spikeBallProp`, `pushBlockProp`, `modelProp(make)`).

### Effects: `systems/particles.js`

```js
burst(x, y, z, colors, count, { speed, size, up, life });  // cubes of 0.1 to 0.15 tile in the object's
                                                           // colours: scatter, bounce, lie still, vanish
sparks(x, y, z, colors, count, { speed, size, up, life }); // small glowing cubes that fly off and fade (hits)
smoke(x, y, z, count, { radius, spread, life });           // white puffs that swell, rise and shrink
```

Each kind is one instanced mesh used round-robin, and randomness comes from
`fxRandom()`. Enemies appear and vanish in smoke, spark and shed a few cubes
when hit and burst when they die; cut bushes, opened doors and chests and
shattered rock shots burst too.

### Kit test areas: `world/areas/kitroom.js`

Registered only with `?kitroom=1`, at screen columns 488 to 496 (clear of
every reserved region): `kitroom` (one room of the 16 x 12 layout with every
dungeon piece: corridor, locked double door, side doorway, stairs out,
statues, braziers, plates, push block, pit, spike balls, dark water, chest;
16 x 11 screens drop one of its floor rows), `kitfield` (every overworld
piece on one screen) and `kitlineup` (every model: hero poses and sword,
enemies and their frames, pickups, props, icons). Teleport there with
`teleport('kitroom:0,0', 7.5, 8.5)`.

## Test hook

`window.__voxelHeroes` (`src/debug/testhook.js`). URL parameters:
`?manual=1` starts in manual mode, `?seed=N` seeds gameplay randomness.

| Member | Use |
|--------|-----|
| `state`, `player`, `world`, `input`, `entities` | live objects (`entities` is the live list) |
| `events` | `{ on, once, off, emit }` |
| `update(dt = 1/60)` | one simulation tick (what the loop calls) |
| `step(seconds, dt = 1/60)` | many ticks; returns how many ran |
| `setManual(on = true)`, `isManual()` | stop / resume the real-time simulation (rendering continues) |
| `render()` | draw a frame now, HUD included |
| `seed(n)` | reseed gameplay randomness |
| `start()` | title or game over -> play |
| `teleport(target, x, z, { yaw })` | `'crypt'`, `'crypt:0,1'`, `'1,0'`, `[1, 0]`, `{ area, screen }` or a screen name; x, z local tiles (default the middle) |
| `give(id, amount = 1)` | grant anything: `'key'`, `'gems'`, `'heart-container'`, an item id, an ammo id |
| `setHp(n)` | set health (clamped to max); `0` or less kills the hero through the normal death path |
| `spawn(type, x, z, opts)` | add an entity at local tile coordinates |
| `setMode(name)`, `newGame()` | switch modes, reset to a new game on the title |
| `save()`, `load(data)` | in-memory save data round trip |
| `saveToSlot(n)`, `loadFromSlot(n)` | localStorage slots |
| `showDialog(lines, opts)`, `dialogOpen()`, `overlayVisible()` | UI |
| `camera.presets`, `camera.choose(name)`, `camera.set(name)`, `camera.get()`, `camera.target` | camera presets (`choose` is the player's setting, `set` lasts until the next screen) |
| `registries.tilesets()`, `.areas()`, `.entities()`, `.items()`, `.grants()` | what is registered |
| `snapshot()` | JSON summary: mode, area, screen, screenName, hp, maxHp, gems, keys, keysByGroup, x, z, lx, lz, yaw, invT, attacking, enemies, entities, flags, inventory, overlay, dialog, particles, time |

## Play-test harness

```sh
npm run playtest                                   # build, run the default scenario, shots in playtest-out/
node scripts/playtest.mjs --out <dir>              # screenshots into <dir>
node scripts/playtest.mjs --scenario screens       # gallery of every screen and camera preset
node scripts/playtest.mjs --scenario all --no-build
node scripts/playtest.mjs --list
```

It runs `vite build`, serves `dist/` with `vite preview` on a free port,
launches headless Chromium (swiftshader; browsers from
`PLAYWRIGHT_BROWSERS_PATH`), opens `?manual=1&seed=1` and injects
`scripts/lib/bot.js`. Swiftshader renders a few frames a second, so all waiting
is simulated: nothing sleeps in real time except a short settle before each
screenshot. A scenario fails on a failed expectation, a bot helper that cannot
finish, or any page error or console error; it then saves `FAILED.png` and
prints the game state. The default scenario takes about two minutes. Google
Fonts is blocked during tests, so screenshots use the fallback font.

A scenario is a file in `scripts/scenarios/`:

```js
export const description = 'Bombs open the cracked wall';
export default async function (t) {
  await t.press('Enter');                               // title -> play
  await t.teleport('crypt:1,1', 8, 3);
  await t.give('bombs');
  await t.hold('KeyK', 0.1);                            // B
  await t.step(3);
  const s = await t.state();
  t.expect(s.flags.includes('...'), 'the wall is gone');
  await t.shot('01-wall-open');                         // <out>/01-wall-open.png
}
```

Session API (`launch(opts)` in `scripts/playtest.mjs` returns it):
`step(seconds)`, `hold(key, seconds)` (Playwright key names: `ArrowUp`,
`Space`, `KeyK`, `Enter`, `Escape`), `press(key)`, `tap(action)`,
`stick(x, z, seconds)`, `teleport`, `give`, `setHp`, `save`, `load`, `state()`
(the snapshot), `shot(name)`, `eval(fn, arg)`, `track(...events)` +
`events(name)`, `expect(cond, message)`, `note(message)`, `close()`, and the
bot: `walkTo(x, z)` (breadth-first path over the screen's tiles, avoiding warp
tiles), `exit('north' | 'south' | 'east' | 'west')` (walk off that edge and wait
for the slide), `fight({ maxKills, seconds })` (approach, face, swing; tops up
health at 1 heart so a long fight cannot end the test), `waitFor(snapshot =>
bool, { seconds })`. Bot helpers throw on failure unless given `{ soft: true }`.

Gotchas: HUD widgets redraw when a frame renders, so call
`__voxelHeroes.render()` before reading HUD elements (`shot()` does). B is
ignored while the sword is mid-swing, and the hero blinks for a second after
starting or getting up, so step past it before a screenshot that should show
him.

## Working in parallel (M2)

Each M2 feature should mostly add files. The table lists what each one owns
and the shared files it may have to touch; anything else shared is a smell.

| Feature | Adds (new files) | Owns (may rewrite) | Shared file it may need |
|---------|------------------|--------------------|-------------------------|
| 1 Sword system | sword data and levels, charge + spin, giant blade at full health, blacksmith NPC (`entities/npcs/blacksmith.js`) | `systems/sword.js`, the sword in `models/hero.js` | `entities/player.js`, only if the swing flow itself must change |
| 2 Overworld enemies | `entities/enemies/*.js`, `models/*.js`, a test field area, loot via `addDrop` | | none |
| 3 Dungeon enemies + boss | enemies, the boss and its phases, a boss test room | | none |
| 4 Sub-items | `items/*.js`, arrow / bomb / blade entities, ammo pickups | `items/`, `ui/hud/item-slot.*` | none |
| 5 Dungeon mechanics | tiles in `world/tiles/*.js` (big key door, shutters, push blocks, switches, cracked walls, torches, pits, pots), map and compass grants, the full dungeon | `areas/crypt.js`, `world/tiles/dungeon.js`, `world/tilekit.js` | `entities/player.js` for falling or lifting |
| 6 Overworld + town | overworld screens, town tileset, NPC entities, shop, inn (`saveToSlot`, `state.respawn`), caves | `areas/overworld.js`, `world/tiles/overworld.js` | none |
| 7 UI / meta | title, pause + inventory, dungeon map, save slots, game over / continue | `ui/screens/*`, the overlay in `index.html`, `style.css` | `core/save.js` |

Rules that keep merges clean:

- Register instead of editing lists: `registerTile`, `registerEntity`,
  `registerItem`, `registerHudWidget`, `registerMode`, `registerGrant`,
  `addDrop`, `registerSfx`, `registerLighting`, `registerCameraPreset`,
  `defineState`, `input.bind`. Never edit `content.js`, `main.js` or another
  feature's registry file to add content.
- Talk to other features through events and ids. A town map can place a
  `blacksmith` marker before the sword branch registers that entity: the
  marker is skipped with a warning until it exists. Chest contents that name
  an item from another branch warn until merged.
- Put styles next to the module (`import './thing.css'`) and colours in the
  file that uses them; `world/palette.js` is shared, so leave it alone.
- New flags and state keys get a feature prefix.
- Test rooms go in their own area file with a reserved origin, never in
  someone else's map.

### Screen origins

Areas share one global screen grid and must not overlap (startup throws).
Reserved regions:

| Origin | Region | For |
|--------|--------|-----|
| `[0, 0]` | x 0-9, y 0-9 | the overworld (feature 6 grows it here) |
| `[0, 10]` | x 0-9, y 10-19 | Cairn Crypt (feature 5 may grow it into the full dungeon) |
| `[0, 20]` | x 0-9, y 20-29 | a second dungeon, if feature 5 builds a new one |
| `[20, 0]` | x 20-29, y 0-9 | town interiors, shop, inn, caves (feature 6) |
| `[30, 0]` | x 30-39 | dungeon enemy and boss test rooms (feature 3) |
| `[40, 0]` | x 40-49 | overworld enemy test field (feature 2) |
| `[50, 0]` | x 50-59 | sub-item test range (feature 4) |
| `[60, 0]` | x 60-69 | sword test yard (feature 1) |

## Build rules

- `npm run artifact` must produce one self-contained HTML page: no dynamic
  `import()`, no runtime `fetch` of assets, no external hosts except the
  Google Fonts stylesheet. Content folders are bundled through eager
  `import.meta.glob`, which compiles to static imports.
- Every model is voxels generated in code (`core/voxel.js`, `models/`).
- All names, text and art are original.
- localStorage can be missing or blocked: go through `core/save.js`, which
  catches every failure.

## Known quirks kept from the prototype

- Knockback that was active at the moment of death carries over, so the hero
  slides a little after "Try again".
- `player.yaw` is not wrapped to 0..2π; compare angles with `lerpAngle` or
  an angle difference, not with `===`.
- The screen-name banner times out in real time (a CSS animation and a
  timer), so in slow headless runs it can appear in several screenshots.

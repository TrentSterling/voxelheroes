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
[Test hook](#test-hook) · [Play-test harness](#play-test-harness) ·
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
    constants.js        SCREEN_W 16, SCREEN_H 11 (the default screen), R 8 (terrain voxels per tile), TV, GROUND_Y, DEG
    renderer.js         WebGL renderer, scene, lights; LIGHTING presets + registerLighting
    camera.js           CAMERA_PRESETS (pitch/fov/height/lead/fixed/fitWidth; A-D selectable) + registerCameraPreset, HERO_OUTLINE, subjectFor (framing rules: southReach, sideReach), slide tween
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
    tiles/overworld.js  overworld tileset: grass, flowers, path, sand, tree, boulder, cliff, water, bush, cave door
    tiles/dungeon.js    dungeon tileset: floor, wall, dark water, pillar, brazier, stairs, locked door, chest
    tilekit.js          shared tile behaviour: bush/door/chest/flame props, cutPlant, unlockDoor, openChest
    palette.js          terrain colours
    areas.js            AREA REGISTRY: registerArea, getArea, START, screen sizes, areaStart, room('J-3') (addressing and rooms: header comment)
    areas/overworld.js  the six overworld screens (16 x 11)
    areas/crypt.js      the four crypt rooms (16 x 12)
    areas/test-borders.js  three small areas that touch, for the 'areas' scenario
    world.js            builds every screen, startup checks, the screen index (screenAt, locate), spots (resolveSpot, freeSpot), places (placeKey), collision, props, tile hooks, setTile, terrain LAYERS
    grid.js             screen keys and screen-object helpers (screenRect, screenCenter, insideScreen, toLocal, toWorld, DIRS)
    links.js            areaGroups (areas joined by touching screens), edgeReport (links, mismatched edges, dead ends)
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
  models/               voxel models built in code: hero (+ sword), slime, spitter, rock, pickups, props
    part.js, cache.js   model helpers: meshed parts with pivots, build-once geometry cache
  systems/
    sword.js            SWORD stats (data), swing, blade pose, blade hit tests; setSwordStats
    combat.js           hurtPlayer, shield, enemiesLeft, room-cleared
    drops.js            DROP_TABLES + addDrop / registerDropTable / rollDrop
    grants.js           GRANT REGISTRY: grant('heart-container'), registerGrant
    keys.js             small keys per dungeon (keyGroup)
    interact.js         A talks before it swings (onInteract on entities and tiles)
    physics.js          moveBody: circle vs solid tiles inside a bounds rect; clearDistance
    particles.js        voxel bursts (instanced cubes)
    spawner.js          map markers -> entities on screen entry
    transitions.js      slides, fades into other areas, warps, entering a screen, which screens are drawn; chooseCameraPreset
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
  lib/bot.js            in-page bot: walkTo, exit, enter, fight, waitFor
  lib/helpers.mjs       scenario helpers: clearFoes, pushUntilMoving
  scenarios/            default.mjs (the M1 play-through), screens.mjs (gallery), rooms.mjs, areas.mjs, camera.mjs
```

Dependency direction: `core` imports nothing from the game. `world`, `entities`,
`systems`, `items` and `ui` import `core` and each other's registries or small
APIs. Content files (a tile, an enemy, an item) import what they need, and
only `content.js` imports them, except for helpers a content file exports on
purpose (the floor builders in `tiles/dungeon.js` and `ground()` in
`tiles/overworld.js`).

## Frame, modes and coordinates

**One frame** (`main.js`): `state.time += dt`, `world.update` (water, flames),
the mute key, `updateMode(dt)`, particles, `world.flush()` (re-mesh changed
screens), `syncScreenVisibility()` (hide what is not drawn), camera
placement, `input.endFrame()`. Rendering then refreshes the
HUD widgets and draws the scene. The loop clamps `dt` to 1/30 s. In manual mode
the loop keeps rendering but only tests advance the simulation.

**Modes** (`core/modes.js`) decide what a frame does. `state.mode` is the top
of a stack.

| Mode | Registered in | What it does |
|------|---------------|--------------|
| `title` | ui/screens/title.js | hero idles behind the title panel; confirm starts |
| `play` | systems/flow.js | Start pauses; hero, items and entities update |
| `scroll` | systems/transitions.js | the 0.8 s slide to the next screen or room of the same area |
| `warp` | systems/transitions.js | fade out, move, fade in: warps (doors, stairs) and walking into another area (a load: the loading card's hold) |
| `paused` | ui/screens/pause.js | pushed over play; Start or the button resumes |
| `dialog` | ui/dialog.js | pushed while a dialog box is open |
| `dead` | ui/screens/gameover.js | hero tips over; then the game-over panel (Try again: at the dungeon's `entrance` inside one, else the respawn point) |

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
up. A screen is 16 x 11 tiles outdoors and 16 x 12 in dungeon rooms: each area
sets its size. Every area sits on one global grid of tiles, its screens on a
lattice of its own screen size placed by its `origin` or `at` (see
[Areas](#areas-srcworldareasjs)); `world.locate(tx, tz)` and
`world.screenAt(x, z)` find the screen under a tile or point, so never divide
by 16 or 11. Map rows and spots are local to their screen. `yaw` 0 faces +z
(towards the camera); use `Math.atan2(dx, dz)`. Health is counted in
half-hearts (`START_HP` 6 = three hearts). Terrain voxels are 1/8 of a tile,
character voxels 1/14.

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
`world.js` adds more), `x, z` local and `tx, tz` global tile coordinates.
Screens differ in size, so tell an edge row or column from `ctx.screen.w` and
`ctx.screen.h` (and a room from `ctx.screen.area.rooms`), not from
`SCREEN_W` / `SCREEN_H`. Draw only from `ctx.rand` so screens look the same
on every load; the world replays each tile's random stream when a screen is
re-meshed, so changing one tile never recolours its neighbours.

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
  screen: [16, 12],              // tiles per screen [w, h]; default [16, 11], rooms [16, 12]
  rooms: true,                   // dungeon rooms (art bible section 9), see below
  origin: [200, 0],              // where local screen '0,0' sits, in screens of this size
                                 //   (or at: [tx, tz], its north-west corner in tiles)
  start: [0, 1],                 // local screen used by teleport('crypt') and spots without one
  entrance: { screen: [0, 1], x: 8, z: 10.4, yaw: Math.PI },  // get up here after falling in here
  keyGroup: 'crypt',             // small keys count per group (default: id)
  spawns: { e: { type: 'slime', variant: 'blue' }, K: { type: 'key', once: true } },
  warps: { X: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 } },
  onScreenEnter(screen) {},      // optional
  screens: {
    '0,1': { name: 'Sunken Gate', rows: [/* h strings of w chars */] },
  },
});
```

`spawns` maps a marker character to an entity type (a string, or an object
whose extra fields go to the entity factory; `tile` sets the tile left under
it, `once: true` means it never returns after `markDone()`). Markers spawn
each time the screen is entered, staggered for enemies. A marker naming an
entity type that is not registered is skipped with a console warning, so a
map can name a type another branch provides. `warps` maps a tile character to
a spot; tiles with `onEnter: enterWarp` use it. Screens can override
`lighting`, `camera`, `tileset`, `spawns`, `warps`, and add `onEnter(screen)`.
The world checks at startup, with a message that names the screen and the
tile: every tile character and row length; every warp (it must land inside
its screen, off solid tiles and off warp tiles, or the hero would warp
straight on, back and forth); every warp tile (`onEnter: enterWarp`) has a
destination in its screen's or its area's `warps`; the `camera` and
`lighting` names are registered; and the edges (see Neighbours below).

**Addressing.** Local screen `'i,j'` of an area with screens of w x h tiles
covers global tiles x `(origin[0] + i) * w` to `(origin[0] + i + 1) * w - 1`
and z `(origin[1] + j) * h` to `(origin[1] + j + 1) * h - 1`. Screens are 16
tiles wide unless an area says otherwise, so a screen column means the same
strip of the world for all of them, and the [global regions](#global-regions)
are columns. Rows count in the area's own screen height, so areas of
different heights keep to different columns. An area whose screens are not 16
wide (a 12 x 9 house) is placed by tile instead: `at: [tx, tz]` is the global
tile of local screen `'0,0'`'s north-west corner, and screen `'i,j'` starts at
`tx + i * w`, `tz + j * h` (`at: [300 * 16, 0]` is the corner of screen
column 300; `areaCorner(area)` gives either form in tiles). The world indexes
screens by position and throws at startup if two screens overlap. Screens are
keyed `'area:i,j'` (`world.screen('crypt:0,1')` or
`world.screen('crypt', 0, 1)`); a screen object carries `key`, `area`, `def`,
`name`, `lx`, `ly` (local screen), `w`, `h`, `x0`, `z0` (north-west corner,
world units) and `x1`, `z1` (one past the south-east corner), so it works as
a rect.

**Spots** name a place independently of where an area sits:
`{ area, screen: [i, j], x, z, yaw }`, with x and z local tiles of that screen
(default: its middle; `screen` defaults to the area's `start`, else its first
screen, `areaStart(area)`). Dungeon rooms can be named by the gameplay spec's
labels (section 3: row A-J north to south, column 1-8, entrance on row J):
`room('J-3')` from `world/areas.js` is `[2, 9]`, and `room('A-1', 1)` is on
the second floor, `[0, 11]` (see Global regions). Warps, the
start point, `state.respawn`, an area's `entrance`, the saved position and
teleports are spots; `world.resolveSpot(spot)` turns one into
`{ screen, x, z, yaw }`. A hero who falls in an area with an `entrance` (a
dungeon: gameplay spec 6.7) gets back up there with full health; elsewhere
at `state.respawn` (an inn) or the start. A boss arena in an area of its own
names its dungeon's entrance (`entrance: { area: 'mire-keep', screen: [2, 9] }`).

**Neighbours.** Screens of one area that touch are joined: walking off an
edge slides to the next one. Screens of different areas that touch are joined
too, whatever their sizes, but walking across changes area: fade to black,
`'area-enter'`, a hold for the loading card, fade in. `world/links.js` works
both out: `areaGroups(world)` (the areas joined into one outdoors, drawn
together) and `edgeReport(world)` (`{ links, mismatches, deadEnds }`: where
areas touch, edge tiles open on one side but a wall on the other, and open
edge tiles with no screen past them; warp tiles are left out). The world
checks them at startup: a mismatch throws, and so does a doorway onto no room;
an open outdoor edge onto nothing only warns (the hero stops there). A new
neighbour must open matching gaps on both sides of the shared edge. To keep
two areas apart, leave an empty screen between them.

**Rooms** (`rooms: true`, art bible section 9). Each screen is one room, in
a dungeon 16 x 12: row 0 is the north wall, rows 1-10 the floor, row 11 the
south wall (`southWall: false` on a screen asks the tiles to leave out its
black band; collision stays), columns 0 and 15 the side walls. Doors are two
tiles wide: columns 7-8 of rows 0 and 11, rows 5-6 of columns 0 and 15. Side
walls are drawn half a tile inward (`WALL_INSET`), and their collision
reaches as far, so bodies stop at x = 1.5 and 14.5; the north and south faces
are at z = 1 and 11. Rooms of a dungeon adjoin so door gaps line up; walking
through one slides to the next room. Only the current room is drawn (both
during a slide), so everything outside it is black, and the camera is the
area's fixed preset, aimed at the floor centre (local 8, 6). Rooms of other
sizes (house interiors, 10 x 8 to 16 x 12 in the gameplay spec; a boss arena,
22 x 16) work the same way: the outer ring of tiles is the wall, the side
walls stand half a tile in, and the camera centres on the room (`camera:
'interior'` fits its height to the room's width).

**Moving between screens** (`systems/transitions.js`; the times are the
gameplay spec's, sections 4.3 and 4.4). Walking off an edge into a screen of
the same area slides (`SLIDE_TIME` 0.8 s, 48 ticks, ease in-out): the hero is
carried `SLIDE_STEP` (1) tile in from the edge, or in a room `ROOM_STEP` (1)
tile into the floor past the wall the doorway is in, and the camera keeps him
in frame on the way. Walking into another area, or through a warp into one
(a door, stairs out), is a load: `FADE_OUT` 0.25 s, `AREA_HOLD` 1 s of black
for the loading card, `FADE_IN` 0.25 s (90 ticks in all), landing him at the
matching spot on the other side, the same distance in. A warp inside one area
(stairs between the floors of a dungeon, warp tiles) fades out and in over
`WARP_FADE` 0.3 s each with no card (`WARP_HOLD` 0) and no `'area-enter'`.
Input is ignored during both, Start included; only the hero's walk animates.
Events: see [Events](#events).

**Drawing.** In a room area only the current room is drawn. Elsewhere the
screens of the hero's group of joined areas are drawn, so the low cameras see
the land beyond the screen, except screens wholly south of the current one:
the camera never looks there, and trees on their first row would otherwise
poke up at the frame's bottom edge. During a slide both screens' sets are
drawn. Tile builders do not need to care: `syncScreenVisibility()` toggles a
screen's meshes and props every frame. `shownRect()` gives the world rect
around what is drawn (in a dungeon the room, or both rooms mid-slide), for
the look's polished floor and lamp culling: `look.bind({ roomRect: shownRect })`.

**Camera** (`core/camera.js`). The subject is the hero, clamped to the
current screen's rect: the ground at the frame's bottom edge never lies south
of the screen, and on the hero's row the frame's sides stay inside it where
the frame is narrower than the screen (centred where it is wider). The north
is never clamped. Within that, all of the hero stays in frame, worked out
from his outline (`HERO_OUTLINE`: `[reach, bottom, top]` slabs in tiles that
cover the model with his shield out and his legs mid-stride, the sword left
out; `setHeroOutline(slabs)` for a bigger hero):
- by an east or west edge the frame's side may go past the screen by what it
  takes to show all of him (about a tile at most);
- at an open south edge he goes on to the next screen as soon as any of him
  would drop below the frame: when his centre reaches the screen's south line,
  `southReach(preset)` north of the edge (A 0.39 tile, B 0.55, C 0.62, D 0.36;
  `southLine(screen)` in `systems/transitions.js`), and the slide or fade
  carries him on from there;
- presets with `fixed: true` (the dungeon and interior cameras) aim at the
  room's centre and move only as far as it takes to keep all of him in frame:
  under a tile sideways in an east or west doorway at 16:9, and down into the
  south doorway. Where the frame is less than half as wide as the room (a
  phone held upright) they follow him across instead. In a room nothing past
  the walls is drawn, so there the bottom edge may show past the south wall,
  and the south line is the edge itself.

A preset with `fitWidth` scales its height with the room: `interior` (houses,
shops, caves) is the dungeon camera at 12.7 x room width / 16, at least 8
(gameplay spec 4.2), so a 12 x 9 room gets 9.5. An area or screen can fix a
preset (`camera`); other screens use the player's choice,
`chooseCameraPreset(name)`, one of the `selectable` presets A-D
(`playerCameraPresets()`), which is saved.

**Not built yet** (gameplay spec v1.0 sections 4 and 11, which landed after
this framework):
- Presets A and D following the hero across screen lines inside an area, with
  no slide and no input lock (a "follow change" 0.5 tile past the line); today
  every preset clamps to the screen and slides, which is the spec's rule for B,
  C and dungeon rooms.
- 16 x 16 overworld screens in areas of 4 x 4 (data: `screen: [16, 16]`;
  today's M1 maps are 16 x 11).
- Building only the current area and unloading it on each load; today every
  screen is meshed at startup and hidden when out of view.
- The loading-art option (card 1.0 s or 0.3 s) and the boss arena camera
  (17.5 high; a preset an arena area registers and names).
- Section 11's load rule (a load resumes at the respawn point, or at a
  dungeon's `entrance` for a save made inside); today a load resumes where the
  save was made.
- Doorway rules (4.5): no attacks or items in a doorway, movement along the
  door's axis.

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
`keys` (per key group), `flags` (a Set of strings), `tileEdits` (keyed by
global tile in play; see below), `inventory`, `respawn` (a spot, which an inn sets), `pos` (the
hero's spot: `{ area, screen: [i, j], x, z, yaw }`; M1 saves with `{ sx, sy }`
still load) and `camera` (the player's preset choice, which a new game keeps). Slots: `saveToSlot(n)`,
`loadFromSlot(n)`, `activeSlot()` in `systems/flow.js` on top of
`core/save.js` (`writeSlot`, `readSlot`, `listSlots`, `deleteSlot`).

Flag names in use: `taken:tx,tz` (once-spawns), `door:tx,tz`,
`chest:tx,tz`. Prefix new ones by feature (`boss:crypt`, `talked:smith`).

A flag of the form `<name>:<tx>,<tz>` names a global tile, and so does every
key of `tileEdits`. Save data names those tiles by place instead:
`chest:crypt:1,0:7,5`, `crypt:1,1:7,0` (the area, its local screen, the
local tile; `world.placeKey(tx, tz)` and back, `world.placeTile(key)`), so
moving an area in the global grid leaves its chests, doors and keys as they
were; a load puts them back on today's tiles (`setTileKeyCodec` in
`core/state.js`). Keep flags that are not about a tile out of that form. An
M1 save (its `pos` is `{ sx, sy }`) named the old crypt's tiles on the M1
lattice (16 x 11 screens at `[0, 10]`); loading one moves those flags, tile
edits and the hero into today's crypt. The save `version` stays 1: both
forms load.

### Presets and small tables

| What | Where | Add from your own file |
|------|-------|------------------------|
| Lighting | `core/renderer.js` `LIGHTING` | `registerLighting('cave', { background, sky, ground, hemi, sunColor, sun })` |
| Camera | `core/camera.js` `CAMERA_PRESETS` (A default, B, C, D: the player's choices; dungeon, interior) | `registerCameraPreset('boss', { pitch, fov, height, lead, fixed, fitWidth, minHeight })`: pitch, fov and height required; lead 0, not fixed and not a player choice unless given (`selectable: true`). Player choice: `chooseCameraPreset(name)` |
| Terrain layers | `world/world.js` `LAYERS` | `registerLayer('lava', { material, castShadow, receiveShadow, tick })` |
| Sounds | `core/audio.js` `sfx` | `registerSfx('bomb', () => noise(0.5, { freq: 300 }))` |
| Key bindings | `core/input.js` `BINDINGS` | `input.bind('map', ['KeyG'])` |
| Sword stats | `systems/sword.js` `SWORD` | `setSwordStats(() => stats)` |

## Events

`core/events.js`: `const off = on(name, fn)`, `once`, `off`, `emit(name, payload)`.
Handlers run synchronously in subscription order.

| Event | Payload | Emitted by |
|-------|---------|------------|
| `room-enter` | `{ area, screen, via }` | transitions.js: every screen or room entered, once its spawns are in and play resumes; `via` is `'slide'`, `'edge'` (walked in from another area), `'warp'`, `'start'`, `'respawn'`, `'load'` or `'teleport'` |
| `area-enter` | `{ area, from, via }` | transitions.js: another area is reached (`via` `'edge'` or `'warp'`), when the screen has gone black; show the loading card for `AREA_HOLD` seconds. Not emitted by warps inside one area (no card), start, respawn, load or teleport |
| `screen-enter` | `{ screen }` | transitions.js, just before `room-enter` (the M1 name) |
| `screen-leave` | `{ screen }` | transitions.js, before its entities are cleared (the start of a slide, or at black in a fade) |
| `warp` | `{ dest }` | a warp starts; `dest` is `{ screen, x, z, yaw }` |
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
import { R } from '../../core/constants.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../systems/particles.js';
import { registerTile } from '../tiles.js';
import { underlayer } from './dungeon.js';

const STONE = [0x6b5f78, 0x2a2230];

registerTile('dungeon', '%', {
  name: 'cracked-wall',
  solid: true,
  becomes: '.',
  build(ctx) {
    underlayer(ctx);
    const { g, bx, bz, rand } = ctx;
    for (let vx = 0; vx < R; vx++)
      for (let vz = 0; vz < R; vz++)
        for (let y = 0; y <= 10; y++) g.set(bx + vx, y, bz + vz, rand() < 0.12 ? STONE[1] : STONE[0], 0.08);
  },
  onBomb(ctx) {
    ctx.world.setTile(ctx.tx, ctx.tz, ctx.def.becomes, { persist: true, reason: 'bombed' });
    burst(ctx.tx + 0.5, 0.5, ctx.tz + 0.5, STONE, 30);
    sfx.door();
  },
});
```

Then use `%` in a dungeon map. Pick characters that are free in the tileset
(`listTilesets()` or the hook's `registries.tilesets()` shows them).

### (b) An enemy

Model in `src/models/bat.js`, behaviour in `src/entities/enemies/bat.js`:

```js
// src/models/bat.js
import { VoxelGrid, buildGeometry, rng } from '../core/voxel.js';
import { MV } from './part.js';
import { cached } from './cache.js';

export function makeBat() {
  const g = new VoxelGrid(rng(21));
  g.ellipsoid(0, 4, 0, 3, 3, 3, () => 0x5a3a78);
  g.box(-7, -3, 4, 4, -1, 1, 0x3b2552);
  g.box(3, 7, 4, 4, -1, 1, 0x3b2552);
  return buildGeometry(g, MV, [-0.5, 0, -0.5]);
}
export const batGeometry = () => cached('bat', makeBat);
```

```js
// src/entities/enemies/bat.js
import { random } from '../../core/random.js';
import { batGeometry } from '../../models/bat.js';
import { moveBody } from '../../systems/physics.js';
import { Enemy } from '../enemy.js';
import { registerEntity } from '../registry.js';

class Bat extends Enemy {
  constructor(opts) {
    super(opts, { hp: 1, r: 0.3, speed: 3, colors: [0x5a3a78, 0x3b2552], geometry: batGeometry() });
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
[Areas](#areas-srcworldareasjs)), an `origin` (or, for screens that are not
16 wide, an `at`) in the right [global region](#global-regions), and a way
in: a warp tile in another area
(`warps: { D: { area: 'your-id', screen: [0, 0], x: 8, z: 9, yaw: Math.PI } }`),
or screens that touch another area's screens (walking across fades into it).
New tiles go in `src/world/tiles/`. If the area needs its own tileset,
`defineTileset('cave', { parent: 'dungeon' })`. For lighting or a fixed camera,
register presets and name them in the area (`camera: 'dungeon'` for dungeon
rooms, `camera: 'interior'` for a house or a cave of any size).

Today's overworld is 3 x 2 screens at `[0, 0]`. A 2 x 2-screen area east of
it, a dungeon of rooms reached by stairs from it, and a one-room hut of
another size:

```js
import { registerArea, room } from '../areas.js';

registerArea({ id: 'fens', name: 'The Fens', tileset: 'overworld', lighting: 'day',
  origin: [3, 0],                          // columns 3-4, rows 0-1: touches the overworld's east edge
  warps: { D: { area: 'mire-keep', screen: room('J-3'), x: 8, z: 10, yaw: Math.PI } },  // a cave door
  screens: {
    '0,0': {...}, '1,0': {...}, '1,1': {...},                          // rows: 11 strings of 16
    '0,1': { name: 'Reed Bank', rows: [...],                           // a second door, to the hut:
      warps: { D: { area: 'reed-hut', screen: [0, 0], x: 6, z: 7.4, yaw: Math.PI } } },
  } });

registerArea({ id: 'mire-keep', name: 'Mire Keep', tileset: 'dungeon', lighting: 'crypt',
  camera: 'dungeon', rooms: true,          // 16 x 12 rooms, fixed dungeon camera
  origin: [210, 0],                        // dungeon 1 (see Global regions)
  start: room('J-3'),                      // [2, 9]: the entrance is on row J
  entrance: { screen: room('J-3'), x: 8, z: 10, yaw: Math.PI },          // get up here after falling
  warps: { X: { area: 'fens', screen: [1, 1], x: 8, z: 3, yaw: 0 } },     // stairs out
  screens: {
    '2,9': { name: 'Entry', rows: [/* 12 strings of 16 */] },             // J-3
    '2,8': {...}, '3,8': {...},                                           // I-3, I-4
  } });

registerArea({ id: 'reed-hut', name: 'Reed Hut', tileset: 'dungeon', lighting: 'crypt',
  camera: 'interior', rooms: true, screen: [12, 9],                     // one 12 x 9 room
  at: [(300 + 2 * 3) * 16, 0],            // interior building 3, placed by tile (12 wide)
  warps: { X: { area: 'fens', screen: [0, 1], x: 8.5, z: 2.7, yaw: 0 } }, // back out the door
  screens: { '0,0': { name: 'Reed Hut', rows: [/* 9 strings of 12 */] } } });
```

A new neighbour needs matching gaps on both sides of the shared edge, and
Mirror Lake's east edge is closed today (column 15 of `overworld.js`'s
`'2,0'` is trees on every row): open, say, rows 5-6 there and rows 5-6 of
the west edge of the Fens' `'0,0'`. Walking east off Mirror Lake then fades
into the fens with a loading card, and so does each door. Open tiles facing a
wall across a shared edge, or a room's doorway onto no room, stop the game at
startup with the tiles named; the rooms' door gaps must line up with their
neighbours'. A dungeon's second floor goes in the same area, 11 rows further
south (see [Global regions](#global-regions); `room('A-1', 1)`), so its stairs
are warps inside one area: they blink without a card. Hedge Burrow and the tunnel in
`areas/test-borders.js` are working examples of a house placed by tile and a
warp inside one area. Check an area with
`node scripts/playtest.mjs --scenario screens`, which photographs every screen
and room.

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
| `teleport(target, x, z, { yaw })` | `'crypt'` (its start screen, else its first), `'crypt:0,1'`, `{ area, screen: [0, 1] }`, a screen name (`'Key Vault'`), or M1 global screen numbers `[1, 0]` / `'1,0'` (read on the old 16 x 11 lattice); x, z local tiles (default the middle, or the free tile nearest it: never inside a chest or on a warp). Returns `{ area, screen, key, name }` |
| `screen()` | the current screen object (live): `key`, `area`, `lx`, `ly`, `w`, `h`, `x0`, `z0`, `x1`, `z1`, `tiles`, ... |
| `give(id, amount = 1)` | grant anything: `'key'`, `'gems'`, `'heart-container'`, an item id, an ammo id |
| `setHp(n)` | set health (clamped to max); `0` or less kills the hero through the normal death path |
| `spawn(type, x, z, opts)` | add an entity at local tile coordinates |
| `setMode(name)`, `newGame()` | switch modes, reset to a new game on the title |
| `save()`, `load(data)` | in-memory save data round trip |
| `saveToSlot(n)`, `loadFromSlot(n)` | localStorage slots |
| `showDialog(lines, opts)`, `dialogOpen()`, `overlayVisible()` | UI |
| `camera.presets`, `camera.choices()`, `camera.choose(name)`, `camera.set(name)`, `camera.get()`, `camera.lens()`, `camera.target`, `camera.object` | camera presets and the player's choices (A-D; `choose` is the player's setting, saved, and refuses other presets; `set` lasts until the next screen), the lens in use (a fitted `interior`, or a blend mid-slide), the subject point, the three.js camera |
| `camera.expected()`, `camera.project(x, y, z)`, `camera.groundAt(nx, ny)`, `camera.heroInFrame()`, `camera.rules` | where the framing rule wants the subject now; world point to normalised device coordinates `[x, y, depth]`; a device point to the ground it shows (or null); every vertex of the hero model (sword and contact shadow left out) in device coordinates: `{ worst, out, total, side }`, worst over 1 when any of him is out of frame; `{ outline(), southReach(preset), southLine(screenKey) }` |
| `transitions` | `SLIDE_TIME`, `SLIDE_STEP`, `ROOM_STEP`, `FADE_OUT`, `FADE_IN`, `AREA_HOLD`, `WARP_FADE`, `WARP_HOLD`, `shown(key)`: is that screen drawn, and `shownRect()`: the world rect `{ x0, z0, x1, z1 }` around the drawn screens |
| `links()` | `edgeReport(world)`: `{ links, mismatches, deadEnds }` between areas |
| `registries.tilesets()`, `.areas()`, `.entities()`, `.items()`, `.grants()` | what is registered |
| `snapshot()` | JSON summary: mode, area, screen (`[i, j]`), key, size (`[w, h]`), screenName, hp, maxHp, gems, keys, keysByGroup, x, z (world), lx, lz (local), cam (`{ preset, x, z }`, local), yaw, invT, attacking, enemies, entities, flags, inventory, overlay, dialog, particles, time |

## Play-test harness

```sh
npm run playtest                                   # build, run the default scenario, shots in playtest-out/
node scripts/playtest.mjs --out <dir>              # screenshots into <dir>
node scripts/playtest.mjs --scenario screens       # gallery of every screen, room and the player's camera presets
SCREENS=crypt,test-burrow node scripts/playtest.mjs --scenario screens   # only those areas' screens
node scripts/playtest.mjs --scenario rooms         # every crypt door both ways, the dungeon camera
node scripts/playtest.mjs --scenario areas         # slides and area-to-area fades in all directions
node scripts/playtest.mjs --scenario camera        # A-D, dungeon, interior at 1280 x 720 and 390 x 844: all of the hero model in frame
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
bot, in local tiles of the current screen whatever its size: `walkTo(x, z)`
(breadth-first path over the screen's tiles, using the real collision test,
avoiding warp tiles), `exit('north' | 'south' | 'east' | 'west')` (walk off
that edge and wait until play resumes on the next screen, after a slide or a
fade), `enter(x, z)` (walk onto a door or stairs and wait until play
resumes past the warp; `{ ok, screen, moved }`), `fight({ maxKills, seconds
})` (approach, face, swing; tops up health at 1 heart so a long fight cannot
end the test), `waitFor(snapshot => bool, { seconds })`. Bot helpers throw on
failure unless given `{ soft: true }`. `scripts/lib/helpers.mjs` has the
scenario helpers more than one scenario needs: `clearFoes(t)` (take the
enemies off the screen) and `pushUntilMoving(t, key)` (hold a key until a
slide or a fade starts).

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
- New flags and state keys get a feature prefix. A flag about one tile is
  `<prefix>:<tx>,<tz>` (save data stores it by place); no other flag may look
  like that.
- Test rooms go in their own area file with a reserved origin, never in
  someone else's map.

### Global regions

Areas share one global grid and must not overlap (startup throws, naming both
screens and the tiles). Screens are 16 tiles wide, so regions are ranges of
screen columns (column c is tiles x `16 c` to `16 c + 15`); rows count in the
area's own screen height, which is why each region has one height. An area
whose screens are not 16 wide is placed by tile with `at`: take the region's
column times 16 and its row times the region's height. Areas that touch are
joined (walking across changes area), so areas that must stay apart need an
empty screen between them. Outdoor areas also get a far band of scenery
around them (up to 16 tiles to the east and west, 19 to the north), which is
not part of any screen: keep anything that is not joined to an outdoor area
(a room, another town) at least two empty screen columns away from it, or
the band shows past a room's walls.

| Columns | Rows | Screens | For |
|---------|------|---------|-----|
| 0-99 | 0-99 | 16 x 11 | The overworld: the 7 x 5 map of areas, laid edge to edge from `[0, 0]`. If every area is W x H screens, area (c, r) of the map sits at `[c * W, r * H]`; areas of other sizes are fine as long as neighbours touch along their shared edge. Today's `overworld` (3 x 2) is at `[0, 0]` (feature 6) |
| 100-199 | 0-99 | 16 x 11 | Towns and other outdoor areas reached by warps: town t at `[100 + 10 t, 0]`, up to 8 x 10 screens, so two empty columns keep towns apart (feature 6) |
| 200-299 | 0-99 | 16 x 12 | Dungeons, 10 columns each, one area per dungeon: dungeon d at `[200 + 10 d, 0]`. Floor f's rooms are local rows `11 f` to `11 f + 9` of that area (the gameplay spec's 8 x 10 canvas, rows A-J, fits; the empty row keeps floors apart), so stairs between floors are warps inside the area, without a card. Rooms of another size (a boss arena, 22 x 16) are areas of their own placed by tile in the dungeon's free columns, with the dungeon's `keyGroup` and `entrance`. Cairn Crypt is dungeon 0 at `[200, 0]` (feature 5 grows it) |
| 300-399 | 0-99 | 16 x 12 | Interiors: houses, shops, the inn, caves. Building k at `[300 + 2 (k % 50), 2 floor(k / 50)]`, one empty screen from the next; a building of several rooms uses neighbouring screens of one area. A building of smaller rooms (10 x 8 to 16 x 12) goes in the same place by tile: `at: [(300 + 2 (k % 50)) * 16, 24 floor(k / 50)]` |
| 400-479 | 0-99 | any, one height per block | Test areas, 10 columns per feature: 400 sword yard (1), 410 overworld enemy field (2), 420 dungeon enemy and boss rooms (3), 430 sub-item range (4), 440 dungeon mechanics (5), 450 overworld and town (6), 460 UI (7), 470 world and camera (`test-borders.js` uses 470-472, and Hedge Burrow, 12 x 9, sits at column 476 by tile) |
| 480-499 | 0-99 | any | Look and kit test areas (the look-kits branch: 488 Kit Lineup, 492 Kit Field, 496 Kit Room) |

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

- `player.yaw` is not wrapped to 0..2π; compare angles with `lerpAngle` or
  an angle difference, not with `===`.
- The screen-name banner times out in real time (a CSS animation and a
  timer), so in slow headless runs it can appear in several screenshots.

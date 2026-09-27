# Voxel Heroes architecture

> **M2 contracts:** [CONTRACTS.md](CONTRACTS.md) fixes what the seven M2 streams
> share: file owners, units, state fields, events, input actions and keys, the
> APIs and the reserved regions of the global grid. Where this file differs
> from it (the feature table and screen origins under "Working in parallel
> (M2)", the example key for the map, M as mute), CONTRACTS.md wins.

This is the map of the code after the M1 foundation work, and the rulebook
for adding to it. The short version:

- **Content registers itself.** Tiles, areas, entities, items, HUD widgets and
  UI screens each live in their own file inside an auto-loaded folder
  (`src/content.js`). Adding one means adding a file. Nothing else imports it.
- **Features talk through registries and events**, not through each other's
  modules. A bomb emits `'explosion'`; a cracked wall's `onBomb` tile hook and
  an enemy's `onBomb` method react. Neither knows the other exists.
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
[Changes from the prototype](#changes-from-the-prototype) ·
[Known quirks](#known-quirks-kept-from-the-prototype)

## Module map

```
index.html              HUD regions, overlay panel, touch controls (markup only)
src/
  main.js               bootstrap: mount, build the world, start the loop (small, rarely edited)
  content.js            eager import.meta.glob of every content folder below
  style.css             base page, HUD, overlay and touch styles
  core/                 engine pieces with no game content
    constants.js        SCREEN_W 16, SCREEN_H 11, R 8 (terrain voxels per tile), TV, GROUND_Y, DEG
    renderer.js         WebGL renderer, scene, lights; LIGHTING presets + registerLighting
    camera.js           CAMERA_PRESETS (pitch/fov/pad/zoom) + registerCameraPreset, playerCameraPresets, slide tween
    input.js            actions (sword, item, menu, confirm, ...): held / pressed / released / carry, touch
    loop.js             requestAnimationFrame loop; setManual() for tests
    events.js           on / once / off / emit bus
    state.js            the state object, defineState / registerSaveField, serialize / load (versioned, all or nothing)
    modes.js            mode stack: registerMode, setMode, pushMode, popMode; presses carried between modes
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
    areas.js            AREA REGISTRY: registerArea, getArea, START
    areas/overworld.js  the six overworld screens
    areas/crypt.js      the four crypt rooms
    world.js            builds every screen, collision, props, tile hooks, setTile, terrain LAYERS
    grid.js             screen/tile coordinate helpers
  entities/
    registry.js         ENTITY REGISTRY: registerEntity, createEntity
    manager.js          live entity list: spawn, removeEntity, updateEntities, entitiesNear
    entity.js           Entity base class (the contract every entity follows)
    npc.js              Npc base: solid, idles, faces the hero, talk() -> showDialog
    enemy.js            Enemy base: pop-in, knockback, stun, flash, contact damage, death burst, loot
    pickup.js           Pickup base: bounce, spin, blink, collect
    player.js           the hero (one instance, `player`)
    enemies/            slime.js, spitter.js
    npcs/               npc.js (the generic 'npc': a townsperson with lines from the spawn table)
    projectiles/        rock-shot.js
    pickups/            heart.js, gem.js (gem, gem5), key.js
  models/               voxel models built in code: hero (+ sword, palettes for townsfolk), slime, spitter, rock, pickups, props
    part.js, cache.js   model helpers: meshed parts with pivots, build-once geometry cache
  systems/
    sword.js            SWORD stats (data), swing, blade pose, blade hit tests; setSwordStats
    combat.js           hurtPlayer, shield, enemiesLeft, room-cleared
    drops.js            DROP_TABLES + addDrop / registerDropTable / rollDrop
    grants.js           GRANT REGISTRY: grant('heart-container'), registerGrant
    keys.js             small keys per dungeon (keyGroup)
    interact.js         A talks before it swings (onInteract on entities and tiles)
    physics.js          moveBody: circle vs solid tiles, solid entities, screen bounds
    blast.js            'explosion' -> onBomb(explosion) on every entity it covers
    particles.js        voxel bursts (instanced cubes)
    spawner.js          map markers -> entities on screen entry
    transitions.js      edge slide, warps, entering a screen; chooseCameraPreset
    flow.js             'play' mode + registerPlayHook, start / pause / respawn, new game, load, save slots, teleport
  items/
    registry.js         ITEM REGISTRY for B-button sub-items (empty in M1)
    inventory.js        owned items, ammo, selection, useSelectedItem; saved state
  ui/
    dom.js, banner.js, overlay.js   helpers, the big screen-name banner, the centred panel + fade
    hud.js              HUD WIDGET REGISTRY (regions, order) + hearts, area name, gems, keys
    hud/item-slot.js    B item slot (hidden while the inventory is empty)
    dialog.js           showDialog(lines, opts) -> Promise, 'dialog' mode
    screens/            title.js, pause.js ('paused'), gameover.js ('dead')
  debug/testhook.js     window.__voxelHeroes
scripts/
  build-artifact.mjs    dist/ -> one self-contained HTML page
  playtest.mjs          play-test library + CLI
  lib/bot.js            in-page bot (async): walkTo, exit, fight, waitFor
  scenarios/            default.mjs (the M1 play-through), screens.mjs (screenshot gallery),
                        contracts.mjs (every extension point and review fix, one check each)
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
screens), camera placement, `input.endFrame()`. Rendering then refreshes the
HUD widgets and draws the scene. The loop clamps `dt` to 1/30 s. In manual mode
the loop keeps rendering but only tests advance the simulation.

**Modes** (`core/modes.js`) decide what a frame does. `state.mode` is the top
of a stack.

| Mode | Registered in | What it does |
|------|---------------|--------------|
| `title` | ui/screens/title.js | hero idles behind the title panel; confirm starts |
| `play` | systems/flow.js | Start pauses; play hooks, hero, items and entities update |
| `scroll` | systems/transitions.js | the 0.85 s slide to the next screen |
| `warp` | systems/transitions.js | fade out, move, fade in (doors, stairs) |
| `paused` | ui/screens/pause.js | pushed over play; Start or the button resumes |
| `dialog` | ui/dialog.js | pushed while a dialog box is open |
| `dead` | ui/screens/gameover.js | hero tips over; then the game-over panel |

`setMode(name)` replaces the whole stack: every mode on it gets `exit` with
`suspended: false`, top first, so a dialog or menu under the top closes too.
`pushMode(name)` suspends the current mode and `popMode()` resumes it. Every
switch calls `exit` on the old mode and `enter` on the new one, clears latched
button presses (so one press never acts twice) and emits `'mode-change'`. A
mode can list actions in `carry`: a press made while it runs is pressed again
on the first tick after it ends. `scroll` and `warp` carry A and B, so a swing
pressed during a slide or a warp comes out on arrival, as in the prototype.

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
end of the tick) are enough for charge attacks. `input.consume(a)` marks a
press as handled so later code in the tick ignores it (a play hook that uses A
to throw a carried pot), and `input.carry(a)` presses it again on the next
tick. `input.bind(action, codes)` adds or rebinds an action from a feature's
own file.

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
  blocksShots: true,             // default: same as solid; false marks a low tile (water, pits)
  build(ctx) {},                 // voxels baked into the screen mesh
  prop(ctx) { return object3d },  // separate object on the tile (ctx.cx, ctx.cz = centre)
  regrow: false,                 // restored every time its screen is entered (bushes)
  becomes: '.',                  // what it turns into when destroyed or opened
  onEnter(ctx) {}, onLeave(ctx) {},  // hero's centre moves onto / off the tile
  onPush(ctx) {},                // hero walks into it (every frame; ctx.player, ctx.dt)
  onSword(ctx) {},               // a blade sample lands on it (ctx.hit, ctx.player, ctx.px, ctx.pz)
  onBomb(ctx) {},                // an 'explosion' event covers it (ctx.explosion)
  onLight(ctx) {},               // a 'light' event covers it (ctx.light)
  onShot(ctx) {},                // a projectile stops on it (ctx.projectile, ctx.hit)
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

**Low tiles.** A solid tile with `blocksShots: false` (water, pits, lava) is
low: shots fly over it, and so do bodies with `flying = true` (bats, ghosts).
A flying enemy therefore needs no edits to the tiles it crosses.

**Shots.** A projectile that stops on a tile calls
`world.trigger(tx, tz, 'onShot', { projectile, hit })` before it breaks
(`rock-shot.js` does), so a crystal switch or a target reacts to arrows,
thrown blades and enemy rocks through one hook. `hit` is
`{ damage, fromX, fromZ, source }`.

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
    '1,1': {
      name: 'Pillar Hall', rows: [/* ... */],
      spawnsAt: { '5,4': { type: 'npc', name: 'Old Wren', lines: ['Mind the pillars.'] } },
      warps: { '8,1': { area: 'town', screen: [0, 0], x: 8, z: 9 } },  // by position
    },
  },
});
```

`spawns` maps a marker character to an entity type (a string, or an object
whose extra fields go to the entity factory; `tile` sets the tile left under
it, `once: true` means it never returns after `markDone()`). A marker
character must not also be a tile of the screen's tileset, inherited tiles
included: startup throws, because the marker would hide that tile everywhere
in the area. Markers spawn each time the screen is entered, staggered for
enemies. A marker naming an entity type that is not registered is skipped
with a console warning, so a map can name a type another branch provides.
`spawnsAt: { 'x,z': type | spec }` on a screen places a spawn by position and
keeps the map tile (unless the spec sets `tile`), so each villager can have
its own lines without a marker character of its own.

`warps` maps a tile character to a destination; tiles with
`onEnter: enterWarp` use it. A screen's `warps` can also key a destination by
position (`'8,1'`), which wins over the character, so one screen can hold a
shop door, an inn door and a house door made of the same tile. Screens can
override `lighting`, `camera`, `tileset`, `spawns`, `warps`, and add
`spawnsAt` and `onEnter(screen)`. The world validates every tile character
and warp at startup. A warp into an area that is not registered (another
branch adds it) only warns once and does nothing until that area exists.

### Entities: `src/entities/registry.js`

`registerEntity('bat', (opts) => new Bat(opts))`. `opts` holds `x, z` (world
position), `spawnIndex`, `spawnFlag`, `screen` and the spawn table's extra
fields. The `Entity` contract (`entities/entity.js`): `x, z, r, yaw, kind`
(`'enemy' | 'projectile' | 'pickup' | 'npc' | ...`), `priority` (update order:
enemies 0, projectiles 10, pickups 20, others 30), `object` (added to and
removed from the scene for you), `screenScoped` (removed when the screen is
left, default true), `solid` (blocks the hero and every body moved with
`moveBody`, like a wall: NPCs, push blocks; default false, so enemies, pickups
and shots overlap freely; a solid body that moves is also stopped by the
hero), `flying` (passes over low tiles, default false), `swordable` +
`canBeHit(hit)` + `onSword(hit)`, `hurt(hit)`, optional `onBomb(explosion)`
(an explosion covers it, see `systems/blast.js`), optional
`onInteract(player)` and `interactRange`, `update(dt)`, `remove()`,
`markDone()`.

`Enemy` (`entities/enemy.js`) takes stats `{ hp, r, speed, colors, geometry,
contactDamage, drops }` and calls `think(dt, { toP, dist, bounds })` when not
stunned. `countsForClear = false` leaves an enemy out of room-cleared checks,
`flying = true` lets it cross water and pits. Its default `onBomb` takes
`explosion.damage` (default 2) through `canBeHit` and `hurt`; override it for
bomb-proof enemies. Knockback decays per second, so it pushes as far at 144 Hz
as at 60 Hz. `Pickup` (`entities/pickup.js`) takes a geometry and calls
`collect()`.

`Npc` (`entities/npc.js`) is the base for people and talking things: solid
(radius 0.34), idles on the spot, turns to face the hero when he presses A
facing it, then calls `talk(player)`, which says `lines` with `name` as the
speaker. Subclass it and override `talk()` for shops and quests (see
[(g) An NPC](#g-an-npc)). The generic `'npc'` type (`entities/npcs/npc.js`)
is a townsperson on the hero's rig, configured from the spawn table:
`{ type: 'npc', name, lines, palette, yaw }`. `makeHero(material, palette)`
dresses the rig in other colours; `blade: null` and `shield: null` leave the
sword and the shield out.

`spawn(type, opts)`, `entitiesNear(x, z, radius, filter)`, `entitiesOfKind(kind)`
come from `entities/manager.js`; removal is deferred, so removing anything at
any time is safe.

### Items: `src/items/registry.js`

```js
registerItem({
  id: 'bombs', name: 'Bombs', icon: '<svg ...>', order: 20,
  ammo: 'bombs', startAmmo: 5,
  maxAmmo: 10,        // or (state) => number, for bag upgrades
  use(ctx) {},        // B pressed; return true if it was used
  update(dt, ctx) {}, // optional, every play frame while owned
  passive: false,     // true: owned but never on B
});
```

`ctx` is `{ item, player, state, world, spawn, ammo(), useAmmo(n) }`. The
inventory (`items/inventory.js`, saved as `state.inventory`) owns the rest:
`giveItem`, `hasItem`, `addAmmo`, `useAmmo`, `selectItem`, `cycleItem` (E/Q),
`selectableItems`. The HUD B slot and touch B button appear once a
selectable item is owned. The item is used on B unless the sword is
mid-swing.

`grant(id, n)` works for every item id and ammo counter: `grant('bow')` gives
the bow with its `startAmmo`, `grant('arrows', 10)` adds ammo up to the
capacity. When an item's id is also its ammo counter (`bombs`), the first
grant gives the item and later ones add `n` ammo, so chests, shops, refills
and ammo pickups can all say `grant('bombs', 5)`. Capacity is the largest
`maxAmmo` among the items using a counter; make it a function to upgrade it
from a save field: `defineState('bombBag', () => 1)` plus
`maxAmmo: (s) => 10 * s.bombBag`.

### Modes: `src/core/modes.js`

`registerMode(name, { enter({ from, resumed }), update(dt), exit({ to, suspended }), carry })`.
UI screens are modes in `src/ui/screens/`. `exit` with `suspended: false`
means the mode is gone for good (popped, or unwound by `setMode`): hide its
DOM and settle anything that waits on it there. `carry` is an optional list
of actions (see [Frame, modes and coordinates](#frame-modes-and-coordinates)).

### Play hooks: `src/systems/flow.js`

```js
registerPlayHook({ id: 'map', phase: 'input', update() { if (input.pressed('map')) pushMode('map'); } });
registerPlayHook({ id: 'lift', phase: 'input', order: 10, update(dt) {
  if (carrying && input.pressed('sword')) { throwPot(); input.consume('sword'); }
} });
registerPlayHook({ id: 'boss-music', update(dt) {} });   // phase 'after' is the default
```

Every `play` tick runs the Start check (pause), the `'input'` hooks, the hero,
the owned items, the entities and then the `'after'` hooks. `'input'` hooks
see the tick's presses before the hero does: they may `input.consume()` one
so the hero never sees it, or change the mode (`pushMode`), which ends the
tick. `'after'` hooks see where everything moved. Within a phase a lower
`order` (default 50) runs first, then by id. Hooks run only in play, so they
stop while paused, in dialogs and during slides. Use a hook instead of
editing `flow.js` or `player.js` for hotkeys, lifting and throwing, or
anything else that must act every play tick whether or not an item is owned.

### HUD widgets: `src/ui/hud.js`

```js
registerHudWidget({
  id: 'bombs',
  region: 'right',                 // 'left' | 'center' | 'right' (default 'right')
  order: 25,                       // place in the region, low first (default 50)
  mount({ host }) { host.append(el('span', { class: 'hud-bombs' })); },
  key: (state) => String(...),     // redraw only when this string changes
  render(state) {},
});
```

Each widget gets its own `host` element in its region, placed by `order` and
then by id, so the HUD reads the same whatever order the files load in. A
widget only fills its host and never prepends or appends into a region
itself. Hosts are `display: contents`, so the widget's elements line up in the
region's row. `mount` also gets `{ region, hud }`. Orders in use: left: hearts
10; center: area name 10; right: B item slot 20, gems 30, keys 40 (the Sound
button stays last). Widgets are redrawn from state every rendered frame when
their key changes, so game code never calls "update HUD".

### Grants: `src/systems/grants.js`

`registerGrant(id, (amount, ctx) => {...})`; `grant(id, amount)` or
`grant({ grant: 'gems', amount: 20 })`. Chests, shops, NPCs and the test hook's
`give()` all go through it. Built in: `gems`, `gem`, `heart`, `key`,
`heart-container`, plus every item and ammo id. Unknown ids warn and return
false.

### Drop tables: `src/systems/drops.js`

`DROP_TABLES.enemy` / `.bush` are lists of `{ chance, type, when }` tried
against one roll (`type` may be a function). An entry whose `when` fails is
left out of that roll: its share becomes "no drop" and the entries after it
keep their windows, so each entry's odds are its own `chance` whatever order
features add entries in. `addDrop('enemy', { chance: 0.1, type: 'arrows', when: () => hasItem('bow') })`,
`registerDropTable(name, entries)`, `rollDrop(table, x, z)`. Enemies name their
table with the `drops` stat. The core tables keep the prototype's odds with a
`type: () => (hurt ? 'heart' : gem)` entry.

### Save fields: `src/core/state.js`

```js
defineState('bombBag', () => 1);                              // saved, reset on new game
defineState('seen', () => new Set(), { toJSON: (s) => [...s], fromJSON: (a) => new Set(a) });
defineState('bossPhase', () => 0, { persist: false });        // runtime only
registerSaveField('pos', { save, load, reset, decode });      // data kept outside `state`
```

`serializeState()` returns `{ version, fields }` (plain JSON). `loadState(data)`
restores every registered field and resets fields the data lacks, so older
saves keep loading when fields are added. Loading is all or nothing: every
field is decoded first (`fromJSON` / `decode`, which may throw on damaged
data) and only then applied (`load` must not throw), so a bad save throws
before the running game changes. Data from a newer `SAVE_VERSION` is
rejected; older data is upgraded by `SAVE_MIGRATIONS[v]` (data of version v
-> data of version v + 1) first.

Core fields: `hp`, `maxHp`, `gems`, `keys` (per key group), `flags` (a Set of
strings), `tileEdits`, `inventory`, `respawn` (an inn sets it), `pos`.
`state.settings` (camera choice) is a preference, not part of a save. Slots:
`saveToSlot(n)`, `loadFromSlot(n)`, `activeSlot()` in `systems/flow.js` on top
of `core/save.js` (`writeSlot`, `readSlot`, `listSlots`, `deleteSlot`).
`loadFromSlot(n)` returns false for an empty, damaged or newer slot and
leaves the game and `activeSlot()` as they were.

Flag names in use: `taken:tx,tz` (once-spawns), `door:tx,tz`,
`chest:tx,tz`. Prefix new ones by feature (`boss:crypt`, `talked:smith`).

### Presets and small tables

| What | Where | Add from your own file |
|------|-------|------------------------|
| Lighting | `core/renderer.js` `LIGHTING` | `registerLighting('cave', { background, sky, ground, hemi, sunColor, sun })` |
| Camera | `core/camera.js` `CAMERA_PRESETS` (A default, B, C, D, dungeon) | `registerCameraPreset('boss', { pitch, fov, padX, padZ, zoom, distance })` for an area or room (not a player choice unless `selectable: true`); `playerCameraPresets()` lists the choices (A-D) for an options menu; `chooseCameraPreset(name)` sets one and rejects the rest |
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
| `explosion` | `{ x, z, radius, damage?, source }` | bombs: calls `onBomb` on covered tiles and entities |
| `light` | `{ x, z, radius, source }` | reserved for the lantern / fire: calls `onLight` |

Emit `explosion` and `light` in world coordinates; the world turns them into
tile hooks, and `systems/blast.js` calls `onBomb(explosion)` on every entity
within `radius` except `source` (enemies take `damage`, default 2; a pot or a
boss part defines its own). The hero is not included: a blast that should
hurt him checks the distance itself (`hurtPlayer`).

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
the rows; the marker must not be a tile character of that tileset), with
`spawnsAt: { '8,5': 'bat' }` on a screen, or try it at once with
`__voxelHeroes.spawn('bat', 8, 5)`. A bat that crosses water and pits sets
`this.flying = true` in its constructor. Bombs already hurt it (Enemy's
default `onBomb`).
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
this.remove();
emit('explosion', { x: this.x, z: this.z, radius: 1.5, damage: 2, source: this });
// covered tiles get onBomb (cracked walls), covered entities get onBomb (enemies, pots)
```

Give it with a chest (`chest: 'bombs'`), a shop, or `__voxelHeroes.give('bombs')`.
More ammo: `grant('bombs', 5)` or an ammo pickup plus `addDrop(...)`. A
bigger bag: `maxAmmo: (s) => 10 * s.bombBag` with a `bombBag` save field. An
arrow that stops on a tile calls its `onShot` hook:
`world.trigger(tx, tz, 'onShot', { projectile: this, hit })`.

### (d) An area

`src/world/areas/<id>.js` with `registerArea({...})` (see
[Areas](#areas-srcworldareasjs)), an `origin` from the
[origin table](#screen-origins), and a way in: a warp tile in another area
(`warps: { D: { area: 'your-id', screen: [0, 0], x: 8, z: 9, yaw: Math.PI } }`),
or a screen that borders another area's screen on the global grid (walking off
the edge slides into it). A door can point at an area another branch is still
building: the warp warns at startup and does nothing until the area exists.
New tiles go in `src/world/tiles/`. If the area needs its own tileset,
`defineTileset('cave', { parent: 'dungeon' })`. For lighting or a fixed
camera, register presets and name them in the area. Check it with
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

Open it with `pushMode('map')`, from a key bound in the same file and a play
hook, so `flow.js` stays untouched:

```js
// also in map.js: pushMode from core/modes.js, registerPlayHook from systems/flow.js
input.bind('map', ['KeyG']);
registerPlayHook({ id: 'map', phase: 'input', update() { if (input.pressed('map')) pushMode('map'); } });
```

Put its CSS in a file next to it and import it; do not grow `style.css`. The
pause screen is the `'paused'` mode in `ui/screens/pause.js` (play pushes it
on Start), the title is `'title'`, game over is `'dead'`: replacing those
files is how the UI feature reworks them.
Use `showDialog(lines, { speaker, choices })` for talk and yes/no questions;
it returns a promise, and the code after `await showDialog(...)` runs between
two ticks. If the mode is replaced while a box is open (teleport, load, new
game, the title's start button), the box closes and every open or waiting
dialog resolves with `undefined`: compare answers (`choice === 0`) instead of
testing them for falsiness. The overlay's button does nothing while a dialog
box is open over the panel.

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
ones. Bump `SAVE_VERSION` and add `SAVE_MIGRATIONS[oldVersion] = (data) => newData`
only for a change `loadState` cannot absorb, such as renaming or reshaping a
field; new fields need neither. A `fromJSON` (or `decode`) that meets data it
cannot use should throw: the whole load is then rejected and the running game
stays as it was.

### (g) An NPC

A plain villager needs no code, only a spawn on a town screen:
`spawnsAt: { '5,4': { type: 'npc', name: 'Old Wren', lines: ['The smith lives up the hill.'] } }`
(optional: `palette`, `yaw`). Someone with behaviour subclasses `Npc`, in
`src/entities/npcs/smith.js`:

```js
import { voxelMaterial } from '../../core/voxel.js';
import { state } from '../../core/state.js';
import { makeHero } from '../../models/hero.js';
import { grant } from '../../systems/grants.js';
import { showDialog } from '../../ui/dialog.js';
import { Npc } from '../npc.js';
import { registerEntity } from '../registry.js';

const SMITH = { tunic: 0x6b4a2e, tunicLight: 0x8a6440, cap: 0x3a3a44, blade: null, shield: null };

class Smith extends Npc {
  constructor(opts) {
    super(opts, { model: makeHero(voxelMaterial, SMITH).root, name: 'Brannoc' });
  }
  async talk() {
    const choice = await showDialog('Lengthen your blade for 30 gems?', { speaker: this.name, choices: ['Yes', 'No'] });
    if (choice !== 0) return;
    if (state.gems < 30) return showDialog('Come back with more gems.', { speaker: this.name });
    if (!grant('sword-length')) return; // a grant the sword feature registers
    state.gems -= 30;
    await showDialog('There. Mind the reach.', { speaker: this.name });
  }
}

registerEntity('smith', (opts) => new Smith(opts));
```

Place it with `spawnsAt: { '6,3': 'smith' }`. It is solid, so the hero and
enemies walk around it and the bot plans around it. Test the conversation
with `t.tap('sword')` facing it, then `t.step()` and `t.tap('confirm')`; the
code after each `await` runs between the stepped ticks.

## Test hook

`window.__voxelHeroes` (`src/debug/testhook.js`, `version: 2`). URL
parameters: `?manual=1` starts in manual mode, `?seed=N` seeds gameplay
randomness.

| Member | Use |
|--------|-----|
| `state`, `player`, `world`, `input`, `entities` | live objects (`entities` is the live list) |
| `events` | `{ on, once, off, emit }` |
| `update(dt = 1/60)` | one bare simulation tick (what the loop calls); promise continuations wait until the calling script returns |
| `tick(dt = 1/60)` | async: one tick, then lets promise continuations run (code after `await showDialog(...)`), as between two frames |
| `step(seconds, dt = 1/60)` | async: many `tick()`s; resolves to how many ran |
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
| `saveToSlot(n)`, `loadFromSlot(n)`, `activeSlot()` | localStorage slots (`loadFromSlot` is false for an empty, damaged or newer slot) |
| `showDialog(lines, opts)`, `dialogOpen()`, `overlayVisible()` | UI |
| `camera.presets`, `camera.playerPresets()`, `camera.choose(name)`, `camera.set(name)`, `camera.get()`, `camera.target` | camera presets (`playerPresets()` are the player's choices, A-D; `choose` sets the player's setting and takes only those, `set` takes any preset until the next screen) |
| `registries.tilesets()`, `.areas()`, `.entities()`, `.items()`, `.grants()` | what is registered |
| `api` | registration functions and small APIs, so a test can add content at run time without a build: `registerTile`, `registerMode`, `pushMode`, `popMode`, `registerItem`, `registerEntity`, `registerGrant`, `registerPlayHook`, `registerHudWidget`, `registerCameraPreset`, `registerDropTable`, `addDrop`, `rollDrop`, `ammo`, `maxAmmo`, `hasItem`, `World` (the class, for map checks on a throwaway world) |
| `snapshot()` | JSON summary: mode, area, screen, screenName, hp, maxHp, gems, keys, keysByGroup, x, z, lx, lz, yaw, invT, attacking, enemies, entities, flags, inventory, overlay, dialog, particles, time |

## Play-test harness

```sh
npm run playtest                                   # build, run the default scenario, shots in playtest-out/
node scripts/playtest.mjs --out <dir>              # screenshots into <dir>
node scripts/playtest.mjs --scenario screens       # gallery of every screen and camera preset
node scripts/playtest.mjs --scenario contracts     # every extension point and review fix, one check each
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
The bot never plans through a tile that holds a solid entity (an NPC). In the
page the bot is `window.__vhBot`; its helpers are async and step with
`__voxelHeroes.tick()`.

Gotchas: HUD widgets redraw when a frame renders, so call
`__voxelHeroes.render()` before reading HUD elements (`shot()` does). B is
ignored while the sword is mid-swing, and the hero blinks for a second after
starting or getting up, so step past it before a screenshot that should show
him. Inside `t.eval`, step with `await __voxelHeroes.step()` or `tick()`, not
a loop of `update()`: code after `await showDialog(...)` (a shop's follow-up,
a grant after a choice) only runs between ticks, as it does between two
frames in real play. `tick()` gives them eight microtask turns, enough for
code several awaits deep.

## Working in parallel (M2)

Each M2 feature should mostly add files. The table lists what each one owns
and the shared files it may have to touch; anything else shared is a smell.

| Feature | Adds (new files) | Owns (may rewrite) | Shared file it may need |
|---------|------------------|--------------------|-------------------------|
| 1 Sword system | sword data and levels, charge + spin, giant blade at full health, blacksmith NPC (`entities/npcs/blacksmith.js`, an `Npc` subclass) | `systems/sword.js`, the sword in `models/hero.js` | `entities/player.js`, only if the swing flow itself must change (try a play hook first) |
| 2 Overworld enemies | `entities/enemies/*.js`, `models/*.js` (fliers set `flying`), a test field area, loot via `addDrop` | | none |
| 3 Dungeon enemies + boss | enemies, the boss and its phases, a boss test room | | none |
| 4 Sub-items | `items/*.js`, arrow / bomb / blade entities (bombs emit `explosion`; shots call the tile's `onShot`), ammo pickups, HUD widgets | `items/`, `ui/hud/item-slot.*` | none |
| 5 Dungeon mechanics | tiles in `world/tiles/*.js` (big key door, shutters, push blocks, switches, cracked walls, torches, pits, pots), solid entities with `onBomb` where a tile will not do, map and compass grants and HUD widgets, the full dungeon | `areas/crypt.js`, `world/tiles/dungeon.js`, `world/tilekit.js` | `entities/player.js` for falling (lifting and throwing can be a play hook) |
| 6 Overworld + town | overworld screens, town tileset, NPCs (`'npc'` via `spawnsAt`, or `Npc` subclasses), shop, inn (`saveToSlot`, `state.respawn`), caves, doors keyed by position | `areas/overworld.js`, `world/tiles/overworld.js` | none |
| 7 UI / meta | title, pause + inventory, dungeon map (opened from a play hook), save slots, game over / continue, camera options from `playerCameraPresets()` | `ui/screens/*`, the overlay in `index.html`, `style.css` | `core/save.js` |

Rules that keep merges clean:

- Register instead of editing lists: `registerTile`, `registerEntity`,
  `registerItem`, `registerHudWidget`, `registerMode`, `registerPlayHook`,
  `registerGrant`, `addDrop`, `registerSfx`, `registerLighting`,
  `registerCameraPreset`, `defineState`, `input.bind`. Never edit
  `content.js`, `main.js`, `systems/flow.js` or another feature's registry
  file to add content. Registries sort by `order` and id where order shows
  (HUD widgets, play hooks), so load order never matters.
- Talk to other features through events and ids. A town map can place a
  `blacksmith` marker before the sword branch registers that entity: the
  marker is skipped with a warning until it exists. Chest contents that name
  an item from another branch warn until merged, and so does a warp into an
  area another branch adds.
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

## Changes from the prototype

M1 kept gameplay the same as the prototype except for these deliberate
changes:

- **Buttons.** K and X are the B (item) button and do nothing until an item
  is owned; the prototype swung the sword on them. The sword (A) is Space, J
  or Z. Enter and Escape pause as well as P (Start). The title and pause
  panels list these keys.
- **Presses stay in their mode.** Changing mode clears button presses, so
  Space closing a dialog or a panel never also swings, and a press while
  paused no longer swings on resume. A and B pressed during a screen slide
  or a warp still carry over and act on arrival, as in the prototype.
- **M (mute)** also works on the title and game-over screens.
- **Slide landing.** When the usual landing spot (1.1 tiles into the next
  screen) is solid, the hero walks further in, up to 3.1 tiles, so a map
  can never trap him. The Mirror Lake bush that trapped him when he came up
  the west half of the south lane (bottom row, column 7; a prototype bug)
  moved to column 4.
- **Knockback** decays per second instead of per frame. It pushes as far as
  the prototype at 60 Hz, and now the same at 30, 120 or 144 Hz.
- **Phones.** The title and pause panel fits a 390 px wide screen (it was
  20 px too wide), and the single-file build keeps the viewport meta tag, so
  a phone lays it out at device width.
- **HUD markup.** Hearts, the area name and the right-hand group sit in
  three region elements (`#hud-left`, `#hud-center`, `#hud-right`). It looks
  the same.

## Known quirks kept from the prototype

- Knockback that was active at the moment of death carries over, so the hero
  slides a little after "Try again".
- `player.yaw` is not wrapped to 0..2π; compare angles with `lerpAngle` or
  an angle difference, not with `===`.
- The screen-name banner times out in real time (a CSS animation and a
  timer), so in slow headless runs it can appear in several screenshots.

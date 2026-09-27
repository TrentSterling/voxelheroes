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
[Frame, modes and coordinates](#frame-modes-and-coordinates) · [Look](#look) ·
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
    materials.js        material kinds (terrain, character, fine), glow, water, setSeams (see Look)
    look/               lighting presets, light rigs, post stack, polished floor, quality levels (see Look)
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
purpose (the floor builders in `tiles/dungeon.js` and `ground()` in
`tiles/overworld.js`).

## Frame, modes and coordinates

**One frame** (`main.js`): `state.time += dt`, `world.update` (water, flames),
the mute key, `updateMode(dt)`, particles, `world.flush()` (re-mesh changed
screens), camera placement, `input.endFrame()`. Rendering then refreshes the
HUD widgets and draws the scene. The loop clamps `dt` to 1/30 s. In manual mode
only tests advance the simulation, and the loop no longer draws either: tests
call the hook's `render()` (a full look frame takes seconds in software GL).

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

## Look

The look is the art bible's render pipeline (sections 3 to 7, appendix A),
ported from its look lab: lighting presets, light rigs, material kinds, the
post stack, the polished dungeon floor and the quality levels. Content never
builds lights, voxel materials or passes of its own; it asks for them here and
the active preset sets their values.

```
src/core/
  renderer.js           renderer, scene, camera; LIGHTING, registerLighting, applyLighting, makeLampLight
  materials.js          getMaterial(kind), makeCharacterMaterial, makeGlowMaterial, makeWaterMaterial, setSeams
  voxel.js              old mesher: writes faceUv and baked voxel AO (vox.js meshVoxels does the same)
  look/
    index.js            createLook: presets, quality levels, frame-time watchdog, the per-frame driver, info()
    presets.js          LOOK_DAY, LOOK_CRYPT, DOF_PRESETS, QUALITY_LEVELS, mergeLook
    lights.js           LightRig (hemisphere fill, key light + shadow box, lamp culling), wall lamps
    environment.js      gradient reflection environment (PMREM "orb")
    pipeline.js         the post stack
    mirror.js           the polished floor
```

**One drawn frame** (`look.render()`, called by `renderScene()`): apply a
changed `state.settings.look`; place the key light's shadow box (on the hero
in the overworld, on the room centre in dungeons, snapped to shadow-map
texels); switch off point lights outside the room the camera shows; lay the
polished floor over that room when the preset has one; advance the water; put
the depth-of-field focus on the hero's feet; then draw:

| Step | high | medium | low | flat |
|------|------|--------|-----|------|
| scene into a half-float target, 4x MSAA, depth-stencil texture | yes | yes | straight to the canvas | straight to the canvas |
| GTAO (normals rebuilt from depth) | yes | | | |
| depth of field: prepare, 16 px tile-max CoC, dilate, Vogel gather | 96 samples | 32 samples | | |
| bloom (UnrealBloomPass), added | yes | yes | | |
| glare: four 45-degree streaks from the brightest pixels (above 3.2), half resolution | yes | | | |
| grade: ACES filmic at the preset's exposure, saturation, contrast, lift, gain, vignette + edge, dither | yes | yes | ACES only | nothing |
| polished floor (dungeon presets) | yes | yes | | |
| shadow map size cap (day asks 4096, crypt 2048) | 4096 | 4096 | 2048 | 2048 |
| bevel, edge light and seams in the materials | yes | yes | yes | no |

**Lighting presets** are whole looks. Built in: `day` (the bible's measured
overworld, OW_A) and `crypt` (its golden dungeon room, DGN_GOLD). Areas and
screens pick one by name (`lighting: 'crypt'`); `transitions.js` applies it on
screen entry. A preset holds:

| Key | What |
|-----|------|
| `background`, `fog` | clear colour (sky in the overworld, the black void in dungeons); fog is off in both built-ins |
| `lights.hemi` `{ sky, ground, intensity }` | the fill (violet-blue outdoors: shadows stay #203229-ish, never black) |
| `lights.sun` `{ color, intensity, dir, castShadow }` | the key light, `dir` points at the light |
| `lights.shadow` `{ mapSize, extent, follow: 'hero' \| 'subject', offset, bias, normalBias, radius }` | shadow box; `radius` is the PCF softness in texels |
| `lights.lamp` `{ color, intensity, distance, decay, out, drop, fill }` | the wall lamps content places with `makeLampLight()` |
| `env` `{ zenith, horizon, ground, sun, intensity }` | reflection environment; `intensity` scales it for every material |
| `material`, `charMaterial`, `fineMaterial` | the three voxel kinds: `roughness`, `bevel`, `bevelTilt`, `edgeLight`, `grid: { width, dark }` (seams) |
| `water` | colour, opacity, roughness, ripple, glints (`sparkle`, `glintSize`, `glintDensity`, `glintFar`), wave troughs, grazing sheen |
| `ao`, `bloom`, `glare` | post values (bible section 5) |
| `tone.exposure`, `grade` | exposure before ACES; `saturation`, `contrast`, `lift`, `gain`, `vignette`, `rim`, `edge` |
| `reflect`, `reflectBlur`, `reflectTint` | polished floor strength (0 = none), gloss blur, polish colour |
| `arrivalFlash` `{ from, boost, seconds }` | brief over-bright exposure on arriving from one of the `from` looks |

```js
registerLighting('ember-cave', { extends: 'crypt', lights: { hemi: { intensity: 0.9 } }, tone: { exposure: 1.3 }, reflect: 0 });
registerLighting('dusk', { background: 0x303850, sky: 0x8090c0, ground: 0x302830, hemi: 0.8, sunColor: 0xffa060, sun: 1.2 });
```

`registerLighting` deep-merges the partial preset over the one it `extends`
(default `'day'`); arrays and numbers replace. The prototype's flat keys
(`background, sky, ground, hemi, sunColor, sun`) still work.

**Depth of field belongs to the camera**, not the lighting: `DOF_PRESETS`
(`look/presets.js`) is keyed by camera preset name, a camera preset may carry
its own `dof` block, and `fixed` presets fall back to `dungeon`. The focus is
the view depth of the hero's feet plus `focusOffset` (0.9 in camera A, so the
sharp band sits just behind the hero). Nothing blurs within `focusRange`;
the blur ramps to `farMaxBlur` / `nearMaxBlur` px (at 720p) over `farRamp` /
`nearRamp` tiles. A and B are measured; C and D are guesses until someone
fits them.

**Materials** (`core/materials.js`, bible section 6):

- Voxel meshes use `getMaterial('terrain')` (1/8-tile blocks, faint seams),
  `getMaterial('character')` (1/16 voxels: characters, props, pickups, clear
  seams) or `getMaterial('fine')` (floors built at 1/16). The geometry carries
  `position`, `normal`, linear `color` with the voxel AO baked in, and
  `faceUv` (0..1 across each face); both meshers write all four. No per-face
  shading in colours: the lights do that.
- `makeCharacterMaterial()` is an unshared character material for per-entity
  hit flashes; it follows look changes like the shared one.
- `makeGlowMaterial(color, intensity)`: unlit HDR colour for flames, lamp
  fixtures and beams, so bloom and glare catch it. Vertex colours multiply it
  (pass `0xffffff` for a voxel model with its own colours).
- `makeWaterMaterial()`: one flat plane per water surface, 0.35 block
  (0.35 x TV) below the ground surface, `receiveShadow` on, not bobbing: the
  ripples, troughs, glints and sheen are all in the shader.
- `setSeams(on)` switches seam lines everywhere (an options menu).

**Lamps.** `makeLampLight(overrides)` returns a group with the active look's
lamp lights: a short bright pool 0.25 in front of the fixture plus a weak
wide fill lower down. Put it at the fixture with its +z pointing into the
room. Lamps never cast shadows. Every point light in the scene counts: the
rig switches off (layer 0) those more than 2 tiles outside the room the camera
shows, rescanning the scene on screen entry and every 30 frames. The number of
lit lights is part of every lit shader's program, so a room with a new lamp
count compiles once on first entry; keep rooms to a few lamps.

**Polished floor** (`reflect > 0`, the crypt look): an additive, glossy,
tinted planar reflection laid 0.002 above the floor of the room or rooms the
camera shows (both during a slide). Pits, moats and water more than 0.02 below
the floor are masked out through the stencil buffer. `setMirrorRect({ x0, x1,
z0, z1 })` narrows it for the current room until the next screen change. The
room rectangle comes from the 16 x 11 screen grid around the camera subject;
areas with other screen sizes bind a getter: `look.bind({ roomRect })`.

**Choosing the quality**: `?look=high|medium|low|flat` wins, then
`state.settings.look` (a menu writes it; it applies on the next frame), then
the device: a coarse pointer or a window whose longer side is under 900 px
starts at medium, anything else at high. The first two pin the level.
Unpinned, the frame-time watchdog in the real-time loop drops one level when
the median frame time over 3 s is above 24 ms (never below low; 2 s grace
after every change; a hidden tab restarts the timing).
`look.setQuality(level, { pin })` sets it from code.

**Manual mode draws nothing.** The loop only refreshes the HUD; the hook's
`render()` draws one frame and play-test shots call it. Tests reach the look
through `window.__voxelHeroes.look`:

| Member | Use |
|--------|-----|
| `levels`, `set(level, { pin })`, `get()` | quality levels (`set` pins unless `pin: false`) |
| `lighting()`, `presets()`, `applyLighting(name)`, `registerLighting(name, preset)` | lighting presets |
| `dof`, `camera` | DOF presets; the three.js camera (project points to find pixels) |
| `info()` | the last frame: quality, pinned, lighting, path, size, pixelRatio, camera, dof, focusDistance, exposure, mirror, shadowMap, lamps, passes, calls, triangles, targetsMB, cpuMs, watchdog, drops, materials |
| `getMaterial`, `makeWaterMaterial`, `makeGlowMaterial`, `makeLampLight`, `setMirrorRect`, `setSeams`, `materials()` | the material and lamp API, for probes and previews |

`scripts/scenarios/look.mjs` shoots the validation frames (Crossroads under
camera A and B, Mirror Lake water, a crypt room) and checks the quality
levels, the DOF band, the polished floor and the watchdog.

**Frame cost.** Headless Chromium with SwiftShader (software GL on 4 shared
CPUs) at 1280 x 720; only the ratios mean anything. JS is the CPU time of
`look.render()` without the GPU wait.

| Frame | Quality | Frame ms | JS ms | Draw calls | Passes | Targets MB |
|-------|---------|----------|-------|------------|--------|------------|
| Crossroads (day) | high | 3665 | 2.8 | 83 | 37 | 107 |
| | medium | 1849 | 2.3 | 65 | 19 | 73 |
| | low | 1211 | 1.4 | 47 | 1 | 0 |
| | flat | 1109 | 1.0 | 47 | 1 | 0 |
| Crypt room `crypt:0,1`, polished floor | high | 3061 | 4.2 | 94 | 37 | 156 |
| | medium | 1736 | - | 76 | 19 | 123 |
| | low | 769 | - | 37 | 1 | 0 |

The post stack is two thirds of a high frame here, and GTAO, the 96-sample
gather and the glare (what medium leaves out) are half of it. The polished
floor draws the scene a second time, into a full-size 4x MSAA target.

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

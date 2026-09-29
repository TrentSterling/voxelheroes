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
[Frame, modes and coordinates](#frame-modes-and-coordinates) · [Look](#look) ·
[Streaming](#streaming) ·
[Registries](#registries) · [Events](#events) · [How to add things](#how-to-add-things) ·
[Kits and models](#kits-and-models) · [Test hook](#test-hook) · [Play-test harness](#play-test-harness) ·
[Working in parallel (M2)](#working-in-parallel-m2) · [Build rules](#build-rules) ·
[Changes from the prototype](#changes-from-the-prototype) ·
[Known quirks](#known-quirks-kept-from-the-prototype)

## Module map

```
index.html              overlay panel, touch controls (markup only)
src/
  main.js               bootstrap: mount, build the world, start the loop (small, rarely edited)
  content.js            eager import.meta.glob of every content folder below
  style.css             base page, overlay and touch styles
  core/                 engine pieces with no game content
    constants.js        SCREEN_W 16, SCREEN_H 11 (the default screen), R 8 (terrain voxels per tile), TV, GROUND_Y, DEG
    renderer.js         WebGL renderer, scene, lights; LIGHTING presets + registerLighting
    camera.js           CAMERA_PRESETS (pitch/fov/height/lead/fixed/fitWidth; A-D selectable) + registerCameraPreset, playerCameraPresets, HERO_OUTLINE, subjectFor (framing rules: southReach, sideReach), slide tween
    input.js            actions (sword, item, menu, confirm, ...): held / pressed / released / carry, touch
    loop.js             fixed 1/60 s ticks, one render per animation frame; setManual() for tests
    events.js           on / once / off / emit bus
    state.js            the state object, defineState / registerSaveField, serialize / load (versioned, all or nothing)
    modes.js            mode stack: registerMode, setMode, pushMode, popMode; presses carried between modes
    save.js             localStorage slots (writeSlot, readSlot, listSlots), all in try/catch
    audio.js            WebAudio voices; sfx table + registerSfx
    voxel.js            seeded rng, VoxelGrid, face-culled mesher, shared voxel material
    materials.js        material kinds (terrain, character, fine, prop), glow, water, setSeams (see Look)
    look/               lighting presets, light rigs, post stack, polished floor, quality levels (see Look)
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
    areas.js            AREA REGISTRY: registerArea, getArea, START, screen sizes, areaStart, room('J-3') (addressing and rooms: header comment)
    areas/overworld.js  the six overworld screens (16 x 11)
    areas/crypt.js      the four crypt rooms (16 x 12)
    areas/kitroom.js    kit test areas at columns 488-499 (?kitroom=1)
    areas/test-borders.js  three small areas that touch, for the 'areas' scenario
    world.js            builds every screen (terrain.js), startup checks, the screen index (screenAt, locate), spots (resolveSpot, freeSpot), places (placeKey), collision, props, tile hooks, setTile, terrain LAYERS
    grid.js             screen keys and screen-object helpers (screenRect, screenCenter, insideScreen, toLocal, toWorld, DIRS)
    links.js            areaGroups (areas joined by touching screens), edgeReport (links, mismatched edges, dead ends)
    terrain.js          the terrain builder: 1/8 blocks, 1/16 detail, water, margins from neighbours, the far band (see Kits and models)
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
  models/               voxel models at 1/16 tile: hero.js (+ sword), characters.js, pickups.js, props.js, icons.js
    kit.js, palette.js  model cache, PoseMesh, contact shadows; the character palette (see Kits and models)
  systems/
    sword.js            SWORD stats (data), swing, blade pose, blade hit tests; setSwordStats
    combat.js           hurtPlayer, shield, enemiesLeft, room-cleared
    drops.js            DROP_TABLES + addDrop / registerDropTable / rollDrop
    grants.js           GRANT REGISTRY: grant('heart-container'), registerGrant
    keys.js             small keys per dungeon (keyGroup)
    interact.js         A talks before it swings (onInteract on entities and tiles)
    physics.js          moveBody: circle vs solid tiles and solid entities (bumpsEntity) inside a bounds rect; clearDistance
    blast.js            'explosion' -> onBomb(explosion) on every entity it covers
    particles.js        voxel bursts (instanced cubes)
    spawner.js          map markers -> entities on screen entry
    transitions.js      slides, fades into other areas, warps, entering a screen, which screens are drawn; chooseCameraPreset
    flow.js             'play' mode + registerPlayHook, start / pause / respawn, new game, load, save slots, teleport
  items/
    registry.js         ITEM REGISTRY for B-button sub-items (empty in M1)
    inventory.js        owned items, ammo, selection, useSelectedItem; saved state
  ui/
    dom.js, banner.js, overlay.js   helpers, the big screen-name banner, the centred panel + fade
    canvas/             the in-canvas UI: gfx.js (layer, hit regions), font.js (pixel font), sprites.js
    hud.js              HUD WIDGET REGISTRY (regions, order) + hearts, coins, keys, area, clock, buttons
    hud/item-slot.js    B item slot (hidden while the inventory is empty)
    dialog.js           showDialog(lines, opts) -> Promise, 'dialog' mode, drawn in canvas
    screens/            title.js, pause.js ('paused'), gameover.js ('dead')
  debug/testhook.js     window.__voxelHeroes
scripts/
  build-artifact.mjs    dist/ -> one self-contained HTML page
  playtest.mjs          play-test library + CLI
  lib/bot.js            in-page bot (async): walkTo, exit, enter, fight, waitFor
  lib/helpers.mjs       scenario helpers: clearFoes, pushUntilMoving
  scenarios/            default.mjs (the M1 play-through), screens.mjs (gallery), rooms.mjs, areas.mjs, camera.mjs,
                        contracts.mjs (every extension point and review fix, one check each),
                        contracts-m2.mjs (the M2 contracts, probe content only)
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
screens), `syncScreenVisibility()` (hide what is not drawn), camera
placement, `input.endFrame()`. Rendering then refreshes the
HUD widgets and draws the scene. The loop (`core/loop.js`) runs the
simulation in fixed 1/60 s ticks, as many per animation frame as the real
time since the last frame holds (at most 4, so a slow device slows the game
down instead of spiralling), and renders once per frame. In manual mode only
tests advance the simulation, and the loop no longer draws either: tests
call the hook's `render()` (a full look frame takes seconds in software GL).

**Modes** (`core/modes.js`) decide what a frame does. `state.mode` is the top
of a stack.

| Mode | Registered in | What it does |
|------|---------------|--------------|
| `title` | ui/screens/title.js | hero idles behind the title panel; confirm starts |
| `play` | systems/flow.js | Start pauses; play hooks, hero, items and entities update |
| `scroll` | systems/transitions.js | the 0.8 s slide to the next screen or room of the same area |
| `warp` | systems/transitions.js | fade out, move, fade in: warps (doors, stairs) and walking into another area (a load: the loading card's hold) |
| `paused` | ui/screens/pause.js | pushed over play; Start or the button resumes |
| `dialog` | ui/dialog.js | pushed while a dialog box is open |
| `dead` | ui/screens/gameover.js | hero tips over; then the game-over panel (Try again: at the dungeon's `entrance` inside one, else the respawn point) |

`setMode(name)` replaces the whole stack: every mode on it gets `exit` with
`suspended: false`, top first, so a dialog or menu under the top closes too.
`pushMode(name)` suspends the current mode and `popMode()` resumes it. Every
switch calls `exit` on the old mode and `enter` on the new one, clears latched
button presses (so one press never acts twice) and emits `'mode-change'`. A
mode can list actions in `carry`: a press made while it runs is pressed again
on the first tick after it ends. `scroll` and `warp` carry nothing: input is
ignored during slides and warps (gameplay spec 4.3), so A or B pressed on the
way acts neither mid-slide nor on arrival (the prototype, and M1 after its
review, carried them).

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
up. A screen is 16 x 11 tiles outdoors and 16 x 12 in dungeon rooms: each area
sets its size. Every area sits on one global grid of tiles, its screens on a
lattice of its own screen size placed by its `origin` or `at` (see
[Areas](#areas-srcworldareasjs)); `world.locate(tx, tz)` and
`world.screenAt(x, z)` find the screen under a tile or point, so never divide
by 16 or 11. Map rows and spots are local to their screen. `yaw` 0 faces +z
(towards the camera); use `Math.atan2(dx, dz)`. Health is counted in
half-hearts (`START_HP` 6 = three hearts). Terrain voxels are 1/8 of a tile,
character voxels 1/16.

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
| `material`, `charMaterial`, `fineMaterial`, `propMaterial` | the voxel kinds: `roughness`, `bevel`, `bevelTilt`, `edgeLight`, `grid: { width, dark }` (seams); `charMaterial` and `propMaterial` merge over `material` |
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
  seams), `getMaterial('fine')` (floors built at 1/16) or `getMaterial('prop')`
  (static stone props at 1/16, statues and braziers: the room's faint seams at
  roughness 0.7, as the bible's statues). The geometry carries
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

**Options.** The look reads `state.settings` every drawn frame and applies a
changed value: `look` (a quality level, or `'auto'` for the device default the
watchdog may lower), `seams` (true / false), `brightness` (multiplies the
exposure) and `saturation` (multiplies the grade's saturation; high and medium
only). From code: `setSeams(on)` and `look.setDisplay({ brightness,
saturation })`.

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

## Streaming

The overworld streams seamlessly (`systems/streaming.js`, `world/world.js`
"loads and streaming"): no fade between outdoor screens, and a screen a couple
of steps away is already built, lit and standing with its people and foes
before the camera reaches it.

**The ring.** Every step, `updateStreaming` lays a ring around the hero's
screen (`layRing`, `TUNING.stream`, `src/tuning/stream.js`): screens within
`radius` (2; `lowRadius` 1 at the `low` look) are **live** (terrain, props,
people and foes, built nearest-first and ahead of the way the hero is
heading); one ring further out (`scenery`) is terrain only, no entities; a
screen leaves either only `hysteresis` screens further out again, so walking
back and forth over a line frees nothing. Screens within `active` (1) are
**simulated** each step (`updateBuckets`); further live screens lie
**dormant**, still drawn but not ticked, same as the SNES game keeping foes to
their own room.

**Buckets and dormancy.** A screen's markers spawn once its terrain is in
(`world.onBuilt` -> `built()`, `'world:screen-live'`), into their own bucket
(`entities/manager.js`), already standing there: never when the camera
arrives. Nothing is deleted when the hero leaves a screen; `transitions.js`
stashes the stage into its bucket (`leaveStage`/`arriveStage`), and a bucket
is reaped only when its screen leaves the live ring (`free()`,
`'world:screen-free'`). The hero's own screen is the one exception to
`'world:screen-live'`: it spawns on `'room-enter'` instead, once he actually
arrives (`arriveStage`), which is also the event a screen's own ambient life
(`systems/critters.js`) and clear memory (`systems/foe-clears.js`) key off.

**Building ahead.** A door, cave mouth or stairs within `prebuildTiles` (10)
of the hero has its interior built in the background (`buildAhead`,
`world.keep`), so the fade through it only has to fade; the area frees again
once the hero is `prebuildDrop` (20) tiles from every one of its doors. Out of
an area of its own the outdoor ring past the exit is kept live the same way,
so the screen beyond a door is never the first one built.

**Workers.** Terrain meshing (`world/meshing.js`) runs in a small pool of Web
Workers (`world/mesh-worker.js`) when the page can start them, one voxel grid
transferred per job; without workers (`?workers=0`, manual mode, or a worker
that failed to start) it meshes on the main thread in slices instead, byte
for byte the same result. Either way a build is a sequence of small steps
(`terrain.js screenTerrainSteps`) that `world.pump()` spends within a
per-frame budget (`budgetMs` 3 ms in play, the larger `loadBudgetMs` 8 ms at
black behind a fade), so a screen streaming in never costs a frame on its
own; `pumpBuilds()` is the one call site (`main.js`, once a frame).

**Warm-up.** Everything above keeps a *building* screen from costing a frame;
the look (`src/core/look/`, `src/core/warm.js`) separately keeps a screen
whose **look differs structurally** from the one behind the title from
costing one to compile. `warmLookFrame()` links the scene and post-stack
programs the current look's quality will draw with (`renderer.compileAsync`,
`KHR_parallel_shader_compile`) before the player can act; `look.warmUp()`
adds what the start screen never has of its own (the `fine`/`prop` material
kinds, the polished floor's Reflector shader) as throwaway stubs so they
compile once, at boot, instead of cold on the first dungeon. It also builds
every *registered* look's reflection environment (`core/look/environment.js`'s
PMREM-prefiltered "orb", cached there by value) one look per animation frame,
behind the title: that texture is normally built lazily, the moment a room
first uses a look nobody has shown yet, and `PMREMGenerator.fromScene` renders
several passes and links its own shader synchronously, with nothing to hide
it behind on a browser with no parallel shader compile. `registerLighting`
re-triggers this warm whenever content adds a look after boot, so a look
registered late still gets it. What is *not* covered here: shadow-map depth
programs (a couple, ~12 ms together, left to the first frame their object
casts one) and anything the world/meshing side of streaming does on the main
thread during a fade (see "Workers" above) - a slow *first room of a kind*
that is not a shader stall shows up there instead of in `look.info()`'s
`cpuMs`.

`scripts/perf-stream.mjs` walks this for real (a real GPU, Chrome and
Firefox): the outdoor walk, then the approach to a dungeon door, checking
frame times and long tasks against budget.

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
`world.js` adds more), `x, z` local and `tx, tz` global tile coordinates.
Screens differ in size, so tell an edge row or column from `ctx.screen.w` and
`ctx.screen.h` (and a room from `ctx.screen.area.rooms`), not from
`SCREEN_W` / `SCREEN_H`. Draw only from `ctx.rand` so screens look the same
on every load; the world replays each tile's random stream when a screen is
re-meshed, so changing one tile never recolours its neighbours.

**Low tiles.** A solid tile with `blocksShots: false` (water, pits, lava) is
low: shots fly over it, and so do bodies with `flying = true` (bats, ghosts).
A flying enemy therefore needs no edits to the tiles it crosses.

**Shots.** A projectile that stops on a tile calls
`world.trigger(tx, tz, 'onShot', { projectile, hit })` before it breaks
(`rock-shot.js` does), so a crystal switch or a target reacts to arrows,
thrown blades and enemy rocks through one hook. `hit` is
`{ damage, fromX, fromZ, source }`.

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

`warps` maps a tile character to a spot (see Spots below); tiles with
`onEnter: enterWarp` use it. A screen's `warps` can also key a destination by
position (`'8,1'`, local tiles), which wins over the character, so one screen
can hold a shop door, an inn door and a house door made of the same tile.
Screens can override `lighting`, `camera`, `tileset`, `spawns`, `warps`, and
add `spawnsAt` and `onEnter(screen)`. The world checks at startup, with a
message that names the screen and the tile: every tile character and row
length; every spawn marker (none may hide a tile) and `spawnsAt` key; every
warp key (a tile character, or `'x,z'` inside the screen) and destination (it
must land inside its screen, off solid tiles and off warp tiles, or the hero
would warp straight on, back and forth); every warp tile (`onEnter:
enterWarp`) has a destination in its screen's or its area's `warps`; every
area's `entrance`; the `camera` and `lighting` names are registered; and the
edges (see Neighbours below). A warp (or an entrance) into an area that is
not registered (another branch adds it) only warns once and does nothing
until that area exists; `world.warpAt` returns null for it.

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
in frame on the way. If something solid (a bush, a block) stands between the
edge and that spot, he stops just short of it: never inside it, never past
it. Walking into another area, or through a warp into one
(a door, stairs out), is a load: `FADE_OUT` 0.25 s, `AREA_HOLD` 1 s of black
for the loading card, `FADE_IN` 0.25 s (90 ticks in all), landing him at the
matching spot on the other side, the same distance in. A warp inside one area
(stairs between the floors of a dungeon, warp tiles) fades out and in over
`WARP_FADE` 0.3 s each with no card (`WARP_HOLD` 0) and no `'area-enter'`.
Input is ignored during both, Start included (gameplay spec 4.3): a press
made on the way is dropped, so A or B acts neither mid-slide nor on arrival.
Only the hero's walk animates.
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

### The canvas UI and HUD widgets: `src/ui/canvas/`, `src/ui/hud.js`

The interface is drawn by the game, not the DOM: one canvas over the view
(`ui/canvas/gfx.js`), immediate mode, our own 5x7 pixel font (`font.js`) and
outlined sprites (`sprites.js`), at whole device pixels (about two CSS pixels
per logical pixel). A "part" is one piece of interface (`registerUiPart({ id,
order, key, busy, draw(g) })`); the layer repaints only when a key changed, a
part is `busy` (animating) or `requestUi()` was called. `g` is the drawing kit:
`text`, `panel`, `button`, `sprite`, `rect`, `wrap`, `fit`, `measure`, and
`hit(id, x, y, w, h, onPress)` for anything that answers a tap. The HUD and the
dialog box are parts; the title panel, banner, toasts, speech and map still
move over one piece at a time (docs/ui-canvas.md is the plan).

```js
registerHudWidget({
  id: 'bombs',
  region: 'counters',              // vitals | counters | center | system | slots (default 'slots')
  order: 25,                       // place in the region, low first (default 50)
  key: (state) => String(...),     // the widget's redraw key
  render(state) {},                // optional, when the key changes (popHud('bombs'))
  measure(g, state, maxW) { return [w, h]; },   // logical pixels, or null to hide
  draw(g, state, x, y, w, h) { g.text('x3', x, y); },
});
```

Regions are rows that flow from a side (vitals and counters: top left, rows
one and two; system and slots: top right, rows one and two) and a stack at the
top centre (center). Inside a region widgets sit by `order`, then id. Orders in
use: vitals: hearts 10; counters: coins 10, keys 20; center: area name 10, Next:
line 20; system: Settings 10, Sound 20; slots: B item slot 20, clock 30. Tests
read `hud.hudView()` (where every widget sat after the last draw) and
`ui.uiView()` (the hit regions; `ui.pressUi(id)` taps one), never pixels.

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
before the running game changes. Data from a newer `SAVE_VERSION` (3 today) is
rejected; older data is upgraded by `SAVE_MIGRATIONS[v]` (data of version v
-> data of version v + 1) first.

Core fields: `hp`, `maxHp`, `coins` (M1's `gems`, still readable as
`state.gems`), `keys` (per key group), `flags` (a Set of strings), `tileEdits`
(keyed by global tile in play; see below), `inventory`, `respawn` (a spot,
which an inn sets), `pos` (the hero's spot: `{ area, screen: [i, j], x, z,
yaw }`) and `camera` (the player's preset choice, one of A-D, which a new game
keeps). The rest of `state.settings` is preferences, not part of a save.
Slots: `saveToSlot(n)`, `loadFromSlot(n)`, `activeSlot()` in `systems/flow.js`
on top of `core/save.js` (`writeSlot`, `readSlot`, `listSlots`,
`deleteSlot`). `loadFromSlot(n)` returns false for an empty, damaged or newer
slot and leaves the game and `activeSlot()` as they were.

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
edits and the hero into today's crypt, so its key, door and chest stay as
they were. Saves of that layout say version 1 (M1's) or 2 (feat/contracts'
before M1.5), and the migration to version 3 converts them; feat/world's own
saves (version 1, already by place) only get the `gems` -> `coins` rename.

### Presets and small tables

| What | Where | Add from your own file |
|------|-------|------------------------|
| Lighting | `core/renderer.js` `LIGHTING` | `registerLighting('cave', { background, sky, ground, hemi, sunColor, sun })` |
| Camera | `core/camera.js` `CAMERA_PRESETS` (A default, B, C, D: the player's choices; dungeon, interior) | `registerCameraPreset('boss', { pitch, fov, height, lead, fixed, fitWidth, minHeight })` for an area or room: pitch, fov and height required; lead 0, not fixed and not a player choice unless given (`selectable: true`). `playerCameraPresets()` lists the choices (A-D) for an options menu; `chooseCameraPreset(name)` sets one and rejects the rest |
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

Merge note: `underlayer` and `ground` are the M1 tilesets' builders.
feat/look-kits (carried into feat/look) rebuilds both tilesets without
them (`land()` in `tiles/overworld.js`; `floorColor`, `fineFloor` in
`tiles/dungeon.js`), so the merge that brings it in keeps the two names as
aliases or rewrites this example and the helper list under Layout.

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
[Areas](#areas-srcworldareasjs)), an `origin` (or, for screens that are not
16 wide, an `at`) in the right [global region](#global-regions), and a way
in: a warp tile in another area
(`warps: { D: { area: 'your-id', screen: [0, 0], x: 8, z: 9, yaw: Math.PI } }`),
or screens that touch another area's screens (walking across fades into it).
A door can point at an area another branch is still building: the warp
warns at startup and does nothing until the area exists.
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

## Kits and models

The content look of the art bible (sections 2 and 7 to 11): terrain at 1/8
tile per block; characters, props, pickups and dungeon floors at 1/16 tile per
voxel. Every mesh is a `DenseGrid` meshed by `meshVoxels` (`core/vox.js`) and
drawn with the material kinds of `core/materials.js` (see Look). Content makes
no materials of its own beyond the contract: `getMaterial('terrain' |
'character' | 'fine' | 'prop')`, `makeCharacterMaterial()` (an enemy's own hit flash),
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
| `ctx.D` detail | voxels of 1/16 tile | `character` | small static models: flowers, signs, graves |

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
`voxelLayer(name)`: a layer added with `registerLayer(name, { material | kind,
res, castShadow, receiveShadow })` (terrain resolution, or with `res: FPT` one
at 1/16 sized like the detail layer; its own material or material kind),
written like `ctx.T` or `ctx.D`. The dungeon's `'stone-props'` layer (statues
and braziers, kind `prop`) and `'unlit-black'` layer (the south wall) are
registered this way. M1 builders still work: `ctx.g` and `ctx.layer(name)` write
terrain blocks counted from the screen's corner (`ctx.bx`, `ctx.bz`).

Rules:

- **Seamless edges.** A screen is built with a one-tile margin of its
  neighbours' tiles and meshes only its own, so faces and ambient occlusion
  match across screen edges; `setTile` re-meshes every screen whose margin
  shows the tile (`marginScreens`). So builders must be deterministic per
  tile: vary colours with `hash3` on global coordinates, and use `ctx.rand`
  only for decisions made before drawing, never per voxel.
- **The edge of the world.** A margin tile with no screen and no backdrop
  (south of the overworld, where the far band stops) is meshed by exactly one
  of the screens around it: the one holding the tile north of it, else south,
  west, east, then the diagonals. Builders write into it (a canopy overhangs
  its tile by a block) and those voxels hide the faces beside them, so leaving
  them unmeshed opened a hole through the tree and the ground under it.
- **No bottom faces** at or below the ground's top. Faces facing north stay on
  shadow casters (three.js shadow maps render back faces).
- **Tile fields the kits read**: `level` (raised ground, in tiles), `ground`
  (`'grass'`, `'dirt'`, `'path'`, `'sand'`: kinds bleed raggedly into each
  other), `water` (banks and bridges look at it), `height` (blocks above the
  level's top layer; sizes the grid, default 16), `detailHeight` (fine voxels
  of detail above the ground), `doorway` (a solid tile that still counts as a
  doorway of a room wall, like a locked door).

**Rooms.** Areas with `rooms: true` or a fixed camera (`camera: 'dungeon'`,
the crypt) are drawn one room at a time with black around them:
`syncScreenVisibility()` (systems/transitions.js, called by `main.js` every
frame after `world.flush()`) hides every other room, and during a slide shows
the room being left too; `shownRect()` is the rectangle the look's polished
floor and lamp culling use (`look.bind({ roomRect })`). In `rooms: true` areas the rooms also get a ring. `registerRing(tileset, (room, tx, tz) => cell | null, { north,
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
distance"). Each band tile is filled for the nearest area of its tileset
(`charAt` gets its distances and edge cell), so areas that touch share one
band that continues each area's own edge. They are meshed in chunks of 8 x 8
tiles, and a chunk touching a play area in quarters of 4 x 4. Only the
quarters touching a play area (the first one to four tiles out) are at full
resolution; the rest is meshed at half resolution (1/4 tile blocks), without
north faces and without casting shadows, which keeps the band cheap to draw.
`cellAt` returns backdrop
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
line, a lighter ring and a darker centre. Statues and braziers are stamped
into the `'stone-props'` layer (1/16, the `prop` material kind: matte stone
with the room's faint seams, not the characters' clear ones).

A lamp is a small dark sconce on the wall, a glow strip on it and a warm point
light, all fixtures of the screen. The light comes from `makeLampLight()` in
`core/renderer.js` when the renderer has it, else it is a single
`PointLight(0xffb060, 4.5, 8, 1.5)`; lamps never cast shadows. Fallback lights
are switched on only in the screen the hero has entered (`'screen-enter'`),
since every lit material pays for every visible point light wherever it is; a
renderer with `makeLampLight` culls its own lamps.

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
| `setManual(on = true)`, `isManual()` | stop / resume the real-time simulation (in manual mode the loop draws nothing either) |
| `render()` | draw a frame now, HUD included (shots call it) |
| `look` | the look: quality levels, lighting presets, `info()`, the material and lamp API ([Look](#look)) |
| `seed(n)` | reseed gameplay randomness |
| `start()` | title or game over -> play |
| `teleport(target, x, z, { yaw })` | `'crypt'` (its start screen, else its first), `'crypt:0,1'`, `{ area, screen: [0, 1] }`, a screen name (`'Key Vault'`), or M1 global screen numbers `[1, 0]` / `'1,0'` (read on the old 16 x 11 lattice); x, z local tiles (default the middle, or the free tile nearest it: never inside a chest or on a warp). Returns `{ area, screen, key, name }` |
| `screen()` | the current screen object (live): `key`, `area`, `lx`, `ly`, `w`, `h`, `x0`, `z0`, `x1`, `z1`, `tiles`, ... |
| `give(id, amount = 1)` | grant anything: `'key'`, `'gems'`, `'heart-container'`, an item id, an ammo id |
| `setHp(n)` | set health (clamped to max); `0` or less kills the hero through the normal death path |
| `spawn(type, x, z, opts)` | add an entity at local tile coordinates |
| `setMode(name)`, `newGame()` | switch modes, reset to a new game on the title |
| `save()`, `load(data)` | in-memory save data round trip |
| `saveToSlot(n)`, `loadFromSlot(n)`, `activeSlot()` | localStorage slots (`loadFromSlot` is false for an empty, damaged or newer slot) |
| `showDialog(lines, opts)`, `dialogOpen()`, `overlayVisible()` | UI |
| `camera.presets`, `camera.playerPresets()` (also `camera.choices()`), `camera.choose(name)`, `camera.set(name)`, `camera.get()`, `camera.lens()`, `camera.target`, `camera.object` | camera presets and the player's choices (A-D; `choose` is the player's setting, saved, and refuses other presets; `set` takes any preset until the next screen), the lens in use (a fitted `interior`, or a blend mid-slide), the subject point, the three.js camera |
| `camera.expected()`, `camera.project(x, y, z)`, `camera.groundAt(nx, ny)`, `camera.heroInFrame()`, `camera.rules` | where the framing rule wants the subject now; world point to normalised device coordinates `[x, y, depth]`; a device point to the ground it shows (or null); every vertex of the hero model (sword and contact shadow left out) in device coordinates: `{ worst, out, total, side }`, worst over 1 when any of him is out of frame; `{ outline(), southReach(preset), southLine(screenKey) }` |
| `transitions` | `SLIDE_TIME`, `SLIDE_STEP`, `ROOM_STEP`, `FADE_OUT`, `FADE_IN`, `AREA_HOLD`, `WARP_FADE`, `WARP_HOLD`, `shown(key)`: is that screen drawn, and `shownRect()`: the world rect `{ x0, z0, x1, z1 }` around the drawn screens |
| `links()` | `edgeReport(world)`: `{ links, mismatches, deadEnds }` between areas |
| `registries.tilesets()`, `.areas()`, `.entities()`, `.items()`, `.grants()` | what is registered |
| `api` | registration functions and small APIs, so a test can add content at run time without a build: `registerTile`, `registerMode`, `pushMode`, `popMode`, `registerItem`, `registerEntity`, `registerGrant`, `registerPlayHook`, `registerHudWidget`, `registerCameraPreset`, `registerDropTable`, `addDrop`, `rollDrop`, `ammo`, `maxAmmo`, `hasItem`, `World` (the class, for map checks on a throwaway world) |
| `snapshot()` | JSON summary: mode, area, screen (`[i, j]`), key, size (`[w, h]`), screenName, hp, maxHp, gems (the coins), keys, keysByGroup, x, z (world), lx, lz (local), cam (`{ preset, x, z }`, local), yaw, invT, attacking, enemies, entities, flags, inventory, overlay, dialog, particles, time |

## Play-test harness

```sh
npm run playtest                                   # build, run the default scenario, shots in playtest-out/
node scripts/playtest.mjs --out <dir>              # screenshots into <dir>
node scripts/playtest.mjs --scenario screens       # gallery of every screen, room and the player's camera presets
SCREENS=crypt,test-burrow node scripts/playtest.mjs --scenario screens   # only those areas' screens
node scripts/playtest.mjs --scenario rooms         # every crypt door both ways, the dungeon camera
node scripts/playtest.mjs --scenario areas         # slides and area-to-area fades in all directions
node scripts/playtest.mjs --scenario camera        # A-D, dungeon, interior at 1280 x 720 and 390 x 844: all of the hero model in frame
node scripts/playtest.mjs --scenario contracts     # every extension point and review fix, one check each
node scripts/playtest.mjs --scenario contracts-m2  # the M2 contracts, on probe content
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
failure unless given `{ soft: true }`. The bot never plans through a tile
that holds a solid entity (an NPC). In the page the bot is `window.__vhBot`;
its helpers are async and step with `__voxelHeroes.tick()`.
`scripts/lib/helpers.mjs` has the scenario helpers more than one scenario
needs: `clearFoes(t)` (take the enemies off the screen) and
`pushUntilMoving(t, key)` (hold a key until a slide or a fade starts).

Gotchas: the canvas UI repaints when a frame renders, so call
`__voxelHeroes.render()` before reading `hudView()` or pressing a hit region (`shot()` does). B is
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
  or a warp are ignored (gameplay spec 4.3, since M1.5); the prototype, and
  M1, carried them over to act on arrival.
- **M (mute)** also works on the title and game-over screens.
- **Slide landing.** The hero lands 1 tile into the next screen (the
  gameplay spec's figure since M1.5; the prototype used 1.1). When something
  solid stands on the way there, he stops just short of it (M1 walked him on
  past it, up to 3.1 tiles in). The Mirror Lake bush that trapped him when
  he came up the west half of the south lane (bottom row, column 7; a
  prototype bug) moved to column 4.
- **Knockback** decays per second instead of per frame. It pushes as far as
  the prototype at 60 Hz, and now the same at 30, 120 or 144 Hz.
- **Phones.** The title and pause panel fits a 390 px wide screen (it was
  20 px too wide), and the single-file build keeps the viewport meta tag, so
  a phone lays it out at device width.
- **HUD markup.** Gone: the HUD, dialog, banner, toast, title/pause panel, map,
  settings, loading card and speech bubbles are all drawn in the UI canvas
  (`src/ui/canvas/`); only the touch pad, the fade and the SEO About block are DOM.

## Known quirks kept from the prototype

- `player.yaw` is not wrapped to 0..2π; compare angles with `lerpAngle` or
  an angle difference, not with `===`.
- The screen-name banner times out in real time (a CSS animation and a
  timer), so in slow headless runs it can appear in several screenshots.

# M2 contracts

Seven streams build M2 at the same time: **hero**, **items**,
**foes-overworld**, **foes-dungeon**, **dungeon**, **overworld** and **ui**.
This file fixes everything more than one of them touches: who owns each file,
the units, the shared state, the events, the input actions and the APIs. All
of it already exists in code on `feat/contracts`, and
`scripts/scenarios/contracts-m2.mjs` checks it (139 checks). A stream builds
behind these names and changes none of them on its own; section 13 says how
to ask for a change.

The gameplay spec (`/mnt/project-files/design/gameplay-spec.md`, "the spec")
owns mechanics and numbers, the art bible
(`/mnt/project-files/design/art-bible.md`) owns the look, and
[ARCHITECTURE.md](ARCHITECTURE.md) explains the registries, the test hook and
the harness. Where ARCHITECTURE.md's M1 notes on parallel work (its feature
table and screen origins) differ from this file, this file wins.

Contents: [1 Working in parallel](#1-working-in-parallel) ·
[2 Ownership](#2-ownership) · [3 Units and conventions](#3-units-and-conventions) ·
[4 TUNING](#4-tuning) · [5 State](#5-state) · [6 Events](#6-events) ·
[7 Input](#7-input) · [8 APIs](#8-apis) · [9 Ids](#9-ids) ·
[10 Global regions](#10-global-regions) · [11 Tiles and markers](#11-tiles-and-markers) ·
[12 Not settled yet](#12-not-settled-yet) · [13 Changing a contract](#13-changing-a-contract) ·
[14 M1 files the contracts changed](#14-m1-files-the-contracts-changed)

---

## 1. Working in parallel

**Branches.** M2 starts from `main` once the M1.5 branches (`feat/look-*`,
`feat/world`, `feat/contracts`) are merged. Each stream works on
`feat/m2-<stream>` in its own worktree (`/home/claude/wt/m2-<stream>`,
`node_modules` linked): `feat/m2-hero`, `feat/m2-items`,
`feat/m2-foes-overworld`, `feat/m2-foes-dungeon`, `feat/m2-dungeon`,
`feat/m2-overworld`, `feat/m2-ui`. No stream merges another's branch; M3
merges them all.

**Rules.**

- Edit only the files section 2 gives your stream. Add new files in your own
  folders; a new file belongs to the stream that creates it.
- Add content by registering it (`registerTile`, `registerEntity`,
  `registerItem`, `registerSword`, `registerSpell`, `registerDungeon`,
  `registerShop`, `registerInn`, `registerMenu`, `registerBestiary`,
  `registerMusic`, `registerLoadingCard`, `registerPrompt`, `registerGrant`,
  `registerHudWidget`, `registerMode`, `registerPlayHook`, `registerSfx`,
  `addDrop`, `defineState`). Never edit a list in someone else's file.
- Talk to other streams through events, ids and the APIs in section 8. Code
  against a contract even when its real implementation is another stream's
  work: until that lands, the stand-in behind the name answers (the M1 sword,
  the dialog menus, the banner item get, silent music). A marker, chest or
  shop entry that names another stream's id warns and is skipped until merge.
- Every number goes in your `TUNING` section (section 4), with the spec's
  Appendix A changed in the same step when it is a spec number.
- Gameplay randomness comes from `random()` in `core/random.js` (seeded);
  effects use `fxRandom()`. Never `Math.random()` in gameplay.
- Test rooms go in your test columns (section 10), never in someone else's map.
- All names, text, models and music are ours. Nothing from 3D Dot Game Heroes
  or Zelda: not a name, a line of dialogue, a sprite or a map layout.
- No new npm packages.

**Tests.** Each stream keeps one scenario, `scripts/scenarios/<stream>.mjs`
(`hero.mjs`, `items.mjs`, `foes-overworld.mjs`, `foes-dungeon.mjs`,
`dungeon.mjs`, `overworld.mjs`, `ui.mjs`), that checks its work through
`window.__voxelHeroes` and `window.__voxelHeroes.game` (section 8.22), stepping
fixed 1/60 s ticks. Screenshots go to
`/mnt/project-files/voxel-heroes-shots/m2/<stream>/`:

```sh
node scripts/playtest.mjs --scenario hero --out /mnt/project-files/voxel-heroes-shots/m2/hero
```

Before every commit: `npm run build`, then
`node scripts/playtest.mjs --no-build --scenario default`, `--scenario contracts-m2`
and `--scenario <stream>` all pass. Before the last commit, `npm run artifact`
too. Commit messages end with the attribution lines the coordinator gives.
Never push.

**Report.** Each stream ends with a report: what works (with screenshots),
what is stubbed, **contract requests** (section 13) and any file it had to
touch outside section 2 (there should be none).

**What each stream builds, provides and uses.** Section numbers are the spec's.

| Stream | Builds | Provides to others | Uses (stand-in until merged) |
|---|---|---|---|
| hero | 8-way body, 4-way facing, 0.8 box, corner assist (7.2, 7.3); thrust, full-life blade, spin, beam, pierce, specials (7.4-7.7); guard (7.8); dash (7.9); damage, i-frames, knockback, low-life beep (7.10); hazards on the hero (7.11); blade-2 to blade-4 (10.5) | the real `hero` API (8.1); `sword-swing`, `sword-hit`, `blade-changed`; blade hits through `dealDamage`; blade pickups through `collectPickup` | `dealDamage`, `Projectile` (beams), swords registry, `effects` (star) |
| items | the quick ring rules (9.1); tools (9.2); consumables and bottles (9.3); spells (9.4, `src/spells/`); revive dust (a reviver); pickups (coins, magic, arrows-5, bomb-1); bombs' blast | item and spell ids for shops and chests; `explosion`, `light`; shots that call tile `onShot`; the effects `reflect`, `reveal`, `quake`, `freeze`, `slow`, `truesight`, `candle`, `lamp` | `hero`, `dealDamage`, `Projectile`, `vitals`, tile hooks and flags (section 11) |
| foes-overworld | enemy base and behaviour primitives (8.2); the overworld roster (8.3); spawn groups and respawn rules (5.5); drop packs A-E in coins (8.7); bestiary entries; the guardian pair; rares | `Enemy` and AI helpers foes-dungeon builds on; `rollDrop` packs; `enemy-killed` | `hero.receiveHit`, `dealDamage` fields, `Projectile`, `dropCoins` |
| foes-dungeon | skeleton, bat, gazer; turret, blade trap, arrow trap (6.4, 8.3); the boss template (8.5) and boss-serpent (8.6); boss intro and payout (6.6); room enemies and cleared-room memory (6.5); tells (12.4) | entity types for dungeon maps; `boss-intro`, `boss-phase`; `defeatBoss` calls | M1 `Enemy` (then foes-overworld's), `receiveHit`, `Projectile`, `dungeons`, `dropCoins`, `grant('heart-container')` |
| dungeon | rooms, doors and keys (6.2, 6.3); the puzzle and hazard kit except traps (6.4); persistence (6.7); D1 (6.9) with its arena and reward room; the dungeon map data; small keys | `registerDungeon('d1')`; the dungeon events (6); tiles that answer items' hooks; dark rooms | grants (`map`, `key-boss`, colored keys), `explosion`, `light`, `room-cleared`, spawn groups, foes' entity types |
| overworld | the overworld map at 16 x 16 screens (5.1-5.3); terrain kit use and gating (5.2, 5.4); towns, NPCs and interiors (5.6); shops and inns (10.4, 11); smith, sage and trader NPCs; the castle and prologue (P2.6); the D1 entrance; loading cards and music ids for its areas | shops, inns, NPCs, cards, area music | `openMenu`, `innRest`, `shops`, swords, spells (sages grant them), foes' entity types |
| ui | the HUD (12.1); pause, inventory, options, new game, file select, game over (11, 12.2); world and dungeon maps (4.6); shop, smith and inn screens; the item get; key toasts; loading cards and the gallery; the dialog box; boss name cards; `systems/flow.js` (title, new game, load, continue, autosave) | the screens; `setItemGetPresenter`; `registerMenu` | everything, read-only |

**M3 order.** Merge hero, items, foes-overworld, foes-dungeon, dungeon,
overworld, then ui. No two streams own the same file, so merges should not
conflict; after each merge run the build, `default`, `contracts-m2` and every
stream scenario. M3 then adds the title-to-boss play-test.

---

## 2. Ownership

Every file has one owner. **contracts** files are the shared surface: no
stream edits them in M2 (ask, section 13). **look** and **world** files come
from the M1.5 branches and are frozen in M2 (ask). "New" rows are files a
stream adds. Paths in `src/` unless they start with a top-level folder.

**Repository and scripts**

| Path | Owner | Notes |
|---|---|---|
| `.gitignore`, `package.json`, `package-lock.json`, `vite.config.js` | contracts | no package changes in M2 |
| `README.md` | contracts | its controls table follows section 7 |
| `index.html` | ui | keep the ids `core/input.js` and `ui/hud.js` bind: `#touch`, `#stick`, `#knob`, the `TOUCH_BUTTONS` ids, `#mute`, `#hud-*`, `#overlay*`, `#start` |
| `docs/PLAN.md`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md` | contracts | streams put notes in file headers and in their report; M3 folds them into ARCHITECTURE.md |
| `scripts/playtest.mjs`, `scripts/build-artifact.mjs` | contracts | |
| `scripts/lib/bot.js` | world | |
| `scripts/scenarios/default.mjs`, `screens.mjs`, `areas.mjs`, `camera.mjs`, `rooms.mjs` | world | `areas`, `camera`, `rooms` come with feat/world |
| `scripts/scenarios/look.mjs` | look | comes with feat/look-render |
| `scripts/scenarios/contracts.mjs`, `contracts-m2.mjs` | contracts | |
| new `scripts/scenarios/<stream>.mjs` | that stream | one per stream |

**Engine**

| Path | Owner | Notes |
|---|---|---|
| `main.js` | world | hook in with play hooks, modes and HUD widgets instead |
| `content.js` | contracts | its globs already load every M2 folder |
| `style.css` | ui | other streams put CSS next to their module |
| `core/audio.js`, `events.js`, `input.js`, `loop.js`, `math.js`, `modes.js`, `random.js`, `save.js`, `state.js`, `tuning.js` | contracts | new sounds: `registerSfx` from your own file |
| `core/camera.js`, `core/constants.js` | world | |
| `core/renderer.js`, `core/voxel.js`, `core/materials.js`, `core/vox.js`, `core/look/*` | look | `materials.js`, `vox.js` and `look/` come with the look branches |
| `debug/testhook.js` | world | streams reach their code through `window.__voxelHeroes.game` (8.22) |
| `tuning/world.js` | world | |
| `tuning/hero.js` | hero | |
| `tuning/items.js` | items | |
| `tuning/enemy.js` | foes-overworld | foes-dungeon reads it |
| `tuning/boss.js` | foes-dungeon | |
| `tuning/dungeon.js` | dungeon | |
| `tuning/economy.js` | overworld | |
| `tuning/ui.js` | ui | |

**Game modules (`src/game/`)**

| Path | Owner | Notes |
|---|---|---|
| `game/fields.js`, `vitals.js`, `damage.js`, `places.js`, `progress.js`, `effects.js`, `watch.js`, `pickups.js`, `testapi.js` | contracts | |
| `game/hero.js`, `game/swords.js` | hero | keep every exported name, argument and return value |
| `game/spells.js` | items | same |
| `game/bestiary.js` | foes-overworld | same |
| `game/dungeons.js` | dungeon | same |
| `game/shops.js`, `game/services.js`, `game/music.js` | overworld | same |
| `game/cards.js`, `game/prompts.js`, `game/saves.js`, `game/settings.js`, `game/menus.js` | ui | same; the dialog fallbacks in `menus.js` stay |

**Entities, items, systems**

| Path | Owner | Notes |
|---|---|---|
| `entities/entity.js`, `manager.js`, `registry.js`, `projectile.js` | contracts | |
| `entities/player.js`, `systems/sword.js`, `systems/combat.js`, `systems/physics.js` | hero | `combat.js` keeps `hurtPlayer`, `registerReviver`, `checkRoomCleared`, `enemiesLeft` |
| `entities/enemy.js`, `entities/spawn-group.js`, `entities/enemies/*`, `entities/projectiles/rock-shot.js`, `systems/drops.js`, `systems/spawner.js` | foes-overworld | new overworld enemies in `entities/enemies/` |
| new `entities/dungeon-enemies/*`, `entities/bosses/*`, `entities/traps/*` | foes-dungeon | |
| `entities/pickup.js`, `entities/pickups/*` except `key.js`, `systems/blast.js`, `items/*` | items | `items/registry.js` and `items/inventory.js` keep every exported name (the HUD, shops and grants call them) |
| `entities/pickups/key.js`, `systems/keys.js` | dungeon | |
| `entities/npc.js`, `entities/npcs/*` | overworld | smith, shopkeepers, innkeepers, sages, townsfolk |
| new `entities/projectiles/<type>.js` | the stream that fires it | hero: beams; items: arrows, fire bolts, the boomerang; foes: their shots |
| `systems/grants.js`, `systems/interact.js` | contracts | |
| `systems/flow.js` | ui | keeps `registerPlayHook`, `teleport`, `saveToSlot`, `loadFromSlot`, `startGame`, `newGame` |
| `systems/particles.js` | look | use `burst` (and look's `sparks`, `smoke`) |
| `systems/transitions.js` | world | |
| new `systems/<name>.js` | the stream that creates it | |

**Content folders**

| Path | Owner | Notes |
|---|---|---|
| `swords/*` | hero | `blade-start.js` exists |
| `spells/*` | items | |
| `dungeons/*` | dungeon | `crypt.js` exists |
| `shops/*`, `music/*` | overworld | `music/placeholders.js` exists; M6 writes the music |
| `cards/default.js` | overworld | new `cards/<dungeon>.js`: dungeon |
| `models/*` (existing, and look's `characters.js`, `icons.js`, `kit.js`, `palette.js`) | look | |
| new `models/<stream>/*` | that stream | built with look's kit (`kit.js`, `palette.js`, `characters.js`) |
| `ui/**` | ui | banner, dialog, dom, hud, overlay, `hud/*`, `screens/*` |

**World**

| Path | Owner | Notes |
|---|---|---|
| `world/world.js`, `grid.js`, `tiles.js`, `areas.js`, `links.js`, `areas/test-borders.js` | world | `links.js` and `test-borders.js` come with feat/world |
| `world/tilekit.js`, `palette.js`, `terrain.js`, `tiles/farband.js`, `areas/kitroom.js` | look | `terrain.js`, `farband.js`, `kitroom.js` come with feat/look-kits |
| `world/tiles/overworld.js`, `world/areas/overworld.js` | overworld | the overworld and town tilesets |
| `world/tiles/dungeon.js`, `world/areas/crypt.js` | dungeon | the dungeon tileset |
| new `world/areas/*` | overworld (overworld areas, towns, interiors), dungeon (dungeons and their arenas), each stream (its `test-<stream>-*.js`) | section 10 |
| new `world/tiles/*` | overworld or dungeon only | section 11 |

---

## 3. Units and conventions

| What | Unit | Notes |
|---|---|---|
| Distance | tiles (1 world unit) | x east, z south, y up. The camera faces north and never turns |
| Local position | tiles from a screen's north-west corner | spots, markers, `teleport`, `hero.place` |
| Time | seconds | converted to ticks with `ticks(s)`; the simulation steps at a fixed 60 Hz (`TICK` = 1/60 s) |
| Speed | tiles per second (t/s) | |
| Angle | degrees in `TUNING`, radians in code | `yaw` 0 faces +z (south); `yaw = atan2(dx, dz)` |
| Life | units: 1 unit = half a heart | `UNITS_PER_HEART` = 2; hero damage in units |
| Magic | whole gems | |
| Money | coins, wallet 9,999 | `state.coins` (the M1 `state.gems` is an alias) |
| Enemy HP and damage | points | blade-start deals 3 |
| Facing | `'north'`, `'east'`, `'south'`, `'west'` | the 4-way attack facing |
| 8-way direction | 0 north, clockwise to 7 north-west, -1 none | `input.move8()` |

- Screens are keyed `'area:i,j'` (local screen i, j of the area). A spot is
  `{ area, screen: [i, j], x, z, yaw }` in local tiles; x and z default to
  the middle, `screen` to the area's `start`.
- Dungeon rooms are named by row letter and column (spec 3): `'J-4'` is row J
  (the tenth, from the north), column 4 (from the west). `roomLabel()` in
  `game/dungeons.js` turns a local screen into one.
- Code uses `dt`; with the fixed step it is always 1/60 in play, but do not
  count on it.
- Ids are kebab-case (section 9).

---

## 4. TUNING

`src/core/tuning.js` assembles one `TUNING` object from one file per owner in
`src/tuning/`, laid out like the spec's Appendix A:

| Section | File (owner) |
|---|---|
| `sim` (60 Hz) | `core/tuning.js` (contracts) |
| `world`, `camera`, `scroll`, `load` | `tuning/world.js` (world) |
| `hero`, `sword`, `guard`, `dash`, `damage` | `tuning/hero.js` (hero) |
| `enemy`, `drops` | `tuning/enemy.js` (foes-overworld) |
| `boss` | `tuning/boss.js` (foes-dungeon) |
| `dungeon` | `tuning/dungeon.js` (dungeon) |
| `pickups`, `items`, `spells`, `progression` | `tuning/items.js` (items) |
| `economy` | `tuning/economy.js` (overworld) |
| `minimap`, `worldMap`, `readability`, `options`, `profile` | `tuning/ui.js` (ui) |

```js
import { TUNING, ticks, TICK } from '../core/tuning.js';
TUNING.hero.walk;                 // 4.5 t/s
ticks(TUNING.damage.knockLock);   // 15
TUNING.sword.length(10);          // 9.5: blade length at L10 (reach adds handOffset 0.35)
```

Add keys to your own section freely; renaming or removing a key another
stream reads is a contract change. Content tables (sword stats, shop tiers,
enemy stats, drop packs) live in their registries, not in `TUNING`.

---

## 5. State

Everything saved lives in `state` (`core/state.js`), declared with
`defineState` or `registerSaveField`. Saves are versioned: `SAVE_VERSION` is
2, and `SAVE_MIGRATIONS[1]` renames the M1 `gems` field to `coins`. New
fields need no version bump; renaming or reshaping one does (contracts
does it). Writers go through the owner's API so events fire; anyone may read.

| Field | Type, default | Owner (writes through) | Saved |
|---|---|---|---|
| `mode`, `modeStack` | string, `'title'`; list | contracts (`core/modes.js`) | no |
| `time`, `deadT` | seconds | contracts / ui | no |
| `settings` | object, section 8.17 | ui (`setSetting`) | in preferences, not in slots |
| `hp`, `maxHp` | units, 6 | contracts (`vitals`, `hero.receiveHit`) | yes |
| `coins` (alias `gems`) | coins, 0 | contracts (`vitals.addCoins`, `spendCoins`) | yes |
| `magic`, `maxMagic` | gems, 0 | contracts (`vitals`) | yes |
| `heartPieces` | count, 0 (the brief's life shards: every 4th adds a heart) | contracts (`vitals.addHeartPiece`) | yes |
| `tokens` | count, 0 | contracts (`vitals.addTokens`) | yes |
| `keys` | `{ group: count }` | dungeon (`systems/keys.js`) | yes |
| `colorKeys` | `{ red, blue, green: count, master: bool }` | dungeon (`dungeons.addColorKey`, `useColorKey`) | yes |
| `flags` | Set of strings | everyone, prefixed (section 9) | yes |
| dungeon progress: map, boss key (the big key), boss beaten, orb | flags `dungeon:<id>:map`, `dungeon:<id>:bosskey`, `boss:<id>`, `orb:<n>`; there is no compass (spec 6) | dungeon (`dungeons.giveMap`, `giveBossKey`, `defeatBoss`, `completeDungeon`) | yes, in `flags` |
| `tileEdits` | `{ 'tx,tz': char }` | world (`world.setTile`) | yes |
| `inventory` | `{ owned: [], ammo: {}, selected: null, off: [] }` | items (`items/inventory.js`) | yes |
| `bags` | `{ bombs: 0, arrows: 0 }` capacity levels | items | yes |
| `bottles` | list of `'empty'`, `'potion-life'`, `'potion-magic'`, `'elixir'` | items | yes |
| `effects` | `{ name: seconds left }` | contracts (`effects`) | no |
| `profile` | `{ name: '', class: null, trait: null, model: 'hero', difficulty: 'normal', plus: 0 }` | contracts (`progress.startNewGame`, `applyProfile`) | yes |
| `gear` | `{ shield: 1, boots: null, ring: null }` | hero (grants `shield-1`..`6`, `boots-*`, `ring-*`) | yes |
| `swords` | `{ owned: ['blade-start'], equipped: 'blade-start', bought: {}, spent: {} }` | hero (`swords`) | yes |
| `respawn` | spot or null | ui (`systems/flow.js`; `places.setRespawn`) | yes |
| `pos` | the hero's spot (save field) | ui (`systems/flow.js`) | yes |
| `camera` | preset letter (save field, feat/world) | world | yes |
| `visited` | Set of screen ids `'area:i,j'` | contracts (`places`) | yes |
| `visitedAreas` | Set of area ids | contracts (`places`) | yes |
| `cardsSeen` | Set of card ids | ui (`cards.markCardSeen`) | yes |
| `bestiary` | `{ seen: {}, defeated: {}, book: {} }` counts per enemy type | foes-overworld (`bestiary`) | yes |
| `shops` | `{ shopId: { entryId: bought } }` | overworld (`shops.buy`) | yes |
| `playTime` | seconds in play | contracts (`watch.js`) | yes |
| `deaths` | count | contracts (`watch.js`, +1 on `player-died`) | yes |
| `sx`, `sy` | M1 screen; feat/world replaces them with `screenKey` | world | no |

Life and magic: a class sets both at a new game (spec 7.12:
`TUNING.progression.classes`); a game started without a profile (the M1 title's
Enter) keeps 3 hearts and no magic. `isFullLife()` is `hp === maxHp`.

---

## 6. Events

`core/events.js`: `on(name, fn)` returns `off`; `once`, `off`, `emit`,
`onAny(fn)`. Handlers run synchronously in order. `EVENTS` in the same file is
the catalogue (name, payload, emitter, listeners) and the `contracts-m2`
scenario fails if anything emits a name that is not in it. Until a new event
is added (section 13) a stream may emit names prefixed with its stream for
its own use (`'items:bomb-lit'`).

| Event | Payload | Emitted by |
|---|---|---|
| `mode-change` | `{ from, to }` | `core/modes.js` |
| `screen-leave` | `{ screen }` | world: before a screen's entities go |
| `screen-enter` | `{ screen }` | world: once its spawns are in |
| `room-enter` | `{ area, screen, via }` (`slide`, `edge`, `warp`, `start`, `respawn`, `load`, `teleport`) | world (feat/world), after `screen-enter` |
| `area-enter` | `{ area, from, via }` (`edge`, `warp`) | world (feat/world), at black, before the loading-card hold |
| `screen-visited` | `{ key, area, screen }` | `places.js`, first visit in this save |
| `warp` | `{ dest }` | world, when a warp starts |
| `tile-changed` | `{ tx, tz, from, to, screen, reason }` | world: `world.setTile` |
| `door-opened` | `{ tx, tz }` | world (tilekit), dungeon |
| `chest-opened` | `{ tx, tz, contents }` | world (tilekit), dungeon, overworld |
| `sword-swing` | `{ player, stats }` | hero: a thrust starts |
| `sword-hit` | `{ target, hit }` | hero: the blade connects |
| `blade-changed` | `{ full, stats }` | hero: the blade grows or shrinks |
| `hero-hit` | `{ result, damage, kind, source }` | `hero.receiveHit` (not for `'ignored'`) |
| `player-hurt` | `{ amount, hp, fromX, fromZ, kind, source }` | `combat.hurtPlayer` |
| `player-died` | `{}` | `combat.hurtPlayer` when nothing revives |
| `player-revived` | `{ by, hp }` | `combat.hurtPlayer` via a reviver |
| `hero-respawn` | `{ spot, via }` | `hero.respawn` |
| `hero-pose` | `{ pose, seconds }` | `hero.setPose`, `hero.cheer` |
| `life-changed` | `{ hp, maxHp, delta, full, wasFull, reason }` | `vitals` (`reason: 'direct'` for writes that bypass it) |
| `magic-changed` | `{ magic, maxMagic, delta, reason }` | `vitals` |
| `coins-changed` | `{ coins, delta, reason }` | `vitals` |
| `sword-found` | `{ id }` | `swords.giveSword` |
| `sword-equip` | `{ id, from }` | `swords.equipSword` |
| `sword-upgrade` | `{ id, stat, level, cost }` | `swords.buyLevel` |
| `sword-reset` | `{ id, lost }` | `swords.resetSword` |
| `item-gained` | `{ id }` | `inventory.giveItem` |
| `item-selected` | `{ id }` | `inventory.selectItem`, `setOnRing` |
| `item-used` | `{ id }` | `inventory.useSelectedItem` |
| `item-get` | `{ id, amount, name, text, source }` | `grants.grant` for fanfare grants |
| `spell-learned` | `{ id }` | `spells.learnSpell` |
| `spell-cast` | `{ id, cost }` | `spells.castSpell` |
| `effect-start` | `{ name, seconds }` | `effects.startEffect` |
| `effect-end` | `{ name }` | `effects` when time runs out or `clearEffect` |
| `pickup` | `{ entity, type, by }` | `Pickup` (walked over: no `by`), `pickups.collectPickup` |
| `explosion` | `{ x, z, radius, damage, source }` | items: bombs |
| `light` | `{ x, z, radius, source }` | items: fire wand, candle, lamp |
| `enemy-spawned` | `{ entity }` | `entities/manager.js` |
| `enemy-hit` | `{ entity, hit, result, damage }` | `damage.dealDamage` |
| `enemy-killed` | `{ entity, hit }` | foes: `Enemy.die` |
| `room-cleared` | `{ screen }` | `combat.checkRoomCleared` |
| `boss-intro` | `{ id, name, title, dungeon }` | foes-dungeon |
| `boss-phase` | `{ id, phase }` | foes-dungeon |
| `boss-defeated` | `{ id, dungeon, refight }` | `dungeons.defeatBoss` |
| `dungeon-enter` | `{ id, via }` (`door`, `start`) | `dungeons.js` |
| `dungeon-leave` | `{ id }` | `dungeons.js` |
| `dungeon-complete` | `{ id, orb }` | `dungeons.completeDungeon` |
| `keys-changed` | `{ group, count, delta }` | `keys.js` (small keys), `dungeons.js` (colors, master) |
| `shutters-closed`, `shutters-opened` | `{ screen }` | dungeon |
| `switch-pressed` | `{ id, tx, tz, kind, on }` | dungeon |
| `block-pushed` | `{ tx, tz, toX, toZ }` | dungeon |
| `torch-lit` | `{ tx, tz }` | dungeon |
| `secret-found` | `{ kind, tx, tz }` | dungeon, overworld |
| `shop-buy` | `{ shop, entry, price }` | `shops.buy` |
| `inn-rest` | `{ inn, price }` | `services.innRest` |
| `music-change` | `{ id, from }` | `music.playMusic`, `stopMusic` |
| `new-game` | `{ profile }` | `progress.startNewGame` |
| `saved` | `{ slot, ok }` | `saves.saveSlot` |
| `loaded` | `{ slot }` | `saves.loadSlot` |
| `settings-changed` | `{ key, value, old }` | `settings.setSetting` |

Events from world and look (`room-enter`, `area-enter`) arrive when feat/world
is merged; the rest fire on this branch already or are the named stream's to
emit.

---

## 7. Input

`core/input.js` reads keyboard, one standard-mapping gamepad and touch as
named actions. Bindings follow spec 7.1; `input.clashes()` lists any key bound
to two actions of one context and must stay empty (tested).

| Action | Context | Keyboard | Gamepad (standard) | Touch |
|---|---|---|---|---|
| `up`, `down`, `left`, `right` | play, menu | WASD, arrows | left stick, d-pad (12-15) | stick |
| `sword` (also talk, open) | play | J, Z | A (0) | A (`#btn-a`) |
| `item` (item or spell on the ring) | play | K, X | B (1) | B (`#btn-b`, shown once an item is owned) |
| `dash` | play | Space | X (2) | D (`#btn-dash`) |
| `guard` (hold) | play | Shift (left, right) | RB (5) | G (`#btn-guard`) |
| `map` | play | M | LB (4) | Map (`#btn-map`) |
| `inventory` | play | Tab | Y (3) | Menu (`#btn-inv`) |
| `prev-item`, `next-item` | play, menu | Q, E | LT (6), RT (7) | tap the HUD item slot (ui: `input.tap('next-item')`) |
| `menu` (pause) | play | Enter, Esc, P | Start (9) | Pause (`#btn-start`) |
| `confirm` | menu | J, Z, Enter, Space | A (0) | tap |
| `cancel` | menu | K, X, Esc, Backspace | B (1) | |
| `mute` | play | N | | |

**Settled:** M opens the map and N mutes (the M1 M-for-mute is gone); Space
is dash in play and confirm in menus, so the sword is J or Z only. Menus read
`confirm` and `cancel` before `menu`, so Enter confirms inside a menu and
Start, Esc or P close one only when neither fired.

**Semantics.**

- `input.pressed(a)`: went down since the last tick. Presses (and releases)
  are latched until the end of the next tick, so a tap between two frames is
  seen once, also when tests step by hand.
- `input.held(a)`: down now (any key, pad button, touch button or test).
- `input.released(a)`: went up since the last tick.
- `input.consume(a)`: mark a press handled; later readers this tick miss it.
- `input.move()`: `{ x, z, len }` from keys, d-pad, sticks (len up to 1);
  `input.move8()`: `{ x, z, dir }` snapped to 8 directions (the hero moves
  8-way only, spec 7.3).
- Hold actions: act on `pressed`, keep going while `held`, stop on `released`
  (guard; dash with the `dashHold` option).
- Changing mode clears latched presses, so one press never acts in two modes;
  a mode's `carry: ['sword']` re-presses on the first tick after it ends.
- Gamepads are polled once per tick, the first time anything reads input; the
  left stick and the touch stick have a radial dead zone of
  `TUNING.hero.deadzone` (0.3), rescaled so movement starts at 0 past it.
- `input.lastDevice()`: `'keyboard' | 'gamepad' | 'touch'`, for button
  prompts (`prompts.buttonLabel`).
- Rebinding: `input.bind(action, codes)`, `bindPad(action, buttons)`,
  `resetBindings()`, `bindings()`; tests use `setPadSource(fn)` for a fake pad
  and `down`, `up`, `tap`, `setStick` for virtual input.

**Touch layout** (shown on coarse pointers): the stick bottom left; Map, Menu
and Pause pills and the G, D, B, A buttons bottom right, fitting a 390 px wide
phone with 16 px gutters (tested). Each button holds its action while pressed.

---

## 8. APIs

Every module below is reachable from tests as
`window.__voxelHeroes.game.<name>` (8.22). "Stand-in" marks behaviour that is
a thin layer over M1 code until the owning stream replaces it.

### 8.1 Hero: `game/hero.js` (hero)

```js
import { hero } from '../game/hero.js';
hero.facing();            // 'north' | 'east' | 'south' | 'west'
hero.facingVector();      // { x, z }
hero.position();          // { x, z } world, lx, lz local to the screen
hero.spot();              // a spot, for warps and respawn points
hero.isGuarding(); hero.isDashing(); hero.isFullLife(); hero.isAlive(); hero.isInvulnerable();
hero.receiveHit({ damage: 2, from: enemy, kind: 'contact' });   // -> 'blocked' | 'hit' | 'ignored'
hero.heal(2);             // units restored
hero.setPose('cheer', 1); hero.cheer(1); hero.pose();
hero.lockInput(0.25); hero.inputLocked();
hero.addStatus('paralyzed', 1); hero.hasStatus('paralyzed'); hero.statusLeft(name); hero.clearStatus(name);
hero.inDoorway(); hero.canAct();       // not locked, not paralyzed, not in a doorway, in play
hero.move(dx, dz);        // push him against walls (conveyors, currents); true if stopped
hero.place(x, z, yaw);    // local tiles, same screen
hero.warp(spot);          // fade out, move, fade in
hero.respawn({ spot });   // stand up with full life and magic (default: respawnSpot('death'))
hero.fall();              // a pit: 2 units, back to where he entered the room
hero.blade();             // bladeStats() + bladeSize(): what the blade does now
```

`receiveHit({ damage, from, kind, tier, source, knockback, unblockable, ignoreIframes })`
is the only way anything hurts the hero:

- `damage`: base units. The hero takes `max(1, floor(damage x difficulty x (1 - ring cut)))`,
  or everything in one-hit mode (`damageTaken(base)`).
- `from`: `{ x, z }` or an entity: the direction for the guard and the push;
  `null` for hazards underfoot.
- `kind`: `'contact'` (bodies, swords), `'projectile'` (shots) or `'hazard'`
  (spikes, lava, pits, swamp; never blocked).
- `tier`: for projectiles, the shield tier that blocks it (2 arrows and basic
  shots, 3 magic bolts, 4 fire, 5 lightning, 6 everything blockable);
  `Infinity` or `unblockable: true` for shots nothing blocks. Contact is
  blocked by any shield.
- Returns `'ignored'` (not in play, down, blinking, invulnerable),
  `'blocked'` (the guard stopped it: the attacker recoils
  `TUNING.guard.attackerKnock` tiles and is stunned `attackerStun` s) or
  `'hit'`. A hit locks input for `TUNING.damage.knockLock` s.

Stand-ins until the hero stream lands: the guard is up while guard is held
and the hero is not thrusting (a play hook); `facing()` is the cardinal
nearest the body's yaw; the push and i-frames are M1's (`combat.hurtPlayer`:
1.1 s, speed 8); `lockInput` eats sword, item and dash presses but not
walking. Gear grants: `shield-1`..`shield-6`, `boots-dash`, `boots-swamp`,
`ring-quarter`, `ring-half` write `state.gear` (placeholder names). An item
get puts the hero in the cheer pose for 1 s.

Revival: `registerReviver(id, ({ amount, info }) => units)` in
`systems/combat.js`; the first reviver (by id) that answers above 0 saves the
hero (`player-revived`), otherwise `player-died`. Revive dust (items)
registers one that answers `TUNING.progression.revive` while the dust is
owned, and spends it.

### 8.2 Life, magic, money: `game/vitals.js` (contracts)

```js
heal(2, 'heart'); setLife(1, 'drain'); addMaxLife(2); addHeartPiece();
restoreMagic(1); spendMagic(3) /* false if short */; addMaxMagic(1); setMagic(0, 'drain');
addCoins(100, 'chest'); spendCoins(30, 'shop') /* false if short */; canAfford(30); addTokens(1);
refill({ life, magic, reason }); isFullLife(); hearts(units); walletMax();
```

Every change emits `life-changed`, `magic-changed` or `coins-changed` with a
reason; writes that bypass the module are reported at the next play tick
with `reason: 'direct'`. Damage never goes through here: use `receiveHit`.

### 8.3 Damage to enemies: `game/damage.js` (contracts)

```js
dealDamage(enemy, { amount: 4, source: 'arrow', from: arrow, swingId });
// -> { result: 'hit' | 'killed' | 'immune' | 'blocked' | 'ignored', damage }
damageAt(x, z, 1.5, { amount: 6, source: 'bomb' });   // everything in the radius
```

Options: `amount` (points), `source` (one of `SOURCES`: sword, beam, spin,
dash, arrow, bomb, boomerang, grapple, fire, book, quake, reflect, hazard,
enemy), `from` (direction), `knockback` (tiles; default `TUNING.enemy.knock`
1.5, heavy targets 0.5, over `knockTime` 0.2 s), `stun` (s; default
`stagger` 0.25; the boomerang passes 2.0), `freeze` (s), `swingId` (one
thrust, arrow or blast hits a target once), `by`.

Enemies describe themselves with fields the foes streams set: `immune: [sources]`,
`weak: { source: multiplier }`, `guards(hit)` (a front guard), `boss`,
`heavy`, `shatter: false` (casters: frozen hits are immune), `frozenT`, and
`hurt(hit)`, `onImmune(hit)`, `onBlocked(hit)`. A frozen enemy that is not a
boss dies to any hit (spec 8.2); bosses never freeze. The hit object carries
`tiles` and `stun` for a new Enemy, and `knockback` as the M1 speed for the
old one. Every result but `'ignored'` emits `enemy-hit`.

### 8.4 Projectiles: `entities/projectile.js` (contracts)

```js
class Arrow extends Projectile {
  constructor(opts) { super(opts, { owner: 'hero', damage: 4, speed: 12, source: 'arrow', geometry: arrowGeometry() }); }
}
registerEntity('arrow', (opts) => new Arrow(opts));
spawn('arrow', { x, z, dir: hero.facingVector() });
```

Fields: `owner` (`'enemy'` hurts the hero, `'hero'` hurts enemies), `damage`
(units against the hero, points against enemies), `speed` + `dir` or `vx, vz`,
`tier` (default 2), `source`, `reflectable`, `deflectable` (enemy shots:
both true), `pierce`, `passWalls`, `range` (default 20), `r`, `height`,
`hitOpts` (extra `dealDamage` options). Each tick it moves, fizzles past its
range or off the screen, calls the tile's `onShot` on a wall, calls
`hero.receiveHit({ kind: 'projectile', tier })` (blocked: reflected at 1.5 x
under the reflect effect, else it breaks) or `dealDamage` on enemies (once
each, then it breaks unless `pierce`). The blade knocks enemy shots apart.
Override `onHitWall`, `onHitHero`, `onHitEnemy` (return false to fly on),
`onReflect`, `animate`, `shatter`.

### 8.5 Enemies

- **Base.** M1's `Enemy` (`entities/enemy.js`, foes-overworld) with
  `entity.js`'s contract. The foes streams move enemy contact and shots onto
  `hero.receiveHit` and `Projectile`, and hits onto `dealDamage`'s fields.
- **Spawn groups** (`entities/spawn-group.js`): a marker
  `{ type: 'group', of: ['blob', 'blob', 'hopper'], count: [2, 6], minDist }`
  places that many enemies on random free floor tiles of the screen on every
  entry (spec 5.5, 6.5); hard mode adds 50%. Extra fields go to each enemy.
- **Cleared rooms** (spec 6.5): an entity may remove itself in `onAdd()`; the
  manager then does not announce it (`enemy-spawned`). Room memory is
  foes-dungeon's, keyed by screen id.
- **Bestiary** (`game/bestiary.js`): `registerBestiary({ id: 'hopper', name, band, hp, text, where, bookHits: 3 })`
  from each enemy's file; sightings and wins count by entity type;
  `recordBookHit(type)` for the book; `bestiaryEntries()` for the menu.
- **Drops** (`systems/drops.js`): `rollDrop(table, x, z)`, `addDrop`,
  `registerDropTable`; foes-overworld turns the M1 tables into the spec's packs
  A-E with coin pickups.
- **Bosses**: foes-dungeon emits `boss-intro` and `boss-phase`, and when the boss
  bursts calls `defeatBoss(dungeonId)` from `game/dungeons.js`, which returns
  `{ heartContainer, coins }` (the first kill pays a container and
  `TUNING.economy.bossPay[n - 1]`, a re-fight coins only); the boss drops them
  with `spawn('heart-container' pickup or chest)` and `dropCoins(x, z, coins)`.

### 8.6 Pickups and money on the floor: `game/pickups.js` (contracts)

```js
collectPickup(entity, { by: 'blade' });   // the blade, boomerang or grapple touched it
dropCoins(x, z, 250);                      // coin pickups worth 250, largest first
coinPieces(250);                           // ['coin-100', 'coin-100', 'coin-10', ...]
```

Pickup types: `heart`, `magic`, `coin-1`, `coin-10`, `coin-100` (items),
`key` (dungeon), and the items stream's `arrows-5`, `bomb-1`. The M1 `gem`
and `gem5` stay until the drop tables move to coins. Pickups last
`TUNING.pickups.life` (8.5 s), boss coins `bossDropLife` (15 s).

### 8.7 Grants and the item get: `systems/grants.js` (contracts)

```js
registerGrant('bombs-bag', (n, ctx) => { ... }, { name: 'Bomb Bag', fanfare: true, text: 'A bigger bag!' });
grant('heart-container');                         // chests, shops, NPCs, bosses
grant({ grant: 'coins', amount: 100 });          // chest contents may be objects
grant('blade-2', 1, { source: 'pedestal' });
setItemGetPresenter((get) => { ... });            // ui: { id, amount, name, text, source }
grantMeta('heart-piece');                         // { name, fanfare, text, kind }
```

A fanfare grant is an item get: after it is applied, `item-get` fires and the
presenter shows it (default: the M1 banner; the ui stream shows the cheer pose
and one dialog line). A registered item is grantable by id; the first grant
of one is an item get unless its `fanfare` is false. `ctx.source` says where
it came from (`'chest'`, `'shop'`, `'npc'`, `'boss'`, `'pickup'`; null from
scripts and tests); `ctx.fanfare === false` makes any grant quiet. **A
presenter must not wait for input when `source` is null**, so scripted
grants and tests never stall.

Grant ids in use: `coins` (`gems`, `gem`: M1 names), `heart`, `magic`,
`key`, `heart-container`, `heart-piece`, `magic-container`, `token`,
`shield-1`..`6`, `boots-dash`, `boots-swamp`, `ring-quarter`, `ring-half`,
`map`, `key-boss` (the current dungeon's, or `ctx.dungeon`), `key-red`,
`key-blue`, `key-green`, `key-master`, `orb-1`..`6`, every sword id, every
spell id, and every item and ammo id.

### 8.8 Items, the quick ring, spells: `items/*`, `game/spells.js` (items)

```js
registerItem({ id: 'bombs', name: 'Bombs', icon: '<svg ...>', kind: 'tool', ammo: 'bombs', maxAmmo: 10, use(ctx) { ... } });
giveItem('bow'); hasItem('bow'); addAmmo('arrows', 10); useAmmo('arrows', 1); ammo('arrows');
ringItems(); isOnRing('book'); setOnRing('book', false);   // the inventory's "E" tags (spec 9.1)
selectItem(id); cycleItem(1); selectedItem(); useSelectedItem(player);
```

Item fields for M2: `kind` (`'tool' | 'spell' | 'consumable' | 'passive'`),
`fanfare`, `getText`, `bottle` (contents of a bottle). Tools and spells
share the B ring; cycling does not pause.

```js
registerSpell({ id: 'spell-reflect', name: 'Reflect', icon, cost: TUNING.spells.reflect.cost,
  cast: ({ spell, cost, hero }) => { startEffect('reflect', TUNING.spells.reflect.time); return true; } });
learnSpell('spell-reflect');    // on the ring, max magic +1; grant('spell-reflect') does the same with an item get
spellCost('spell-quake');       // [might, focus] by trait, thrift special -1 per 2 levels, at least 1
castSpell('spell-quake');       // 'cast' | 'no-magic' | 'blocked' | 'failed' | 'unknown'
```

`castSpell` checks `hero.canAct()` (so no spells in doorways) and the magic,
calls `cast`, and only then spends and emits `spell-cast`; a cast that
returns false spends nothing. The spell's item `use` is `castSpell`.

### 8.9 Swords and the smith: `game/swords.js` (hero)

```js
registerSword({
  id: 'blade-2', name: 'Fen Edge', source: 'a pedestal', order: 20,
  base: { strength: 3, spin: 1 },                      // unlisted stats: 0 (strength 1)
  max: { length: 5, width: 5, strength: 9, spin: 1, pierce: 1 },   // default: base
  price: { length: 80, width: 80, strength: 240, pierce: 450 },    // coins per level; no price: not sold
  budget: 2200,                                        // most coins a smith takes for it
  special: null,                                       // or one of SPECIALS; its level is the special stat
});
giveSword(id); equipSword(id); hasSword(id); ownedSwords(); equippedSword();
swordLevels(id); swordStars(id);     // { stat: { level, base, max } } for the stars
levelPrice(id, stat); canBuyLevel(id, stat);   // { ok, reason: 'not-owned' | 'not-sold' | 'max' | 'budget' | 'coins', price }
buyLevel(id, stat); resetSword(id);  // reset: back to base, coins spent are lost, budget freed
bladeStats(); bladeSize(stats);      // the blade now: the full-life rule and the might trait
```

Stats (spec 10.5): length 0-20, width 0-20, strength 1-20, spin 0-1, beam
0-3, pierce 0-1, special 0-5. `SPECIALS`: `coin-burst`, `freeze`, `pinch`,
`swift`, `star`, `thrift`, `rare-slayer`. The starter is `blade-start`
("Squire Blade", from the king): strength 3, spin 1, everything else 0,
budget 0. Below full life the blade is small (1.25 tiles), thrusts with the
base strength and has no spin, beam, pierce or special, except pinch. The
might trait adds 1 strength. Size: length `2.5 + 0.7 L` tiles, width
`0.25 + 0.1 W`, hit width at least 0.35, reach = length + 0.35.

Stand-in: M1's swing (`systems/sword.js`) keeps its own numbers until the
hero stream reads `bladeStats()`.

### 8.10 Dungeons: `game/dungeons.js`, `systems/keys.js` (dungeon)

```js
registerDungeon({
  id: 'd1', number: 1, name: '...', areas: ['d1', 'd1-boss'],
  entrance: { area: 'd1', screen: [3, 9], x: 8, z: 10.4, yaw: Math.PI },   // area.entrance wins if set
  exit: { area: 'overworld', screen: [2, 3], x: 8, z: 6.5, yaw: 0 },
  keyGroup: 'd1', boss: 'boss-serpent', bossRoom: 'd1-boss:0,0',
  tool: 'boomerang', smallKeys: 4, music: 'dungeon-1', canvas: [8, 10], floors: 1,
});
currentDungeon(); dungeonOfArea(areaId); dungeonEntrance(id); dungeonExit(id);
dungeonProgress(id);   // { id, entered, map, bossKey, boss, complete, portal, keys }
giveMap(id); giveBossKey(id); openPortal(id); defeatBoss(id); completeDungeon(id); orbs();
dungeonRooms(id);      // [{ key, area, screen, name, room: 'J-4', floor, visited, boss }]
roomLabel([i, j]);     // { floor, room }: floor f uses local rows 11 f to 11 f + 9
addColorKey('red'); useColorKey('red'); colorKeyCount('red'); hasMasterKey();
addKeys(1); useKey(); keyCount();   // small keys, per key group (systems/keys.js)
```

Progress is flags (spec Appendix B): `dungeon:<id>:map`, `dungeon:<id>:bosskey`,
`boss:<id>` (by dungeon, as spec P1.5's `boss:d1`), `orb:<n>`, plus
`dungeon:<id>:entered`, `:complete`, `:portal`, and the dungeon stream's
`dungeon:<id>:door:<room>:<side>`. A hero who falls in a dungeon, or loads a
save made in one, gets up at its entrance (a respawn rule). Walking into or out
of a dungeon's areas fires `dungeon-enter` / `dungeon-leave`. The crypt is
registered as dungeon 0 (`src/dungeons/crypt.js`); D1 is dungeon 1.

### 8.11 Shops, inns, menus: `game/shops.js`, `game/services.js` (overworld), `game/menus.js` (ui)

```js
registerShop({ id: 'v1-shop', name: '...', place: 'v1', tier: 1, entries: [
  { id: 'heart', grant: 'heart', price: 5 },
  { id: 'bow', grant: 'bow', price: 30, stock: 1, when: () => hasFlag('boss:d1') },
  { id: 'potion-life', grant: 'potion-life', price: 80, can: () => state.bottles.includes('empty') || 'no-bottle' },
]});
shopEntries('v1-shop');       // the shelf: each entry with { name, price, left, ok, reason }
buy('v1-shop', 'bow');        // { ok, reason: null | 'coins' | 'sold-out' | 'unavailable' | <can reason>, price }
registerInn({ id: 'inn-1', name: '...', place: 'inn-1', price: 10, bed: spot });
innRest('inn-1');             // pays, refills, moves the respawn point to the bed
restHere({ life, magic });    // bedrolls and the tent
await openMenu('shop', { shop: 'v1-shop', speaker: 'Mags' });
await openMenu('smith', { speaker: '...', sword });   // default: the equipped sword
await openMenu('inn', { inn: 'inn-1', speaker: '...' });   // -> true if he stayed
registerMenu('shop', async ({ shop, speaker }) => { ... });   // ui: the real screen
```

Shopkeepers, the smith and innkeepers (overworld NPCs) call `openMenu`; the
ui stream registers screens for `shop`, `smith` and `inn` with
`registerMenu`, which replaces the dialog fallback (each id takes one
screen). Until then the fallbacks run the same APIs through dialog choices.
A shop entry pays out through its grant with `ctx.source: 'shop'`.

### 8.12 NPCs and dialogue (overworld)

An NPC is an `Npc` subclass (`entities/npc.js`) registered as an entity type
and placed with a marker or `spawnsAt`; the generic `'npc'` says its `lines`.
It is solid, faces the hero and answers A through `onInteract`; its `prompt`
(default `'Talk'`) labels the prompt bar.

```js
class Smith extends Npc {
  constructor(opts) { super(opts, { model, name: 'Brannoc', lines: ['...'] }); this.prompt = 'Talk'; }
  async talk() { await showDialog(['Well met, {hero}.']); await openMenu('smith', { speaker: this.name }); }
}
const choice = await ask('Stay the night?', ['Stay', 'Leave'], { speaker });   // index, or undefined if closed
```

`showDialog(lines, { speaker, choices, speed })` pauses play in the `'dialog'`
mode and resolves when the box closes; `{hero}` becomes the hero's name.
Conversation state is flags with the stream's prefix (`overworld:talked:smith`).

### 8.13 Music: `game/music.js` (overworld)

`registerMusic({ id, name, play(out) { ...; return stop; } })`,
`playMusic(id)` (unknown ids throw; `music-change`), `stopMusic()`,
`currentMusic()`, `areaMusic(area)` (`area.music`, else its dungeon's).
Entering another area plays its track. Silent placeholders exist for
`title`, `overworld`, `village`, `dungeon`, `boss`; M6 writes the music.
`play(out)` gets the music bus from `core/audio.js`.

### 8.14 Loading cards: `game/cards.js` (ui)

`registerLoadingCard({ id: 'card-crypt', title, art, areas: ['crypt'] | '*', text, order })`;
`cardForArea(areaId)` (a listing card, else a `'*'` card); `markCardSeen(id)`
(the gallery, saved); `galleryCards()`. The ui shows `cardForArea(area.id)`
on `area-enter` for at least `TUNING.load.cardMin` s while the `loadingArt`
option is on. Card data: overworld (`cards/default.js`) and dungeon.

### 8.15 Places: `game/places.js` (contracts)

`spotHere()`, `goToSpot(spot, { fade })`, `resolveSpot(spot)`, `fullSpot(spot)`,
`setRespawn(spot)`, `respawnSpot('death' | 'load', { area })` (respawn rules
first, then `state.respawn`, then the start), `registerRespawnRule(id, fn)`,
`roomEntry()` (where the hero came into this screen), `onAreaChange(fn)`,
`hasVisited(screenOrId)`, `screenRect(screen)`, `currentRect()`, `screenId(screen)`.
These work on main and after feat/world merges (spots then resolve through
`world.resolveSpot`).

### 8.16 Profile: `game/progress.js` (contracts)

`startNewGame({ name, class, trait, difficulty })` resets, applies the class's
life and magic (`classStats`), starts play and emits `new-game`. `CLASSES`
(`life`, `balanced`, `magic`), `TRAITS` (`might`, `focus`), `DIFFICULTIES`
(`normal`, `hard`, `one-hit`), `cleanName` (letters, digits, spaces, `'` and
`-`, at most `TUNING.profile.nameMax` 8), `heroName()`, `hasTrait`,
`isOneHit`, `damageMultiplier` (2 in hard mode).

### 8.17 Settings: `game/settings.js` (ui)

`setSetting(key, value)` (unknown keys throw; values not allowed return
false), `getSetting`, `registerSettingApplier(key, fn)` (runs now and on each
change), `resetSettings`, `textSpeed()`. Stored in localStorage for the
browser, not per slot; defaults in `TUNING.options`.

| Key | Values (default) | Applied by |
|---|---|---|
| `camera` | `'A'`-`'D'` (`'A'`) | world's `chooseCameraPreset` (wired) |
| `look` | `auto`, `high`, `medium`, `low`, `flat` (`auto`) | look's quality level (ui wires it) |
| `seams` | bool (true) | look's `setSeams`, after returning to the title (ui wires it) |
| `brightness` | 0.5-1.5 (1) | look (ui wires it) |
| `saturation` | 0-2 (1) | look (ui wires it) |
| `minimap` | bool (true) | ui |
| `loadingArt` | bool (true) | ui |
| `textSpeed` | `slow`, `normal`, `fast`, `instant` (`normal`) | ui (dialog, wired) |
| `largeText` | bool (false) | ui (dialog, wired) |
| `sway`, `cornerAssist`, `spinAssist`, `dashHold` | bool (true, true, false, false) | hero |
| `autosave` | bool (false) | ui |
| `volume`, `music`, `sfx` | 0-1 (0.8, 0.7, 0.9) | `core/audio.js` (wired) |
| `muted` | bool (false) | `core/audio.js` and the HUD Sound button (wired; N toggles) |

### 8.18 Effects: `game/effects.js` (contracts)

`startEffect(name, seconds)` (`effect-start`), `effectActive(name)`,
`effectLeft(name)`, `clearEffect(name)` (`effect-end`). They count down in play
only and are not saved. Names: `reflect`, `reveal`, `quake`, `freeze`, `slow`,
`truesight` (items' spells), `star` (hero), `candle`, `lamp` (items; started
with `Infinity`, cleared on `screen-leave`).

### 8.19 Prompts: `game/prompts.js` (ui)

`registerPrompt({ id, order, action, label, when })` from any stream
(`label` may be a function returning text or null); `currentPrompts()`
(one per action, lowest order wins; play only); `buttonLabel(action)`
names the button on the last device used. Built in: Talk/Check/Open on A
(`findInteraction`), the selected item on B.

### 8.20 Save slots: `game/saves.js` (ui)

`saveSlot(n)` (`saved`), `loadSlot(n)` (`loaded`), `eraseSlot(n)`,
`slotSummary(n)` (`null` or `{ slot, time, ok, name, class, hearts, maxHearts, magic, coins, playTime, deaths, orbs, area }`,
read without loading), `slotSummaries()`, `SLOT_COUNT` 3. Where a load
resumes is `systems/flow.js`'s (ui): spec 11 wants `respawnSpot('load')`.

### 8.21 HUD (ui)

The HUD is widgets (`registerHudWidget({ id, region, order, mount, key, render })`)
that read `state` and query functions (`selectedItem`, `ringItems`, `keyCount`,
`currentPrompts`, `dungeonRooms`) and redraw when their key changes. Nothing
pushes into the HUD: a stream that wants something shown puts it in state or
emits an event, and the ui draws it (the key toast from `keys-changed`, the
item get from the presenter, the boss card from `boss-intro`). Readability rules
(12.4, `TUNING.readability`) are the ui's.

### 8.22 Test API: `window.__voxelHeroes.game` (contracts)

The contract modules themselves, so a test reaches every export:
`version` 1, `tuning`, `events`, `input`, `loop`, `save`, `audio`, `state`,
`grants`, `combat`, `interact`, `keys`, `inventory`, `items`, `projectile`,
`vitals`, `progress`, `places`, `effects`, `settings`, `hero`, `swords`,
`damage`, `spells`, `dungeons`, `shops`, `services`, `saves`, `bestiary`,
`music`, `cards`, `prompts`, `pickups`, `menus`. `window.__voxelHeroesGame`
holds the same object. Streams add their own debug handles under
`window.__voxelHeroes.game` only through a contract request.

---

## 9. Ids

- **Kebab-case**, and the spec's Appendix B ids where it names one: items,
  keys and progress, spells (`spell-*`), pickups, swords (`blade-*`), enemies,
  bosses (`boss-*`), places (`castle`, `v1`-`v3`, `inn-1`-`inn-3`, `cabin`,
  `trader`, `d1`-`d7`, ...).
- **Area ids**: overworld areas `ow-<col>-<row>` (spec 3: col 1-7, row 1-5,
  e.g. `ow-4-3`), towns and interiors by place id (`v1`, `inn-1`, `v1-smith`),
  dungeons by dungeon id (`d1`, with `d1-boss` for an arena of its own), test
  areas `test-<stream>-<name>`.
- **Flags**: the spec's (`dungeon:<id>:...`, `boss:<id>`, `orb:<n>`) plus the
  M1 ones (`taken:tx,tz`, `door:tx,tz`, `chest:tx,tz`); anything new is
  prefixed with the stream (`overworld:talked:smith`, `items:bag-1`).
  `world:seen:<gx>,<gy>` is not used: `state.visited` records every screen.
  The spec's `respawn`, `class`, `trait` and `mode` are `state.respawn` and
  `state.profile`.
- **Entity types**: the spec's enemy ids; NPC types `npc-<name>`; projectile
  types by what they are (`arrow`, `beam`, `rock-shot`); `group` is the spawn
  group.
- **Music** `overworld`, `village`, `dungeon`, `boss`, `title` and
  `dungeon-<n>`; **cards** `card-<area or place>`; **menus** `shop`, `smith`,
  `inn`; **effects** section 8.18.
- **Prefixes reserved for tests**: `probe-` (contracts-m2) and
  `test-<stream>-` (stream scenarios).

---

## 10. Global regions

Areas share one grid of tiles (feat/world, ARCHITECTURE.md "Global
regions"): an area's `origin: [x, y]` counts screens of its own size, so
regions are ranges of 16-tile screen columns; an area whose screens are not 16
wide is placed by tile with `at: [tx, tz]`. Areas that touch are joined, so
keep two empty screen columns between anything that must stay apart, and
between rooms and outdoor areas (their far band of scenery).

| Columns | For | Owner |
|---|---|---|
| 0-99 | the overworld: 7 x 5 areas edge to edge from `[0, 0]`; with W x H screens per area, area (c, r) (spec 3, 1-based) at `[(c - 1) W, (r - 1) H]`. Today's 3 x 2 `overworld` sits at `[0, 0]` | overworld |
| 100-199 | towns and other outdoor areas reached by warps: town t at `[100 + 10 t, 0]`, up to 8 x 10 screens | overworld |
| 200-299 | dungeons, 16 x 12 rooms: dungeon d at `[200 + 10 d, 0]`, floor f in local rows `11 f` to `11 f + 9`; boss arenas (22 x 16) as areas of their own placed by tile in the dungeon's free columns. The crypt is dungeon 0 at `[200, 0]`, D1 at `[210, 0]` | dungeon |
| 300-399 | interiors (houses, shops, inns, caves): building k at `[300 + 2 (k % 50), 2 floor(k / 50)]`; smaller rooms by tile at `[(300 + 2 (k % 50)) 16, 24 floor(k / 50)]` | overworld |
| 400-409 | sword yard | hero |
| 410-419 | overworld enemy field | foes-overworld |
| 420-429 | dungeon enemy and boss rooms | foes-dungeon |
| 430-439 | item and spell range | items |
| 440-449 | dungeon mechanics rooms | dungeon |
| 450-459 | overworld and town test screens | overworld |
| 460-469 | UI test screens | ui |
| 470-479 | world and camera tests (`test-borders.js`) | world |
| 480-499 | kit test areas (`kitroom.js`) | look |

Use the first 8 columns of a 10-column test block and leave the last 2 empty.
Test areas are reached by `teleport` only and never linked to the real map.

---

## 11. Tiles and markers

- **Tilesets.** `overworld` and `town` belong to the overworld stream,
  `dungeon` to the dungeon stream (existing chars from M1 and look-kits:
  `listTilesets()` lists them; `registerTile` throws on a duplicate). New tiles
  go in new files under `world/tiles/`. Items and foes add no tiles.
- **Hooks items and foes rely on.** Tiles answer `onShot` (arrows, the
  boomerang, fire bolts, enemy shots: check `ctx.projectile.source`), `onBomb`
  (`explosion` within its radius), `onLight` (`light`), `onSword`, `onPush`,
  `onEnter`, `onInteract`. Flags on a tile def: `grapple: true` (the grapple
  hooks it and pulls the hero; chests too), `blocksShots: false` (low tiles:
  water, pits, lava). A screen with `dark: true` is a dark room (the candle
  and lamp light it). Wall switches ignore the blade (spec 6.4).
- **Markers.** Spawn markers are per area and are the area owner's. Entity
  types named in markers belong to their stream (section 9); an unknown type
  is skipped with one warning until merge. Random enemies use the `group`
  marker (8.5).

---

## 12. Not settled yet

| Question | Why it is open | Who settles it, when |
|---|---|---|
| Boss arenas of 22 x 16 and their fixed camera (`TUNING.camera.bossHeight`) | feat/world places rooms of any size by tile, but the boss camera and a 22-wide room's doors are camera and world work, frozen in M2 | foes-dungeon and dungeon build the arena in their test columns and ask; M3 |
| Overworld screens at 16 x 16 (spec 4.1) instead of M1's 16 x 11 | presets B and C were tuned on 16 x 11 screens; a 16 x 16 screen may need camera changes (world, frozen) | overworld builds its new areas at 16 x 16 and reports what the camera needs |
| Where the game starts (`START` in `world/areas.js`) | spec P2.6 starts at the castle; `areas.js` is world's | overworld asks; M3 moves `START` |
| Loading a save at the respawn point (spec 11) | M1's flow resumes where the save was made; `respawnSpot('load')` answers the spec's rule | ui, in `systems/flow.js` |
| One camera choice or two | the options keep one in preferences; feat/world also saves one per slot | ui with world at M3; until then the slot's choice wins on load |
| Look options (`look`, `seams`, `brightness`, `saturation`) | stored and checked, but only look's code can apply them, and look is frozen | ui wires them to look's exports (`setSeams`, the quality levels) from its own files |
| The hero's feel numbers in M1 code | the i-frames (1.1 s, spec 1.5 s), push (speed 8, spec 1.0 tile in 0.15 s), passive shield and swing are M1's until the hero stream moves to `TUNING` | hero |
| Enemy contact and `rock-shot` bypass `receiveHit` | M1 enemies call `hurtPlayer` and `shieldBlocks` | foes-overworld moves them |
| Drops in `gem` and `gem5` | the M1 tables | foes-overworld (packs A-E, 8.7) |
| Rare spawns, hard mode's doubled rare chance | spawn groups do not place rares yet | foes-overworld |
| `lockInput` stops presses, not walking | the M1 player moves on its own | hero reads `hero.inputLocked()` |
| Where a boss arena that is its own area sits on the dungeon map | `dungeonRooms` gives it `room: null` | dungeon with ui |
| The `default` scenario starts with Enter (no class) | the ui's new-game flow is not built yet | M3 updates the scenario |
| Music | silent placeholders | M6 |
| Names of gear, swords and places in placeholders | working names only | their streams replace them |

---

## 13. Changing a contract

1. Do not edit a contracts file or another stream's file. Keep working
   against the current contract, with a stream-prefixed stand-in if needed
   (a `'items:...'` event, a field in your own module).
2. Write the request in your report under **Contract requests**: the file,
   the exact change (a diff if you can), who else it affects and why.
3. Contracts (the coordinator) applies accepted requests in one commit that
   every stream merges, or at M3, and updates this file and `contracts-m2.mjs`.

A stream may add, in its own files and without asking: entity types, items,
grants, swords, spells, shops, inns, cards, music ids, prompts, HUD widgets,
modes, play hooks, sounds, `TUNING` keys in its section, flags with its
prefix, and state fields declared with `defineState` in its own files (tell
the others in the report).

---

## 14. M1 files the contracts changed

`player.js` is untouched. `systems/combat.js` needed one edit that could not
be avoided: `hurtPlayer(dmg, fromX, fromZ, info)` takes the hit's kind and
source (and `knockback: false` for hazards), passes them on in
`player-hurt`, and asks the revivers (`registerReviver`) before the hero
dies (`player-revived`). The rest:

| File | Change |
|---|---|
| `core/state.js` | `SAVE_VERSION` 2 with the `gems` to `coins` migration; `coins` field, `gems` alias |
| `core/input.js` | spec 7.1 actions and bindings, gamepad, touch buttons, `move8`, `clashes`, `lastDevice` |
| `core/loop.js` | fixed 1/60 s steps with an accumulator (`advance`) |
| `core/events.js` | the `EVENTS` catalogue, `onAny` |
| `core/save.js` | `SLOT_COUNT`, `readPrefs`, `writePrefs` |
| `core/audio.js` | music and effects buses, `setMuted`, `setVolumes`, `musicOutput` |
| `entities/manager.js` | `enemy-spawned`; an entity removed in `onAdd` is not announced |
| `systems/grants.js` | grant meta, fanfare, the item-get presenter, the core grants |
| `systems/interact.js` | `findInteraction` for the prompt bar |
| `systems/keys.js` | `keys-changed` |
| `items/registry.js`, `items/inventory.js` | item `kind`; the quick ring (`setOnRing`, `ringItems`) |
| `ui/dialog.js`, `ui/dialog.css` | text speed and large text options, `{hero}`, `ask`, wrapping choices |
| `ui/hud.js` | mute through the `muted` option |
| `content.js` | globs for the M2 content folders |
| `index.html`, `style.css` | touch buttons for dash, guard, map, inventory and pause; the title's controls |
| `README.md` | the controls table |
| `scripts/scenarios/contracts.mjs` | the sword is J now that Space dashes |

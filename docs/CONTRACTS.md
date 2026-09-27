# M2 contracts

Seven streams build M2 at the same time: **hero**, **items**,
**foes-overworld**, **foes-dungeon**, **dungeon**, **overworld** and **ui**.
This file fixes everything more than one of them touches: who owns each file,
the units, the shared state, the events, the input actions and the APIs. All
of it already exists in code on `feat/contracts`, and
`scripts/scenarios/contracts-m2.mjs` checks it (173 checks, with probe
content only: section 2, "Fixtures", lists the M1 content it still reads). A
stream builds behind these names and changes none of them on its own;
section 13 says how to ask for a change.

The gameplay spec (`/mnt/project-files/design/gameplay-spec.md`, "the spec")
owns mechanics and numbers, the art bible
(`/mnt/project-files/design/art-bible.md`) owns the look, and
[ARCHITECTURE.md](ARCHITECTURE.md) explains the registries, the test hook and
the harness. Where ARCHITECTURE.md's M1 notes on parallel work (its feature
table and screen origins) differ from this file, this file wins. The stream
briefs and the research drafts (`design/research/*.draft.md`) came before
the spec: where they disagree with it, the spec and this file win (section 4,
"Briefs and drafts against the spec").

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
  `registerPlace`, `registerClearRule`, `registerDropTable`, `registerMode`,
  `registerPlayHook`, `registerSfx`, `defineState`; the ui alone
  `registerHudWidget`). Never edit a list in someone else's file.
- Talk to other streams through events, ids and the APIs in section 8. Code
  against a contract even when its real implementation is another stream's
  work: until that lands, the stand-in behind the name answers (the M1 sword,
  the dialog menus, the banner item get, silent music). A marker, chest,
  shop entry or warp that names another stream's id warns and is skipped
  until merge.
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
| hero | 8-way body, 4-way attack facing (`player.facing`, apart from the body's yaw), 0.8 box, corner assist (7.2, 7.3); thrust, full-life blade, spin, beam, pierce, specials (7.4-7.7); guard (7.8); dash (7.9); damage, i-frames, knockback, low-life beep (7.10); hazards, stairs, ledges and conveyors under the hero, read from tile fields (7.3, 7.11, section 11); an unarmed hero (no sword, shield 0: the prologue); the guard, item and shield-tier poses (`models/hero/*`) and the sword effects (`systems/sword-fx.js`); blade-2 to blade-4 (10.5) | the real `hero` API (8.1); `sword-swing`, `sword-hit`, `blade-changed`; blade hits through `dealDamage` (with `crit`); blade pickups through `collectPickup`; sword models for the item get | `dealDamage`, `Projectile` (beams), swords registry, `effects` (star), `pickup`'s `wasFull`; `scripts/lib/bot.js` `fight()` and `steer()` (section 2) |
| items | the quick ring rules (9.1); tools (9.2; the grapple through `hero.pull`); consumables and bottles (9.3; the warp feather over `warpPlaces` and the `warp` menu); spells (9.4, `src/spells/`; freeze through `freezeAt`, slow through `worldScale`); revive dust (a reviver); pickups (coins, magic, arrows-5, bomb-1, heart-container, token); bombs' blast; the prize models of its items (`models/items/*`) | item and spell ids for shops and chests; `explosion`, `light`; shots that call tile `onShot`; the effects `reflect`, `reveal`, `quake`, `freeze`, `slow`, `truesight`, `candle`, `lamp` | `hero`, `dealDamage`, `freezeAt`, `Projectile`, `vitals`, places, tile hooks and flags (section 11) |
| foes-overworld | the `Enemy` base's M2 surface and the AI helpers (`entities/ai.js`: 8.2), with the tell and alert primitives (12.4); its roster (section 9: hopper, blob, blob-blue, buzzer, stump, archer, leaper, guardian, treasure-slime, wyrm, and M1's slime and spitter); spawn groups, rares and crowns, and the overworld clear rule (5.5); drop tables `pack-a` to `pack-e`, `bush`, `pot` in coins (8.7); bestiary entries | `Enemy`, AI helpers and tells foes-dungeon builds on; the drop tables; `enemy-killed` | `hero.receiveHit`, `dealDamage` fields, `Projectile`, `dropCoins`, `clears` |
| foes-dungeon | skeleton, bat, gazer; turret (with its glow), blade trap, arrow trap (6.4, 8.3); the boss template (8.5), boss-serpent (8.6) and the re-fight `boss-tombstone`; the `boss-intro` mode with the camera push-in, phases, burst and payout (6.6); the room clear rule (6.5) | entity types for dungeon maps; `boss-intro`, `boss-phase`; `defeatBoss` calls | M1 `Enemy` (then foes-overworld's), its AI helpers and tells, `receiveHit`, `Projectile`, `dungeons`, `dropCoins`, the `heart-container` pickup, the `boss` presets |
| dungeon | rooms, doors and keys (6.2, 6.3: small-key doors and chests through `systems/tile-actions.js`, boss-key and colored locks in its own tiles); the puzzle and hazard kit except traps (6.4), hazards as tile fields (section 11); persistence (6.7); D1 (6.9): its entrance room at the pinned spot, the arena map, the doors that shut, the reward room with the orb, the sage marker and the warp tile; dark rooms (lighting `dark` and the candle and lamp light); the dungeon map data; small keys; its cards and `dungeon-<n>` music | `registerDungeon('d1')`; the dungeon events (6); tiles that answer items' hooks | grants (`map`, `key-boss`, colored keys), `explosion`, `light`, `room-cleared`, `clears`, spawn groups, foes' entity types, `npc-sage` |
| overworld | the P2.7 slice of the overworld at 16 x 16 screens (areas (3,2), (4,2), (4,3), (5,3); 5.1-5.3); terrain kit use and gating (5.2, 5.4) with the ledge, stairs and hazard tile fields; V1 as a lattice area, towns, NPCs and interiors (5.6; `interior` and `cave` tilesets of its own); shop counters (`shop-item`) and inns (10.4, 11); smith, sage (`npc-sage`) and trader NPCs; the castle and prologue (P2.6, `registerPrologue`); the D1 entrance and its exit spot; named places (`registerPlace`); loading cards and music for its areas | shops, inns, NPCs, places, cards, area music | `openMenu`, `innRest`, `shops`, swords, spells (sages grant them), foes' entity types |
| ui | the HUD (12.1) in the art bible's regions; pause, inventory, options, new game (`startNewGame({ prologue: true })`), file select, game over (11, 12.2); world and dungeon maps (4.6); the shop (NPC-run services), counter, smith, inn and warp screens; the item get; key toasts; loading cards and the gallery; the dialog box; boss name cards with the hint; `systems/flow.js` (title, new game, load, continue, autosave) | the screens; `setItemGetPresenter`; `registerMenu` | everything, read-only |

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
| `scripts/lib/bot.js` | world | one exception: the hero may change `fight()` and `steer()` to the spec's controls (spec 7.3: close in until the foe is in line on one axis, turn with `hero.faceToward`, then press the sword; stop within one 8-way step), and nothing else in the file, if world has not done it first |
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
| `tuning/boss.js` | foes-dungeon | `boss` and `traps` |
| `tuning/dungeon.js` | dungeon | |
| `tuning/economy.js` | overworld | |
| `tuning/ui.js` | ui | |

**Game modules (`src/game/`)**

| Path | Owner | Notes |
|---|---|---|
| `game/fields.js`, `vitals.js`, `damage.js`, `places.js`, `progress.js`, `effects.js`, `watch.js`, `pickups.js`, `clears.js`, `camera-presets.js`, `testapi.js` | contracts | |
| `game/hero.js`, `game/swords.js` | hero | keep every exported name, argument and return value |
| `game/spells.js` | items | same |
| `game/bestiary.js` | foes-overworld | same |
| `game/dungeons.js` | dungeon | same |
| `game/shops.js`, `game/services.js`, `game/music.js` | overworld | same |
| `game/cards.js`, `game/prompts.js`, `game/saves.js`, `game/settings.js`, `game/menus.js` | ui | same; the dialog fallbacks in `menus.js` stay and answer `openMenu(id, args, { fallback: true })` |

**Entities, items, systems**

| Path | Owner | Notes |
|---|---|---|
| `entities/entity.js`, `manager.js`, `registry.js`, `projectile.js` | contracts | |
| `entities/player.js`, `systems/sword.js`, `systems/combat.js`, `systems/physics.js` | hero | keeps below; `combat.js` keeps `hurtPlayer`, `registerReviver`, `checkRoomCleared`, `enemiesLeft` |
| new `systems/hero-body.js`, `systems/sword-fx.js`, `models/hero/*` | hero | the hero's own movement (0.8 box, corner assist), sword effects and poses |
| `entities/enemy.js`, `entities/spawn-group.js`, `entities/enemies/*`, `entities/projectiles/rock-shot.js`, `systems/drops.js`, `systems/spawner.js` | foes-overworld | `enemy.js` keeps the base surface of 8.5; new overworld enemies in `entities/enemies/`; new `entities/ai.js` (the AI helpers) |
| new `entities/dungeon-enemies/*`, `entities/bosses/*`, `entities/traps/*` | foes-dungeon | |
| `entities/pickup.js`, `entities/pickups/*` except `key.js`, `systems/blast.js`, `items/*` | items | `items/registry.js` and `items/inventory.js` keep every exported name (the HUD, shops and grants call them); new `pickups/heart-container.js`, `pickups/token.js` |
| `entities/pickups/key.js`, `systems/keys.js` | dungeon | |
| `entities/npc.js`, `entities/npcs/*` | overworld | smith, shopkeepers, innkeepers, sages, townsfolk |
| new `entities/projectiles/<type>.js` | the stream that fires it | hero: beams; items: arrows, fire bolts, the boomerang; foes: their shots |
| `systems/grants.js`, `systems/interact.js`, `systems/tile-actions.js` | contracts | |
| `systems/flow.js` | ui | keeps below |
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
| `cards/default.js` | overworld | `card-overworld` and the one `'*'` card, `card-road` |
| `cards/crypt.js`, new `cards/<dungeon>.js` | dungeon | |
| `models/*` (existing, and look's `characters.js`, `icons.js`, `kit.js`, `palette.js`) | look | |
| new `models/<stream>/*` | that stream | built with look's kit (`kit.js`, `palette.js`, `characters.js`) |
| `ui/**` | ui | banner, dialog, dom, hud, overlay, `hud/*`, `screens/*`; keeps below |

**World**

| Path | Owner | Notes |
|---|---|---|
| `world/world.js`, `grid.js`, `tiles.js`, `areas.js`, `links.js`, `areas/test-borders.js` | world | `links.js` and `test-borders.js` come with feat/world |
| `world/tilekit.js`, `palette.js`, `terrain.js`, `tiles/farband.js`, `areas/kitroom.js` | look | `terrain.js`, `farband.js`, `kitroom.js` come with feat/look-kits |
| `world/tiles/overworld.js`, `world/areas/overworld.js` | overworld | the overworld and town tilesets |
| `world/tiles/dungeon.js`, `world/areas/crypt.js` | dungeon | the dungeon tileset |
| new `world/areas/*` | overworld (overworld areas, towns, interiors), dungeon (dungeons and their arenas), each stream (its `test-<stream>-*.js`) | section 10 |
| new `world/tiles/*` | overworld or dungeon only | section 11; overworld's `interior` and `cave` tilesets too |

**Keeps.** Frozen world and look code and other streams use these names in
files a stream owns. Names, arguments and meanings stay; bodies may change,
and may become no-ops where the art bible drops the thing (`setAreaLabel`).

- `entities/player.js` (hero): the `player` singleton and its `x`, `z`,
  `yaw` (the 8-way body yaw), `r` (half-size for `world.blocked`), `speed`,
  `invT` (> 0 while blinking), `attackT` (> 0 while the blade is out),
  `knockT`, `kx`, `kz`, `object`, `hero` (look's rig), `tileX`, `tileZ`,
  `update(dt)`, `animate(dt, moving)`, `resetTileTracking()`, and after
  feat/look `cheer(seconds)`. New state goes in new fields (`facing`,
  `guarding`, `dashing`). At the feat/look merge the hero takes look-kits'
  own cheer listeners out of `player.js` (`chest-opened`, `item-gained`, the
  key pickup): `hero.js` is the one pose authority (8.1).
- `systems/physics.js` (hero): `moveBody(body, dx, dz, bounds)` with both
  bounds forms (M1's `{ x, z }` origin, feat/world's `{ x0, z0, x1, z1 }`
  rect), unchanged for every body but the hero's; `bumpsEntity`;
  `clearDistance` (feat/world). The hero's 0.8 box and corner assist go in
  a hero-only path (`systems/hero-body.js`), not into `moveBody`.
- `systems/flow.js` (ui): `registerPlayHook`, `teleport`, `saveToSlot`,
  `loadFromSlot`, `startGame`, `newGame`, `loadGame(data)`,
  `placeAtStart()`, `activeSlot()`, `respawnPoint()`; the play mode's tick
  order (menu check, `'input'` play hooks, `player.update`, `updateItems`,
  `updateEntities`, `'after'` play hooks); the `respawn` and `pos` save fields.
- `ui/**` (ui): `hud.js` `initHud`, `refreshHud`, `setAreaLabel`,
  `toggleMuteUi`, `registerHudWidget`, the `REGIONS` names, `muteLabel()`;
  `overlay.js` `initOverlay`, `hideOverlay`, `setFade`, `overlayVisible()`
  (true while the title, pause or game-over panel is up), `overlayView()`;
  `banner.js` `showBanner(text)`; `dialog.js` `showDialog`, `ask`,
  `dialogOpen`, `dialogView()`. Tests read the views (`dialogView`,
  `overlayView`, `muteLabel`), never the DOM, so the ui may restyle the box,
  put yes and no in a box of their own, or hide the Sound button. Also kept:
  the mode names `title`, `play`, `paused`, `dialog`, `dead`; Escape pauses
  and resumes; in a dialog Space, Enter and A turn the page and pick, and
  the arrows move the choice; Enter continues from game over.

**Fixtures frozen until M3.** The gate scenarios play M1 content that
streams own. Until M3 rewrites `default`, it stays as below; new content
uses new ids (`ow-*`, `v1`, `d1`, the spec's enemy ids, section 9), and
`contracts-m2` uses `probe-` content wherever it can.

| Fixture | Read by | What stays |
|---|---|---|
| area `overworld` (overworld): Whisperwood, Cairn Ridge, Mirror Lake, Bloom Meadow, Crossroads, Rattlestone Hollow; `START` (its screen [1, 1], the hero at local 8, 5.5) | `default`, `contracts-m2` | maps, area and screen names, markers (the enemies of Rattlestone Hollow and Cairn Ridge), the Cairn Ridge doorway, the open middle rows of the Crossroads. Overworld may move its `origin` (section 10) and give it music |
| area `crypt` and dungeon 0 (dungeon): Sunken Gate, Key Vault, Pillar Hall, Treasure Chamber; `dungeons/crypt.js` (entrance: the Sunken Gate; music `dungeon`) | `default`, `contracts-m2` | maps, names, markers, room labels, the M1 chars `K`, `L`, `C`, `X` with M1's behaviour (`world/tilekit.js`) and their `taken:`, `door:`, `chest:` flags |
| entity types `slime`, `spitter` (foes-overworld) | `default` (the bot fights them) | kind `'enemy'`, `spawned`, killable by the M1 sword in the numbers the bot manages, M1 drops |
| `npc`, the pickups `heart`, `magic`, `coin-*`, `key`, the `group` marker | `default`, `contracts-m2` | type names and what they grant |
| `blade-start` and the M1 swing (hero) | `default`, `contracts-m2` | strength 3, spin 1, budget 0; the hero's own thrust replaces the swing only once it passes `default` |
| cards `card-overworld`, `card-crypt`, `card-road` | saves (the gallery), `contracts-m2` | ids; `card-road` stays the one `'*'` card |
| the title's Enter (ui) | `default`, `contracts-m2` | starts M1's class-less game at `START` with 6 of 6 life at once (section 12) |

---

## 3. Units and conventions

| What | Unit | Notes |
|---|---|---|
| Distance | tiles (1 world unit) | x east, z south, y up. The camera faces north and never turns |
| Local position | tiles from a screen's north-west corner | spots, markers, `teleport`, `hero.place` |
| Time | seconds | converted to ticks with `ticks(s)`; the simulation steps at a fixed 60 Hz (`TICK` = 1/60 s) |
| Speed | tiles per second (t/s) | |
| Angle | degrees in `TUNING`, radians in code | `yaw` 0 faces +z (south); `yaw = atan2(dx, dz)` |
| Life | units: 1 unit = half a heart | `UNITS_PER_HEART` = 2; hero damage in units. The stream briefs and the research drafts say "unit" for a whole heart: double their life numbers. This file and `TUNING` (spec Appendix A) win: revive 8, heart pickup 2, classes life / balanced / magic 10 / 8 / 6 units with 3 / 4 / 5 magic |
| Magic | whole gems | |
| Money | coins, wallet 9,999 | `state.coins` (the M1 `state.gems` is an alias) |
| Enemy HP and damage | points | blade-start deals 3 |
| Facing | `'north'`, `'east'`, `'south'`, `'west'` | the 4-way attack facing (`hero.facing()`; the hero stream keeps it in `player.facing`). `player.yaw` is the body's 8-way yaw, which only turns the model |
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
| `boss`, `traps` | `tuning/boss.js` (foes-dungeon) |
| `dungeon` | `tuning/dungeon.js` (dungeon) |
| `pickups`, `items`, `spells`, `progression` | `tuning/items.js` (items) |
| `economy` | `tuning/economy.js` (overworld) |
| `minimap`, `worldMap`, `readability`, `options`, `profile`, `menu`, `toasts` | `tuning/ui.js` (ui) |

```js
import { TUNING, ticks, TICK } from '../core/tuning.js';
TUNING.hero.walk;                 // 4.5 t/s
ticks(TUNING.damage.knockLock);   // 15
TUNING.sword.length(10);          // 9.5: blade length at L10 (reach adds handOffset 0.35)
```

Add keys to your own section freely; renaming or removing a key another
stream reads is a contract change. Content tables (sword stats, shop tiers,
enemy stats, drop packs) live in their registries, not in `TUNING`.

Moved before M2 so each number sits with the stream that uses it: the trap
numbers from `dungeon` to `traps` (`bladeTrap`, `turret`, `arrowTrap`; the
turret's glow from `enemy.tells.turretGlow` to `traps.turret.glow`), the key
toast from `dungeon.keyToast` to `toasts.key`; `enemy.rare` is keyed by type
id (`'treasure-slime'`, `wyrm`). Where the spec's Appendix A files a number
under another heading, the `TUNING` path here is the one code reads.
`TUNING.options.seams` is the spec's grid option.

**Briefs and drafts against the spec.** The stream briefs, the research
drafts and a few art-bible lines came before the spec. Where they differ,
the right-hand column binds:

| Topic | Brief, draft or art bible | Binding (spec, `TUNING`) |
|---|---|---|
| Life units | "unit" is a whole heart (items and hero briefs, player-combat draft) | a unit is half a heart (section 3): revive 8, heart pickup 2 |
| Starting magic by class | 0 / 1 / 2 | 3 / 4 / 5 (`TUNING.progression.classes`) |
| I-frames after a hit | about 2.0 s (player-combat draft 13) | 1.5 s (`TUNING.damage.iframes`, what `receiveHit` gives); M1's 1.1 s is the stand-in of direct `hurtPlayer` calls: tune contact cadence against 1.5 s |
| Input lock after a hit | 0.2 s | 0.25 s (`TUNING.damage.knockLock`) |
| Spin rate | about 1080 degrees/s | 1440 degrees/s (`TUNING.sword.spinRate`) |
| Small blade | 0.75 hero widths | 1.25 tiles (spec 7.4, `sword.smallLength`) |
| Dash | hold or tap, unresolved | a tap, with the `dashHold` option |
| Smith prices | the price per star rises; spin and pierce dearest | a fixed price per level of each stat (spec 10.5, `registerSword` `price`) |
| A sword with no cap | one late sword | `budget: Infinity` (`registerSword` accepts it) |
| Blade length and width | art bible 10: 5-step stats, width 0.3-2 tiles | levels 0-20; length `2.5 + 0.7 L`, width `0.25 + 0.1 W` tiles (spec 10.5) |
| Spells and tools | fire burst, guard reflect, barrier and reveal spells; a lantern | the spec's six spells (`spell-reveal`, `spell-reflect`, `spell-quake`, `spell-freeze`, `spell-slow`, `spell-truesight`), the fire wand, the candle and the lamp (9.2-9.4); the others are dropped |
| Enemies on a screen you come back to | they respawn (camera-world draft) | a cleared screen stays empty until its area loads again, and a screen with a rare spawn never counts (spec 5.5, `game/clears.js`) |
| The world map | fills per area, outline visible (camera-world draft) | fills per screen from `state.visited`, starting black (spec 4.6) |
| Stand-in dungeon rooms | 16 x 11 (camera-world draft) | 16 x 12 (spec 4.1, feat/world) |
| The orb | appears in the arena when the boss falls (art bible 11) | taken in the reward room (spec 6.6); in the arena a glowing orb is only the burst's effect |
| The magic icon | look-kits' vial (`ICONS.vial`) | mana gems (art bible 12, spec Q24): the ui draws its own gem |

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
| `gear` | `{ shield: 1, boots: null, ring: null }`; shield 0 in a prologue game | hero (grants `shield-1`..`6`, `boots-*`, `ring-*`) | yes |
| `swords` | `{ owned: ['blade-start'], equipped: 'blade-start', bought: {}, spent: {} }`; `owned: []`, `equipped: null` in a prologue game | hero (`swords`) | yes |
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
Enter) keeps 3 hearts and no magic. `isFullLife()` is `hp === maxHp`. A new
game starts armed (the defaults above) unless the ui asks for the prologue
(8.16): then the king's grants (`blade-start`, `shield-1`) arm the hero.
Remembered clears (`game/clears.js`) are runtime state: a load or a new game
forgets them.

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
| `door-opened` | `{ tx, tz, kind?, flag?, room?, side? }` (`kind`: `small`, `boss`, `red`, `blue`, `green`) | world (tilekit: the M1 `L`), `tile-actions.openKeyDoor`, the dungeon's own locks |
| `chest-opened` | `{ tx, tz, contents, source? }` | world (tilekit: the M1 `C`), `tile-actions.openChest` (every new chest) |
| `sword-swing` | `{ player, stats }` | hero: a thrust starts |
| `sword-hit` | `{ target, hit }` | hero: the blade connects |
| `blade-changed` | `{ full, stats }` | hero: the blade grows or shrinks |
| `hero-hit` | `{ result: 'blocked' \| 'hit', damage, kind, source, from: { x, z } \| null }` | `hero.receiveHit` (not for `'ignored'`) |
| `player-hurt` | `{ amount, hp, fromX, fromZ, kind, source }` | `combat.hurtPlayer` |
| `player-died` | `{}` | `combat.hurtPlayer` when nothing revives |
| `player-revived` | `{ by, hp }` | `combat.hurtPlayer` via a reviver |
| `hero-respawn` | `{ spot, via }` | `hero.respawn` |
| `hero-pose` | `{ pose, seconds }` (`POSES`: `stand`, `cheer`, `swordOut`, `item`, `guard`; null: back to walking) | `hero.setPose`, `hero.cheer` |
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
| `item-get` | `{ id, amount, name, text, source, model }` | `grants.grant` for fanfare grants |
| `spell-learned` | `{ id }` | `spells.learnSpell` |
| `spell-cast` | `{ id, cost, x, z }` (where the hero stood) | `spells.castSpell` |
| `effect-start` | `{ name, seconds }` | `effects.startEffect` |
| `effect-end` | `{ name }` | `effects` when time runs out or `clearEffect` |
| `pickup` | `{ entity, type, by, wasFull }` | `Pickup` (walked over: no `by`), `pickups.collectPickup` (`wasFull` for hearts and magic: already full before; items adds it to `Pickup` in M2) |
| `explosion` | `{ x, z, radius, damage, source }` | items: bombs |
| `light` | `{ x, z, radius, source }` (`fire`, `candle`, `lamp`) | items: fire wand, candle, lamp |
| `enemy-spawned` | `{ entity }` | `entities/manager.js` |
| `enemy-hit` | `{ entity, hit, result, damage }` (`result` also `'frozen'`; `hit.crit` for the red word) | `damage.dealDamage`, `damage.freezeAt` |
| `enemy-killed` | `{ entity, hit }` | foes: `Enemy.die` |
| `room-cleared` | `{ screen }` | `combat.checkRoomCleared` (`clears.js` listens) |
| `boss-intro` | `{ id, name, title, dungeon, hint }` | foes-dungeon, as its `boss-intro` mode starts |
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
| `new-game` | `{ profile, prologue }` | `progress.startNewGame` |
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
- `input.menuDir()`: `'up' | 'down' | 'left' | 'right' | null`, where a menu
  cursor moves this tick. A key, d-pad or virtual press moves it at once; a
  held direction (keys, d-pad, either stick pushed past half-way) moves it,
  then again after `TUNING.menu.repeatDelay` (0.35 s) and every
  `repeatEvery` (0.1 s). Every call in one tick gives the same answer, and a
  direction still held from before a mode change waits for its release.
  Menus read it instead of `pressed('up')`, so the stick works in menus.
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
import { hero, POSES } from '../game/hero.js';
hero.facing();            // 'north' | 'east' | 'south' | 'west': the attack facing
hero.facingVector();      // { x, z }
hero.setFacing('east');   // turn the attack facing (and the body) to a cardinal
hero.faceToward(x, z);    // face a world point: the cardinal nearest its direction
hero.position();          // { x, z } world, lx, lz local to the screen
hero.spot();              // a spot, for warps and respawn points
hero.isGuarding(); hero.isDashing(); hero.isFullLife(); hero.isAlive(); hero.isInvulnerable();
hero.receiveHit({ damage: 2, from: enemy, kind: 'contact' });   // -> 'blocked' | 'hit' | 'ignored'
hero.heal(2);             // units restored
hero.setPose('cheer', 1); hero.cheer(1); hero.pose();          // one of POSES, or null
hero.lockInput(0.25); hero.inputLocked();
hero.addStatus('paralyzed', 1); hero.hasStatus('paralyzed'); hero.statusLeft(name); hero.clearStatus(name);
hero.inDoorway(); hero.canAct();       // not locked, not paralyzed, not in a doorway, in play
hero.move(dx, dz);        // push him against walls (conveyors, currents); true if stopped
hero.place(x, z, yaw);    // local tiles, same screen
hero.pull({ toX, toZ, speed });   // the grapple: -> Promise<'arrived' | 'blocked' | 'cancelled'>
hero.isPulled();
hero.warp(spot);          // fade out, move, fade in
hero.respawn({ spot });   // stand up with full life and magic (default: respawnSpot('death'))
hero.fall({ damage, to }); // pits (to: 'entry'), lava ('safe'), dark puddles (a spot)
hero.safeSpot();          // the last tile he stood on that was no hazard
hero.blade();             // bladeStats() + bladeSize(): what the blade does now
```

`receiveHit({ damage, from, kind, tier, source, knockback, iframes, lock, unblockable, ignoreIframes })`
is the only way anything hurts the hero:

- `damage`: base units. The hero takes `max(1, floor(damage x difficulty x (1 - ring cut)))`,
  or everything in one-hit mode (`damageTaken(base)`).
- `from`: `{ x, z }` or an entity: the direction for the guard and the push;
  `null` for hazards underfoot.
- `kind`: `'contact'` (bodies, swords), `'projectile'` (shots) or `'hazard'`
  (spikes, lava, pits, swamp, blasts; never blocked).
- `tier`: the shield tier that blocks it. Projectiles default to 2 (arrows
  and basic shots; 3 magic bolts, 4 fire, 5 lightning, 6 everything
  blockable), contact to 1 (any shield); `Infinity` or `unblockable: true`
  for what nothing blocks. Shield 1 therefore blocks contact only (spec 7.8).
- `knockback`: tiles pushed away from `from` over `TUNING.damage.knockTime`
  (`true`, the default: `TUNING.damage.knock`, 1 tile; `false` or 0: none).
- `iframes`: seconds of blinking after the hit (default
  `TUNING.damage.iframes`, 1.5; `false`: none, for damage over time).
- `lock`: seconds of locked input after the hit (default
  `TUNING.damage.knockLock`, 0.25; `false`: none).
- `ignoreIframes`: lands even while he blinks (hazards that tick).
- Returns `'ignored'` (not in play, down, blinking, invulnerable),
  `'blocked'` or `'hit'`. On `'blocked'` the hero only takes the guard's
  push, and **the caller applies the recoil**: an enemy knocks itself
  `TUNING.guard.attackerKnock` tiles away from the hero and is stunned
  `attackerStun` s, a shot reflects or breaks. `receiveHit` never touches
  `from`; `hero-hit` carries it for the ui and audio.

```js
// your own bomb (spec 7.11, 9.2): 2 units, 1.5 tiles, never guarded
hero.receiveHit({ damage: TUNING.damage.ownBomb, from: bomb, kind: 'hazard', knockback: TUNING.damage.ownBombKnock, source: 'bomb' });
// one second of poison swamp: no blink, no lock, so the next second lands too
hero.receiveHit({ damage: TUNING.damage.swampPerSec, kind: 'hazard', knockback: false, iframes: false, lock: false, ignoreIframes: true });
```

**Moving him for others.** `pull` (items' grapple, spec 9.2) drags him to the
world point at `speed` (default `TUNING.items.grapple.pull`) over water, pits
and tile hazards (`overLow: true`), with walking and the sword, item and dash
buttons held off; anything that stops shots ends it early (`'blocked'`), a
new pull, a warp or a death cancels it, and he lands on the target or the
nearest standable point back along the way. `fall({ damage, to })` is a
hazard hit that ignores the blink and puts him at `'entry'` (where he came
into the room: pits), `'safe'` (the last tile without `hazard`: lava), a spot
(a dark puddle's floor start; another screen is a warp) or nowhere (`null`).

**Tiles under the hero** (spec 7.3, 7.11, 6.4). Every play tick the hero
stream reads the tile under his centre and applies section 11's fields
(`hazard`, `stairs`, `ledge`, `conveyor`). Tile owners (overworld, dungeon)
set the fields and draw the tiles; they never apply hazard damage
themselves, so nothing is counted twice.

**Poses.** `hero.js` is the one pose authority: `player.animate()` shows
`hero.pose()` while it is set, otherwise walking or the thrust. `POSES`:
`stand`, `cheer`, `swordOut` (look's rig has them), `item` (a B item or
spell in use) and `guard` (the raised shield). The hero adds the item, guard
and shield-tier models to `player.hero` from `models/hero/*` (until then
they fall back to `swordOut` and `stand`) and builds the swing arc, the
spin disc and the beam in `systems/sword-fx.js` with look's
`makeGlowMaterial`; look replaces them at M4. An item get holds the cheer
for 1 s with `item-get`'s `model` over his head; the ledge hop cheers too.

**Unarmed.** A prologue game (8.16) starts with no sword (`bladeStats()` is
`{ none: true }`, reach 0) and shield 0 (no guard). With no sword, A only
talks and checks.

Stand-ins until the hero stream lands: the guard is up while guard is held,
a shield is carried and the hero is not thrusting (a play hook);
`facing()` is the cardinal nearest the body's yaw, and `setFacing` and
`faceToward` turn the yaw; `receiveHit` gives `TUNING.damage`'s blink, push
and lock over M1's `combat.hurtPlayer` (M1 enemies that call `hurtPlayer`
directly still get M1's 1.1 s and speed 8 until the foes move to
`receiveHit`); `lockInput` and `pull` eat sword, item and dash presses, and a
pull also holds walking. Gear grants: `shield-1`..`shield-6`, `boots-dash`,
`boots-swamp`, `ring-quarter`, `ring-half` write `state.gear` (placeholder
names). The world bot (`scripts/lib/bot.js`) aims with the body's yaw and a
weak stick push; when the spec controls land, the hero may change its
`fight()` and `steer()` (section 2) so `default` keeps passing.

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
freezeAt(x, z, radius, seconds);                      // the freeze spell -> [entities frozen]
```

Options: `amount` (points), `source` (one of `SOURCES`: sword, beam, spin,
dash, arrow, bomb, boomerang, grapple, fire, book, quake, freeze, reflect,
hazard, enemy), `from` (direction), `knockback` (tiles; default
`TUNING.enemy.knock` 1.5, heavy targets 0.5, over `knockTime` 0.2 s), `stun`
(s; default `stagger` 0.25; the boomerang passes 2.0), `freeze` (s: the
sword's freeze special), `crit` (a critical hit: sword specials, pinch
power; the ui shows the red word), `swingId` (one thrust, arrow or blast
hits a target once), `by`.

Enemies describe themselves with fields the foes streams set: `immune: [sources]`,
`weak: { source: multiplier }`, `guards(hit)` (a front guard), `boss`,
`heavy`, `rare` (a rare spawn: treasure-slime, wyrm; the rare-slayer special
kills it in one hit), `shatter: false` (casters: frozen hits are immune),
`frozenT`, and `hurt(hit)`, `onImmune(hit)`, `onBlocked(hit)`. A frozen enemy
that is not a boss dies to any hit (spec 8.2); bosses never freeze. The hit
object carries `tiles` and `stun` for a new Enemy, and `knockback` as the M1
speed for the old one. Every result but `'ignored'` emits `enemy-hit`.

`freezeAt` is the freeze spell's path (spec 9.4): it freezes every enemy in
reach that is not a boss, not immune to `'freeze'` and not invulnerable, for
`seconds`, with no damage, guard or shatter; a second cast only renews the
time. Each gets `enemy-hit` with result `'frozen'` and damage 0, and the
tiles in the radius get `onFreeze` (the dungeon's flame walls turn to ice).
The sword's freeze special stays a `dealDamage` option: it hurts, and
shatters what is already frozen.

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
`hitOpts` (extra `dealDamage` options). Each tick it moves (by `dt` times
`effects.worldScale(this)`: half speed under the slow spell unless the hero
owns it), fizzles past its range or off the screen, calls the tile's `onShot`
on a wall, calls
`hero.receiveHit({ kind: 'projectile', tier })` (blocked: reflected at 1.5 x
under the reflect effect, else it breaks) or `dealDamage` on enemies (once
each, then it breaks unless `pierce`). The blade knocks enemy shots apart.
Override `onHitWall`, `onHitHero`, `onHitEnemy` (return false to fly on),
`onReflect`, `animate`, `shatter`. Projectile ids are fixed per stream
(section 9) so no two streams register the same one.

### 8.5 Enemies

- **Ids** (section 9). foes-overworld: `hopper`, `blob`, `blob-blue`,
  `buzzer`, `stump`, `archer`, `leaper`, `guardian`, `treasure-slime`,
  `wyrm`, and M1's `slime` and `spitter`. foes-dungeon: `skeleton`, `bat`,
  `gazer`, `turret`, `blade-trap`, `arrow-trap`, `boss-serpent`,
  `boss-tombstone`. Spec 8.3's first-slice roster names both lists; only the
  owner registers a type (the registry throws on a duplicate at M3).
- **Base.** `entities/enemy.js` (foes-overworld) keeps this surface, which
  foes-dungeon builds on against M1's base in M2 and foes-overworld's at M3:
  `constructor(opts, def)` with def fields `hp`, `r`, `speed`, `colors`,
  `model` | `poses` | `geometry`, `contactDamage`, `drops`, `heavy`;
  `think(dt, ctx)`, `canBeHit(hit)`, `hurt(hit)` (reads `hit.tiles` and
  `hit.stun`, else M1's `knockback` speed), `die(hit)` (`enemy-killed`, the
  drop roll, `checkRoomCleared`), `onBlocked(hit)`; the fields `spawned`,
  `growT`, `countsForClear`. The M2 base deals contact through
  `hero.receiveHit({ damage: contactDamage, from: this, kind: 'contact' })`
  and on `'blocked'` knocks itself `TUNING.guard.attackerKnock` tiles back
  and stuns itself `attackerStun` s; it appears after `TUNING.scroll.spawnWait`
  with `spawnStagger` between enemies (spec 4.3); it scales its `dt` by
  `effects.worldScale(this)`; it rolls the crown
  (`TUNING.enemy.crownedChance`) unless `opts.crowned` is true or false.
  Subclasses never call `hurtPlayer`.
- **AI helpers** (spec 8.2) in foes-overworld's `entities/ai.js`: `wander`,
  `aligned`, `charge`, `shoot`, `hop`, `flier`, `teleport`, and the tell and
  alert primitives (spec 12.4): `tell(seconds)`, the stop or wind-up before
  an attack (`TUNING.enemy.tells`), and `alert()`, the `!` over an enemy that
  noticed the hero (look's alert mark). foes-dungeon uses them (stubbing any
  it needs in its own folder until M3) and builds the turret's glow
  (`TUNING.traps.turret.glow`).
- **Traps and invulnerable hazards** set `countsForClear = false` and
  `immune: SOURCES`, so they never hold a room shut.
- **Spawn groups** (`entities/spawn-group.js`): a marker
  `{ type: 'group', of: ['blob', 'blob', 'hopper'], count: [2, 6], minDist, rare: ['treasure-slime'] }`
  places that many enemies on random free floor tiles of the screen on every
  entry (spec 5.5, 6.5); hard mode adds 50%. `rare` lists the rare types the
  screen may roll: each rolls once per entry at `TUNING.enemy.rare[type]`
  (times `rareHardMultiplier` in hard mode), and a hit replaces one member of
  the group and gets `rare: true`. `rare` stays with the group; other fields
  (`variant`, `crowned: false` where a crown makes no sense) go to each enemy.
- **Cleared screens and rooms** (`game/clears.js`, contracts; spec 5.5, 6.5):

  ```js
  registerClearRule('overworld', ({ key, area, rare }) => (areaKind(area) === 'overworld' ? !rare : undefined));
  isCleared('ow-4-3:1,2'); markCleared(key); forgetCleared((key, rec) => rec.area === 'ow-4-3');
  clearedScreens(); remembersClear(screen);
  ```

  On `room-cleared` the screen is remembered when some rule answers true and
  none answers false (no rule: nothing is remembered, as in M1). A rule gets
  `{ key, area, screen, rare, now }`; `rare` is true when an enemy with
  `rare: true` appeared on this visit. foes-overworld registers the overworld
  rule and forgets an area's screens on `area-enter`; foes-dungeon registers
  the room rule and forgets on a floor change, `dungeon-leave` or after
  `TUNING.enemy.roomClearMemory` s. Whatever places enemies checks
  `isCleared(screenId(screen))` first: spawn groups do; foes-overworld adds
  it to the plain markers of `systems/spawner.js`; any stream's own spawner
  does the same. An entity may also remove itself in `onAdd()` (the manager
  then does not announce it).
- **Bestiary** (`game/bestiary.js`): `registerBestiary({ id: 'hopper', name, band, hp, text, where, bookHits: 3 })`
  from each enemy's file; sightings and wins count by entity type;
  `recordBookHit(type)` for the book; `bestiaryEntries()` for the menu.
- **Drops** (`systems/drops.js`): `rollDrop(table, x, z)`,
  `registerDropTable(name, entries)`, `addDrop`. The tables are `pack-a` to
  `pack-e`, `bush` and `pot` (spec 8.7), registered by foes-overworld with
  coin pickups; an enemy names its table in its def (`drops: 'pack-a'`:
  foes-dungeon's skeleton and bat use `pack-a`, the gazer `pack-c`). An entry
  `{ chance, type, when, else }` whose `when` fails gives its chance to
  `else`: `arrows-5` and `bomb-1` drop only for a hero who owns the bow or
  bombs, else `coin-1`. A type no branch has registered yet is skipped with
  one warning. Only foes-overworld changes these tables; items does not
  `addDrop` to them. Rare tables name the `token` pickup.
- **Bosses** (spec 6.6, 8.5). foes-dungeon owns the boss, placed by the
  dungeon's marker `{ type: 'boss-serpent', dungeon: 'd1' }` (it stays away
  while `bossDefeated(dungeon)` unless it is a re-fight); the `boss-intro`
  mode (`registerMode('boss-intro')`: it emits `boss-intro` with the
  companion's `hint`, tweens the camera to the `'boss-intro'` preset over
  `TUNING.camera.bossIntro.in` s with
  `startCameraTween(centre, in, { preset: 'boss-intro' })` and
  `stepCameraTween(dt)`, then back to `'boss'` over `bossIntro.out`); the
  phases and the burst (the art bible's glowing orb only as its effect);
  `defeatBoss(dungeonId)`, which returns `{ heartContainer, coins }` (the
  first kill pays a container and `TUNING.economy.bossPay[n - 1]`, a re-fight
  coins only); the payout, `spawn('heart-container', ...)` (items' pickup;
  `grant('heart-container', 1, { source: 'boss' })` while
  `!hasEntityType('heart-container')`) and `dropCoins(x, z, coins)`; and the
  `boss-tombstone` that starts a re-fight (`refight: true`). The dungeon owns
  the arena map (the boss and tombstone markers, `camera: 'boss'`), the doors
  that shut on entry, the north door that opens on `boss-defeated
  { dungeon }`, and the reward room: the orb to take (`completeDungeon`), the
  `npc-sage` marker and the warp tile. The `'boss'` preset (pitch 41.5, fov
  28, height `TUNING.camera.bossHeight`, fixed) and `'boss-intro'` (30%
  closer) are registered once in `game/camera-presets.js`; nobody registers
  them again (a second registration silently replaces the first). A stream
  may register a test dungeon (`test-<stream>-*`) from its own test-area
  file, so `defeatBoss` works in its test arena.

### 8.6 Pickups and money on the floor: `game/pickups.js` (contracts)

```js
collectPickup(entity, { by: 'blade' });   // the blade, boomerang or grapple touched it
dropCoins(x, z, 250);                      // coin pickups worth 250, largest first
coinPieces(250);                           // ['coin-100', 'coin-100', 'coin-10', ...]
```

Pickup types: `heart`, `magic`, `coin-1`, `coin-10`, `coin-100` (items),
`key` (dungeon), and the items stream's `arrows-5`, `bomb-1`,
`heart-container` (never despawns; grants `heart-container` with
`{ source: 'boss' }`, so the item get plays) and `token` (grants `token`;
the rares drop it). The M1 `gem` and `gem5` stay until the drop tables move
to coins. Pickups last `TUNING.pickups.life` (8.5 s), boss coins
`bossDropLife` (15 s). `pickup` carries `wasFull` for hearts and magic:
whether life or magic was already full before (the star special: a heart at
full life). `collectPickup` fills it in; items adds it to `Pickup`'s own
walked-over emit in M2 (until then it is missing there).

### 8.7 Grants and the item get: `systems/grants.js` (contracts)

```js
registerGrant('bombs-bag', (n, ctx) => { ... }, { name: 'Bomb Bag', fanfare: true, text: 'A bigger bag!', model: bagModel });
grant('heart-container');                         // chests, shops, NPCs, bosses
grant({ grant: 'coins', amount: 100 });          // chest contents may be objects
grant('blade-2', 1, { source: 'pedestal' });
setItemGetPresenter((get) => { ... });            // ui: { id, amount, name, text, source, model }
grantMeta('heart-piece');                         // { name, fanfare, text, kind, model }
```

A fanfare grant is an item get: after it is applied, `item-get` fires and the
presenter shows it (default: the M1 banner; the ui stream shows the one-line
box). `model` is a function returning a `THREE.Object3D`, built with look's
kit in the owner's `models/<stream>/*` (items for items, hero for swords and
gear, each stream for its own grants), or null until it makes one: the hero
holds it overhead in the cheer pose for the item get (8.1). The `heart` and
`magic` grants restore `TUNING.pickups.heart` units and `TUNING.pickups.magic`
gems each, whether picked up, bought or found. A registered item is grantable by id; the first grant
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
`fanfare`, `getText`, `bottle` (contents of a bottle), `model` (the prize
held overhead at the item get, 8.7). Tools and spells share the B ring;
cycling does not pause.

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

- **The B button.** The hero decides when B may act (not thrusting, not
  locked; the press ends a dash) and calls `useSelectedItem(player)`; items
  apply `canAct()`, `inDoorway()` and the use and cast locks
  (`TUNING.items.useLock`, `castLock`: spec 9.1) inside `useSelectedItem` and
  `castSpell`; the hero shows the `item` pose on `item-used`.
- **Spells do their own work** in `cast()`: freeze calls
  `freezeAt(x, z, TUNING.spells.freeze.radius, TUNING.spells.freeze.time)`
  (8.3); slow starts the `slow` effect, which every mover reads through
  `effects.worldScale(entity)` (8.18); quake calls `damageAt`; reveal and
  truesight start their effects. `spell-cast` (with where the hero stood) is
  for the ui, audio and the dungeon's reveal tablets, not for applying a spell.
- **Your own bomb** hurts you with the `receiveHit` call in 8.1 (a hazard:
  never guarded).
- **The grapple** pulls with `hero.pull` (8.1); tiles and chests with
  `grapple: true` take the hook.
- **Candle and lamp.** The candle emits `light { x, z, radius:
  TUNING.dungeon.candleRadius, source: 'candle' }` and starts the `candle`
  effect; the lamp emits `source: 'lamp'` and starts `lamp`; both last until
  `screen-leave`. The dungeon draws dark rooms and their light (section 11);
  items only start and clear the effects and emit `light`.
- **The warp feather** opens `openMenu('warp', { kinds: WARP_KINDS })` (the
  visited villages, inns and dungeon entrances: 8.15) and warps with
  `hero.warp(place.spot)`.

### 8.9 Swords and the smith: `game/swords.js` (hero)

```js
registerSword({
  id: 'blade-2', name: 'Fen Edge', source: 'a pedestal', order: 20,
  base: { strength: 3, spin: 1 },                      // unlisted stats: 0 (strength 1)
  max: { length: 5, width: 5, strength: 9, spin: 1, pierce: 1 },   // default: base
  price: { length: 80, width: 80, strength: 240, pierce: 450 },    // coins per level; no price: not sold
  budget: 2200,                                        // most coins a smith takes for it (Infinity: no cap)
  special: null,                                       // or one of SPECIALS; its level is the special stat
  icon: '<svg ...>',                                   // the HUD weapon slot and menus
  model: () => bladeModel(),                           // THREE.Object3D: the item get, menus (models/hero/*)
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
`0.25 + 0.1 W`, hit width at least 0.35, reach = length + 0.35. With no
sword equipped (a prologue game) `bladeStats()` is `{ id: null, none: true }`
with strength 0 and `bladeSize()` a reach of 0. A new game started without
the prologue owns `blade-start` and shield 1 (the M1 fixture).

Stand-in: M1's swing (`systems/sword.js`) keeps its own numbers until the
hero stream reads `bladeStats()`.

### 8.10 Dungeons: `game/dungeons.js`, `systems/keys.js` (dungeon)

```js
registerDungeon({
  id: 'd1', number: 1, name: '...', areas: ['d1', 'd1-boss'],
  entrance: { area: 'd1', screen: [3, 9], x: 8, z: 10.4, yaw: Math.PI },   // area.entrance wins if set
  exit: { area: 'ow-3-2', screen: [1, 2], x: 8, z: 9, yaw: 0 },
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

- **D1's door** spans two maps, so both spots are pinned now: the entrance
  `{ area: 'd1', screen: [3, 9], x: 8, z: 10.4, yaw: Math.PI }` (the room
  inside the door, the dungeon's) and the exit
  `{ area: 'ow-3-2', screen: [1, 2], x: 8, z: 9, yaw: 0 }` (just south of
  the door in the cliff, the overworld's). The overworld's door warp targets
  the entrance exactly; the dungeon's exit stairs warp to `dungeonExit('d1')`.
- **Chests and small-key doors** use `systems/tile-actions.js` (contracts)
  from the tile hooks, the same in towns, caves and dungeons:
  `openChest(ctx, { source: 'chest', contents, flag })` (grants with
  `{ source }`, `chest-opened`) and `openKeyDoor(ctx, { flag, twin, kind })`
  (after `TUNING.dungeon.keyPush` s of pushing, spends a small key, flag
  `dungeon:<id>:door:<room>:<side>`, `door-opened` with `kind`). Boss-key and
  colored locks are the dungeon's own tiles, with the same event. The M1
  crypt's `C` and `L` keep M1's tilekit behaviour (fixtures, section 2).
- **Shutters and kill-all rewards** also check `enemiesLeft() === 0` on
  `room-enter`: a room whose enemies are remembered as cleared, or whose
  foes' types are missing until merge, never fires `room-cleared`.
- **Music.** Each dungeon registers its own `dungeon-<n>` placeholder with
  `registerMusic` in `dungeons/<id>.js` (8.13).

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
await openMenu('counter', { shop: 'v1-shop', entry: 'bow' });   // one thing on a counter -> true if bought
await openMenu('shop', { shop: 'v1-shop', speaker: 'Mags' });   // a list, for NPC-run services
await openMenu('smith', { speaker: '...', sword });   // default: the equipped sword
await openMenu('inn', { inn: 'inn-1', speaker: '...' });   // -> true if he stayed
await openMenu('warp', { kinds: WARP_KINDS });        // -> the place picked (8.15), or undefined
registerMenu('shop', async ({ shop, speaker }) => { ... });   // ui: the real screen
await openMenu('shop', args, { fallback: true });     // the dialog fallback, even once a screen is registered
registerFallback('probe-menu', async (args) => { ... }); usesFallback('shop'); hasFallback('shop');
```

- **Counters** (spec 5.6: face the item on the counter, press A, answer yes
  or no). Shop goods are entities: overworld registers `shop-item`, placed
  by a marker `{ type: 'shop-item', shop: 'v1-shop', entry: 'bow' }`. It
  shows the entry's prize model (`grantMeta(grant).model`, 8.7), labels the
  prompt `'Buy'`, calls `openMenu('counter', { shop, entry })` from
  `onInteract` and hides while the entry is sold out or off the shelf
  (`shopEntries`). `openMenu('shop')` is only for services an NPC runs (a
  token trader's list).
- **Screens and fallbacks.** Counters, the smith and innkeepers (overworld)
  and the warp feather (items) call `openMenu`. The ui registers the real
  `shop`, `counter`, `smith`, `inn` and `warp` screens in M2 with
  `registerMenu` (one screen per id; a second throws). Until an id has a
  screen, its dialog fallback in `menus.js` answers through `ask`, so buying
  works from the first day; after that `openMenu(id, args, { fallback: true })`
  still reaches the fallback, which is how `contracts-m2` tests the
  registries. `usesFallback(id)` is true while only the fallback answers;
  new ids need no fallback.
- A shop entry pays out through its grant with `ctx.source: 'shop'`.

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

- **Reach.** A talks to what is roughly in front of the hero (within 60
  degrees of his facing) and within `TUNING.hero.interactRange` (1 tile,
  spec 5.6), measured from his centre to the entity's edge
  (`systems/interact.js`). NPCs use that range; only something reached
  across a table (a counter) sets its own `interactRange`.
- **The sage.** Overworld registers `npc-sage`, which takes `{ spell, flag }`
  from its marker, grants the spell once with `{ source: 'npc' }`, sets
  `flag` (default `overworld:sage:<spell>`) and afterwards only talks. The
  dungeon places `{ type: 'npc-sage', spell: 'spell-reveal' }` in D1's reward
  room (spec 6.9, 9.4); the marker is skipped with a warning until the
  overworld branch is merged.

### 8.13 Music: `game/music.js` (overworld)

`registerMusic({ id, name, play(out) { ...; return stop; } })`,
`playMusic(id)` (unknown ids throw; `music-change`), `stopMusic()`,
`currentMusic()`, `areaMusic(area)` (an area or its id: `area.music`, else
its dungeon's `music`, else null) and `playAreaMusic(area)`. Entering another
area plays its track. A track nobody has registered is silent, with one
warning per id, so a map may name a track before its owner is merged.

Each stream registers its own tracks: `music/placeholders.js` (overworld)
holds the silent `title`, `overworld`, `village`, `dungeon` and `boss`;
overworld adds its area tracks in `music/*`; each dungeon registers its
`dungeon-<n>` in `dungeons/<id>.js`. The M1 area `overworld` may get music
(`contracts-m2` checks `currentMusic() === areaMusic(area)`, not silence).
M6 writes the music. `play(out)` gets the music bus from `core/audio.js`.

### 8.14 Loading cards: `game/cards.js` (ui)

`registerLoadingCard({ id: 'card-crypt', title, art, areas: ['crypt'] | '*', text, order })`;
`cardForArea(areaId)` (the lowest-order card listing the area, else the
`'*'` card); `markCardSeen(id)` (the gallery, saved); `galleryCards()`.

- **Art** belongs to the card's owner: an image URL (a file next to its card
  file), a function returning a `THREE.Object3D` (a diorama built with
  look's kit, which the ui renders), or null, the default, for which the ui
  draws the title and text on a plain card. Anything else throws.
- **Ids.** A card id is never replaced (a duplicate throws). Overworld's
  cards are in `cards/default.js`, each dungeon's in `cards/<dungeon>.js`
  (`card-crypt` is in `cards/crypt.js`). No stream adds a `'*'` card in M2:
  `card-road` (order 999) stays the one fallback.
- **Showing.** The ui shows `cardForArea(area.id)` on `area-enter` and marks
  it seen. In M2 the black hold is world's fixed 1 s (`AREA_HOLD` in the
  frozen `systems/transitions.js`), whatever `loadingArt` says; at M3 world
  reads `TUNING.load.cardMin` and the option and emits `area-ready` when the
  hold ends (section 12).

### 8.15 Places: `game/places.js` (contracts)

`spotHere()`, `goToSpot(spot, { fade })`, `resolveSpot(spot)`, `fullSpot(spot)`,
`setRespawn(spot)`, `respawnSpot('death' | 'load', { area })` (respawn rules
first, then `state.respawn`, then the start), `registerRespawnRule(id, fn)`,
`roomEntry()` (where the hero came into this screen), `onAreaChange(fn)`,
`hasVisited(screenOrId)`, `screenRect(screen)`, `currentRect()`, `screenId(screen)`.
These work on main and after feat/world merges (spots then resolve through
`world.resolveSpot`).

```js
registerPlace({ id: 'v1', name: '...', kind: 'village', spot: { area: 'v1', screen: [1, 2], x: 8, z: 9, yaw: 0 } });
registerPlace({ id: 'd1', name: '...', kind: 'dungeon', area: 'd1', spot: dungeonExit('d1') });
places('inn'); getPlace('v1'); placeVisited('d1');   // visited: its area is in state.visitedAreas
warpPlaces();          // the warp feather's list: visited places of WARP_KINDS ('village', 'inn', 'dungeon')
areaKind('ow-4-3');    // one of AREA_KINDS: the area's `kind`
```

- **Named places** (the spec's Appendix B ids) are registered by the stream
  that builds them: overworld its villages, inns, the castle, the cabin and
  the trader; the dungeon each dungeon, with `spot` outside its door and
  `area` its own first area. `kind` is one of `PLACE_KINDS` (`village`,
  `inn`, `castle`, `cabin`, `trader`, `dungeon`, `cave`, `other`); `area`
  (default: the spot's) is the area whose first visit makes the place known;
  `order` sorts the lists (default 100). The world map's blinking goal
  (spec 4.6) is on the area of the next dungeon's place: `getPlace(id).spot.area`
  for the lowest-numbered dungeon that `dungeonProgress(id).complete` does
  not mark.
- **Area kinds.** `areaKind(area)` reads the area's `kind` (`AREA_KINDS`:
  `overworld`, `town`, `castle`, `interior`, `cave`, `dungeon`, `arena`,
  `test`), else answers `dungeon` for an area of rooms or with a key group
  (the M1 crypt) and `overworld` for the rest. Every new area sets `kind`.
  The minimap shows only in `overworld` and `town` areas (spec 4.6), and not
  in one that sets `minimap: false`. Its exit marks come from feat/world's
  `edgeReport(world).links` (`world/links.js`).

### 8.16 Profile: `game/progress.js` (contracts)

`startNewGame({ name, class, trait, difficulty, model, prologue })` resets,
applies the profile and the class's life and magic (`classStats`), starts
play and emits `new-game { profile, prologue }`. `model` names the hero's
look (`state.profile.model`, `'hero'`).

- **The prologue.** With `prologue: true` (the ui's new-game flow) the hero
  starts unarmed, with no sword and shield 0 (8.1), at the spot overworld
  gives `registerPrologue({ spot, respawn })` (the castle; `respawn`, by
  default the spot, becomes `state.respawn`). The king's grants
  (`blade-start`, `shield-1`) arm him. `prologueSpot()` reads the spot; with
  none registered the game starts at `START` with one warning. Without
  `prologue`, and on the M1 title's Enter, a game starts armed at `START`
  (the fixture).
- `CLASSES` (`life`, `balanced`, `magic`), `TRAITS` (`might`, `focus`),
  `DIFFICULTIES` (`normal`, `hard`, `one-hit`), `cleanName` (letters, digits,
  spaces, `'` and `-`, at most `TUNING.profile.nameMax` 8), `heroName()`,
  `hasTrait`, `isOneHit`, `damageMultiplier` (2 in hard mode).
- What the player has unlocked (hard mode once the game is finished,
  one-hit: spec 11) is the ui's to keep in preferences (`core/save.js`
  `readPrefs`, `writePrefs`), not in a slot.

### 8.17 Settings: `game/settings.js` (ui)

`setSetting(key, value)` (unknown keys throw; values not allowed return
false), `getSetting`, `registerSettingApplier(key, fn)` (runs now and on each
change; one that throws logs a warning and the value is still stored),
`resetSettings`, `textSpeed()`. Stored in localStorage for the
browser, not per slot; defaults in `TUNING.options`.

| Key | Values (default) | Applied by |
|---|---|---|
| `camera` | `'A'`-`'D'` (`'A'`) | world's `chooseCameraPreset` (wired) |
| `look` | `auto`, `high`, `medium`, `low`, `flat` (`auto`) | look: feat/look reads `state.settings` every drawn frame (`auto`: the device's level) |
| `seams` | bool (true): the spec's grid option | look (the same), live |
| `brightness` | 0.5-1.5 (1) | look: times the exposure |
| `saturation` | 0-2 (1) | look: times the grade's saturation (high and medium quality; low and flat have no grade) |
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
`effectLeft(name)`, `clearEffect(name)` (`effect-end`), and
`worldScale(entity)`: the time scale every mover multiplies its `dt` by
(`TUNING.spells.slow.factor`, 0.5, while `slow` runs; always 1 for the hero
and the shots he owns). Effects count down in play only and are not saved.
Names: `reflect`, `reveal`, `quake`, `freeze`, `slow`, `truesight` (items'
spells), `star` (hero), `candle`, `lamp` (items; started with `Infinity`,
cleared on `screen-leave`; while one runs the dungeon lights a dark room,
section 11).

### 8.19 Prompts: `game/prompts.js` (ui)

`registerPrompt({ id, order, action, label, when })` from any stream
(`label` may be a function returning text or null); `currentPrompts()`
(one per action, lowest order wins; play only); `buttonLabel(action)`
names the button on the last device used. Built in: Talk/Check/Open on A
(`findInteraction`), the selected item on B.

### 8.20 Save slots: `game/saves.js` (ui)

`saveSlot(n)` (`saved`), `loadSlot(n)` (`loaded`), `eraseSlot(n)`,
`slotSummary(n)` (`null` or `{ slot, time, ok, name, class, hearts, maxHearts, magic, coins, playTime, deaths, orbs, area }`,
read without loading), `slotSummaries()`, `SLOT_COUNT` 3. Where a game
resumes is `systems/flow.js`'s (ui):

- `flow.loadGame(data)` keeps resuming where the save was made, with the
  saved life: the test hook's `t.load` and `default` use it.
- `saves.loadSlot(n)` applies spec 11 (the respawn point, or the entrance of
  the dungeon it was saved in, with full life and magic): the ui gives
  `loadGame` options and calls `loadGame(data, { at: respawnSpot('load'), refill: true })`.
  M3 moves `default` to slots.
- Continue after a death is `hero.respawn()` (8.1): full life and magic, at
  `respawnSpot('death')` (the respawn point, or the entrance of the dungeon
  he fell in). Once flow continues that way, contracts remove the stand-in
  in `places.js` that copies a respawn rule's answer into `state.respawn`
  while the game-over panel is up.

### 8.21 HUD (ui)

The ui alone draws the HUD, as widgets:
`registerHudWidget({ id, region, order, mount, key, render })`. A widget
reads `state` and query functions (`selectedItem`, `ringItems`, `ammo`,
`keyCount`, `currentPrompts`, `dungeonRooms`, `areaKind`) and redraws when
its key changes. Nothing pushes into the HUD: another stream puts what
should show in state or emits an event.

- **Regions** (`REGIONS`, art bible 12): `vitals` (hearts and mana gems, top
  left), `counters` (money, bombs and arrows, under them), `slots` (the item
  and weapon slots), `minimap` (top right), `prompts` (the prompt bar, bottom
  right) and `toast` (the key toast and short notices). M1's `left`,
  `center` and `right` stay as aliases until the ui's layout lands.
- **What it shows.** Money is `state.coins`; bombs and arrows are
  `state.inventory.ammo` (`ammo('bombs')`); the magic row is mana gems the ui
  draws itself, not look's `ICONS.vial` (section 4). The key toast shows on
  `keys-changed` for `TUNING.toasts.key` s; the item get comes through the
  presenter (8.7); the boss's name card and hint come from `boss-intro`; a
  critical hit's red word comes from `enemy-hit` when `hit.crit` is set.
- **World's banner.** World calls `showBanner(screen.name)` and
  `setAreaLabel` on every new screen (frozen code), and the art-bible HUD
  has neither. Until world gives banners a kind at M3, the ui may ignore a
  banner whose text is the current screen's name, and `setAreaLabel` may do
  nothing.
- Readability rules (12.4, `TUNING.readability`) are the ui's.

### 8.22 Test API: `window.__voxelHeroes.game` (contracts)

The contract modules themselves, so a test reaches every export:
`version` 1, `tuning`, `events`, `input`, `loop`, `save`, `audio`, `state`,
`grants`, `combat`, `interact`, `keys`, `inventory`, `items`, `projectile`,
`vitals`, `progress`, `places`, `effects`, `settings`, `hero`, `swords`,
`damage`, `spells`, `dungeons`, `shops`, `services`, `saves`, `bestiary`,
`music`, `cards`, `prompts`, `pickups`, `menus`, `clears`, `drops`,
`tileActions`; the entity base and registry (`entity`, `registry`: tests
register `probe-` types); and the ui modules whose views tests read instead
of the DOM: `dialog` (`dialogView()`: null, or `{ speaker, text, shown,
choices, choice, large, page, pages }`), `overlay` (`overlayView()`:
`{ visible, title, message, button }`) and `hud` (`muteLabel()`, `REGIONS`).
`window.__voxelHeroesGame` holds the same object. Streams add their own
debug handles under `window.__voxelHeroes.game` only through a contract
request.

---

## 9. Ids

- **Kebab-case**, and the spec's Appendix B ids where it names one: items,
  keys and progress, spells (`spell-*`), pickups, swords (`blade-*`), enemies,
  bosses (`boss-*`), places (`castle`, `v1`-`v3`, `inn-1`-`inn-3`, `cabin`,
  `trader`, `graveyard`, `volcano`, `lost-woods`, `d1`-`d7`).
- **Area ids**: overworld areas `ow-<col>-<row>` (spec 3: col 1-7, row 1-5,
  e.g. `ow-4-3`); villages, which are lattice areas, by place id (`v1`);
  interiors by place id (`inn-1`, `v1-smith`); dungeons by dungeon id (`d1`,
  with `d1-boss` for an arena of its own); test areas `test-<stream>-<name>`.
  Every new area sets `kind` (8.15).
- **Flags**: the spec's (`dungeon:<id>:...`, `boss:<id>`, `orb:<n>`) plus the
  M1 ones (`taken:tx,tz`, `door:tx,tz`, `chest:tx,tz`); anything new is
  prefixed with the stream (`overworld:talked:smith`, `items:bag-1`).
  `world:seen:<gx>,<gy>` is not used: `state.visited` records every screen.
  The spec's `respawn`, `class`, `trait` and `mode` are `state.respawn` and
  `state.profile`.
- **Entity types**: enemies by stream (8.5); NPCs `npc-<name>` (`npc-sage`);
  the counter `shop-item` (overworld); the pickups of 8.6, with items'
  `heart-container` and `token`; `boss-tombstone` (foes-dungeon); `group`,
  the spawn group.
- **Projectiles**, one owner each, all on the `Projectile` base with `owner`
  and `tier`: hero `beam`; items `arrow` (and its fire bolts and
  boomerang); foes-overworld `archer-arrow`, `rock-shot`; foes-dungeon
  `trap-arrow`, `turret-bolt`, `gazer-shot`, `serpent-<name>`.
- **Music** `title`, `overworld`, `village`, `dungeon`, `boss` and
  `dungeon-<n>`; **cards** `card-<area or place>`; **menus** `shop`,
  `counter`, `smith`, `inn`, `warp`; **drop tables** `pack-a` to `pack-e`,
  `bush`, `pot`; **camera presets** `boss`, `boss-intro` (contracts) and
  `interior` (world); **place and area kinds** 8.15; **effects** 8.18.
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
| 0-99 | the overworld lattice (spec 3, 4.1): 7 x 5 areas of 4 x 4 screens of 16 x 16 tiles, edge to edge. Area (c, r) (1-based) sets `screen: [16, 16]` and `origin: [(c - 1) 4, (r - 1) 4]`, so the lattice fills columns 0-27. Villages are lattice areas at their cell: V1 is area `v1` at (5, 3), origin `[16, 8]`. The M1 `overworld` (3 x 2 screens of 16 x 11) moves to origin `[90, 0]` (columns 90-92) in overworld's `world/areas/overworld.js` before any lattice area is added: the gate scenarios reach it by area and local tile only | overworld |
| 100-199 | outdoor places off the lattice, reached only by warps (none in M2) | overworld |
| 200-299 | dungeons, 16 x 12 rooms: dungeon d at `[200 + 10 d, 0]`, floor f in local rows `11 f` to `11 f + 9`; boss arenas (22 x 16) as areas of their own placed by tile in the dungeon's free columns. The crypt is dungeon 0 at `[200, 0]` once feat/world is merged (on main it is still at `[0, 10]`), D1 at `[210, 0]` | dungeon |
| 300-399 | interiors (houses, shops, inns, caves), entered by door warps: building k at `[300 + 2 (k % 50), 2 floor(k / 50)]`; smaller rooms by tile at `[(300 + 2 (k % 50)) 16, 24 floor(k / 50)]`. They use feat/world's `interior` camera preset (fixed, fitted to the room's width) | overworld |
| 400-409 | sword yard | hero |
| 410-419 | overworld enemy field | foes-overworld |
| 420-429 | dungeon enemy and boss rooms | foes-dungeon |
| 430-439 | item and spell range | items |
| 440-449 | dungeon mechanics rooms | dungeon |
| 450-459 | overworld and town test screens | overworld |
| 460-469 | UI test screens | ui |
| 470-479 | world and camera tests (`test-borders.js`) | world |
| 480-499 | kit test areas (`kitroom.js`) | look |

M2 builds the P2.7 slice of the lattice at full size: `ow-3-2` (the D1
area), `ow-4-2` (between), `ow-4-3` (the castle) and `v1`, with the D1
entrance. Use the first 8 columns of a 10-column test block and leave the
last 2 empty. Test areas are reached by `teleport` only and never linked to
the real map.

---

## 11. Tiles and markers

- **Tilesets.** `overworld` and `town` belong to the overworld stream,
  `dungeon` to the dungeon stream (existing chars from M1 and look-kits:
  `listTilesets()` lists them; `registerTile` throws on a duplicate). New tiles
  go in new files under `world/tiles/`. Overworld may define `interior` and
  `cave` tilesets of its own (`defineTileset(name, { parent })`); the dungeon
  keeps the builders they borrow as stable exports of `world/tiles/dungeon.js`
  (feat/look's `floorColor`, `fineFloor`, `wallColor`, `LAMP_OFFSET`,
  `LAMP_BLOCK`). Items and foes add no tiles.
- **Hooks items and foes rely on.** Tiles answer `onShot` (arrows, the
  boomerang, fire bolts, enemy shots: check `ctx.projectile.source`), `onBomb`
  (`explosion` within its radius), `onLight` (`light`), `onFreeze`
  (`freezeAt`: flame walls turn to ice), `onSword`, `onPush`, `onEnter`,
  `onInteract`. Flags on a tile def: `grapple: true` (the grapple hooks it
  and pulls the hero; chests too), `blocksShots: false` (low tiles: water,
  pits, lava). Chests and small-key doors call `systems/tile-actions.js`
  (8.10).
- **The blade on tiles** (hero, spec 7.4). While the blade is out, the hero
  calls `onSword` on the tiles it covers, from the hilt outward, with
  `{ hit: { source: 'sword' | 'spin' | 'dash' | 'beam', swingId, damage, pierce, fromX, fromZ }, player, px, pz }`
  (`px`, `pz`: the point on the tile). Without pierce it stops after the
  first solid tile. `swingId` lets a tile act once per thrust. Wall switches
  ignore the blade (spec 6.4, 7.4).

**Fields the hero reads** (spec 7.3, 7.11, 6.4). Every play tick the hero
stream looks at the tile under the hero's centre and applies these. Tile
owners set them and draw the tiles, and never apply hazard damage
themselves, so nothing counts twice.

| Field | What the hero does |
|---|---|
| `hazard: 'pit'` | `fall({ damage: TUNING.damage.pit, to: 'entry' })`: back to where he came into the room |
| `hazard: 'spikes'` | `receiveHit({ damage: TUNING.damage.spikes, kind: 'hazard', from: <the tile's centre> })`: pushed off, blinking |
| `hazard: 'lava'` | `fall({ damage: TUNING.damage.lava, to: 'safe' })`: back to the last tile without a hazard |
| `hazard: 'swamp'` | `TUNING.damage.swampPerSec` for each second in it (8.1: no push, blink or lock); nothing with `boots-swamp` |
| `hazard: 'puddle'` | `fall({ damage: TUNING.damage.darkPuddle, to: def.to })`: the floor's start, a spot in the tile def |
| `stairs: true` | walks at `TUNING.hero.stairs` (0.75) times his speed |
| `ledge: 'north' \| 'east' \| 'south' \| 'west'` | a solid hop-down ledge facing that way: pushing into it that way for `TUNING.hero.ledgePush` s hops him over it, a `ledgeHop` s hop in the cheer pose |
| `conveyor: [dx, dz]` | carries him with `hero.move` at `TUNING.dungeon.conveyor` t/s |

Weak floors, holes and stairs between floors stay tile behaviours
(`onEnter`, a timer, `hero.warp`).

- **Raised ground** stays solid scenery in M2, as frozen world code treats
  it: pockets are built with `ledge` and `stairs` tiles at ground level. The
  level model (the hero's height, collision per level, the wyrm's rule) is
  world and hero work for M3 (section 12).
- **Dark rooms** (dungeon; spec 6.4). The dungeon registers the lighting
  `dark` (`registerLighting('dark', { extends: 'crypt', ... })`), and a dark
  screen sets `lighting: 'dark'` and `dark: true`. On `effect-start` for
  `candle` in a dark screen it attaches
  `makeLampLight({ distance: TUNING.dungeon.candleRadius })` (feat/look's
  renderer) to the hero; for `lamp` it applies the area's normal lighting;
  it undoes both on `effect-end` and `screen-leave`. Items only start and
  clear the effects and emit `light`.
- **Markers.** Spawn markers are per area and are the area owner's. Entity
  types named in markers belong to their stream (section 9); an unknown type
  is skipped with one warning until merge. Random enemies use the `group`
  marker (8.5), shop goods `shop-item` (8.11), the D1 sage `npc-sage`
  (8.12), bosses `{ type: 'boss-serpent', dungeon: 'd1' }` (8.5).

---

## 12. Not settled yet

| Question | Why it is open | Who settles it, when |
|---|---|---|
| Boss arenas of 22 x 16 | feat/world places rooms of any size by tile and the `'boss'` preset exists (8.5), but a 22-wide room's doors and how the camera fits it are world work, frozen in M2 | foes-dungeon and dungeon build the arena in their test columns and report; M3 |
| Overworld screens at 16 x 16 (spec 4.1) instead of M1's 16 x 11 | presets B and C were tuned on 16 x 11 screens; a 16 x 16 screen may need camera changes (world, frozen) | overworld builds its new areas at 16 x 16 and reports what the camera needs |
| Levels: the hero's height, collision per level, the wyrm's rule | frozen world collision treats raised ground as walls | world and hero at M3; M2 builds pockets with ledges and stairs (section 11) |
| Where the game starts (`START` in `world/areas.js`) | spec P2.6 starts at the castle, which `registerPrologue` gives the new-game flow (8.16); `START` stays for the M1 Enter | M3 moves `START` when it rewrites `default` |
| The title's Enter | `default` and `contracts-m2` press Enter and expect M1's class-less game | until M3, Enter or confirm on the first title screen starts that game at once (6 of 6 life at `START`); the file select and new-game flow sit behind a second entry (a Files item reached with down) and are tested in `ui.mjs`; M3 updates the scenarios |
| Loading a save at the respawn point (spec 11) | `default` loads through `flow.loadGame(data)` and expects the hero where the save was made | `loadGame(data)` keeps that; `saves.loadSlot(n)` applies spec 11 through `loadGame(data, { at, refill })` (8.20); M3 moves `default` to slots |
| The respawn stand-in in `places.js` | until flow asks `respawnSpot('death')` itself, `places.js` copies a rule's answer into `state.respawn` during game over | contracts remove it once the ui's flow continues through `respawnSpot` (8.20) |
| The loading-card hold | world's transition holds a fixed 1 s (`AREA_HOLD`) whatever `loadingArt` says | world at M3: reads `TUNING.load.cardMin` and the option, and emits `area-ready` when the hold ends |
| Screen banners and the area label | world calls `showBanner(screen.name)` and `setAreaLabel` on every screen; the art-bible HUD has neither | the ui may ignore them in M2 (8.21); world adds a banner kind (`showBanner(text, { kind: 'screen' })`) at M3 |
| One camera choice or two | the options keep one in preferences; feat/world also saves one per slot | ui with world at M3; until then the slot's choice wins on load |
| The hero's feel numbers in M1 code | `receiveHit` uses `TUNING.damage`, but direct `hurtPlayer` calls keep M1's 1.1 s i-frames and speed-8 push, and the passive shield and the swing are M1's | hero; foes-overworld moves its enemies to `receiveHit` |
| Enemy contact and `rock-shot` bypass `receiveHit` | M1 enemies call `hurtPlayer` and `shieldBlocks` | foes-overworld moves them |
| Drops in `gem` and `gem5` | the M1 tables | foes-overworld (the packs of spec 8.7: section 8.5) |
| `lockInput` stops presses, not walking | the M1 player moves on its own | hero reads `hero.inputLocked()` |
| Where a boss arena that is its own area sits on the dungeon map | `dungeonRooms` gives it `room: null` | dungeon with ui |
| Who speaks the boss hint | `boss-intro` carries `hint`, but the companion who says it has no owner | unassigned until M3 |
| Music | silent placeholders | M6 |
| Names of gear, swords and places in placeholders | working names only | their streams replace them |
| Briefs, drafts and the art bible against the spec | they came before the spec | settled: the spec and `TUNING` win (section 4, "Briefs and drafts against the spec") |

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
grants, swords, spells, shops, inns, places, cards (never a `'*'` card in
M2), music ids, prompts, clear rules (the foes streams), modes, play hooks,
sounds, `TUNING` keys in its section, flags with its prefix, and state
fields declared with `defineState` in its own files (tell the others in the
report). HUD widgets are the ui's alone (8.21).

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
| `core/input.js` | spec 7.1 actions and bindings, gamepad, touch buttons, `move8`, `menuDir`, `clashes`, `lastDevice` |
| `core/loop.js` | fixed 1/60 s steps with an accumulator (`advance`) |
| `core/events.js` | the `EVENTS` catalogue, `onAny` |
| `core/save.js` | `SLOT_COUNT`, `readPrefs`, `writePrefs` |
| `core/audio.js` | music and effects buses, `setMuted`, `setVolumes`, `musicOutput` |
| `entities/manager.js` | `enemy-spawned`; an entity removed in `onAdd` is not announced |
| `systems/grants.js` | grant meta, fanfare, the item-get presenter, the core grants |
| `systems/interact.js` | `findInteraction` for the prompt bar; reach `TUNING.hero.interactRange` to the entity's edge |
| `systems/drops.js` | entries with `else`; a type nobody has registered is skipped with one warning |
| `systems/keys.js` | `keys-changed` |
| `items/registry.js`, `items/inventory.js` | item `kind` and `model`; the quick ring (`setOnRing`, `ringItems`) |
| `ui/dialog.js`, `ui/dialog.css` | text speed and large text options, `{hero}`, `ask`, wrapping choices, `dialogView` |
| `ui/hud.js` | mute through the `muted` option, `muteLabel`; the art bible's region names (`REGIONS`, with M1's as aliases) |
| `ui/overlay.js` | `overlayView` |
| `content.js` | globs for the M2 content folders |
| `index.html`, `style.css` | touch buttons for dash, guard, map, inventory and pause; the title's controls |
| `README.md` | the controls table |
| `scripts/scenarios/contracts.mjs` | the sword is J now that Space dashes |

### Merging the M1.5 branches

`feat/world`, `feat/look-kits` and `feat/look-render` branch from `a00fb70`,
before main's M1 review fixes (`3f86c4d`), so merging any of them with main
conflicts in world and look files (`core/camera.js`,
`systems/transitions.js`, `debug/testhook.js`, `world/world.js`, ...)
whatever this branch does. This branch adds no conflict of its own: the one
file it shares with them is `core/state.js` (feat/world), in separate hunks.
Trial merges of this branch with each of them, with those conflicts settled
as below, build and pass `contracts-m2`, and the feat/world one passes
feat/world's `default` scenario too. When settling main against feat/world,
keep main's:

- `CARRY` and the `carry` of the scroll and warp modes
  (`systems/transitions.js`), and `playerCameraPresets` (`core/camera.js`);
- `selectable: true` on presets A-D: feat/world's presets drop the flag, and
  main's `chooseCameraPreset` then refuses every preset (the camera option
  only warns);
- the warp check that warns about an unknown area instead of throwing
  (`world.js`, `checkWarp`): M2 streams warp into areas other streams add;
- `spawnsAt` and the spawn marker checks (`world.js`): NPCs are placed with
  it (8.12);
- the test hook's imports (`activeSlot`, `registerPlayHook`,
  `registerHudWidget`, `registerMode`, `playerCameraPresets`, ...), and in
  `scripts/lib/bot.js` the `occupied` helper and `async function exit` (its
  body awaits).

The look trials took main's side of the `camera.js` conflicts
(`debug/testhook.js` imports `playerCameraPresets` from it). The coin and
magic pickups find their models by name (M1's `gemGeometry`, or look-kits'
`coinModel` and `gemModel`), so they build before and after feat/look-kits.

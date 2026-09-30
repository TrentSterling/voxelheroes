# Voxel Heroes build plan

Goal: a browser game (Three.js, Vite, vanilla JS) that plays and feels like 3D Dot Game Heroes as closely as we can manage. Mechanics, camera, pacing and structure should follow that game. Every piece of art, every name and every line of text is our own, so nothing is copied from 3D Dot Game Heroes or from Zelda.

Design inputs, read these when they exist and follow them over this plan:

- `/mnt/project-files/design/gameplay-spec.md`, the mechanics spec
- `/mnt/project-files/design/art-bible.md`, the art bible

## What "1:1" means here

The signature things a player of the original would expect to find (with the gameplay spec's corrections, section 2.1):

1. **Areas, then screens.** The world is 7 × 5 areas joined by short loading cards. Each area is a grid of fixed screens (16 × 16 tiles outdoors; dungeon rooms are 16 × 12). The default camera is a low, tilted view that follows the hero; the higher presets and every dungeon room slide one screen at a time.
2. **Everything is voxels, and everything breaks into voxels.** Enemies, grass, bushes, pots and walls burst into bouncing cubes when destroyed.
3. **The sword is the star.** Swords have separate stats (length, width, strength, spin, beam, pierce, special), raised one level at a time at a blacksmith. At full life the sword grows to its full, often screen-spanning size; half a heart of damage drops it to a small blade until life is full again. The thrust is instant; twisting the stick while the blade is out sweeps it round (a spin, with no charge). There are several swords to find, some with special traits.
4. **Guard.** A held button that slows the hero and blocks from the front. Six shield tiers decide which projectiles it stops.
5. **Tools and spells** share one quick slot on the B button, cycled without pausing: boomerang, bombs, bow, grapple, long grapple and fire wand, plus spells paid from a magic row. Candles and lamps are shop consumables. Ammo and bomb counts show on the HUD.
6. **Dungeons** on a room grid, with small keys, one boss key, a map chest and a map that fills in as you explore (no compass), shutter doors that open when a room is cleared, push blocks, floor and wall switches, bombable cracked walls, torches and dark rooms, pits, pots, a boss, a heart container and an orb reward.
7. **Towns and people.** Villagers to talk to, shops, a blacksmith, an inn that sets the respawn point and refills, sidequests and secret caves. Saving is from the pause menu, anywhere.
8. **Progression.** A life row and a magic row (starting life 3 to 5 hearts by class), heart pieces, coins from enemies, bushes and chests, and six orbs from six dungeons as the long-term goal. The first playable milestone ships with one full dungeon.
9. **Controls.** Sword, item, dash, guard, map, inventory and item cycling each have their own button.
10. **Custom hero.** The original lets you build your own hero in a voxel editor. We add a simple editor late on.

## Scope: the smaller world

The compact scope below overrides the gameplay spec's full-size sections (4.1, 5.3, 6.8, 6.9, 10.5).

Trent chose a smaller world (spec Q25, 2026-09-28): fewer, smaller areas and dungeons, so a complete game from title screen to ending lands sooner. Mechanics and look still follow the original 1:1. Where the gameplay spec gives full-size counts (sections 4.1, 5.3, 6.8, 6.9, 10.5), these win:

| | Original (spec) | Ours |
|---|---|---|
| Overworld | 7 × 5 areas of 4 × 4 screens, about 560 screens | 4 × 3 areas of 3 × 3 screens (16 × 16 tiles each), about 108 screens |
| Dungeons | 6 plus a 7-floor tower, about 370 rooms | 4 plus a short tower (2 to 3 rematch floors, then the final), about 100 rooms |
| First dungeon | 20 to 24 rooms | about 16 rooms, same mechanics (4 small keys, boomerang, dark room, colored side room, antechamber) |
| Tool chain | boomerang, bombs, grapple, long grapple, fire wand, swamp boots | boomerang, bombs, grapple, fire wand; 4 orbs open the tower |
| Swords | 12 to 16 | about 8 to 10 |
| Places | castle, 3 villages, 3 inns, lone houses, graveyard, volcano, lost woods | castle, 1 village (shops, smith, inn), a second inn, graveyard, a small lost woods (5 exits), caves |

`TUNING.world.areaScreens` is [3, 3] and `areas` [4, 3] (set in P0; [CONTRACTS.md](CONTRACTS.md) carries the numbers).

## Milestones

| # | Milestone | Contents |
|---|-----------|----------|
| M0 | Prototype (done) | 6 overworld screens, a 4-room crypt, sword, 2 enemy types, key, door, chest |
| M1 | Foundation (done) | Modules with registries, event bus, inventory, dialog, save; deterministic headless play-test harness with screenshots |
| M1.5 | Look, world, contracts (done, v0.3) | The art bible look (materials, lighting, post-processing, 1/8 terrain, 1/16 characters, the dungeon kit); per-area screen sizes, 16 × 12 dungeon rooms, area loads; [CONTRACTS.md](CONTRACTS.md), TUNING, the fixed 60 Hz step and the spec's key layout |
| P0 | Framework alignment | Cameras A and D follow the hero with follow changes, B and C hold and slide (48 ticks); loads of at most 90 ticks with cards; only the current area built; dungeon, large-room and interior cameras from the art bible |
| M2 | The kit and the first slice | hero (movement, thrust, full-life blade, spin, guard, dash, damage), items, overworld and dungeon enemies with the first boss, the dungeon kit and D1, the overworld slice (castle area, village, D1's area), and the ui, one stream at a time or in pairs |
| M3 | Title to the first boss | Merge the streams, fix the seams, and a play-test from the title screen through a new game, the overworld slice and D1 to its boss |
| M4 | The complete game | D2 to D4, the remaining areas, the tower, the final boss and the ending; the effects catalogue, biome palettes and temple themes |
| M5 | Extras | Hero voxel editor, new game+, minigames, music |

The gameplay spec's build order (its section 13, phases P0 to P5) decides what comes first inside these milestones.

M4 now has its second-dungeon stretch: three forest screens, five repeating
woodland forks, fifteen Rootglass Hive rooms and the Amber Queen arena. Bombs,
breaches, three keys, the optional red magic vault, portal, second orb and
rematch are implemented. The Sunreach route and twenty-two-room, two-floor
Buried Watch add grapple crossings, blue vault, powder bag, the colossus,
third orb and Quake. Brineglass Coast and the twenty-five-room, two-floor
Brineglass Temple add the fire wand, paired torch gates, meltable ice, magic
shield vault, thirty-bomb bag, Nacre, fourth orb and Freeze. The hive sage
also teaches Reflect. The Fourfold Tower adds an invulnerable two-minute first
reflection, three memory floors with independent keys/maps/puzzles/rematches,
rest wells, Truesight, the Bastion Shield and Dawn Blade. The final keeper grows
from three to five bodies; personal Truesight reveals its vulnerable body.
The Hollow Crown uses storm, marked lightning and charged-shot patterns. The
ending returns to Mossbrook and saves victory, with King Aldric's homecoming.
This route is implemented and is undergoing full regression and co-op checks.
Broader village quest variety and the rest of M4's catalogue remain to audit;
the existence of an ending does not by itself complete that milestone.

Village errands now include Tobin's physical root cellar and Rook's three-room
Briar Den. Rook's route earns the Hunter Bow, combines two arrow targets into
a bridge crossing, guards the stolen dice behind a shielded enemy, and returns
a permanent quiver plus bombs. These routes replace automatic visit and bush
objectives with places, tools and physical treasure; other village errands and
the remaining M4 catalogue still need their own audit.

The item-get cheer now presents existing native prize models for tools, quest
keepsakes and heart containers. A brief local camera adjustment keeps them below
the phone HUD, and reward captions sit apart from the model. Missing model
metadata still falls back to the existing banner; the remaining reward catalogue
needs its own art audit rather than substituting a generic prize.

## Architecture contracts

- [ARCHITECTURE.md](ARCHITECTURE.md) is the map of the code: the registries (tiles, areas, entities, items, modes, HUD widgets, grants, drops, save fields), the event bus, the test hook `window.__voxelHeroes` and the play-test harness.
- [CONTRACTS.md](CONTRACTS.md) fixes everything the M2 streams share: one owner per file, units, state fields, events, input actions and bindings, the APIs (hero, damage, projectiles, pickups, items and spells, swords, dungeons, shops and menus, music, loading cards, settings, save slots), ids and the reserved regions of the global grid. A stream that needs a change in a file it does not own asks for it in its report instead of editing.

## Process

- Every milestone ends with a Playwright play-test that drives the real build and saves screenshots to `/mnt/project-files/voxel-heroes-shots/<milestone>/`. The playable artifact is republished after each milestone.
- Headless Chromium renders slowly, so tests step the simulation at fixed 1/60 s ticks through `window.__voxelHeroes` rather than waiting in real time.
- Work happens in a local git repo. Parallel features use separate branches and worktrees, and an integration pass merges them. In M2 each stream works on `feat/m2-<stream>`, keeps one scenario in `scripts/scenarios/<stream>.mjs` and saves its screenshots under `/mnt/project-files/voxel-heroes-shots/m2/<stream>/`.
- Trent puts the code on GitHub himself; each milestone ships a source zip and the playable link.

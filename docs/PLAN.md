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

## Milestones

| # | Milestone | Contents |
|---|-----------|----------|
| M0 | Prototype (done) | 6 overworld screens, a 4-room crypt, sword, 2 enemy types, key, door, chest |
| M1 | Foundation (done) | Split into modules with clear extension points: tile registry, entity registry, event bus, inventory, dialog, save. Deterministic headless play-test harness with screenshots. |
| M1.5 | Look port, world structure, contracts | Three pieces built in parallel. Look (`feat/look-render`, `feat/look-kits`): renderer, lighting, post-processing, materials, the terrain and dungeon kits, models at 1/16 tile with hero poses, particles. World (`feat/world`): per-area screen sizes, `'area:i,j'` addressing and spots, 16 × 12 dungeon rooms, area transitions with a loading-card hold, `room-enter` and `area-enter`, camera follow. Contracts (`feat/contracts`): [CONTRACTS.md](CONTRACTS.md), the file owners, units, shared state, events, input actions, registries and APIs that M2 builds on, in code and tested. |
| M2 | The seven streams | hero, items, foes-overworld, foes-dungeon, dungeon, overworld and ui, built at the same time on `feat/m2-<stream>` branches against the contracts (CONTRACTS.md section 1 says what each one builds) |
| M3 | Integration and a title-to-boss play-test | Merge the seven streams in the order CONTRACTS.md gives, fix the seams, settle its open questions, and add a play-test that runs from the title screen through a new game, the overworld slice and the first temple to its boss |
| M4 | Remaining look work | The effects catalogue, biome palettes and temple themes |
| M5 | Alignment with the gameplay spec | Cameras, speeds, damage values, item behaviour and every other number checked against the spec, with its measured values folded into `TUNING` |
| M6 | Extras | Hero voxel editor, more dungeons, music |

The gameplay spec's build order (its section 13, phases P0 to P5) decides what comes first inside these milestones.

## Architecture contracts

- [ARCHITECTURE.md](ARCHITECTURE.md) is the map of the code: the registries (tiles, areas, entities, items, modes, HUD widgets, grants, drops, save fields), the event bus, the test hook `window.__voxelHeroes` and the play-test harness.
- [CONTRACTS.md](CONTRACTS.md) fixes everything the M2 streams share: one owner per file, units, state fields, events, input actions and bindings, the APIs (hero, damage, projectiles, pickups, items and spells, swords, dungeons, shops and menus, music, loading cards, settings, save slots), ids and the reserved regions of the global grid. A stream that needs a change in a file it does not own asks for it in its report instead of editing.

## Process

- Every milestone ends with a Playwright play-test that drives the real build and saves screenshots to `/mnt/project-files/voxel-heroes-shots/<milestone>/`. The playable artifact is republished after each milestone.
- Headless Chromium renders slowly, so tests step the simulation at fixed 1/60 s ticks through `window.__voxelHeroes` rather than waiting in real time.
- Work happens in a local git repo. Parallel features use separate branches and worktrees, and an integration pass merges them. In M2 each stream works on `feat/m2-<stream>`, keeps one scenario in `scripts/scenarios/<stream>.mjs` and saves its screenshots under `/mnt/project-files/voxel-heroes-shots/m2/<stream>/`.
- Trent puts the code on GitHub himself; each milestone ships a source zip and the playable link.

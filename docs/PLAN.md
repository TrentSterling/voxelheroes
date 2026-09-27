# Voxel Heroes build plan

Goal: a browser game (Three.js, Vite, vanilla JS) that plays and feels like 3D Dot Game Heroes as closely as we can manage. Mechanics, camera, pacing and structure should follow that game. Every piece of art, every name and every line of text is our own, so nothing is copied from 3D Dot Game Heroes or from Zelda.

Design inputs, read these when they exist and follow them over this plan:

- `/mnt/project-files/design/gameplay-spec.md`, the mechanics spec
- `/mnt/project-files/design/art-bible.md`, the art bible

## What "1:1" means here

The signature things a player of the original would expect to find:

1. **Screen-by-screen world.** The overworld and dungeons are grids of fixed screens. Walking off an edge scrolls the camera to the next one. The camera is a fixed, tilted, near top-down view.
2. **Everything is voxels, and everything breaks into voxels.** Enemies, grass, bushes, pots and walls burst into bouncing cubes when destroyed.
3. **The sword is the star.** Swords have separate length and width levels, raised at a blacksmith. At full health the sword grows to its full, often screen-spanning size. Once the hero is hurt it drops back to normal size. Holding the button charges a spin attack. There are several swords to find, some with special traits such as piercing or a beam.
4. **Shield.** It blocks projectiles from the front while the hero is not swinging.
5. **Classic sub-items** on a separate button: bow and arrows, bombs, a returning throwing blade (the boomerang role), a lantern, plus a few more later. Ammo and bomb counts show on the HUD.
6. **Dungeons** with small keys, a big key, a map and a compass, shutter doors that open when a room is cleared, push blocks, floor switches, bombable cracked walls, torches to light, pits, pots, a boss, a heart container and an orb reward.
7. **Towns and people.** Villagers to talk to, shops, a blacksmith, an inn to save at, sidequests and secret caves.
8. **Progression.** Hearts plus heart fragments, currency from enemies, bushes and chests, and six orbs from six dungeons as the long-term goal. The first playable milestone ships with one full dungeon.
9. **Custom hero.** The original lets you build your own hero in a voxel editor. We add a simple editor late on.

## Milestones

| # | Milestone | Contents |
|---|-----------|----------|
| M0 | Prototype (done) | 6 overworld screens, a 4-room crypt, sword, 2 enemy types, key, door, chest |
| M1 | Foundation | Split into modules with clear extension points: tile registry, entity registry, event bus, inventory, dialog, save. Deterministic headless play-test harness with screenshots. |
| M2 | Core systems, built in parallel | Sword system; overworld enemy roster; dungeon enemy roster and first boss; sub-items; dungeon mechanics plus a full first dungeon; a larger overworld with a town, NPCs, shop, blacksmith and inn; title, pause, inventory, map and save UI |
| M3 | Integration | Merge every branch, fix seams, play-test the whole loop from title screen to boss |
| M4 | Look | Apply the art bible: palette, voxel scale, bevelled cubes, lighting, depth of field, particles, UI skin |
| M5 | Spec alignment | Camera, speeds, damage values and item behaviour checked against the gameplay spec |
| M6 | Extras | Hero voxel editor, more dungeons, sidequests, music |

## Architecture contracts (set up in M1)

- `src/core/`: renderer, camera, input (keyboard and touch; A = sword, B = item, Start = menu), game loop, `events` bus, save and load.
- `src/world/tiles.js`: registry of tile types by map character. Each entry declares solidity, how it builds voxels and optional hooks (on enter, on bomb, on sword, on push, on light). New tiles register themselves here without touching the world builder.
- `src/world/areas/`: content. One file per area: overworld, town, each dungeon. Each area is a set of 16×11 ASCII screens plus metadata (name, lighting, music key, spawns, props, warps).
- `src/entities/`: an `Entity` base and a registry. Every enemy, projectile, pickup and NPC type lives in its own file and registers by name. Areas refer to spawns by name.
- `src/items/`: one file per sub-item, registered in an item registry that the inventory and HUD read.
- `src/ui/`: HUD, dialog box, pause and inventory menu, map, title, shop.
- `window.__voxelHeroes`: test hook exposing state, `update(dt)`, teleport and give-item helpers so headless tests can drive the game without real-time rendering.

## Process

- Every milestone ends with a Playwright play-test that drives the real build and saves screenshots to `/mnt/project-files/voxel-heroes-shots/<milestone>/`. The playable artifact is republished after each milestone.
- Headless Chromium renders slowly, so tests step the simulation with `window.__voxelHeroes.update(1/60)` rather than waiting in real time.
- Work happens in a local git repo. Parallel features use separate branches and worktrees, and an integration pass merges them. Nothing is pushed to GitHub until Trent says so.

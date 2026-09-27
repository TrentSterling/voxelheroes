# Voxel Heroes

A Three.js voxel action adventure in the spirit of 3D Dot Game Heroes and the SNES Zelda overworld.

```sh
npm install
npm run dev        # play locally at http://localhost:5173
npm run artifact   # build a single self-contained HTML page into dist-artifact/
npm run playtest   # headless play-through with screenshots in playtest-out/
```

Controls:

| | Keyboard | Touch |
|-|----------|-------|
| Move | WASD or arrows | stick |
| Sword (A) | Space, J or Z | A |
| Item (B) | K or X (once you own one) | B |
| Pause (Start) | Enter, Esc or P | Menu |
| Next / previous item | E / Q | |
| Mute | M | |

Face a shot to block it with the shield (not while swinging).

## Layout

The code is split into small modules with registries for tiles, areas,
entities, items, HUD widgets and UI screens, so most additions are new files.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, every
registry's contract, worked examples, the `window.__voxelHeroes` test hook and
the play-test harness. [docs/PLAN.md](docs/PLAN.md) has the milestone plan.

# Voxel Heroes

A Three.js voxel action adventure in the spirit of 3D Dot Game Heroes and the SNES Zelda overworld.

```sh
npm install
npm run dev        # play locally at http://localhost:5173
npm run artifact   # build a single self-contained HTML page into dist-artifact/
npm run playtest   # headless play-through with screenshots in playtest-out/
```

Controls (gameplay spec 7.1; `src/core/input.js` holds the bindings):

| | Keyboard | Gamepad | Touch |
|-|----------|---------|-------|
| Move | WASD or arrows | left stick or d-pad | stick |
| Sword, talk (A) | J or Z | A | A |
| Item or spell (B) | K or X (once you own one) | B | B |
| Dash | Space | X | D |
| Guard (hold) | Shift | RB | G |
| Map | M | LB | Map |
| Next / previous item | E / Q | RT / LT | |
| Inventory | Tab | Y | Menu |
| Pause | Enter, Esc or P | Start | Pause |
| Mute | N | | |

In menus and dialogs J, Z, Enter and Space confirm; K, X, Esc and Backspace
cancel. Dash, guard, the map and the inventory arrive with the M2 streams;
until then M1's passive shield still blocks a shot you face.

## Layout

The code is split into small modules with registries for tiles, areas,
entities, items, HUD widgets and UI screens, so most additions are new files.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, every
registry's contract, worked examples, the `window.__voxelHeroes` test hook and
the play-test harness. [docs/CONTRACTS.md](docs/CONTRACTS.md) has the M2
contracts: who owns which file, shared state, events, input and the APIs the
parallel streams build on. [docs/PLAN.md](docs/PLAN.md) has the milestone plan.

# Voxel Heroes

A Three.js voxel action adventure in the spirit of 3D Dot Game Heroes and the SNES Zelda overworld.

```sh
npm install
npm run dev        # play locally at http://localhost:5173
npm run artifact   # build a single self-contained HTML page into dist-artifact/
```

Controls: WASD or arrows to move, Space or J to swing, P to pause, M to mute. On touch screens a stick and an A button appear.

## Layout

- `src/voxel.js` voxel grid plus a face-culling mesher that turns voxels into one geometry
- `src/maps.js` the overworld screens and the crypt rooms as 16 x 11 ASCII tile maps (edit these to change the world); `WARPS` links the crypt doorway and stairs
- `src/world.js` builds terrain, trees, rocks, water and bushes from the maps; tile collision
- `src/models.js` hero, slime, spitter, pickups, all built from voxels in code
- `src/main.js` game loop, combat, enemy AI, screen-scroll transitions, HUD
- `src/audio.js` WebAudio sound effects

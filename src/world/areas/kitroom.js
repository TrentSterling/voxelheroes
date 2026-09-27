// Debug-only kit test areas, registered only with ?kitroom=1 (never reachable in normal play):
//   kitroom   one golden temple room in the 16 x 12 room layout with every dungeon kit piece:
//             an open north doorway (corridor), a locked double door in the west wall, an open
//             east doorway, stairs out through the south wall, braziers, statues, pressure plates,
//             a push block, a pit, spike balls, dark water and a chest
//   kitfield  one overworld screen with every overworld kit piece: two levels of raised ground,
//             a cave mouth, stairs, a river with a bridge, dirt, sand, a path, flowers, bushes,
//             rocks, a fence, a gravestone, a signpost, a pot and a chest
//   kitlineup every model on one grass screen: the hero's poses (and the sword), the elder, the
//             enemies and their frames, markers, pickups, props and HUD icons
// Teleport there with the test hook: teleport('kitroom:0,0', 7.5, 8.5).
// The room layout needs per-area screen sizes; where the area registry only knows 16 x 11 screens
// the room drops one of its floor rows.
import * as THREE from 'three';
import { GROUND_Y } from '../../core/constants.js';
import { registerArea } from '../areas.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { modelMesh } from '../../models/kit.js';
import { heroModel, makeSwordMesh, SWORD_GRIP, PIVOT_Y } from '../../models/hero.js';
import { slimeModel, spitterModel, pebbleModel, stoneBrute, CHARACTER_MODELS } from '../../models/characters.js';
import { heartModel, gemModel, keyModel, coinModel } from '../../models/pickups.js';
import { ICONS } from '../../models/icons.js';
import { chestBaseModel, statueModel, spikeBallModel, pushBlockModel, brazierModel, flameModel, doorModel, FLAME_Y } from '../../models/props.js';

const enabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('kitroom');

const ROOM = [
  'WWWWWWW..WWWWWWW',
  'W.F..........F.W',
  'W..S..._=....S.W',
  'W....*.....*...W',
  'W..............W', // dropped in the 16 x 11 fallback
  'L....P..C..OO...',
  'L....._=...OO...',
  'W..............W',
  'W..~~.....S....W',
  'W..~~..........W',
  'W.F..........F.W',
  'WWWWWWWXXWWWWWWW',
];

const FIELD = [
  'TTT22222222222TT',
  'TT#222222222###T',
  'T##DD###^####..T',
  'T..o..,....dd..T',
  'T.B..R..ppppp..T',
  '~~~~~=~~~~~~.g.T',
  'Tss.s.ss..i...vT',
  'Tssss.ff.ffff..T',
  'T..sss.....e..CT',
  'T...,,...R....TT',
  'TTTTTTTTTTTTTTTT',
];

const LINEUP = [
  'TTTTTTTTTTTTTTTT',
  'T.V....U..9.S..T',
  'T..............T',
  'T.E.AHJKLM..3..T',
  'T.ahbcjkl.NOPQ.T',
  'T.nqrxym.z!.567T',
  'T.$%&()[.0vgiC.T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
];

// Lineup tiles: each shows one model on the tile centre (lift: tiles above the ground).
function show(make, { lift = 0, yaw = 0 } = {}) {
  return {
    name: 'lineup',
    solid: true,
    ground: 'grass',
    build: (ctx) => getTile('overworld', '.').build(ctx),
    prop(ctx) {
      const obj = make();
      obj.position.set(ctx.cx, GROUND_Y + lift, ctx.cz);
      obj.rotation.y += yaw;
      return obj;
    },
  };
}
const mesh = (m) => () => modelMesh(m());
function heroWithSword() {
  const g = new THREE.Group();
  g.add(modelMesh(heroModel('swordOut')));
  const s = makeSwordMesh();
  s.position.set(SWORD_GRIP.x, PIVOT_Y, SWORD_GRIP.z);
  g.add(s);
  return g;
}
function brazierWithFlame() {
  const g = new THREE.Group();
  g.add(modelMesh(brazierModel()));
  const f = modelMesh(flameModel(0));
  f.position.y = FLAME_Y / 16;
  g.add(f);
  return g;
}
function doorPair() {
  const g = new THREE.Group();
  const l = modelMesh(doorModel(false));
  const r = modelMesh(doorModel(true));
  l.position.set(-0.5, 0, 0.5);
  r.position.set(0.5, 0, 0.5);
  g.add(l, r);
  return g;
}
const LINEUP_TILES = {
  V: show(mesh(CHARACTER_MODELS.golem)),
  U: show(() => stoneBrute()),
  S: show(mesh(CHARACTER_MODELS.sentry)),
  E: show(mesh(CHARACTER_MODELS.elder)),
  A: show(mesh(() => heroModel('stand'))),
  H: show(mesh(() => heroModel('walk1'))),
  J: show(mesh(() => heroModel('walk2'))),
  K: show(mesh(() => heroModel('cheer'))),
  L: show(heroWithSword, { yaw: Math.PI / 5 }),
  M: show(mesh(() => heroModel('windUp'))),
  3: show(mesh(statueModel)),
  a: show(mesh(() => slimeModel(0, 'red'))),
  h: show(mesh(() => slimeModel(1, 'red'))),
  b: show(mesh(() => slimeModel(0, 'blue'))),
  c: show(mesh(() => slimeModel(0, 'green'))),
  j: show(mesh(() => slimeModel(1, 'green'))),
  k: show(mesh(() => spitterModel(0))),
  l: show(mesh(() => spitterModel(1))),
  N: show(mesh(CHARACTER_MODELS.thornbug)),
  O: show(mesh(CHARACTER_MODELS.skeleton)),
  P: show(mesh(CHARACTER_MODELS.bat0), { lift: 0.5 }),
  Q: show(mesh(CHARACTER_MODELS.bat1), { lift: 0.5 }),
  n: show(mesh(heartModel), { lift: 0.12 }),
  q: show(mesh(() => gemModel(1)), { lift: 0.12 }),
  r: show(mesh(() => gemModel(5)), { lift: 0.12 }),
  x: show(mesh(keyModel), { lift: 0.12 }),
  y: show(mesh(coinModel), { lift: 0.12 }),
  m: show(mesh(pebbleModel), { lift: 0.35 }),
  z: show(mesh(CHARACTER_MODELS.leaderGem), { lift: 0.62 }),
  '!': show(mesh(CHARACTER_MODELS.alertMark), { lift: 1.15 }),
  5: show(mesh(spikeBallModel)),
  6: show(mesh(pushBlockModel)),
  7: show(brazierWithFlame),
  0: show(mesh(chestBaseModel)),
  $: show(mesh(() => ICONS.heart(1)), { lift: 0.2 }),
  '%': show(mesh(() => ICONS.heart(0.5)), { lift: 0.2 }),
  '&': show(mesh(() => ICONS.heart(0)), { lift: 0.2 }),
  '(': show(mesh(() => ICONS.vial(0.6)), { lift: 0.2 }),
  ')': show(mesh(ICONS.coin), { lift: 0.2 }),
  '[': show(mesh(ICONS.key), { lift: 0.2 }),
};
const DOORS = show(doorPair);

const room = (rows) => ({
  id: 'kitroom',
  name: 'Kit Room',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'dungeon',
  screen: [16, rows.length],
  rooms: true,
  origin: [496, 0],
  start: [0, 0],
  keyGroup: 'kitroom',
  warps: { X: { area: 'kitfield', screen: [0, 0], x: 8, z: 9.5, yaw: Math.PI } },
  screens: { '0,0': { name: 'Kit Room', chest: { grant: 'gems', amount: 5 }, rows } },
});

if (enabled) {
  defineTileset('kitshow', { parent: 'overworld', floor: '.' });
  for (const [ch, def] of Object.entries(LINEUP_TILES)) registerTile('kitshow', ch, def);
  registerTile('kitshow', '9', DOORS);
  registerArea({
    id: 'kitlineup',
    name: 'Kit Lineup',
    tileset: 'kitshow',
    lighting: 'day',
    origin: [488, 0],
    start: [0, 0],
    screens: { '0,0': { name: 'Kit Lineup', rows: LINEUP } },
  });
  try {
    registerArea(room(ROOM));
  } catch {
    registerArea(room(ROOM.filter((_, i) => i !== 4)));
  }
  registerArea({
    id: 'kitfield',
    name: 'Kit Field',
    tileset: 'overworld',
    lighting: 'day',
    origin: [492, 0],
    start: [0, 0],
    spawns: { e: 'slime', o: 'spitter' },
    warps: { D: { area: 'kitroom', screen: [0, 0], x: 7.5, z: 8.5, yaw: Math.PI } },
    screens: { '0,0': { name: 'Kit Field', chest: { grant: 'gems', amount: 5 }, rows: FIELD } },
  });
}

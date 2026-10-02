import * as THREE from 'three';
import { defineTileset, registerTile } from '../tiles.js';
import { fineFloor } from './dungeon.js';
import { modelMesh } from '../../models/kit.js';
import { clockAnchorModel, cityClockModel, cityClockHand } from '../../models/tower-clock.js';
import { CLOCK_ANCHORS, clockAnchorFlag } from '../../systems/tower-clock.js';
import { hasFlag, setFlag } from '../../core/state.js';
import { GROUND_Y } from '../../core/constants.js';
import { showDialog } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { sparks } from '../../systems/particles.js';
import { sfx } from '../../core/audio.js';
import { entities } from '../../entities/manager.js';

defineTileset('tower-clock', { parent: 'dungeon', floor: '.' });
for (const [char, name] of [['.', 'clock-slate'], ['o', 'borrowed-hour-rosette'], ['u', 'winding-channel'], ['p', 'lost-minute-mosaic']]) registerTile('tower-clock', char, {
  name, pushableFloor: true, build(ctx) {
    fineFloor(ctx); const { F, FX0: x, FZ0: z } = ctx;
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      if (char === '.' && (a === 0 || b === 0)) F.set(x + a, 1, z + b, 0x494357);
      if (char === 'o' && Math.abs(Math.hypot(a - 7.5, b - 7.5) - 5) < .8) F.set(x + a, 1, z + b, 0xc9a47c);
      if (char === 'u' && (a === 4 || a === 11 || a > 4 && a < 11 && b % 5 === 1)) F.set(x + a, 1, z + b, a === 4 || a === 11 ? 0xc9a47c : 0x80b7b7);
      if (char === 'p' && ((Math.floor(a / 4) + Math.floor(b / 4)) % 2 === 0)) F.set(x + a, 1, z + b, 0x796580);
    }
  },
});
function readAnchor(id) {
  if (id === 'return') showDialog(['The barrow kept the hour of return. Every borrowed light was meant to find its way home.', 'Throw a returning blade into this winding. When it comes back, one hand of the clock will move.'], { speaker: 'Sage Iona' });
  if (id === 'break') showDialog(['The nursery kept the hour of change. A city that cannot break its old promises cannot grow.', 'The eastern winding is sealed in brass. Place a bomb beside it, then stand clear. Powder waits south of the clock.'], { speaker: 'Sage Iona' });
  if (id === 'draw') showDialog(['The watch kept the hour of reaching. Its last train left before the shore children could board.', 'Hook this winding with the grapple. Draw the lost hour back toward someone still here.'], { speaker: 'Sage Iona' });
  if (id === 'kindle') showDialog(['The shore kept the hour of welcome. Its lamp was meant for the person who arrived after everyone else.', 'Send a flame into this winding. When all four hands are free, the first reflection will fade.'], { speaker: 'Sage Iona' });
  return true;
}
for (const anchor of CLOCK_ANCHORS) {
  const flag = clockAnchorFlag(anchor.id);
  const tune = ctx => {
    if (hasFlag(flag) || hasFlag('tower:trial')) return true;
    setFlag(flag); sparks(ctx.tx + .5, GROUND_Y + .8, ctx.tz + .5, [anchor.colour, 0xe1f5d2], 18); sfx.gem();
    // One released hour scatters the current volley and creates a short beat
    // to reach the next winding. Hero tools and reflected shots remain alive.
    for (const e of [...entities]) if (e.kind === 'projectile' && e.owner !== 'hero') e.remove();
    const keeper = entities.find(e => !e.removed && e.type === 'boss-bishop' && e.trial);
    if (keeper) { keeper.vanish(); keeper.harmless = true; keeper.present(); }
    toast(`${anchor.name} anchor: one borrowed hour released.`, 2.2); return true;
  };
  registerTile('tower-clock', anchor.char, { name: `clock-anchor-${anchor.id}`, solid: true, blocksShots: true, grapple: true,
    prompt: `Read ${anchor.name} anchor`, build: fineFloor,
    prop(ctx) {
      const group = new THREE.Group(), off = modelMesh(clockAnchorModel(anchor.id, anchor.colour)), on = modelMesh(clockAnchorModel(anchor.id, anchor.colour, true));
      group.add(off, on); group.position.set(ctx.cx, GROUND_Y, ctx.cz);
      group.userData.tick = () => { on.visible = hasFlag(flag) || hasFlag('tower:trial'); off.visible = !on.visible; }; group.userData.tick(); return group;
    },
    onInteract: () => readAnchor(anchor.id),
    onSword() { if (!hasFlag(flag) && !hasFlag('tower:trial')) toast(anchor.hud, 2); return false; },
    onShot(ctx) { return (ctx.projectile?.source ?? ctx.hit?.source) === anchor.source ? tune(ctx) : false; },
    onBomb: anchor.source === 'bomb' ? tune : undefined,
  });
}
registerTile('tower-clock', 'C', { name: 'fourfold-city-clock', prompt: 'Read city clock', build: fineFloor,
  prop(ctx) {
    const group = new THREE.Group(); group.position.set(ctx.cx, GROUND_Y, ctx.cz); group.add(modelMesh(cityClockModel()));
    const hands = CLOCK_ANCHORS.map((a, i) => {
      const pivot = new THREE.Group(), hand = modelMesh(cityClockHand(a.colour));
      hand.position.set(0, .26 + i * .025, -.55); pivot.add(hand); group.add(pivot); return pivot;
    });
    group.userData.tick = time => hands.forEach((hand, i) => { hand.rotation.y = i * Math.PI / 2 + (hasFlag(clockAnchorFlag(CLOCK_ANCHORS[i].id)) || hasFlag('tower:trial') ? (time ?? 0) * .35 : 0); });
    group.userData.tick(0); return group;
  },
  onInteract() {
    showDialog(['Before it was a tower, this was our city clock. The barrow, nursery, watch and shore each lent it one hour.', 'The keeper bound those hours to four windings. Free them with the tools their temples taught you. You may work in any order, or leave one winding to a friend.'], { speaker: 'Sage Iona' }); return true;
  },
});

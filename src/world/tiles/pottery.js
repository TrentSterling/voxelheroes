// An optional physical puzzle: a thrown clay pot rings the seal and reveals a heart-piece chest.
import { registerTile } from '../tiles.js';
import { fineFloor } from './dungeon.js';
import { DenseGrid } from '../../core/vox.js';
import { model, modelMesh } from '../../models/kit.js';
import { GROUND_Y } from '../../core/constants.js';
import { state, hasFlag, setFlag } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { sfx, tone } from '../../core/audio.js';
import { sparks } from '../../systems/particles.js';
import { showDialog } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';

const flagOf = (screen) => `pot-seal:${screen.key}`;
const gongModel = () => model('pot-gong', () => {
  const g = new DenseGrid(16, 22, 8);
  g.box(1, 0, 1, 15, 2, 7, 0x675a42);
  g.box(2, 2, 2, 4, 21, 5, 0x85653e);
  g.box(12, 2, 2, 14, 21, 5, 0x85653e);
  g.box(2, 20, 2, 14, 22, 5, 0xb88b44);
  for (let y = 5; y < 19; y++) for (let x = 2; x < 14; x++) {
    const r = Math.hypot(x - 7.5, y - 11.5);
    if (r > 6) continue;
    g.box(x, y, 3, x + 1, y + 1, 5, r > 5 ? 0x9a6726 : r < 2 ? 0xf4d474 : 0xc99636);
  }
  return g;
});

registerTile('dungeon', 'j', {
  name: 'bronze-seal', prompt: 'Read seal', solid: true,
  build: fineFloor,
  prop(ctx) {
    const obj = modelMesh(gongModel());
    obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
    obj.userData.tick = (t) => {
      const age = t - (obj.userData.rangAt ?? -10);
      obj.rotation.z = Math.sin(age * 25) * Math.max(0, 1 - age) * 0.08;
    };
    return obj;
  },
  onInteract(ctx) {
    showDialog(hasFlag(flagOf(ctx.screen)) ? 'The bronze seal hums softly. Its treasure is yours.' : 'Clay rings where steel falls silent. Lift a pot, face the bronze seal, then throw.', { speaker: 'Bronze seal' });
    return true;
  },
  onShot(ctx) {
    if (ctx.projectile?.source !== 'pot') { sfx.block(); return false; }
    const flag = flagOf(ctx.screen);
    tone(220, 0.8, { type: 'sine', vol: 0.15 });
    tone(660, 0.5, { type: 'sine', vol: 0.08 });
    const prop = ctx.world.propAt(ctx.tx, ctx.tz);
    if (prop) prop.userData.rangAt = state.time;
    if (hasFlag(flag)) return true;
    const reward = ctx.screen.def.potSeal;
    if (!reward) return false;
    setFlag(flag);
    ctx.world.setTile(ctx.screen.x0 + reward[0], ctx.screen.z0 + reward[1], 'c', { persist: true, rebuild: false, reason: 'pot-seal' });
    sparks(ctx.tx + 0.5, GROUND_Y + 0.8, ctx.tz + 0.5, [0xf1c232, 0xffffff], 24, { speed: 2.5, up: 4, life: 0.8 });
    sfx.fanfare();
    toast('The bronze seal reveals a hidden chest');
    emit('secret-found', { kind: 'pot-seal', tx: ctx.tx, tz: ctx.tz });
    return true;
  },
});

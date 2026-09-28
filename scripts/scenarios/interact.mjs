// Nothing the player can see is dead. (1) An audit of every tile placed in every area: a tile with a
// prop (a separate model: pot, bush, chest, sign, statue...) must answer at least one verb (sword,
// bomb, push, talk/check, step, shot, fire), be marked decor, or be driven by room logic. (2) Pots, by hand: the sword breaks
// one (the tile clears, a drop may fall), a bomb breaks one, and they are back on the next visit.
export const description = 'Interactables: every placed prop answers a verb (audit of all areas); pots break to the sword and to bombs and come back.';

const VERBS = ['onSword', 'onBomb', 'onPush', 'onInteract', 'onEnter', 'onShot', 'onFire', 'onLift'];
// Things the spec makes interactive even when they are built into the terrain (no separate prop).
const SPEC_INTERACTIVE = ['sign', 'statue', 'pit', 'pot', 'bush', 'chest', 'push-block', 'locked-door', 'tablet', 'switch', 'crystal', 'cracked-wall', 'stairs'];

export default async function (t) {
  await t.press('Enter');
  await t.step(1.1);

  const audit = await t.eval(([VERBS, SPEC]) => {
    const h = window.__voxelHeroes;
    const dead = new Map();
    const seen = new Set();
    for (const s of h.world.screens.values()) {
      for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) {
        const ch = s.tiles[z][x];
        const key = `${s.tileset}:${ch}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const def = h.world.tileDef(s, ch);
        if (!def || (!def.prop && !SPEC.some((n) => def.name?.startsWith(n))) || def.decor || def.driven) continue;
        if (!VERBS.some((v) => typeof def[v] === 'function') && !def.hazard) dead.set(key, `${def.name ?? '?'} (${s.area.id} ${s.key})`);
      }
    }
    return { kinds: seen.size, dead: [...dead.entries()].map(([k, v]) => `${k} ${v}`) };
  }, [VERBS, SPEC_INTERACTIVE]);
  t.note(`${audit.kinds} placed tile kinds checked`);
  t.expect(audit.dead.length === 0, `every placed prop answers a verb (dead: ${audit.dead.join('; ') || 'none'})`);

  // pots by hand: find one on a screen
  const at = await t.eval(() => {
    const h = window.__voxelHeroes;
    for (const s of h.world.screens.values()) {
      if (s.area.rooms) continue;
      for (let z = 1; z < s.h - 1; z++) for (let x = 1; x < s.w - 1; x++) {
        if (s.tiles[z][x] !== 'v') continue;
        // an open tile south of it to stand on, facing north
        if (!h.world.isSolid(s.x0 + x, s.z0 + z + 1)) return { key: s.key, x, z };
      }
    }
    return null;
  });
  t.expect(!!at, `a pot to test (${JSON.stringify(at)})`);
  if (!at) return;
  await t.teleport(at.key, at.x + 0.5, at.z + 1.5, { yaw: Math.PI });
  await t.step(0.2);
  const r = await t.eval(async (at) => {
    const h = window.__voxelHeroes;
    const s = h.screen();
    const tile = () => h.world.tile(s.x0 + at.x, s.z0 + at.z);
    const out = { before: tile() };
    h.game.hero.hero.setFacing('north');
    const pick0 = h.entities.filter((e) => e.kind === 'pickup').length;
    h.input.tap('sword');
    for (let i = 0; i < 30; i++) await h.tick();
    out.afterSword = tile();
    out.drops = h.entities.filter((e) => e.kind === 'pickup').length - pick0;
    // a bomb on the pot (a real explosion event at its centre)
    h.world.setTile(s.x0 + at.x, s.z0 + at.z, 'v', { rebuild: false });
    h.events.emit('explosion', { x: s.x0 + at.x + 0.5, z: s.z0 + at.z + 0.5, radius: 1, damage: 2 });
    await h.tick();
    out.afterBomb = tile();
    // regrow on the next visit
    h.world.regrow(s);
    out.afterRegrow = tile();
    return out;
  }, at);
  t.expect(r.before === 'v' && r.afterSword !== 'v', `the sword breaks a pot (${r.before} -> ${r.afterSword}, ${r.drops} drop)`);
  t.expect(r.afterBomb !== 'v', `a bomb breaks a pot (${r.afterBomb})`);
  t.expect(r.afterRegrow === 'v', 'pots are back on the next visit');
  await t.shot('interact-01-pot');
}

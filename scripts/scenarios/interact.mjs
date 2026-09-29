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
  // New games start unarmed now (the king arms the hero); this scenario swings from the start.
  await t.eval(() => {
    const h = window.__voxelHeroes;
    if (!h.state.swords.owned.includes('blade-start')) h.state.swords.owned.push('blade-start');
    h.state.swords.equipped = 'blade-start';
    h.state.gear.shield = Math.max(1, h.state.gear.shield ?? 0);
  });
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

  // find a tile char on any screen with open floor on one side: -> { key, x, z, from: [dx, dz] }
  const find = (ch, rooms, both = true) =>
    t.eval(([ch, rooms, both]) => {
      const h = window.__voxelHeroes;
      for (const s of h.world.screens.values()) {
        if (!!s.area.rooms !== rooms || /^test-/.test(s.area.id)) continue;
        for (let z = 2; z < s.h - 2; z++) for (let x = 2; x < s.w - 2; x++) {
          if (s.tiles[z][x] !== ch) continue;
          for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const floor = (px, pz) => !h.world.isSolid(s.x0 + px, s.z0 + pz, h.player) && !h.world.tileDefAt(s.x0 + px, s.z0 + pz)?.hazard;
            if (floor(x + dx, z + dz) && (!both || floor(x - dx, z - dz))) return { key: s.key, x, z, from: [dx, dz] };
          }
        }
      }
      return null;
    }, [ch, rooms, both]);

  // a signpost reads
  const sign = await find('i', false);
  t.expect(!!sign, `a signpost to read (${JSON.stringify(sign)})`);
  if (sign) {
    await t.teleport(sign.key, sign.x + sign.from[0] + 0.5, sign.z + sign.from[1] + 0.5);
    const g = await t.eval(async (sign) => {
      const h = window.__voxelHeroes;
      h.player.yaw = Math.atan2(-sign.from[0], -sign.from[1]);
      await h.tick();
      h.input.tap('sword');
      for (let i = 0; i < 10; i++) await h.tick();
      const mode = h.state.mode;
      const text = document.querySelector('#dialog')?.textContent ?? '';
      for (let i = 0; i < 300 && h.state.mode === 'dialog'; i++) {
        if (i % 20 === 0) h.input.tap('confirm');
        await h.tick();
      }
      return { mode, text: text.slice(0, 80) };
    }, sign);
    t.expect(g.mode === 'dialog', `pressing A at a signpost reads it (${g.mode}: ${g.text})`);
  }

  // a statue pushes a tile and is back on the next visit
  const st = await find('S', true);
  t.expect(!!st, `a statue to push (${JSON.stringify(st)})`);
  if (st) {
    await t.teleport(st.key, st.x + st.from[0] + 0.5, st.z + st.from[1] + 0.5);
    const p = await t.eval(async (st) => {
      const h = window.__voxelHeroes;
      const s = h.screen();
      for (const e of h.entities) if (e.kind === 'enemy') e.remove();
      const at = (x, z) => h.world.tile(s.x0 + x, s.z0 + z);
      for (let i = 0; i < 50; i++) {
        h.input.setStick(-st.from[0], -st.from[1]);
        await h.tick();
      }
      h.input.setStick(0, 0);
      const moved = at(st.x, st.z) !== 'S' && at(st.x - st.from[0], st.z - st.from[1]) === 'S';
      h.world.regrow(s);
      const back = at(st.x, st.z) === 'S' && at(st.x - st.from[0], st.z - st.from[1]) !== 'S';
      return { moved, back };
    }, st);
    t.expect(p.moved, 'leaning on a statue slides it a tile');
    t.expect(p.back, 'and it is back in place on the next visit');
  }

  // a pit drops the hero back to the room's door for a heart
  const pit = await find('O', true, false);
  t.expect(!!pit, `a pit to fall in (${JSON.stringify(pit)})`);
  if (pit) {
    await t.teleport(pit.key, pit.x + pit.from[0] + 0.5, pit.z + pit.from[1] + 0.5);
    const f = await t.eval(async (pit) => {
      const h = window.__voxelHeroes;
      for (const e of h.entities) if (e.kind === 'enemy') e.remove();
      h.setHp(h.state.maxHp);
      const hp0 = h.state.hp;
      let fell = false;
      for (let i = 0; i < 90 && !fell; i++) {
        h.input.setStick(-pit.from[0], -pit.from[1]);
        await h.tick();
        fell = h.state.hp < hp0;
      }
      h.input.setStick(0, 0);
      const s = h.screen();
      const onPit = h.world.tile(Math.floor(h.player.x), Math.floor(h.player.z)) === 'O';
      return { lost: hp0 - h.state.hp, onPit, mode: h.state.mode };
    }, pit);
    t.expect(f.lost === 2 && !f.onPit, `walking into a pit costs a heart and puts him back at the door (${JSON.stringify(f)})`);
  }
}

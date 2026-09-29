// Secrets and density (fun audit items 1-6, wave 3's secrets lane): every overworld combat screen
// earns a find, a cracked rock or wall gives way to a bomb (and a stair-bush to the sword) into a
// real warp, D1 carries at least 8 pots and a hidden vault, heart pieces reach the fun audit's
// floor of 8 (three before this lane), and the sage's long-dead reveal spell is finally registered.
export const description = 'Fun audit: every combat screen has a find, secrets open to a bomb or the sword, heart pieces >= 8, D1 pots >= 8, the vault grants blade-warden.';

export default async function (t) {
  await t.press('Enter');
  await t.step(1.1);

  // ---------------------------------------------------------------- 1) density: every overworld
  // combat screen (a real 'G' group, not just the marker) has a find: a secret, pots, a chest, or
  // the guardian set piece. Mirrors scripts/fun/density.mjs's own count, against the live world.
  const density = await t.eval(() => {
    const h = window.__voxelHeroes;
    const FIND = new Set(['k', 'K', 'v', 'C', 'c', 'D']); // D: the pre-existing cave-mouth warp
    const hasFind = (s) => {
      if (s.def.chest || Object.keys(s.def.chests ?? {}).length) return true;
      if (Object.values(s.def.spawnsAt ?? {}).some((m) => (typeof m === 'string' ? m : m.type) === 'guardian')) return true;
      return s.tiles.some((row) => row.some((ch) => FIND.has(ch)));
    };
    const bare = [];
    let combat = 0;
    for (const s of h.world.screens.values()) {
      if (!['ow-4-3', 'ow-3-2'].includes(s.area.id)) continue;
      if (!s.spawns.some((sp) => sp.type === 'group')) continue;
      combat++;
      if (!hasFind(s)) bare.push(`${s.area.id} ${s.key} (${s.name})`);
    }
    return { combat, bare };
  });
  t.note(`${density.combat} overworld combat screens checked`);
  t.expect(density.bare.length === 0, `every combat screen has a find (bare: ${density.bare.join('; ') || 'none'})`);

  // ---------------------------------------------------------------- 2) heart pieces >= 8
  const hearts = await t.eval(() => {
    const h = window.__voxelHeroes;
    let n = 0;
    for (const s of h.world.screens.values()) {
      if (s.def.chest === 'heart-piece') n++;
      n += Object.values(s.def.chests ?? {}).filter((c) => c === 'heart-piece').length;
    }
    return n;
  });
  t.note(`${hearts} heart pieces placed (was 3 before this lane)`);
  t.expect(hearts >= 8, `at least 8 heart pieces (found ${hearts})`);

  // ---------------------------------------------------------------- 3) D1 pots >= 8
  const d1Pots = await t.eval(() => {
    const h = window.__voxelHeroes;
    let n = 0;
    for (const s of h.world.screens.values()) if (s.area.id === 'd1') n += s.tiles.flat().filter((ch) => ch === 'v').length;
    return n;
  });
  t.note(`${d1Pots} pots through D1's rooms`);
  t.expect(d1Pots >= 8, `D1 has at least 8 pots (found ${d1Pots})`);

  // Find the first tile `ch` in area `areaId`: { key, screen: [lx, ly], x, z } local coordinates.
  const findChar = (ch, areaId) =>
    t.eval(
      ([ch, areaId]) => {
        const h = window.__voxelHeroes;
        for (const s of h.world.screens.values()) {
          if (s.area.id !== areaId) continue;
          for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) if (s.tiles[z][x] === ch) return { key: s.key, x, z };
        }
        return null;
      },
      [ch, areaId]
    );

  // ---------------------------------------------------------------- 4) a cracked rock (overworld)
  // gives way to a bomb: an 'explosion' event covers it (the same one items/bombs fires), same as
  // scripts/scenarios/interact.mjs already does for the pot.
  const rock = await findChar('k', 'ow-4-3');
  t.expect(!!rock, `a cracked rock to bomb (${JSON.stringify(rock)})`);
  if (rock) {
    await t.teleport(rock.key, rock.x + 0.5, rock.z + 1.5, { yaw: Math.PI });
    const r = await t.eval(async (rock) => {
      const h = window.__voxelHeroes;
      const s = h.screen();
      const before = h.world.tile(s.x0 + rock.x, s.z0 + rock.z);
      h.events.emit('explosion', { x: s.x0 + rock.x + 0.5, z: s.z0 + rock.z + 0.5, radius: 1, damage: 6 });
      await h.tick();
      const after = h.world.tile(s.x0 + rock.x, s.z0 + rock.z);
      const opens = !!h.world.tileDefAt(s.x0 + rock.x, s.z0 + rock.z)?.onEnter;
      return { before, after, opens };
    }, rock);
    t.expect(r.before === 'k' && r.after === 'y' && r.opens, `a bomb clears a cracked rock into a warp (${JSON.stringify(r)})`);
  }

  // ---------------------------------------------------------------- 5) D1's cracked wall, the same
  // way, and the vault it opens onto.
  const wall = await findChar('z', 'd1');
  t.expect(!!wall, `D1's cracked wall to bomb (${JSON.stringify(wall)})`);
  if (wall) {
    await t.teleport(wall.key, wall.x + 1.5, wall.z + 0.5, { yaw: -Math.PI / 2 });
    const r = await t.eval(async (wall) => {
      const h = window.__voxelHeroes;
      const s = h.screen();
      const before = h.world.tile(s.x0 + wall.x, s.z0 + wall.z);
      h.events.emit('explosion', { x: s.x0 + wall.x + 0.5, z: s.z0 + wall.z + 0.5, radius: 1, damage: 6 });
      await h.tick();
      const after = h.world.tile(s.x0 + wall.x, s.z0 + wall.z);
      const opens = !!h.world.tileDefAt(s.x0 + wall.x, s.z0 + wall.z)?.onEnter;
      return { before, after, opens };
    }, wall);
    t.expect(r.before === 'z' && r.after === 'y' && r.opens, `a bomb clears D1's cracked wall into a passage (${JSON.stringify(r)})`);
  }

  // ---------------------------------------------------------------- 6) a stair-bush (overworld):
  // the sword, not a bomb, and it clears to hidden stairs instead of grass.
  const bush = await findChar('K', 'ow-4-3');
  t.expect(!!bush, `a stair-bush to cut (${JSON.stringify(bush)})`);
  if (bush) {
    await t.teleport(bush.key, bush.x + 0.5, bush.z + 1.5, { yaw: Math.PI });
    const r = await t.eval(async (bush) => {
      const h = window.__voxelHeroes;
      const s = h.screen();
      const before = h.world.tile(s.x0 + bush.x, s.z0 + bush.z);
      h.world.trigger(s.x0 + bush.x, s.z0 + bush.z, 'onSword', { player: h.player });
      await h.tick();
      const after = h.world.tile(s.x0 + bush.x, s.z0 + bush.z);
      const opens = !!h.world.tileDefAt(s.x0 + bush.x, s.z0 + bush.z)?.onEnter;
      return { before, after, opens };
    }, bush);
    t.expect(r.before === 'K' && r.after === 'j' && r.opens, `the sword clears a stair-bush into hidden stairs (${JSON.stringify(r)})`);
  }

  // ---------------------------------------------------------------- 7) the blade-warden chest:
  // it exists in the vault either way; it actually grants the sword only once the sword registry
  // has landed (hasGrant checked live, so this lane's report never blocks on another lane's file).
  const vault = await t.eval(() => {
    const h = window.__voxelHeroes;
    const s = h.world.screen('d1-vault:0,0');
    if (!s) return null;
    for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) if (s.tiles[z][x] === 'c' && s.def.chests?.[`${x},${z}`] === 'blade-warden') return { x, z };
    return null;
  });
  t.expect(!!vault, `the vault has a chest set to grant blade-warden (${JSON.stringify(vault)})`);
  const bwReady = await t.eval(() => window.__voxelHeroes.game.grants.hasGrant('blade-warden'));
  t.note(`blade-warden registered by the sword/economy lane: ${bwReady}`);
  if (vault && bwReady) {
    await t.teleport('d1-vault:0,0', vault.x + 0.5, vault.z + 1.5, { yaw: Math.PI });
    const g = await t.eval(async (vault) => {
      const h = window.__voxelHeroes;
      const s = h.screen();
      // Swords track ownership on state.swords.owned, not the generic item list
      // (game/swords.js hasSword); a plain item id would be inventory.owned instead.
      const owns = () => !!h.state.swords?.owned?.includes('blade-warden') || !!h.state.inventory?.owned?.includes('blade-warden');
      const before = owns();
      h.world.trigger(s.x0 + vault.x, s.z0 + vault.z, 'onPush', { player: h.player });
      await h.tick();
      const after = owns();
      return { before, after };
    }, vault);
    t.expect(!g.before && g.after, `opening the vault's chest grants blade-warden (${JSON.stringify(g)})`);
  }

  // ---------------------------------------------------------------- 8) spell-reveal is registered
  // (it never was: the sage's hasGrant check always failed) and its effect actually runs.
  const spellOk = await t.eval(() => window.__voxelHeroes.game.grants.hasGrant('spell-reveal'));
  t.expect(spellOk, 'spell-reveal is registered (the D1 sage finally has something to give)');
  if (spellOk) {
    const cast = await t.eval(() => {
      const h = window.__voxelHeroes;
      h.give('spell-reveal');
      h.state.maxMagic = Math.max(h.state.maxMagic ?? 0, 10);
      h.state.magic = h.state.maxMagic;
      const result = h.game.spells.castSpell('spell-reveal', { force: true });
      return { result, active: h.game.effects.effectActive('reveal') };
    });
    t.expect(cast.result === 'cast' && cast.active, `casting reveal starts the effect (${JSON.stringify(cast)})`);
  }
}

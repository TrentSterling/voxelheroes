// Village life (entities/npc.js, game/npc-talk.js): wanderers stroll and stay near home, people
// at a post stay there, anyone near turns to watch the hero and greets him, a sword swung close
// startles them, and conversations build friendship (hearts in the speaker's name, warmer lines).
export const description = 'NPC life in Mossbrook: wandering near home, posts kept, watching and greeting the hero, startle on a swing, friendship from talking.';

export default async function (t) {
  await t.press('Enter');
  await t.step(1.1);
  await t.teleport('Mossbrook Square', 8, 4.5);
  await t.step(0.2);

  // 20 s with the hero standing still at the square's north end
  const r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const npcs = () => h.entities.filter((e) => e.kind === 'npc');
    const start = Object.fromEntries(npcs().map((n) => [n.name, { x: n.x, z: n.z }]));
    let maxFromHome = {};
    for (let i = 0; i < 20 * 60; i++) {
      await h.tick();
      for (const n of npcs()) maxFromHome[n.name] = Math.max(maxFromHome[n.name] ?? 0, Math.hypot(n.x - n.home.x, n.z - n.home.z));
    }
    const moved = npcs().filter((n) => Math.hypot(n.x - start[n.name].x, n.z - start[n.name].z) > 0.3 || maxFromHome[n.name] > 0.3).map((n) => n.name);
    return { count: npcs().length, moved, maxFromHome, wanderers: npcs().filter((n) => n.wander > 0).map((n) => [n.name, n.wander]) };
  });
  t.expect(r.count >= 9, `Mossbrook Square has its people (${r.count})`);
  t.expect(r.moved.length >= 2, `wanderers stroll about in 20 s (${r.moved.join(', ')})`);
  const strays = r.wanderers.filter(([name, w]) => r.maxFromHome[name] > 0.8 + w + 0.5);
  t.expect(strays.length === 0, `nobody strays past their wander radius (${JSON.stringify(strays)})`);
  t.expect(!['Mags', 'Brannoc', 'Wenna', 'Tinker Wyll'].some((n) => r.moved.includes(n)), 'the shopkeeper, smith, innkeeper and inventor keep their posts');
  await t.shot('npcs-01-square');

  // walk up to Hettie: she watches and greets (a bark or an emote)
  const g = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const n = h.entities.find((e) => e.name === 'Hettie');
    h.player.x = n.x;
    h.player.z = n.z - 2;
    for (let i = 0; i < 30; i++) await h.tick();
    const faces = Math.abs(Math.atan2(Math.sin(n.yaw - Math.atan2(h.player.x - n.x, h.player.z - n.z)), Math.cos(n.yaw - Math.atan2(h.player.x - n.x, h.player.z - n.z)))) < 0.2;
    return { mode: n.mind.mode, faces, greeted: n.mind.greeted, bubble: !!(n.bubble.e || n.bubble.b) };
  });
  t.expect(g.mode === 'watch' && g.faces, `Hettie stops and turns to watch the hero (${g.mode}, faces ${g.faces})`);
  t.expect(g.greeted && g.bubble, 'and greets him with a line or an emote');
  await t.shot('npcs-02-greet');

  // a sword swung near her startles her
  const s = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const n = h.entities.find((e) => e.name === 'Hettie');
    n.bubble.e = n.bubble.b = null;
    h.input.tap('sword');
    await h.tick();
    return !!(n.bubble.e || n.bubble.b);
  });
  t.expect(s, 'a sword swung close startles her');
  await t.step(1);

  // talk three times: the first is her spawn-table lines, then chat; three talks make a heart
  const f = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const n = h.entities.find((e) => e.name === 'Hettie');
    const speakers = [];
    for (let k = 0; k < 3; k++) {
      n.onInteract(h.player);
      for (let i = 0; i < 400 && h.state.mode === 'dialog'; i++) {
        if (i % 20 === 0) h.input.tap('confirm');
        speakers.push(document.querySelector('#dialog, .dialog')?.textContent?.slice(0, 40) ?? '');
        await h.tick();
      }
      for (let i = 0; i < 20; i++) await h.tick();
    }
    return { friend: h.state.friends?.Hettie ?? null, mode: h.state.mode };
  });
  t.expect(f.friend && f.friend.talks === 3 && f.friend.pts >= 3, `three conversations build friendship (${JSON.stringify(f.friend)})`);
  t.expect(f.mode === 'play', 'every conversation closes back to play');

  // ---------------------------------------------------------------- the day (game/clock.js)
  // talk through a dialog, answering every question with its first choice
  const talkTo = `async (h, n) => {
    n.onInteract(h.player);
    for (let i = 0; i < 900 && h.state.mode === 'dialog'; i++) {
      if (i % 20 === 0) h.input.tap('confirm');
      await h.tick();
    }
    for (let i = 0; i < 10; i++) await h.tick();
  }`;
  const d = await t.eval(async (talkSrc) => {
    const h = window.__voxelHeroes;
    const talk = new Function(`return (${talkSrc})`)();
    const people = () => h.entities.filter((e) => e.kind === 'npc');
    const town = () => people().filter((n) => n.schedule === 'town');
    const posts = () => people().filter((n) => n.schedule === 'post');
    const run = async (s) => { for (let i = 0; i < s * 60; i++) await h.tick(); };
    h.player.x = h.screen().x0 + 8;
    h.player.z = h.screen().z0 + 4.5;
    const s = h.screen();
    const cx = s.x0 + s.w / 2, cz = s.z0 + s.h / 2 + 1;
    const spread = () => town().reduce((a, n) => a + Math.hypot(n.x - cx, n.z - cz), 0) / town().length;
    const out = { clockStart: h.state.clock.min };
    // evening: townsfolk drift toward the middle of the square
    const dayMean = spread();
    h.state.clock.min = 17.2 * 60;
    await run(14);
    out.gather = [+dayMean.toFixed(2), +spread().toFixed(2)];
    // 20:30: shops shut; 21:40: everyone in town goes home through a door
    h.state.clock.min = 20.5 * 60;
    await run(10);
    out.shopsShut = posts().every((n) => !n.out);
    out.posts = posts().map((n) => `${n.name}:${n.out}:${n.mind.mode}:${n.x.toFixed(1)},${n.z.toFixed(1)}:${JSON.stringify(n.door())}`);
    h.state.clock.min = 21.7 * 60;
    await run(14);
    out.townIn = town().every((n) => !n.out);
    out.alwaysOut = people().filter((n) => n.schedule === 'always').every((n) => n.out);
    // 7:30 the next morning: back out
    h.state.clock.day += 1;
    h.state.clock.min = 7.5 * 60;
    await run(2);
    out.townBack = town().every((n) => n.out);
    h.state.clock.min = 9 * 60;
    await run(1);
    out.shopsBack = posts().every((n) => n.out);
    // a gift: a wildflower for Hettie (once a day)
    const hettie = people().find((n) => n.name === 'Hettie');
    h.state.forage.wildflower = 1;
    const before = { ...h.state.friends.Hettie };
    h.player.x = hettie.x;
    h.player.z = hettie.z - 1.2;
    await talk(h, hettie);
    out.gift = { before, after: { ...h.state.friends.Hettie }, flowersLeft: h.state.forage.wildflower, day: h.state.clock.day };
    // a heart event at 2 hearts: a scene and 20 coins
    h.state.friends.Hettie.pts = Math.max(h.state.friends.Hettie.pts, 6);
    const coins0 = h.state.coins;
    await talk(h, hettie);
    out.event = { coins: h.state.coins - coins0, events: h.state.friends.Hettie.events };
    return out;
  }, talkTo);
  t.expect(d.gather[1] < d.gather[0] - 0.5, `in the evening the townsfolk gather toward the square's middle (mean distance ${d.gather[0]} -> ${d.gather[1]})`);
  t.expect(d.shopsShut, `at 20:30 the shopkeeper, smith, innkeeper and inventor have closed up and gone in (${d.posts.join(' | ')})`);
  t.expect(d.townIn && d.alwaysOut, 'by 21:40 the townsfolk have walked home; the guards stay on watch');
  t.expect(d.townBack && d.shopsBack, 'the next morning everyone is back out');
  // the talk alone is +1; the gift adds her taste on top (+3 love, +2 like, +1 neutral, -1 dislike)
  t.expect(d.gift.after.giftDay === d.gift.day && d.gift.flowersLeft === 0 && d.gift.after.pts - d.gift.before.pts !== 1, `a wildflower gift is taken and changes her friendship (${JSON.stringify(d.gift.before)} -> ${JSON.stringify(d.gift.after)})`);
  t.expect(d.event.coins === 20 && d.event.events.includes(2), `at 2 hearts her next conversation is a heart event with a present (${JSON.stringify(d.event)})`);
  await t.shot('npcs-03-morning');

  // foraging: a cut through a flower tile picks a wildflower, once per tile per day
  await t.teleport('Crossroads', 8, 5.5);
  const w = await t.eval(async () => {
    const h = window.__voxelHeroes;
    await h.tick();
    const s = h.screen();
    let at = null;
    for (let z = 0; z < s.h && !at; z++) for (let x = 0; x < s.w && !at; x++) if (s.tiles[z][x] === ',') at = [s.x0 + x, s.z0 + z];
    if (!at) return { none: true };
    const n0 = h.state.forage.wildflower;
    h.world.trigger(at[0], at[1], 'onSword', { player: h.player, hit: { source: 'sword' } });
    h.world.trigger(at[0], at[1], 'onSword', { player: h.player, hit: { source: 'sword' } });
    return { gained: h.state.forage.wildflower - n0 };
  });
  t.expect(w.none || w.gained === 1, `cutting a flower tile picks one wildflower, not two from the same tile (${JSON.stringify(w)})`);

  // a night at the inn starts the next morning
  const inn = await t.eval(async () => {
    const h = window.__voxelHeroes;
    h.state.clock.min = 21 * 60;
    const day0 = h.state.clock.day;
    h.game.vitals.addCoins(50);
    const r = h.game.services.innRest('inn-1');
    await h.tick();
    return { ok: r.ok, reason: r.reason, day: h.state.clock.day - day0, min: h.state.clock.min };
  });
  t.expect(inn.ok && inn.day === 1 && Math.floor(inn.min) === 6 * 60, `resting at the inn starts the next day at 6:00 (${JSON.stringify(inn)})`);
}

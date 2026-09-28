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
}

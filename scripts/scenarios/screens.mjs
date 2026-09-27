// A gallery: one screenshot of every screen of every area, then the
// Crossroads under each camera preset (the player's choices A-D through
// camera.choose, area presets such as 'dungeon' through camera.set). Handy
// when editing maps, tiles, lighting or the camera.
export const description = 'Screenshot of every screen in every area, then the Crossroads under each camera preset.';

// The walkable tile nearest the middle of the current screen.
const middleSpot = (t) =>
  t.eval(() => {
    let best = null;
    for (let z = 0; z < 11; z++)
      for (let x = 0; x < 16; x++) {
        if (!window.__vhBot.walkable(x, z, false)) continue;
        const d = Math.hypot(x + 0.5 - 8, z + 0.5 - 5.5);
        if (!best || d < best.d) best = { x: x + 0.5, z: z + 0.5, d };
      }
    return best;
  });

export default async function screens(t) {
  await t.press('Enter');
  const list = await t.eval(() =>
    [...window.__voxelHeroes.world.screens.values()].map((s) => ({ area: s.area.id, lx: s.lx, ly: s.ly, name: s.name }))
  );
  t.expect(list.length > 0, `${list.length} screens in ${new Set(list.map((s) => s.area)).size} areas`);

  for (const s of list) {
    const target = `${s.area}:${s.lx},${s.ly}`;
    await t.teleport(target);
    const spot = await middleSpot(t);
    if (spot) await t.teleport(target, spot.x, spot.z, { yaw: 0 });
    await t.step(0.8);
    const st = await t.state();
    t.expect(st.screenName === s.name && st.mode === 'play', `${s.name} (${target})`);
    await t.shot(`${s.area}-${s.lx}-${s.ly}`);
  }

  const presets = await t.eval(() => {
    const cam = window.__voxelHeroes.camera;
    const mine = cam.playerPresets();
    return Object.keys(cam.presets).map((name) => ({ name, choice: mine.includes(name) }));
  });
  await t.teleport('overworld:1,1');
  for (const { name, choice } of presets) {
    await t.eval(([n, c]) => (c ? window.__voxelHeroes.camera.choose(n) : window.__voxelHeroes.camera.set(n)), [name, choice]);
    await t.step(0.1);
    t.expect((await t.eval(() => window.__voxelHeroes.camera.get())) === name, `camera preset ${name}${choice ? '' : ' (area preset)'}`);
    await t.shot(`camera-${name}`);
  }
  await t.eval(() => window.__voxelHeroes.camera.choose('A'));
}

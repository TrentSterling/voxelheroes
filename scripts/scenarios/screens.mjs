// A gallery: one screenshot of every screen and room of every area, then the
// Crossroads under each camera preset. Handy when editing maps, tiles,
// lighting or the camera. It also checks that screens of different areas meet
// cleanly (no edge tile open on one side and a wall on the other) and that
// the dungeon camera sits on the centre of every room.
export const description = 'Screenshot of every screen and room in every area (sizes, edges, room cameras), then the Crossroads under each camera preset.';

const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

// The walkable tile nearest the middle of the current screen, whatever its size.
const middleSpot = (t) =>
  t.eval(() => {
    const { w, h } = window.__voxelHeroes.screen();
    let best = null;
    for (let z = 0; z < h; z++)
      for (let x = 0; x < w; x++) {
        if (!window.__vhBot.walkable(x, z, false)) continue;
        const d = Math.hypot(x + 0.5 - w / 2, z + 0.5 - h / 2);
        if (!best || d < best.d) best = { x: x + 0.5, z: z + 0.5, d };
      }
    return best;
  });

export default async function screens(t) {
  await t.press('Enter');
  const list = await t.eval(() =>
    [...window.__voxelHeroes.world.screens.values()].map((s) => ({
      key: s.key,
      area: s.area.id,
      rooms: !!s.area.rooms,
      lx: s.lx,
      ly: s.ly,
      w: s.w,
      h: s.h,
      name: s.name,
    }))
  );
  t.expect(list.length > 0, `${list.length} screens in ${new Set(list.map((s) => s.area)).size} areas`);

  const report = await t.eval(() => window.__voxelHeroes.links());
  const bad = report.mismatches.map((m) => `${m.name} ${m.dir} edge at ${m.x},${m.z} faces a wall in ${m.facing}`);
  t.expect(bad.length === 0, bad.length ? `edges that do not match:\n  ${bad.join('\n  ')}` : 'every open edge tile meets open ground on the other side');
  t.note(`${report.links.length} places where screens of different areas touch`);

  for (const s of list) {
    await t.teleport(s.key);
    const spot = await middleSpot(t);
    if (spot) await t.teleport(s.key, spot.x, spot.z, { yaw: 0 });
    await t.step(0.8);
    const st = await t.state();
    t.expect(st.screenName === s.name && st.mode === 'play' && st.size[0] === s.w && st.size[1] === s.h, `${s.name} (${s.key}, ${s.w} x ${s.h})`);
    if (s.rooms)
      t.expect(
        st.cam.preset === 'dungeon' && near(st.cam.x, s.w / 2) && near(st.cam.z, s.h / 2),
        `  the dungeon camera looks at the middle of ${s.name} (${st.cam.x}, ${st.cam.z})`
      );
    await t.shot(`${s.area}-${s.lx}-${s.ly}`);
  }

  const presets = await t.eval(() => Object.keys(window.__voxelHeroes.camera.presets));
  await t.teleport('overworld:1,1');
  for (const name of presets) {
    await t.eval((n) => window.__voxelHeroes.camera.choose(n), name);
    await t.step(0.1);
    t.expect((await t.eval(() => window.__voxelHeroes.camera.get())) === name, `camera preset ${name}`);
    await t.shot(`camera-${name}`);
  }
  await t.eval(() => window.__voxelHeroes.camera.choose('A'));
}

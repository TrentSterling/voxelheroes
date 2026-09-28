// A gallery: one screenshot of every screen and room of every area, then the
// Crossroads under each camera preset the player can choose (A-D, through
// camera.choose; area presets such as 'dungeon' are shot on their own
// screens). Handy when editing maps, tiles, lighting or the camera. It also
// checks that screens of different areas meet cleanly (no edge tile open on
// one side and a wall on the other) and that a room's fixed camera (dungeon,
// interior, or one an area registers) sits on its centre.
//
// SCREENS=<area id>[,<area id>...] limits the shots to those areas (the edge
// check still covers the whole world), e.g.
//   SCREENS=crypt,test-burrow node scripts/playtest.mjs --scenario screens
export const description = 'Screenshot of every screen and room in every area (sizes, edges, room cameras), then the Crossroads under each camera preset the player can choose. SCREENS=<area ids> limits the shots to those areas.';

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
  const only = process.env.SCREENS?.split(',').map((a) => a.trim()).filter(Boolean);
  const pick = only ? list.filter((s) => only.includes(s.area)) : list;
  if (only) t.expect(pick.length > 0, `SCREENS=${only.join(',')}: ${pick.length} of them`);

  const report = await t.eval(() => window.__voxelHeroes.links());
  const bad = report.mismatches.map((m) => `${m.name} ${m.dir} edge at ${m.x},${m.z} faces a wall in ${m.facing}`);
  t.expect(bad.length === 0, bad.length ? `edges that do not match:\n  ${bad.join('\n  ')}` : 'every open edge tile meets open ground on the other side');
  t.note(`${report.links.length} places where screens of different areas touch`);

  for (const s of pick) {
    await t.teleport(s.key);
    const spot = await middleSpot(t);
    if (spot) await t.teleport(s.key, spot.x, spot.z, { yaw: 0 });
    await t.step(0.8);
    const st = await t.state();
    t.expect(st.screenName === s.name && st.mode === 'play' && st.size[0] === s.w && st.size[1] === s.h, `${s.name} (${s.key}, ${s.w} x ${s.h})`);
    if (s.rooms) {
      // Standard rooms hold the middle; the large-room and interior rigs
      // follow the hero inside the room (art bible 1.8, section 9).
      const fixed = await t.eval((n) => !!window.__voxelHeroes.camera.presets[n]?.fixed, st.cam.preset);
      if (fixed) t.expect(near(st.cam.x, s.w / 2) && near(st.cam.z, s.h / 2), `  the ${st.cam.preset} camera looks at the middle of ${s.name} (${st.cam.x}, ${st.cam.z})`);
      else {
        const inFrame = await t.eval(() => window.__voxelHeroes.camera.heroInFrame().out === 0);
        t.expect(st.cam.x >= 0 && st.cam.x <= s.w && st.cam.z >= 0 && st.cam.z <= s.h && inFrame, `  the ${st.cam.preset} camera follows the hero inside ${s.name} (${st.cam.x}, ${st.cam.z})`);
      }
    }
    await t.shot(`${s.area}-${s.lx}-${s.ly}`);
  }

  if (only && !only.includes('overworld')) return;
  // The presets the player can choose; an area's own presets (camera.set
  // only) are shot on its screens above.
  const presets = await t.eval(() => window.__voxelHeroes.camera.playerPresets());
  await t.teleport('overworld:1,1');
  for (const name of presets) {
    await t.eval((n) => window.__voxelHeroes.camera.choose(n), name);
    await t.step(0.1);
    t.expect((await t.eval(() => window.__voxelHeroes.camera.get())) === name, `camera preset ${name}`);
    await t.shot(`camera-${name}`);
  }
  await t.eval(() => window.__voxelHeroes.camera.choose('A'));
}

// The look (docs/ARCHITECTURE.md, "Look"): the validation frames the art bible is compared against,
// plus checks of the quality levels, lighting presets, depth-of-field focus, polished floor and the
// frame-time watchdog. Frames are 1280x720:
//   crossroads-A, crossroads-B   the hero centred in the Crossroads under camera presets A and B
//   mirror-lake-A                water in preset A
//   crypt-dungeon                a crypt room under the fixed dungeon camera, the other rooms hidden
//   quality-<level>              the Crossroads at every quality level
// It also checks that content draws with the look's materials (kinds, water, glow, lamps) and that
// the options in state.settings apply.
export const description = 'Look: Crossroads A/B, Mirror Lake water, crypt room; quality levels, DOF focus, mirror, options, watchdog.';

const info = (t) => t.eval(() => window.__voxelHeroes.look.info());

// Draw a frame and measure its depth of field the way the art bible does (appendix B): mean squared
// Laplacian of luminance per 28 px band over x 300 to 560, from y 300 down, normalised to the
// sharpest band. Returns the profile, the centroid of the bands at 50% or more, and the screen row
// of the focus point (the ground 0.9 tiles behind the hero's feet).
const dofProfile = (t) =>
  t.eval(() => {
    const h = window.__voxelHeroes;
    const cam = h.look.camera;
    const gl = document.querySelector('canvas').getContext('webgl2');
    h.render();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const L = (x, y) => {
      const i = ((H - 1 - y) * W + x) * 4; // y from the top
      return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    };
    const bands = [];
    for (let y0 = 300; y0 + 28 <= H - 1; y0 += 28) {
      let s = 0;
      let n = 0;
      for (let y = y0; y < y0 + 28; y++)
        for (let x = 300; x < 560; x++) {
          const d = 4 * L(x, y) - L(x, y - 1) - L(x, y + 1) - L(x - 1, y) - L(x + 1, y);
          s += d * d;
          n++;
        }
      bands.push([y0 + 14, s / n]);
    }
    const max = Math.max(...bands.map((b) => b[1]));
    const profile = bands.map(([y, v]) => [y, +(v / max).toFixed(2)]);
    let ws = 0;
    let ys = 0;
    for (const [y, v] of profile) if (v >= 0.5) (ws += v), (ys += v * y);
    const f = new cam.position.constructor(h.player.x, 0.125, h.player.z - 0.9).project(cam);
    return { profile, centroid: Math.round(ys / ws), focusRow: Math.round((1 - (f.y * 0.5 + 0.5)) * H) };
  });

export default async function lookScenario(t) {
  await t.press('Enter');
  await t.step(1.2);

  const levels = await t.eval(() => window.__voxelHeroes.look.levels);
  t.expect(levels.join() === 'high,medium,low,flat', `quality levels: ${levels.join(', ')}`);
  let i = await info(t);
  t.expect(i.quality === 'high' && !i.pinned, `desktop default is high, unpinned (${i.quality})`);
  const presets = await t.eval(() => window.__voxelHeroes.look.presets());
  t.expect(presets.includes('day') && presets.includes('crypt'), `lighting presets: ${presets.join(', ')}`);

  // ---------------------------------------------------------------- Crossroads, camera A
  await t.teleport('overworld:1,1', 8, 5.5, { yaw: 0 });
  await t.eval(() => window.__voxelHeroes.camera.choose('A'));
  await t.step(1.0);
  await t.shot('crossroads-A');
  i = await info(t);
  t.expect(i.lighting === 'day' && i.path === 'post' && i.exposure === 0.88 && i.shadowMap === 4096, `day look, post stack, exposure ${i.exposure}, shadow map ${i.shadowMap}`);
  t.expect(!i.mirror, 'no polished floor in the overworld');
  const focusA = await t.eval(() => {
    const h = window.__voxelHeroes;
    const cam = h.look.camera;
    const v = new cam.position.constructor(h.player.x, 0.125, h.player.z).applyMatrix4(cam.matrixWorldInverse);
    return -v.z + 0.9;
  });
  t.expect(Math.abs(i.focusDistance - focusA) < 0.02, `DOF focus on the hero's feet + 0.9 (${i.focusDistance} vs ${focusA.toFixed(3)})`);

  // depth of field: one sharp band at the focus point, blur in front of it and behind it
  const dof = await dofProfile(t);
  const far = dof.profile.filter(([y]) => y < dof.centroid - 70).map((b) => b[1]);
  const near = dof.profile.filter(([y]) => y > dof.centroid + 70).map((b) => b[1]);
  t.expect(
    Math.abs(dof.centroid - dof.focusRow) < 40 && Math.max(...far, 0) < 0.35 && Math.max(...near, 0) < 0.35,
    `DOF sharp band at y ${dof.centroid} (focus point ${dof.focusRow}); far bands <= ${Math.max(...far, 0)}, near bands <= ${Math.max(...near, 0)}`
  );
  t.note(`sharpness per 28 px band: ${dof.profile.map(([y, v]) => `${y}:${v}`).join(' ')}`);

  // ---------------------------------------------------------------- quality levels
  for (const level of ['medium', 'low', 'flat']) {
    await t.eval((l) => window.__voxelHeroes.look.set(l), level);
    await t.shot(`quality-${level}`);
    i = await info(t);
    const path = level === 'medium' ? 'post' : level === 'low' ? 'direct' : 'flat';
    t.expect(i.quality === level && i.path === path && i.pinned, `quality ${level}: ${i.path}, ${i.passes} passes, ${i.calls} draw calls`);
  }
  await t.eval(() => window.__voxelHeroes.look.set('high'));
  await t.shot('quality-high');
  i = await info(t);
  t.expect(i.quality === 'high' && i.path === 'post', `quality high: ${i.passes} passes, ${i.calls} draw calls`);

  // settings choices apply when they change
  await t.eval(() => {
    window.__voxelHeroes.state.settings.look = 'low';
    window.__voxelHeroes.render();
  });
  i = await info(t);
  t.expect(i.quality === 'low' && i.pinned, `state.settings.look = 'low' applies (${i.quality})`);
  await t.eval(() => {
    window.__voxelHeroes.state.settings.look = 'auto';
    window.__voxelHeroes.render();
  });
  i = await info(t);
  t.expect(i.quality === 'high' && !i.pinned, `state.settings.look = 'auto' goes back to the device default, unpinned (${i.quality})`);
  const opts = await t.eval(() => {
    const h = window.__voxelHeroes;
    Object.assign(h.state.settings, { seams: false, brightness: 1.2, saturation: 0.5 });
    h.render();
    const off = { seams: h.look.materials().seams, exposure: h.look.info().exposure };
    Object.assign(h.state.settings, { seams: true, brightness: 1, saturation: 1 });
    h.render();
    return { off, on: { seams: h.look.materials().seams, exposure: h.look.info().exposure } };
  });
  t.expect(
    opts.off.seams === false && opts.on.seams === true && Math.abs(opts.off.exposure - 0.88 * 1.2) < 1e-6 && opts.on.exposure === 0.88,
    `settings seams and brightness apply (${JSON.stringify(opts)})`
  );
  await t.eval(() => {
    const S = window.__voxelHeroes.state.settings;
    for (const k of ['look', 'seams', 'brightness', 'saturation']) delete S[k];
    window.__voxelHeroes.look.set('high');
  });

  // content draws with the look's material kinds
  const kinds = await t.eval(() => {
    const h = window.__voxelHeroes;
    const s = h.screen();
    const out = {};
    for (const m of s.meshes) if (m.mesh.material) out[m.name] = m.mesh.material.kind ?? m.mesh.material.type;
    let hero = null;
    h.player.object.traverse((o) => {
      if (o.isMesh && !hero && o.material.isVoxelMaterial) hero = o.material.kind;
    });
    return { ...out, hero };
  });
  t.expect(kinds.terrain === 'terrain' && kinds.hero === 'character', `material kinds: ${JSON.stringify(kinds)}`);

  // ---------------------------------------------------------------- Crossroads, camera B
  await t.eval(() => window.__voxelHeroes.camera.choose('B'));
  await t.step(0.5);
  await t.shot('crossroads-B');
  i = await info(t);
  t.expect(i.camera === 'B' && i.dof?.focusRange === 2.5 && i.dof?.focusOffset === 0, `preset B depth of field (band ${i.dof?.focusRange})`);
  await t.eval(() => window.__voxelHeroes.camera.choose('A'));

  // ---------------------------------------------------------------- Mirror Lake water, camera A
  await t.teleport('overworld:2,0', 8, 5.5, { yaw: 0 });
  const lake = await t.eval(() => {
    const h = window.__voxelHeroes;
    const s = h.screen();
    return s.meshes.filter((m) => m.name === 'water').map((m) => !!m.mesh.material.isWaterMaterial);
  });
  t.expect(lake.length > 0 && lake.every(Boolean), `the lake is drawn with the water material (${lake.length} meshes)`);
  await t.step(2.5);
  await t.shot('mirror-lake-A');
  i = await info(t);
  t.expect(i.materials.water.trough === 0.5 && i.materials.water.sheen === 0.35, 'lab water values');

  // ---------------------------------------------------------------- crypt room, dungeon camera
  await t.teleport('crypt:0,1', 8, 5.5, { yaw: 0 });
  await t.step(2.5);
  await t.shot('crypt-dungeon');
  i = await info(t);
  t.expect(i.lighting === 'crypt' && i.camera === 'dungeon' && i.exposure === 1.1, `crypt look under the dungeon camera (exposure ${i.exposure})`);
  t.expect(i.mirror && i.shadowMap === 2048 && i.lamps > 0, `polished floor on, shadow map ${i.shadowMap}, ${i.lamps} lamps lit`);
  const room = await t.eval(() => {
    const h = window.__voxelHeroes;
    const here = h.screen();
    const others = [...h.world.screens.values()].filter((s) => s !== here);
    const drawn = (s) => s.meshes.some((m) => m.mesh.visible);
    const statues = here.meshes.find((m) => m.name === 'stone-props');
    let flames = 0;
    for (const obj of here.props.values()) if (obj.material?.userData?.glow) flames++;
    return {
      here: drawn(here),
      othersDrawn: others.filter((s) => s.area.id === 'crypt' && drawn(s)).map((s) => s.name),
      overworldDrawn: others.filter((s) => s.area.id === 'overworld' && drawn(s)).length,
      statues: statues?.mesh.material.kind ?? null,
      flames,
    };
  });
  t.expect(room.here && room.othersDrawn.length === 0 && room.overworldDrawn === 0, `only the current room is drawn (${JSON.stringify(room)})`);
  t.expect(room.statues === 'prop' && room.flames > 0, `statues in the prop kind, ${room.flames} glowing flames`);

  // ---------------------------------------------------------------- frame-time watchdog
  // The real-time loop at medium quality (unpinned) in software GL: frames take seconds, so the
  // watchdog must drop to low (high -> medium works the same way; a high frame here takes ~12 s).
  await t.teleport('overworld:1,1', 8, 5.5, { yaw: 0 });
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.look.set('medium', { pin: false });
    h.setManual(false);
  });
  // poll (real time) until the watchdog acts, for up to 60 s
  for (let waited = 0; waited < 60000; waited += 5000) {
    await t.page.waitForTimeout(5000);
    i = await info(t);
    if (i.drops.length) break;
  }
  await t.eval(() => window.__voxelHeroes.setManual(true));
  t.note(`watchdog: ${JSON.stringify(i.watchdog)}`);
  t.expect(i.drops.length >= 1 && i.quality === 'low', `watchdog dropped quality: ${i.drops.map((d) => `${d.from}->${d.to} (median ${d.median} ms)`).join(', ') || 'none'}`);
  await t.eval(() => window.__voxelHeroes.look.set('high'));
}

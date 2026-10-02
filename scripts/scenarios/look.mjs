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

// The depth of field against the same frame drawn sharp (state.settings.blur = 0): the mean
// absolute luminance change per 24 px band over x 200 to 1080, and the screen row of the play
// screen's far edge (look.info().focus.rect, its north edge on the ground, in the middle).
const dofBlur = (t) =>
  t.eval(() => {
    const h = window.__voxelHeroes;
    const cam = h.look.camera;
    const gl = document.querySelector('canvas').getContext('webgl2');
    const S = h.state.settings;
    const had = S.blur;
    const grab = (blur) => {
      S.blur = blur;
      h.render();
      const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const sharp = grab(0);
    const soft = grab(1);
    if (had === undefined) delete S.blur;
    else S.blur = had;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const Y = (px, x, y) => {
      const i = ((H - 1 - y) * W + x) * 4;
      return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    };
    const bands = [];
    for (let y0 = 24; y0 + 24 <= H - 24; y0 += 24) {
      let s = 0;
      let n = 0;
      for (let y = y0; y < y0 + 24; y += 2)
        for (let x = 200; x < 1080; x += 2) {
          s += Math.abs(Y(soft, x, y) - Y(sharp, x, y));
          n++;
        }
      bands.push([y0, +(s / n).toFixed(2)]);
    }
    const r = h.look.info().focus.rect;
    const f = new cam.position.constructor((r.x0 + r.x1) / 2, r.y, r.z0).project(cam);
    return { bands, farRow: Math.round((1 - (f.y * 0.5 + 0.5)) * H) };
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
  t.expect(
    Math.abs(i.focus.hero - focusA) < 0.02 && i.focus.near <= focusA - 0.3 && i.focus.far >= focusA + 0.3,
    `DOF focus holds the hero's feet + 0.9 (${i.focus.hero} vs ${focusA.toFixed(3)}) inside its sharp band (${i.focus.near} to ${i.focus.far})`
  );

  // depth of field: the whole play screen sharp (the frame barely changes with the blur on), the
  // tilt-shift blur past its far edge
  const dof = await dofBlur(t);
  const inside = dof.bands.filter(([y]) => y > dof.farRow + 24).map((b) => b[1]);
  const beyond = dof.bands.filter(([y]) => y + 24 < dof.farRow - 24).map((b) => b[1]);
  const mean = (xs) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
  t.expect(
    inside.length > 5 && Math.max(...inside) < 1.5 && beyond.length > 0 && mean(beyond) > 3 * Math.max(0.5, mean(inside)),
    `DOF: play screen sharp below y ${dof.farRow} (change <= ${Math.max(...inside).toFixed(2)}), blurred past it (mean change ${mean(beyond).toFixed(2)})`
  );
  t.note(`blur change per 24 px band: ${dof.bands.map(([y, v]) => `${y}:${v}`).join(' ')}`);
  // the old measure (appendix B), for the record
  const prof = await dofProfile(t);
  t.note(`sharpness per 28 px band: ${prof.profile.map(([y, v]) => `${y}:${v}`).join(' ')}`);

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
  // A disclosed slow-render fixture makes the real-time watchdog check
  // independent of whether this engine uses software GL or the local GPU.
  await t.teleport('overworld:1,1', 8, 5.5, { yaw: 0 });
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.look.set('medium', { pin: false });
    window.__lookOriginalRender = h.gfx.renderer.render;
    h.gfx.renderer.render = function(scene, camera) {
      if (scene === h.gfx.scene) {
        const start = performance.now();
        while (performance.now() - start < 30) { /* actual slow-render fixture */ }
      }
      return window.__lookOriginalRender.call(this, scene, camera);
    };
    h.setManual(false);
  });
  // poll (real time) until the watchdog acts, for up to 60 s
  for (let waited = 0; waited < 60000; waited += 5000) {
    await t.page.waitForTimeout(5000);
    i = await info(t);
    if (i.drops.length) break;
  }
  await t.eval(() => {const h=window.__voxelHeroes;h.setManual(true);h.gfx.renderer.render=window.__lookOriginalRender;delete window.__lookOriginalRender;});
  t.note('Watchdog used a 30 ms delay per native scene draw; production renderer is unchanged.');
  t.note(`watchdog: ${JSON.stringify(i.watchdog)}`);
  t.expect(i.drops.length >= 1 && i.quality === 'low', `watchdog dropped quality: ${i.drops.map((d) => `${d.from}->${d.to} (median ${d.median} ms)`).join(', ') || 'none'}`);
  await t.eval(() => window.__voxelHeroes.look.set('high'));
}

// In-page play-test helpers, injected by scripts/playtest.mjs as
// window.__vhBot. They drive the game only through window.__voxelHeroes
// (virtual stick, button taps, hook.tick), so a whole walk or fight runs
// inside one page.evaluate: fast, and deterministic for a given seed.
//
// All coordinates are local tile coordinates of the current screen
// (0..16 x 0..11). Every helper is async (hook.tick lets promise
// continuations such as dialog follow-ups run between ticks) and resolves to
// { ok, reason?, t, ... }.
(() => {
  const DT = 1 / 60;
  const W = 16;
  const H = 11;
  const hook = () => window.__voxelHeroes;
  const screenKey = () => `${hook().state.sx},${hook().state.sy}`;
  const origin = () => ({ x: hook().state.sx * W, z: hook().state.sy * H });
  const local = (e) => {
    const o = origin();
    return { x: e.x - o.x, z: e.z - o.z };
  };
  const angleDiff = (a, b) => {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

  // Is a solid entity (an NPC, a push block) standing on local tile (x, z)?
  function occupied(x, z) {
    const o = origin();
    return hook().entities.some((e) => e.solid && Math.floor(e.x - o.x) === x && Math.floor(e.z - o.z) === z);
  }

  // Can the hero stand on local tile (x, z)? Tiles with an onEnter hook
  // (warps, pits) are avoided unless allowed; tiles holding a solid entity
  // always are.
  function walkable(x, z, allowHooks) {
    if (x < 0 || z < 0 || x >= W || z >= H) return false;
    const o = origin();
    const w = hook().world;
    if (w.isSolid(o.x + x, o.z + z, hook().player)) return false;
    if (occupied(x, z)) return false;
    const def = w.tileDefAt(o.x + x, o.z + z);
    return allowHooks || !def?.onEnter;
  }

  // Breadth-first search over the screen's tiles. Returns the tiles to visit
  // after `start`, ending at the first tile where goal(x, z) is true.
  function bfs(start, goal, { allowHooks = false } = {}) {
    const k = (x, z) => z * W + x;
    const prev = new Map([[k(start[0], start[1]), null]]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (goal(cur[0], cur[1])) {
        const path = [];
        for (let c = cur; c; c = prev.get(k(c[0], c[1]))) path.push(c);
        return path.reverse().slice(1);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur[0] + dx;
        const nz = cur[1] + dz;
        if (prev.has(k(nx, nz))) continue;
        if (!walkable(nx, nz, allowHooks || goal(nx, nz))) continue;
        prev.set(k(nx, nz), cur);
        queue.push([nx, nz]);
      }
    }
    return null;
  }

  // Point the virtual stick at local (x, z). exact: slow down to stop on it.
  function steer(x, z, exact) {
    const p = hook().player;
    const L = local(p);
    const dx = x - L.x;
    const dz = z - L.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) {
      hook().input.setStick(0, 0);
      return 0;
    }
    const m = exact ? Math.min(1, d / (p.speed * DT)) : 1;
    hook().input.setStick((dx / d) * m, (dz / d) * m);
    return d;
  }

  function planTo(goalTile, opts) {
    const L = local(hook().player);
    const cur = [Math.floor(L.x), Math.floor(L.z)];
    if (cur[0] === goalTile[0] && cur[1] === goalTile[1]) return [];
    const tiles = bfs(cur, (x, z) => x === goalTile[0] && z === goalTile[1], opts);
    if (!tiles) return null;
    const path = tiles.map(([x, z]) => [x + 0.5, z + 0.5]);
    // Go through the middle of the current tile first so corners are not
    // clipped, unless something solid stands there (the hero is beside it).
    return walkable(cur[0], cur[1], true) ? [[cur[0] + 0.5, cur[1] + 0.5], ...path] : path;
  }

  async function walkTo(x, z, { timeout = 20, tolerance = 0.05, allowHooks = false } = {}) {
    const g = hook();
    const from = screenKey();
    const goal = [Math.floor(x), Math.floor(z)];
    let t = 0;
    let path = null;
    let stuckT = 0;
    let replans = 0;
    let last = null;
    try {
      while (t < timeout) {
        if (g.state.mode !== 'play') return { ok: false, reason: `mode became ${g.state.mode}`, t };
        if (screenKey() !== from) return { ok: false, reason: 'left the screen', t };
        const L = local(g.player);
        if (Math.hypot(L.x - x, L.z - z) <= tolerance) return { ok: true, t };
        if (!path) {
          path = planTo(goal, { allowHooks });
          if (!path) return { ok: false, reason: `no path to ${x},${z}`, t };
        }
        const wp = path.length ? path[0] : [x, z];
        const d = steer(wp[0], wp[1], path.length === 0);
        if (path.length && d < 0.12) path.shift();
        await g.tick(DT);
        t += DT;
        const now = local(g.player);
        if (last && Math.hypot(now.x - last.x, now.z - last.z) < 0.002 && g.player.attackT <= 0) stuckT += DT;
        else stuckT = 0;
        last = now;
        if (stuckT > 0.6) {
          if (++replans > 6) return { ok: false, reason: 'stuck', t };
          path = null;
          stuckT = 0;
        }
      }
      return { ok: false, reason: 'timeout', t };
    } finally {
      g.input.setStick(0, 0);
    }
  }

  // Walk to the nearest open tile on one edge and keep going until the
  // camera has slid to the next screen.
  async function exit(dir, { timeout = 20 } = {}) {
    const g = hook();
    const [ex, ez] = DIRS[dir];
    const from = screenKey();
    const onEdge = (x, z) => (ex === 1 && x === W - 1) || (ex === -1 && x === 0) || (ez === 1 && z === H - 1) || (ez === -1 && z === 0);
    const L = local(g.player);
    const cur = [Math.floor(L.x), Math.floor(L.z)];
    let target = cur;
    if (!onEdge(...cur)) {
      const tiles = bfs(cur, onEdge);
      if (!tiles) return { ok: false, reason: `no open ${dir} edge`, t: 0 };
      target = tiles[tiles.length - 1];
    }
    const w = await walkTo(target[0] + 0.5, target[1] + 0.5, { timeout, tolerance: 0.15 });
    if (!w.ok) return { ...w, reason: `walking to the ${dir} edge: ${w.reason}` };
    let t = w.t;
    try {
      for (let i = 0; i < 600; i++) {
        if (g.state.mode === 'play' && screenKey() !== from) return { ok: true, t, screen: screenKey() };
        if (g.state.mode === 'play') g.input.setStick(ex, ez);
        else g.input.setStick(0, 0);
        await g.tick(DT);
        t += DT;
      }
      return { ok: false, reason: 'did not scroll', t };
    } finally {
      g.input.setStick(0, 0);
    }
  }

  // Fight until the screen has no enemies (or `maxKills` enemies are down).
  // The hero walks up to the nearest one, turns to face it and swings. If
  // health drops to `heal` half-hearts or less it is topped up (counted in
  // `heals`), so a long fight cannot end the test by accident.
  async function fight({ seconds = 60, heal = 2, reach = 1.15, maxKills = Infinity } = {}) {
    const g = hook();
    const from = screenKey();
    let t = 0;
    let heals = 0;
    let swings = 0;
    let kills = 0;
    let path = null;
    let planT = 0;
    const off = g.events.on('enemy-killed', () => kills++);
    const result = (ok, reason) => ({ ok, reason, t, kills, swings, heals, left: g.entities.filter((e) => e.kind === 'enemy').length });
    try {
      while (t < seconds) {
        const mode = g.state.mode;
        if (mode === 'dead') return result(false, 'died');
        if (screenKey() !== from) return result(false, 'left the screen');
        if (mode !== 'play') {
          g.input.setStick(0, 0);
          await g.tick(DT);
          t += DT;
          continue;
        }
        if (g.state.hp <= heal) {
          g.setHp(g.state.maxHp);
          heals++;
        }
        const p = g.player;
        const foes = g.entities.filter((e) => e.kind === 'enemy');
        if (!foes.length || kills >= maxKills) return result(true);
        const ready = foes.filter((e) => e.spawned !== false);
        let e = null;
        let best = Infinity;
        for (const f of ready) {
          const d = Math.hypot(f.x - p.x, f.z - p.z);
          if (d < best) {
            best = d;
            e = f;
          }
        }
        if (!e) {
          g.input.setStick(0, 0);
        } else {
          const dx = e.x - p.x;
          const dz = e.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > reach) {
            planT -= DT;
            if (!path || planT <= 0) {
              const el = local(e);
              path = planTo([Math.floor(el.x), Math.floor(el.z)], {}) ?? [];
              planT = 0.3;
            }
            while (path.length && Math.hypot(path[0][0] - local(p).x, path[0][1] - local(p).z) < 0.12) path.shift();
            const el = local(e);
            if (path.length > 1) steer(path[0][0], path[0][1], false);
            else steer(el.x, el.z, false);
          } else {
            path = null;
            const diff = angleDiff(Math.atan2(dx, dz), p.yaw);
            if (Math.abs(diff) > 0.3 && p.attackT <= 0) {
              g.input.setStick((dx / d) * 0.2, (dz / d) * 0.2);
            } else {
              g.input.setStick(0, 0);
              if (p.attackT <= 0) {
                g.input.tap('sword');
                swings++;
              }
            }
          }
        }
        await g.tick(DT);
        t += DT;
      }
      return result(false, 'timeout');
    } finally {
      off();
      g.input.setStick(0, 0);
    }
  }

  // Step until predicate(snapshot) is true.
  async function waitFor(predicateSource, { seconds = 10 } = {}) {
    const g = hook();
    const pred = new Function('s', `return (${predicateSource})(s);`);
    let t = 0;
    while (t < seconds) {
      if (pred(g.snapshot())) return { ok: true, t };
      await g.tick(DT);
      t += DT;
    }
    return { ok: false, reason: 'timeout', t };
  }

  window.__vhBot = { walkTo, exit, fight, waitFor, bfs, walkable, occupied };
})();

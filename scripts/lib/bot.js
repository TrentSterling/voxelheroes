// In-page play-test helpers, injected by scripts/playtest.mjs as
// window.__vhBot. They drive the game only through window.__voxelHeroes
// (virtual stick, button taps, hook.tick), so a whole walk or fight runs
// inside one page.evaluate: fast, and deterministic for a given seed.
//
// All coordinates are local tile coordinates of the current screen (0..w x
// 0..h: 16 x 11 outdoors, 16 x 12 in dungeon rooms). Every helper is async
// (hook.tick lets promise continuations such as dialog follow-ups run between
// ticks) and resolves to { ok, reason?, t, ... }.
(() => {
  const DT = 1 / 60;
  const hook = () => window.__voxelHeroes;
  const scr = () => hook().screen();
  const screenKey = () => hook().state.screenKey;
  const origin = () => ({ x: scr().x0, z: scr().z0 });
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

  // Can the hero stand in the middle of local tile (x, z)? This is the real
  // collision test, so tiles half covered by a room's side wall are out.
  // Tiles with an onEnter hook (warps, pits) are avoided unless allowed;
  // tiles holding a solid entity always are.
  function walkable(x, z, allowHooks) {
    const s = scr();
    if (x < 0 || z < 0 || x >= s.w || z >= s.h) return false;
    const w = hook().world;
    const p = hook().player;
    if (w.blocked(s.x0 + x + 0.5, s.z0 + z + 0.5, p.r, p)) return false;
    if (occupied(x, z)) return false;
    const def = w.tileDefAt(s.x0 + x, s.z0 + z);
    if (def?.hazard) return false; // pits, lava, swamp: never a route (they are open to the hero)
    return allowHooks || !def?.onEnter;
  }

  // Breadth-first search over the screen's tiles. Returns the tiles to visit
  // after `start`, ending at the first tile where goal(x, z) is true.
  function bfs(start, goal, { allowHooks = false } = {}) {
    const W = scr().w;
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
    // The hero walks 8-way at one speed (spec 7.3), so a stick cannot stop
    // him between two steps: within two steps of an exact goal (walkTo's
    // tolerance is less than one) the bot sets him down on it (the M1 bot
    // slowed an analog stick instead).
    if (exact && d <= 2 * p.speed * DT + 1e-9 && !(p.attackT > 0) && !p.dashing && !(p.knockT > 0)) {
      p.x += dx;
      p.z += dz;
      hook().input.setStick(0, 0);
      return 0;
    }
    hook().input.setStick(dx / d, dz / d);
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

  // Walk to the nearest open tile on one edge and keep going until the hero
  // is on the next screen and play has resumed (after a slide, or after the
  // fade into another area).
  async function exit(dir, { timeout = 20 } = {}) {
    const g = hook();
    const [ex, ez] = DIRS[dir];
    const from = screenKey();
    const { w: W, h: H } = scr();
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

  // Walk onto local (x, z), a tile whose onEnter hook starts something (a
  // door or stairs: a warp), and wait through the fade (or slide) until play
  // resumes, as exit() does for edges. Returns { ok, t, screen, moved }:
  // screen is where play resumed, moved whether it is another screen.
  async function enter(x, z, { timeout = 20 } = {}) {
    const g = hook();
    const from = screenKey();
    const w = await walkTo(x, z, { timeout, allowHooks: true });
    let t = w.t;
    if (!w.ok && !/^mode became (warp|scroll)$/.test(w.reason)) return { ...w, reason: `walking onto ${x},${z}: ${w.reason}` };
    // Arrived without anything starting: one more tick for the hook.
    if (g.state.mode === 'play') {
      await g.tick(DT);
      t += DT;
    }
    if (g.state.mode === 'play')
      return { ok: false, reason: `nothing started at ${x},${z} (for a doorway in a screen edge use exit(dir))`, t };
    for (let i = 0; i < 600; i++) {
      if (g.state.mode === 'play') return { ok: true, t, screen: screenKey(), moved: screenKey() !== from };
      g.input.setStick(0, 0);
      await g.tick(DT);
      t += DT;
    }
    return { ok: false, reason: `still in mode ${g.state.mode} after 10 s`, t };
  }

  // Fight until the screen has no enemies (or `maxKills` enemies are down).
  // The hero walks up to the nearest one, turns to face it and swings. If
  // health drops to `heal` half-hearts or less it is topped up (counted in
  // `heals`), so a long fight cannot end the test by accident.
  async function fight({ seconds = 60, heal = 2, reach = 1.4, maxKills = Infinity, guard = false, tool = false, clearObstacles = false } = {}) {
    const g = hook();
    const from = screenKey();
    let t = 0;
    let heals = 0;
    let swings = 0;
    let kills = 0;
    let path = null;
    let planT = 0;
    let pathGoal = null;
    let guardHeld = false;
    let toolWait = 0, itemUses = 0;
    const holdGuard = (want) => {
      if (want === guardHeld) return;
      g.input[want ? 'down' : 'up']('guard'); guardHeld = want;
    };
    const off = g.events.on('enemy-killed', () => kills++);
    const offItem = g.events.on('item-used', () => itemUses++);
    const result = (ok, reason) => ({ ok, reason, t, kills, swings, heals, itemUses, left: g.entities.filter((e) => e.kind === 'enemy').length });
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
        toolWait = Math.max(0, toolWait - DT);
        const foes = g.entities.filter((e) => e.kind === 'enemy');
        if ((!foes.length && !g.game.combat.roomClearBlocked()) || kills >= maxKills) return result(true);
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
          holdGuard(false);
          g.input.setStick(0, 0);
        } else {
          const dx = e.x - p.x;
          const dz = e.z - p.z;
          const d = Math.hypot(dx, dz);
          // Guard strafes with a fixed facing. Release it to turn, then hold
          // once facing the threat; sword input naturally lowers it to strike.
          holdGuard(guard && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) <= 0.3);
          if (d > reach) {
            planT -= DT;
            const el = local(e);
            const goal = [Math.floor(el.x), Math.floor(el.z)];
            // Retain a route to a stationary foe. Rebuilding it every 0.3 s
            // prepends the current tile centre again, so a slow guarding hero
            // reverses before reaching the next centre and never advances.
            if (!path || (planT <= 0 && (!pathGoal || goal[0] !== pathGoal[0] || goal[1] !== pathGoal[1]))) {
              path = planTo(goal, {});
              pathGoal = goal;
              planT = 0.3;
            }
            while (path?.length && Math.hypot(path[0][0] - local(p).x, path[0][1] - local(p).z) < 0.12) path.shift();
            // A flier over a pit has no floor route. Wait on safe ground
            // instead of walking directly into the pit to chase it.
            if (path === null && e.flying) g.input.setStick(0, 0);
            else if (path?.length > (clearObstacles ? 0 : 1)) steer(path[0][0], path[0][1], false);
            else steer(el.x, el.z, false);
          } else {
            path = null;
            // The blade faces four ways even when walking diagonally. Line
            // up beside a foe before attacking; running at its centre can
            // leave every thrust off to its side and walk into contact.
            const vertical=Math.abs(dz)>=Math.abs(dx), lateral=vertical?dx:dz;
            const aim=vertical?(dz>0?0:Math.PI):(dx>0?Math.PI/2:-Math.PI/2);
            const diff=angleDiff(aim,p.yaw);
            // The new route uses a conservative part of the real blade
            // width plus enemy radius, rather than a centreline-only hit.
            const lateralReach=clearObstacles?Math.max(.24,(e.r+g.game.tuning.TUNING.sword.minHitWidth/2)*.9):.24;
            if (Math.abs(lateral)>lateralReach && p.attackT<=0) {
              holdGuard(false);
              const mx=vertical?Math.sign(dx):0,mz=vertical?0:Math.sign(dz);
              if (!clearObstacles || !g.world.blocked(p.x+mx*p.speed*DT,p.z+mz*p.speed*DT,p.r,p)) g.input.setStick(mx,mz);
              else {
                // Clear a real bush or pot that blocks the attack lane. A
                // sideways lineup must not keep pushing into the same prop.
                const facing=Math.atan2(mx,mz),aimed=Math.abs(angleDiff(facing,p.yaw))<.3;
                const def=g.world.tileDefAt(Math.floor(p.x+mx*(p.r+.35)),Math.floor(p.z+mz*(p.r+.35)));
                if (def?.onSword && def.regrow) {
                  g.input.setStick(aimed?0:mx,aimed?0:mz);
                  if (aimed && p.attackT<=0) {holdGuard(guard);g.input.tap('sword');swings++;}
                } else {
                  // Back into free floor, then approach by the existing BFS.
                  // Only ordinary stick input; avoid hazards and passages.
                  const dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,z])=>{
                    const nx=p.x+x*p.speed*DT,nz=p.z+z*p.speed*DT,def=g.world.tileDefAt(Math.floor(nx),Math.floor(nz));
                    return !g.world.blocked(nx,nz,p.r,p)&&!def?.hazard&&!def?.onEnter;
                  }).sort(([ax,az],[bx,bz])=>Math.hypot(p.x+bx*.2-e.x,p.z+bz*.2-e.z)-Math.hypot(p.x+ax*.2-e.x,p.z+az*.2-e.z));
                  g.input.setStick(...(dirs[0]??[0,0]));
                }
              }
            } else if (Math.abs(diff) > 0.3 && p.attackT <= 0) {
              holdGuard(false);
              g.input.setStick(vertical?0:Math.sign(dx),vertical?Math.sign(dz):0);
            } else {
              g.input.setStick(0, 0);
              if (p.attackT <= 0) {
                if (clearObstacles) holdGuard(guard);
                g.input.tap('sword');
                swings++;
              }
            }
          }
          if (tool && (!clearObstacles || !e.flying || !g.world.blocked(e.x,e.z,p.r,p)) && toolWait===0 && d>reach && d<=5.5 && p.attackT<=0 && !p.carrying && Math.abs(angleDiff(Math.atan2(dx,dz),p.yaw))<.3) {
            g.input.tap('item'); toolWait=.5;
          }
        }
        await g.tick(DT);
        t += DT;
      }
      return result(false, 'timeout');
    } finally {
      holdGuard(false);
      off();
      offItem();
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

  window.__vhBot = { walkTo, exit, enter, fight, waitFor, bfs, walkable, occupied };
})();

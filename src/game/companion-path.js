// Followers use the hero's travelled route, with a small local repair when a
// moving prop or a tight corner obstructs it. No route teleports through walls.
import { world, currentScreen } from '../world/world.js';
import { bumpsEntity } from '../systems/physics.js';

export function companionGround(body, x, z) {
  const screen = currentScreen(), at = world.locate(Math.floor(x), Math.floor(z));
  if (!at || at.screen.area !== screen?.area || (screen.area.rooms && at.screen !== screen)) return false;
  if (world.blocked(x, z, body.r, body) || bumpsEntity(body, x, z)) return false;
  for (let tx = Math.floor(x - body.r + 1e-6); tx <= Math.floor(x + body.r - 1e-6); tx++)
    for (let tz = Math.floor(z - body.r + 1e-6); tz <= Math.floor(z + body.r - 1e-6); tz++) {
      const tile = world.tileDefAt(tx, tz);
      if (!tile || tile.hazard || tile.onEnter) return false;
    }
  return true;
}

export function companionLine(body, from, to) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z), steps = Math.max(1, Math.ceil(distance * 12));
  for (let i = 1; i <= steps; i++) {
    if (!companionGround(body, from.x + (to.x - from.x) * i / steps, from.z + (to.z - from.z) * i / steps)) return false;
  }
  return true;
}

export function companionRoute(body, goal) {
  if (companionLine(body, body, goal)) return [{ x: goal.x, z: goal.z }];
  const start = { x: Math.floor(body.x), z: Math.floor(body.z) }, end = { x: Math.floor(goal.x), z: Math.floor(goal.z) };
  const key = p => `${p.x},${p.z}`, point = p => ({ x: p.x + .5, z: p.z + .5 });
  const queue = [start], previous = new Map([[key(start), null]]);
  // A repair is local to the visible party, even in a large outdoor area.
  const minX = Math.min(start.x, end.x) - 3, maxX = Math.max(start.x, end.x) + 3;
  const minZ = Math.min(start.z, end.z) - 3, maxZ = Math.max(start.z, end.z) + 3;
  for (let i = 0; i < queue.length && i < 512; i++) {
    const at = queue[i], from = i === 0 ? body : point(at);
    if (at.x === end.x && at.z === end.z && companionLine(body, from, goal)) {
      const route = [{ x: goal.x, z: goal.z }];
      for (let p = at; p && key(p) !== key(start); p = previous.get(key(p))) route.push(point(p));
      // Centre the first tile only when the route needs that turn.
      if (route.length > 1 && !companionLine(body, body, route.at(-1))) route.push(point(start));
      route.reverse();
      return route;
    }
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const next = { x: at.x + dx, z: at.z + dz };
      if (next.x < minX || next.x > maxX || next.z < minZ || next.z > maxZ || previous.has(key(next))) continue;
      const to = point(next);
      const centred = i === 0 && companionLine(body, body, point(start));
      if (!companionLine(body, centred ? point(start) : from, to)) continue;
      previous.set(key(next), at); queue.push(next);
    }
  }
  return null;
}

export function companionTrailDistance(body, trail, leader) {
  let distance = 0, previous = body;
  for (const at of trail) { distance += Math.hypot(at.x - previous.x, at.z - previous.z); previous = at; }
  return distance + Math.hypot(leader.x - previous.x, leader.z - previous.z);
}

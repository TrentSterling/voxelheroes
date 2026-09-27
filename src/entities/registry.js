// Entity registry: type name -> factory. Every enemy, projectile, pickup and
// NPC type registers itself from its own file (files under src/entities/ load
// automatically), and areas spawn them by name from map markers:
//
//   registerEntity('bat', (opts) => new Bat(opts));
//
// opts always carries x, z (world position) and may carry spawnIndex (how
// many enemies spawned before it on this screen), spawnFlag (set it with
// entity.markDone() when it should never come back) and any extra fields from
// the area's spawn table (for example variant: 'blue').

const types = new Map();

export function registerEntity(name, factory, meta = {}) {
  if (types.has(name)) throw new Error(`Entity type "${name}" is already registered`);
  if (typeof factory !== 'function') throw new Error(`registerEntity("${name}"): factory must be a function`);
  types.set(name, { name, factory, ...meta });
}

export function createEntity(name, opts = {}) {
  const t = types.get(name);
  if (!t) throw new Error(`Unknown entity type "${name}"`);
  const e = t.factory(opts);
  e.type = name;
  return e;
}

export const hasEntityType = (name) => types.has(name);
export const entityTypes = () => [...types.keys()];

import { world, currentScreen } from '../world/world.js';
import { entities, bucketOf, inBucket, spawn, hasBucket } from '../entities/manager.js';
import { hasEntityType } from '../entities/registry.js';

export const actorLists = () => [entities, ...[...world.screens.values()].filter(hasBucket).map(bucketOf)];
export const allActors = () => actorLists().flat().filter((e) => !e.removed && e.kind !== 'friend');

const runtimeExtras = ['ai', 'trail', 'segments', 'head', 'carried', 'brokenSwings', 'punishOrbs'];
const omitted = new Set(['type', 'kind', 'priority', 'netId', 'homeKey', '_frame', 'removed']);

function encode(value, depth = 0) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { $number: String(value) };
  if (!value || depth > 6) return undefined;
  if (value.netId && typeof value.remove === 'function') return { $actor: value.netId };
  if (value.key && world.screens.get(value.key) === value) return { $screen: value.key };
  if (value instanceof Set) return { $set: [...value].map((v) => encode(v, depth + 1)) };
  if (value instanceof Map) return { $map: [...value].map(([k, v]) => [encode(k, depth + 1), encode(v, depth + 1)]) };
  if (Array.isArray(value)) return value.map((v) => encode(v, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k))
    .map(([k, v]) => [k, encode(v, depth + 1)]).filter(([, v]) => v !== undefined));
}

function decode(value, actors) {
  if (value === null || typeof value !== 'object') return value;
  if (value.$number) return value.$number === 'Infinity' ? Infinity : value.$number === '-Infinity' ? -Infinity : 0;
  if (value.$actor) return actors.get(value.$actor) ?? null;
  if (value.$screen) return world.screens.get(value.$screen) ?? null;
  if (value.$set) return new Set(value.$set.map((v) => decode(v, actors)));
  if (value.$map) return new Map(value.$map.map(([k, v]) => [decode(k, actors), decode(v, actors)]));
  if (Array.isArray(value)) return value.map((v) => decode(v, actors));
  return Object.fromEntries(Object.entries(value).filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k))
    .map(([k, v]) => [k, decode(v, actors)]));
}

export function captureActor(e) {
  const fields = {};
  for (const [key, value] of Object.entries(e)) {
    if (omitted.has(key) || key.startsWith('_party')) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value) || runtimeExtras.includes(key)) {
      const data = encode(value);
      if (data !== undefined) fields[key] = data;
    }
  }
  const transforms = [];
  e.object?.traverse((o) => transforms.push({ p: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray(), v: o.visible }));
  return { id: e.netId, type: e.type, kind: e.kind, opts: encode({ ...e.spawnOptions, crowned: e.crowned }), fields,
    pose: e.mesh?.pose ?? null, emissive: e.mat?.emissive?.getHex() ?? null, transforms };
}

export function applyActors(screen, records, { prune = true, playerShots = false } = {}) {
  if (screen !== world.screens.get(screen.key)) return;
  // A friend's old homeKey must never create a dormant dungeon bucket. Only actual streamed
  // buckets and the local hero's current room contain replicas; other rooms stay in the cache.
  if (screen.key !== currentScreen()?.key && !hasBucket(screen)) return;
  const list = screen.key === currentScreen()?.key ? entities : bucketOf(screen);
  const map = new Map(allActors().map((e) => [e.netId, e]));
  const incoming = new Set(records.map((r) => r.id));
  for (const record of records) {
    let e = map.get(record.id);
    if (e && (e.type !== record.type || (e.kind === 'enemy' && e.crowned !== record.fields.crowned))) { e.remove(); map.delete(record.id); e = null; }
    if (!e) {
      const opts = { ...decode(record.opts, map), netId: record.id, screen, skipIntro: true };
      const create = () => spawn(record.type, opts);
      if (!hasEntityType(record.type)) continue;
      e = screen.key === currentScreen()?.key ? create() : inBucket(screen, create);
      map.set(record.id, e);
      // A multipart actor's onAdd creates its children. Reuse those children when their own
      // records follow; creating them again leaves duplicate serpent segments in the scene.
      for (const child of allActors()) if (child.netId && !map.has(child.netId)) map.set(child.netId, child);
    }
  }
  // Restore references after every part exists (the serpent's head/body, carried pickups).
  for (const record of records) {
    const e = map.get(record.id);
    if (!e || e.removed) continue;
    const previous = e.object?.position.clone();
    for (const [key, value] of Object.entries(record.fields)) {
      if (omitted.has(key) || key.startsWith('_') || typeof e[key] === 'function') continue;
      const decoded = decode(value, map);
      if (key === 'ai') e.ai = { ...e.ai, ...decoded };
      else e[key] = decoded;
    }
    e.homeKey = screen.key;
    e._partyProxy = true;
    e._partyPlayerShot = playerShots;
    e._partyLocalShot = false;
    if (record.pose && e.mesh?.setPose) e.mesh.setPose(record.pose);
    if (record.emissive !== null) e.mat?.emissive?.setHex(record.emissive);
    let i = 0;
    e.object?.traverse((o) => {
      const t = record.transforms[i++];
      if (!t) return;
      o.position.fromArray(t.p); o.quaternion.fromArray(t.q); o.scale.fromArray(t.s); o.visible = t.v;
    });
    if (previous && e._partyPlaced) { e._partyDestination = e.object.position.clone(); e.object.position.copy(previous); }
    e._partyPlaced = true;
    // A replicated pose must not overwrite this hero's personal spell cues.
    e.present?.();
  }
  if (prune) for (const e of [...list]) {
    if (!e.removed && e.kind !== 'friend' && !e._partyLocalShot && (e._partyPendingSpawn ?? 0) < performance.now() && !incoming.has(e.netId)) e.remove();
  }
}

// Trystero transport; one simulation owner per occupied screen, personal hero controls.
import { joinRoom, selfId } from 'trystero';
import { partyHooks } from '../multiplayer/adapters.js';
import { allActors, captureActor, applyActors } from '../multiplayer/actors.js';
import { createFriend, partyColor } from '../multiplayer/friends.js';
import { state, serializeState, setFlag, clearFlag } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { world, currentScreen, withScreen } from '../world/world.js';
import { getTile } from '../world/tiles.js';
import { player } from '../entities/player.js';
import { spawn, entities, bucketOf, hasBucket, inBucket } from '../entities/manager.js';
import { loadGame } from '../systems/flow.js';
import { startNewGame } from './progress.js';
import { dealDamage } from './damage.js';
import { collectPickup } from './pickups.js';
import { getItem } from '../items/registry.js';
import { grant } from '../systems/grants.js';
import { openChest } from '../world/tilekit.js';
import { liftPot, releasePot } from '../systems/pots.js';
import { endSwing } from '../systems/sword.js';
import { hero } from './hero.js';
import { sfx } from '../core/audio.js';
import { sparks } from '../systems/particles.js';
import { GROUND_Y } from '../core/constants.js';
import { toast } from '../ui/toast.js';

const VERSION = 1, APP_ID = 'tront.xyz/voxel-heroes/coop-v1', MAX_PLAYERS = 8;
const members = new Map(), friends = new Map(), rooms = new Map(), seen = new Set(), pending = new Map();
let room = null, eventAction = null, poseAction = null, roomAction = null, timer = null;
let code = '', hostId = null, rank = Infinity, ready = false, applying = false, rpcRecipient = null;
let sequence = 0, nextRank = 1, status = 'Solo adventure', error = '', lastProgress = '', sending = false;
let approvedLift = null;
const enabled = () => !!room && ready;
const cleanCode = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const validPoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const idOf = () => `${selfId}:${++sequence}`;
const remember = (id) => { if (seen.has(id)) return false; seen.add(id); if (seen.size > 4096) seen.delete(seen.values().next().value); return true; };
const quiet = (fn) => { const was = applying; applying = true; try { return fn(); } finally { applying = was; } };
const safeSend = (action, data, target) => action?.send({ v: VERSION, ...data }, target ? { target } : undefined).catch(() => {});

function send(data, target) {
  if (!room) return;
  const packet = { eventId: idOf(), ...data };
  if (target === selfId) receive(packet, selfId);
  else safeSend(eventAction, packet, target);
}

function localPose() {
  return { screen: currentScreen()?.key, x: player.x, z: player.z, r: player.r, yaw: player.yaw,
    hp: state.hp, mode: state.mode, pose: player.hero.pose(), carrying: !!player.carrying, shield: state.gear?.shield ?? 0, guarding: player.guarding, companion: partyHooks.companion(), companions: partyHooks.companions(),
    name: (state.profile?.name || `Hero ${Number.isFinite(rank) ? rank + 1 : ''}`).slice(0, 14),
    blade: player.thrust ? { reach: player.thrust.reach, angle: player.thrust.angle } : null };
}

export function roomOwner(key) {
  // A boss introduction briefly changes mode while the room's new boss is
  // being published. Keep that living hero eligible so an empty replica
  // cannot take ownership and erase the second stage before it arrives.
  const occupants = [...members].filter(([, m]) => m.info?.screen === key && m.info.hp > 0 && ['play', 'boss-intro'].includes(m.info.mode));
  occupants.sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]));
  const previous = rooms.get(key)?.owner;
  return occupants[0]?.[0] ?? (members.has(previous) ? previous : selfId);
}

// A shared story turn-in keeps one authority while both dialogue choices close.
// Simulation ownership still follows heroes able to play; a friend's dialogue
// does not pause another hero's fight. Claim authority ignores those mode changes.
function claimOwner(key) {
  const occupants = [...members].filter(([, m]) => m.info?.screen === key && m.info.hp > 0);
  occupants.sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]));
  return occupants[0]?.[0] ?? roomOwner(key);
}

function stamp(e) {
  if (!enabled() || ['friend', 'companion'].includes(e.kind)) return;
  if (!e.netId) e.netId = e.head?.netId ? `${e.head.netId}:segment:${e.index}` : idOf();
  if ((e.kind === 'projectile' && e.owner === 'hero') || e.type === 'bomb') {
    if (!e._partyProxy) e._partyLocalShot = true;
  }
}

function added(e) {
  stamp(e);
  // Loot created by a guest's item special or broken carried pot joins the shared room.
  if (!enabled() || applying || e.kind !== 'pickup' || !e.netId?.startsWith(`${selfId}:`) || roomOwner(e.homeKey) === selfId) return;
  e._partyPendingSpawn = performance.now() + 1500;
  queueMicrotask(() => { if (enabled() && !e.removed) request('spawn-loot', e, { record: captureActor(e) }); });
}

const roomList = (key) => allActors().filter((e) => e.homeKey === key && !e._partyLocalShot && !e._partyPlayerShot);
const memberList = () => [...members].map(([id, m]) => ({ id, rank: m.rank, info: m.info }));

function acceptPose(data, peerId) {
  if (!validPoint(data) || !world.screens.has(data.screen) || !members.has(peerId)) return;
  const m = members.get(peerId);
  m.info = data;
  if (peerId !== selfId) {
    let e = friends.get(peerId);
    if (!e) friends.set(peerId, e = createFriend(peerId, m.rank, bonkFriend));
    e.info = data;
  }
}

function restoreRoom(key) {
  const snapshot = rooms.get(key), s = world.screens.get(key);
  if (!snapshot || !s) return;
  quiet(() => {
    for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) {
      const ch = snapshot.tiles[z]?.[x];
      if (getTile(s.tileset, ch) && s.tiles[z][x] !== ch) world.setTile(s.x0 + x, s.z0 + z, ch, { rebuild: true, reason: 'party' });
    }
    applyActors(s, snapshot.actors);
  });
}

function captureRooms() {
  for (const e of allActors()) stamp(e);
  const keys = new Set([currentScreen()?.key, ...allActors().map((e) => e.homeKey)]);
  const snapshots = [];
  for (const key of keys) {
    const s = world.screens.get(key);
    if (!s || roomOwner(key) !== selfId || (!hasBucket(s) && key !== currentScreen()?.key)) continue;
    // The destination becomes current before its markers are spawned. An
    // empty frame during the fade/slide would erase them on screen-enter.
    if(key===currentScreen()?.key&&['warp','scroll'].includes(state.mode))continue;
    const snapshot = { key, owner: selfId, sequence: ++sequence, tiles: s.tiles.map((row) => [...row]), actors: roomList(key).map(captureActor) };
    rooms.set(key, snapshot);
    snapshots.push(snapshot);
  }
  return snapshots;
}

function roster(data) {
  for (const m of data) {
    if (!m || typeof m.id !== 'string' || !Number.isFinite(m.rank)) continue;
    members.set(m.id, { rank: m.rank, info: m.info ?? members.get(m.id)?.info });
    if (m.id === selfId && rank !== m.rank) { rank = m.rank; player.hero.setPalette({ tunic: partyColor(rank) }); }
    if (m.info) acceptPose(m.info, m.id);
  }
}

function welcome(peerId) {
  if (members.size > MAX_PLAYERS) { send({ kind: 'full' }, peerId); return; }
  captureRooms();
  send({ kind: 'welcome', hostId, members: memberList(), save: serializeState(), rooms: [...rooms.values()] }, peerId);
  send({ kind: 'roster', hostId, members: memberList() });
}

function applyWelcome(data, peerId) {
  if (ready || peerId !== data.hostId || !data.save?.fields || !Array.isArray(data.members)) return;
  hostId = peerId;
  roster(data.members);
  for (const snapshot of data.rooms ?? []) if (world.screens.has(snapshot.key)) rooms.set(snapshot.key, snapshot);
  const hub = [...world.screens.values()].find((s) => s.name === 'Mossbrook Square');
  const save = structuredClone(data.save);
  // Friends choose their own journal task, including when joining a party.
  save.fields.trackedQuest = serializeState().fields.trackedQuest;
  const profile = state.profile;
  if (profile?.name) save.fields.profile = { ...save.fields.profile, name: profile.name };
  if (hub) {
    const occupied = (x, z) => [...members.values()].some((m) => m.info?.screen === hub.key && Math.hypot(m.info.x - x, m.info.z - z) < 1);
    const safe = world.freeSpot(hub, hub.w / 2, hub.h / 2, player.r, { body: player, occupied });
    save.fields.pos = { area: hub.area.id, screen: [hub.lx, hub.ly], x: safe?.x ?? 8, z: safe?.z ?? 5.5, yaw: 0 };
  }
  ready = true;
  quiet(() => loadGame(save));
  restoreRoom(currentScreen().key);
  status = 'Adventure together';
  error = '';
  members.get(selfId).info = localPose();
  send({ kind: 'hello', info: localPose() });
  toast('Joined the party in Mossbrook');
}

function validateRoomAction(data, peerId) {
  const s = world.screens.get(data.screen), m = members.get(peerId);
  const claim = data.action === 'tile-hook' && data.hook === 'onClaim';
  return s && m && (claim ? claimOwner(s.key) : roomOwner(s.key)) === selfId && validPoint(data.from) &&
    data.from.x >= s.x0 - 1 && data.from.x <= s.x1 + 1 && data.from.z >= s.z0 - 1 && data.from.z <= s.z1 + 1;
}

function action(data, peerId) {
  if (!validateRoomAction(data, peerId)) return;
  const s = world.screens.get(data.screen);
  const list = data.screen === currentScreen()?.key ? entities : bucketOf(s);
  const e = data.actor && list.find((a) => !a.removed && a.netId === data.actor);
  withScreen(s, () => {
    if (data.action === 'damage' && e?.kind === 'enemy') {
      const hit = data.hit ?? {};
      if (Math.hypot(e.x - data.from.x, e.z - data.from.z) > 24 || !Number.isFinite(hit.amount) || hit.amount < 0 || hit.amount > 1000) return;
      dealDamage(e, { ...hit, from: data.from, swingId: `${peerId}:${hit.swingId ?? data.eventId}` });
    } else if (data.action === 'freeze' && e?.kind === 'enemy' && !e.boss && !e.invulnerable && !e.immune?.includes('freeze')) {
      if (Number.isFinite(data.seconds) && data.seconds > 0 && data.seconds <= 60 && Math.hypot(e.x - data.from.x, e.z - data.from.z) <= 24) {
        e.frozenT = Math.max(e.frozenT ?? 0, data.seconds);
        emit('enemy-hit', { entity: e, result: 'frozen', damage: 0 });
      }
    } else if (data.action === 'spawn-loot' && data.record?.kind === 'pickup' && data.record.id?.startsWith(`${peerId}:`) && !e) {
      const record = data.record;
      if (!validPoint(record.fields) || Math.hypot(record.fields.x - data.from.x, record.fields.z - data.from.z) > 24) return;
      const create = () => spawn(record.type, { ...record.opts, netId: record.id, x: record.fields.x, z: record.fields.z });
      if (s.key === state.screenKey) create(); else inBucket(s, create);
    } else if (data.action === 'pickup' && e?.kind === 'pickup' && Math.hypot(e.x - data.from.x, e.z - data.from.z) <= (data.by === 'hero' ? 1.2 : 24)) {
      e.remove(); // The room owner resolves the claim once, before replying to the collector.
      send({ kind: 'loot', screen: s.key, type: e.type, opts: { x: e.x, z: e.z, once: e.once, flag: e.flag, spawnFlag: e.spawnFlag, giver: e.giver } }, peerId);
    } else if (data.action === 'shot-hit' && e?.kind === 'projectile' && e.owner !== 'hero') {
      if (Math.hypot(e.x - data.from.x, e.z - data.from.z) > 3) return;
      if (data.reflect) e.reflect(); else e.shatter();
    } else if (data.action === 'tile-hook' && Number.isInteger(data.tx) && Number.isInteger(data.tz) &&
      ['onPush', 'onSword', 'onShot', 'onBomb', 'onFreeze', 'onFire', 'onClaim'].includes(data.hook)) {
      const distance = Math.hypot(data.tx + 0.5 - data.from.x, data.tz + 0.5 - data.from.z);
      if (distance > (['onPush', 'onClaim'].includes(data.hook) ? 2 : 24) || world.locate(data.tx, data.tz)?.screen !== s) return;
      rpcRecipient = peerId;
      try { world.trigger(data.tx, data.tz, data.hook, { ...data.extra, player: { ...data.from, r: player.r }, dt: Math.min(0.05, data.extra?.dt ?? 1 / 60) }); }
      finally { rpcRecipient = null; }
    } else if ((data.action === 'chest' || data.action === 'lift') && Number.isInteger(data.tx) && Number.isInteger(data.tz)) {
      if (Math.hypot(data.tx + 0.5 - data.from.x, data.tz + 0.5 - data.from.z) > 2) return;
      const at = world.locate(data.tx, data.tz);
      if (at?.screen !== s) return;
      const ch = world.tile(data.tx, data.tz), def = world.tileDefAt(data.tx, data.tz);
      const ctx = { world, screen: s, area: s.area, tx: data.tx, tz: data.tz, x: at.lx, z: at.lz, ch, def, player };
      if (data.action === 'chest' && def?.name === 'chest') {
        rpcRecipient = peerId;
        try { openChest(ctx); } finally { rpcRecipient = null; }
      } else if (data.action === 'lift' && def?.name === 'pot') {
        world.setTile(data.tx, data.tz, def.becomes ?? '.', { rebuild: false, reason: 'lift' });
        send({ kind: 'lift-approved', tx: data.tx, tz: data.tz, screen: s.key, loot: def.loot !== false }, peerId);
      }
    }
  });
}

function receive(data, peerId) {
  if (!data || typeof data !== 'object' || (data.v !== undefined && data.v !== VERSION)) return;
  if (data.eventId && !remember(data.eventId)) return;
  try {
    if (data.kind === 'hello') {
      if (selfId === hostId && !members.has(peerId)) {
        if (members.size >= MAX_PLAYERS) { send({ kind: 'full' }, peerId); return; }
        members.set(peerId, { rank: nextRank++, info: data.info });
      }
      if (members.has(peerId)) acceptPose(data.info, peerId);
      if (selfId === hostId) { status = 'Adventure together'; welcome(peerId); }
      return;
    }
    if (data.kind === 'welcome') { applyWelcome(data, peerId); return; }
    if (data.kind === 'roster' && peerId === hostId) { roster(data.members ?? []); return; }
    if (data.kind === 'full') { error = 'This party is full'; status = error; return; }
    if (!enabled() || !members.has(peerId)) return;
    if (data.kind === 'action') action(data, peerId);
    else if (data.kind === 'companion-tech' && ['clockwork-cross', 'bell-shelter', 'steamwheel'].includes(data.name) && validPoint(data) && hasCompanionTechnique(data, peerId)) {
      emit('companion-tech', { ...data, remote: true });
    }
    else if (data.kind === 'flag' && typeof data.flag === 'string' && data.flag.length < 150) {
      quiet(() => data.value ? setFlag(data.flag) : clearFlag(data.flag));
      const match = /^chest:(-?\d+),(-?\d+)$/.exec(data.flag);
      if (match) { const prop = world.propAt(Number(match[1]), Number(match[2])); if (prop) prop.userData.opening = true; }
    } else if (data.kind === 'tile' && Number.isInteger(data.tx) && Number.isInteger(data.tz)) {
      const s = world.locate(data.tx, data.tz)?.screen;
      if (s && getTile(s.tileset, data.to)) quiet(() => world.setTile(data.tx, data.tz, data.to, { persist: !!data.persist, rebuild: data.rebuild !== false, reason: 'party' }));
    } else if (data.kind === 'keys' && typeof data.group === 'string' && Number.isInteger(data.delta) && Math.abs(data.delta) <= 100) {
      const colors = ['red', 'blue', 'green', 'master'];
      const store = colors.includes(data.group) ? state.colorKeys : state.keys;
      if (data.group === 'master') store.master = true;
      else store[data.group] = Math.max(0, (store[data.group] ?? 0) + data.delta);
    } else if (data.kind === 'grant' || data.kind === 'grant-share') {
      if (typeof data.id !== 'string' || !Number.isFinite(data.amount)) return;
      const fn = () => grant(data.id, data.amount, { ...data.ctx, source: 'party', fanfare: false });
      const s = world.screens.get(data.screen);
      const run = () => s ? withScreen(s, fn) : fn();
      if (data.kind === 'grant-share') quiet(run); else run();
    } else if (data.kind === 'loot' && world.screens.has(data.screen)) {
      const s = world.screens.get(data.screen);
      let pickup;
      quiet(() => { pickup = spawn(data.type, { ...data.opts, netId: data.eventId }); });
      withScreen(s, () => collectPickup(pickup, { by: 'party' }));
    } else if (data.kind === 'lift-approved') approvedLift = data;
    else if (data.kind === 'bonk') receiveBonk(data, peerId);
    else if (data.kind === 'progress') {
      if (data.errands && typeof data.errands === 'object') for (const [giver, record] of Object.entries(data.errands)) {
        const existing = state.errands[giver];
        if (record && typeof record === 'object') state.errands[giver] = { ...existing, ...record,
          status: existing?.status === 'done' ? 'done' : record.status, found: !!existing?.found || !!record.found };
        else if (giver === '_smithDiscount') state.errands[giver] = Math.max(existing ?? 0, record ?? 0);
      }
      for (const key of data.visited ?? []) if (world.screens.has(key)) state.visited.add(key);
      lastProgress = JSON.stringify(progress());
    } else if (data.kind === 'room-cleared' && world.screens.has(data.screen)) {
      quiet(() => emit('room-cleared', { screen: world.screens.get(data.screen) }));
    } else if (data.kind === 'wall-switch' && Number.isInteger(data.tx) && Number.isInteger(data.tz)) {
      const s = world.locate(data.tx, data.tz)?.screen;
      if (s) quiet(() => withScreen(s, () => world.trigger(data.tx, data.tz, 'onShot', { projectile: { source: 'boomerang' } })));
    }
  } catch (e) { error = `Party update could not be applied: ${e.message}`; }
}

function request(actionName, e, extra = {}) {
  const screen = e.homeKey ?? currentScreen()?.key;
  send({ kind: 'action', action: actionName, screen, actor: e.netId, from: { x: player.x, z: player.z }, ...extra }, roomOwner(screen));
}

function tileRequest(actionName, ctx) {
  const key = `${actionName}:${ctx.tx},${ctx.tz}`;
  if ((pending.get(key) ?? 0) < performance.now()) {
    pending.set(key, performance.now() + 600);
    send({ kind: 'action', action: actionName, screen: ctx.screen.key, tx: ctx.tx, tz: ctx.tz, from: { x: player.x, z: player.z } }, roomOwner(ctx.screen.key));
  }
  return true;
}

function bonkFriend(peerId, hit) {
  send({ kind: 'bonk', swingId: hit.swingId, screen: currentScreen()?.key, from: { x: player.x, z: player.z },
    reach: Math.min(12, hit.stats?.reach ?? hero.blade().reach) }, peerId);
}

function receiveBonk(data, peerId) {
  if (state.mode !== 'play' || state.hp <= 0 || !validPoint(data.from) || !Number.isFinite(data.reach)) return;
  const other = members.get(peerId)?.info, s = currentScreen();
  if (!other || !s || world.screens.get(other.screen)?.area !== s.area || (s.area.rooms && other.screen !== s.key)) return;
  const distance = Math.hypot(player.x - data.from.x, player.z - data.from.z);
  if (distance > Math.min(12, data.reach) + 0.8) return;
  const swing = `bonk:${peerId}:${data.swingId}`;
  if (!remember(swing) || player.knockT > 0) return;
  const dx = player.x - data.from.x, dz = player.z - data.from.z, d = Math.hypot(dx, dz) || 1;
  player.stopDash(); endSwing(player); player.attackBuffer = 0; player.charge = null; player.chargeArmed = false;
  player.kx = dx / d * 5; player.kz = dz / d * 5; player.knockT = 0.16; player.lockT = Math.max(player.lockT, 0.16);
  releasePot({ breakIt: true });
  sfx.block(); sparks(player.x, GROUND_Y + 0.5, player.z, [0xffffff, 0xf1c232], 8, { speed: 2, up: 2 });
  emit('party-bonk', { from: peerId, swingId: data.swingId });
}

const sharedGrant = (id) => !!getItem(id) || /^(blade-|shield-|boots-|ring-|spell-|orb-|bomb-bag-|arrow-bag-)/.test(id) || ['heart-container', 'heart-piece', 'magic-container', 'fair-medal'].includes(id);
const progress = () => ({ errands: state.errands, visited: [...state.visited] });

async function broadcastFrame() {
  if (!enabled() || sending) return;
  members.set(selfId, { rank, info: localPose() });
  const shots = allActors().filter((e) => e._partyLocalShot && !e.removed).map(captureActor);
  const info = localPose();
  safeSend(poseAction, { ...info, shots });
  const next = JSON.stringify(progress());
  if (next !== lastProgress) { lastProgress = next; send({ kind: 'progress', ...progress() }); }
  const frames = captureRooms();
  if (frames.length) {
    sending = true;
    try { await roomAction.send({ v: VERSION, frames }); } catch {} finally { sending = false; }
  }
}

export function tickParty(dt) {
  if (!enabled()) return;
  members.set(selfId, { rank, info: localPose() });
  for (const e of friends.values()) e.update(dt);
  if (approvedLift && state.mode === 'play') {
    const data = approvedLift;
    if (currentScreen()?.key !== data.screen) { approvedLift = null; return; }
    player.stopDash();
    if (player.knockT <= 0 && player.lockT <= 0 && !player.thrust) {
      const s = currentScreen();
      liftPot({ world, screen: s, tx: data.tx, tz: data.tz, def: getTile(s.tileset, 'v'), player }, { approved: true, loot: data.loot !== false });
      approvedLift = null;
    }
  }
}

export async function leaveParty() {
  const previous = room;
  room = null; ready = false;
  clearInterval(timer); timer = null;
  for (const e of friends.values()) e.remove();
  for (const e of allActors()) {
    if (e._partyPlayerShot) e.remove();
    e._partyProxy = false; e._partyLocalShot = false;
  }
  members.clear(); friends.clear(); rooms.clear(); pending.clear(); seen.clear();
  eventAction = poseAction = roomAction = null;
  approvedLift = null; code = ''; status = 'Solo adventure'; error = ''; hostId = null; rank = Infinity; sending = false;
  player.hero.setPalette({});
  try { await previous?.leave(); } catch {}
}

async function connect(value, hosting, options = {}) {
  await leaveParty();
  code = cleanCode(value);
  if (code.length < 6) { error = 'Enter a party code (6 to 12 letters or numbers)'; return false; }
  if (state.mode === 'title' || state.mode === 'dead' || state.modeStack.includes('title')) startNewGame({ prologue: true });
  try { localStorage.setItem('voxelHeroes:before-party', JSON.stringify(serializeState())); } catch {}
  status = hosting ? 'Waiting for friends' : 'Finding the party';
  hostId = hosting ? selfId : null; rank = hosting ? 0 : Infinity; ready = hosting; sequence = 0; nextRank = 1;
  if (hosting) player.hero.setPalette({ tunic: partyColor(rank) });
  members.set(selfId, { rank, info: localPose() });
  try {
    const config = { appId: APP_ID, ...(options.relayUrls ? { relayConfig: { urls: options.relayUrls, redundancy: options.relayUrls.length } } : {}),
      ...(options.rtcConfig ? { rtcConfig: options.rtcConfig } : {}), ...(options.testLocal ? { _test_only_mdnsHostFallbackToLoopback: true } : {}) };
    room = joinRoom(config, `vh-${code}`, { onJoinError: (details) => {
      error = `Could not connect: ${details.error || 'connection failed'}`; status = error;
    } });
    eventAction = room.makeAction('event'); poseAction = room.makeAction('pose'); roomAction = room.makeAction('room');
    eventAction.onMessage = (data, { peerId }) => receive(data, peerId);
    poseAction.onMessage = (data, { peerId }) => {
      acceptPose(data, peerId);
      if (!enabled() || !members.has(peerId)) return;
      const s = world.screens.get(data.screen);
      if (s && Array.isArray(data.shots)) quiet(() => applyActors(s, data.shots, { prune: false, playerShots: true }));
      const ids = new Set((data.shots ?? []).map((r) => r.id));
      for (const e of allActors()) if (e._partyPlayerShot && e.netId?.startsWith(`${peerId}:`) && !ids.has(e.netId)) e.remove();
    };
    roomAction.onMessage = (data, { peerId }) => {
      if (!enabled() || data.v !== VERSION || !Array.isArray(data.frames)) return;
      for (const frame of data.frames) {
        if (!world.screens.has(frame.key) || frame.owner !== peerId || roomOwner(frame.key) !== peerId || !Array.isArray(frame.actors)) continue;
        const previous = rooms.get(frame.key);
        if (previous?.owner === peerId && previous.sequence >= frame.sequence) continue;
        rooms.set(frame.key, frame);
        restoreRoom(frame.key);
      }
    };
    room.onPeerJoin = (peerId) => { send({ kind: 'hello', info: localPose() }, peerId); };
    room.onPeerLeave = (peerId) => {
      const wasHost = peerId === hostId;
      friends.get(peerId)?.remove(); friends.delete(peerId); members.delete(peerId);
      if (wasHost && ready) {
        hostId = [...members].sort((a, b) => a[1].rank - b[1].rank)[0]?.[0] ?? selfId;
        nextRank = Math.max(1, ...[...members.values()].map((m) => m.rank + 1));
      }
      status = members.size > 1 ? 'Adventure together' : 'Waiting for friends';
      toast('A friend left the party');
    };
    timer = setInterval(broadcastFrame, 80);
    lastProgress = JSON.stringify(progress());
    if (hosting) captureRooms();
    return true;
  } catch (e) { await leaveParty(); error = `Party could not start: ${e.message}`; status = error; return false; }
}

export function createParty(value, options) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return connect(value ?? [...bytes].map((b) => alphabet[b % alphabet.length]).join(''), true, options);
}
export const joinParty = (value, options) => connect(value, false, options);
export const inviteLink = () => { const url = new URL(location.href); url.searchParams.delete('manual'); url.hash = new URLSearchParams({ party: code }).toString(); return url.href; };
export const partyView = () => ({ active: !!room, ready, code, status, error, selfId, hostId, count: members.size,
  members: memberList().map((m) => ({ id: m.id, name: m.info?.name ?? 'Joining...', screen: m.info?.screen, area: world.screens.get(m.info?.screen)?.name ?? '', rank: m.rank })),
  rooms: [...rooms].map(([key]) => ({ key, owner: roomOwner(key) })) });
export const partyFriends = () => [...friends.values()];
export const partyConnections = () => Object.entries(room?.getPeers() ?? {}).map(([id, connection]) => ({ id, state: connection.connectionState }));
export const partyRoomSnapshot = (key) => structuredClone(rooms.get(key) ?? null);

partyHooks.added = added;
partyHooks.drive = (e, dt) => {
  if (e.kind === 'companion') { e.update(dt); return; }
  if (!enabled() || e.kind === 'friend') { if (e.kind !== 'friend') e.update(dt); return; }
  stamp(e);
  if (e._partyLocalShot) { e.update(dt); return; }
  if (!e._partyPlayerShot && roomOwner(e.homeKey) === selfId) { e._partyProxy = false; e.update(dt); return; }
  if (e._partyDestination && e.object) e.object.position.lerp(e._partyDestination, Math.min(1, dt * 18));
  e.present?.(); // Personal Truesight changes only this hero's visual cue.
  if (e.kind === 'enemy' && !e._partyPlayerShot && e.spawned && !e.harmless && !e.airborne && !(e.stunT > 0) && !(e.knockT > 1e-9) && !(e.frozenT > 0) && e.contactDamage &&
    Math.hypot(e.x - player.x, e.z - player.z) < e.r + player.r) e.touchHero?.();
  if (e.kind === 'projectile' && e.owner !== 'hero' && !e.harmless && !e._partyContact && Math.hypot(e.x - player.x, e.z - player.z) <= e.r + player.r) {
    const result = hero.receiveHit({ damage: e.damage, from: e.tail(), kind: 'projectile', tier: e.tier, source: e });
    if (result !== 'ignored') { e._partyContact = true; request('shot-hit', e, { reflect: result === 'blocked' && !!state.effects.reflect }); }
  }
  if (e.kind === 'pickup' && e.t > 0.25 && Math.hypot(e.x - player.x, e.z - player.z) < 0.6 && state.mode === 'play') collectPickup(e, { by: 'hero' });
};
partyHooks.target = (e) => {
  if (!enabled()) return null;
  const heroes = [...members.values()].filter((m) => m.info?.screen === e.homeKey && m.info.mode === 'play' && m.info.hp > 0).map((m) => m.info);
  heroes.sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
  return heroes[0] ?? null;
};
partyHooks.leader = () => {
  if (!enabled()) return null;
  const leader = [...members].filter(([, member]) => member.info?.hp > 0).sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]))[0];
  return leader ? { id: leader[0], local: leader[0] === selfId, info: leader[1].info } : null;
};
function hasCompanionTechnique(data, peerId) {
  const caster = members.get(peerId)?.info;
  if (data.name === 'steamwheel') return state.flags.has('coast:mara-travels') && state.flags.has('era:mira-travels')
    && state.flags.has('coast:beacon-lit') && state.inventory.owned.includes('fire-wand') && caster?.hp > 0
    && caster.screen === data.screen && Math.hypot(data.x - caster.x, data.z - caster.z) < 4 && currentScreen()?.key === data.screen;
  const flag = data.name === 'bell-shelter' ? 'era:tern-travels' : 'era:mira-travels';
  return state.flags.has(flag) && state.flags.has('era:copper-memory') && caster?.screen === data.screen
    && Math.hypot(data.x - caster.x, data.z - caster.z) < 4 && currentScreen()?.key === data.screen;
}
partyHooks.technique = data => { if (enabled()) send({ kind: 'companion-tech', ...data }); };
partyHooks.damage = (e, hit) => {
  if (!enabled() || applying || !e || e.removed || e.kind !== 'enemy' || roomOwner(e.homeKey) === selfId) return null;
  request('damage', e, { hit: { amount: hit.amount ?? 1, source: hit.source ?? 'sword', swingId: hit.swingId, knockback: hit.knockback, stun: hit.stun, freeze: hit.freeze, crit: hit.crit, truesight: !!hit.truesight } });
  return { result: 'hit', damage: hit.amount ?? 1 };
};
partyHooks.pickup = (e, by) => {
  if (!enabled() || applying || by === 'party' || roomOwner(e.homeKey) === selfId) return null;
  if ((e._partyClaimAt ?? 0) < performance.now()) { e._partyClaimAt = performance.now() + 600; request('pickup', e, { by }); }
  return false;
};
partyHooks.chest = (ctx) => enabled() && !applying && !rpcRecipient && roomOwner(ctx.screen.key) !== selfId ? tileRequest('chest', ctx) : null;
partyHooks.lift = (ctx) => enabled() && !applying && roomOwner(ctx.screen.key) !== selfId ? tileRequest('lift', ctx) : null;
partyHooks.trigger = ({ screen, tx, tz, hook, extra }) => {
  const owner = hook === 'onClaim' ? claimOwner(screen.key) : roomOwner(screen.key);
  if (!enabled() || applying || rpcRecipient || owner === selfId || !['onPush', 'onSword', 'onShot', 'onBomb', 'onFreeze', 'onFire', 'onClaim'].includes(hook)) return null;
  const point = (value) => value ? Object.fromEntries(['x', 'z', 'radius', 'damage', 'source', 'owner', 'freeze', 'strength'].filter((key) => ['number', 'string'].includes(typeof value[key])).map((key) => [key, value[key]])) : null;
  send({ kind: 'action', action: 'tile-hook', screen: screen.key, tx, tz, hook, from: { x: player.x, z: player.z },
    extra: { dt: extra.dt, hit: point(extra.hit), projectile: point(extra.projectile), explosion: point(extra.explosion) } }, owner);
  return true;
};
partyHooks.freeze = (e, seconds) => {
  if (!enabled() || applying || roomOwner(e.homeKey) === selfId) return false;
  request('freeze', e, { seconds }); return true;
};
partyHooks.deflect = (e) => {
  if (!enabled() || applying || roomOwner(e.homeKey) === selfId || e._partyLocalShot) return false;
  request('shot-hit', e, { reflect: false }); return true;
};
partyHooks.regrow = (s) => !enabled() || !rooms.has(s.key);
partyHooks.preserveRoom = (s) => enabled() && !!s && rooms.has(s.key);
partyHooks.flag = (flag, value) => { if (enabled() && !applying) send({ kind: 'flag', flag, value }); };
partyHooks.tile = (data) => { if (enabled() && !applying) send({ kind: 'tile', ...data }); };
partyHooks.grantTo = (id, amount, ctx) => {
  if (!enabled() || !rpcRecipient || rpcRecipient === selfId) return null;
  send({ kind: 'grant', id, amount, ctx, screen: currentScreen()?.key }, rpcRecipient);
  return true;
};
partyHooks.granted = (id, amount, ctx) => { if (enabled() && !applying && sharedGrant(id)) send({ kind: 'grant-share', id, amount, ctx, screen: currentScreen()?.key }); };
on('keys-changed', ({ group, delta }) => { if (enabled() && !applying && delta) send({ kind: 'keys', group, delta }); });
on('room-cleared', ({ screen }) => { if (enabled() && !applying) send({ kind: 'room-cleared', screen: screen.key }); });
on('switch-pressed', ({ kind, tx, tz }) => { if (enabled() && !applying && kind === 'wall') send({ kind: 'wall-switch', tx, tz }); });
on('screen-enter', ({ screen }) => { if (enabled() && rooms.has(screen.key)) restoreRoom(screen.key); });
on('world:reset', () => { if (room && !applying) leaveParty(); });

export function initPartyInvite() {
  const invite = new URLSearchParams(location.hash.slice(1)).get('party');
  if (invite) joinParty(invite);
}

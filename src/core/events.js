// Tiny publish/subscribe bus for cross-feature hooks. Features listen for
// what other features do without importing each other.
//
//   const off = on('enemy-killed', ({ entity }) => { ... });
//   emit('explosion', { x, z, radius: 1.5, source: bomb });
//
// Handlers run synchronously in subscription order; an exception propagates
// to the emitter. onAny(fn) sees every emit (fn(name, payload)), after the
// named handlers; play-tests use it to check that only catalogued events fire.
//
// EVENTS below is the catalogue: every event name the game uses, its payload,
// who emits it and who listens. It is data, so tests and docs read it; emit()
// does not check names. docs/CONTRACTS.md ("Events") is the same list with
// notes. A stream that needs a new event asks for it (docs/CONTRACTS.md,
// "Changing a contract"); until then it may emit a name prefixed with its
// stream ('items:...') for its own use.

const handlers = new Map();
const anyHandlers = new Set();

export function on(name, fn) {
  let set = handlers.get(name);
  if (!set) handlers.set(name, (set = new Set()));
  set.add(fn);
  return () => set.delete(fn);
}

export function once(name, fn) {
  const off = on(name, (payload) => {
    off();
    fn(payload);
  });
  return off;
}

export function off(name, fn) {
  handlers.get(name)?.delete(fn);
}

export function onAny(fn) {
  anyHandlers.add(fn);
  return () => anyHandlers.delete(fn);
}

export function emit(name, payload) {
  const set = handlers.get(name);
  if (set && set.size) for (const fn of [...set]) fn(payload);
  if (anyHandlers.size) for (const fn of [...anyHandlers]) fn(name, payload);
}

export const events = { on, once, off, emit, onAny };

// ---------------------------------------------------------------- catalogue
// name: [payload, emitted by, listened to by]. Owners are M2 streams (hero,
// items, foes-overworld, foes-dungeon, dungeon, overworld, ui), the M1.5
// branches (world, look) and contracts (src/game/*.js and src/core/*.js).
const E = (payload, from, to) => ({ payload, from, to });

export const EVENTS = {
  // ---- frame, modes, world (M1 and feat/world)
  'mode-change': E('{ from, to }', 'core/modes.js on every switch', 'anyone'),
  'screen-leave': E('{ screen }', 'world: transitions.js, before its entities are cleared', 'foes (despawn smoke), dungeon (reset puzzles)'),
  'screen-enter': E('{ screen }', 'world: transitions.js, once spawns are in (M1 name of room-enter)', 'places.js (visited), music, cards'),
  'room-enter': E("{ area, screen, via: 'slide' | 'edge' | 'warp' | 'start' | 'respawn' | 'load' | 'teleport' }", 'world: transitions.js, after screen-enter', 'dungeon (shutters), foes (spawn), ui (minimap)'),
  'area-enter': E("{ area, from, via: 'edge' | 'warp' }", 'world: transitions.js at black, before the loading-card hold', 'ui (loading card), overworld (music)'),
  'screen-visited': E('{ key, area, screen }', 'places.js, the first time a screen or room is entered in this save', 'ui (map fill)'),
  warp: E('{ dest }', 'world: transitions.js when a warp starts', 'anyone'),
  'tile-changed': E('{ tx, tz, from, to, screen, reason }', 'world: world.setTile', 'dungeon, overworld'),
  'door-opened': E("{ tx, tz, kind?: 'small' | 'boss' | 'red' | 'blue' | 'green', flag?, room?, side? }", 'world: tilekit unlockDoor (M1 chars); systems/tile-actions.js openKeyDoor; dungeon doors', 'ui (key toast)'),
  'chest-opened': E('{ tx, tz, contents, source? }', 'world: tilekit openChest (M1 chars); systems/tile-actions.js openChest (every new chest)', 'anyone'),

  // ---- hero and the hero's vitals
  'sword-swing': E('{ player, stats }', 'hero: sword.js when a thrust starts', 'hero (a thrust ends a dash), audio'),
  'sword-hit': E('{ target, hit }', 'hero: sword.js when the blade connects', 'foes'),
  'blade-changed': E('{ full, stats }', 'hero: the blade grows (life full) or shrinks (life not full)', 'ui, audio'),
  'hero-hit': E("{ result: 'blocked' | 'hit', damage, kind, source, from: { x, z } | null }", 'hero.js receiveHit (every call that is not ignored)', 'ui, audio (the caller of receiveHit applies its own recoil on block)'),
  'player-hurt': E('{ amount, hp, fromX, fromZ, kind, source }', 'hero: combat.js hurtPlayer', 'ui, audio'),
  'player-died': E('{}', 'hero: combat.js when life reaches 0 and nothing revives', 'dungeon (death in a dungeon), ui (game over)'),
  'player-revived': E('{ by, hp }', 'hero: combat.js when a reviver (revive dust) saves the hero', 'ui'),
  'hero-respawn': E('{ spot, via }', 'hero.js respawn()', 'anyone'),
  'hero-pose': E("{ pose: 'stand' | 'cheer' | 'swordOut' | 'item' | 'guard' | null, seconds }", 'hero.js setPose / cheer (the one pose authority)', 'hero (model)'),
  'life-changed': E('{ hp, maxHp, delta, full, wasFull, reason }', "vitals.js on every change ('direct' for writes that bypass it)", 'hero (full-life blade), ui, audio (low-life beep)'),
  'magic-changed': E('{ magic, maxMagic, delta, reason }', 'vitals.js', 'ui'),
  'coins-changed': E('{ coins, delta, reason }', 'vitals.js', 'ui'),

  // ---- swords
  'sword-found': E('{ id }', 'swords.js giveSword', 'ui (item get)'),
  'sword-equip': E('{ id, from }', 'swords.js equipSword', 'hero (model), ui'),
  'sword-upgrade': E('{ id, stat, level, cost }', 'swords.js buyLevel (the smith)', 'ui'),
  'sword-reset': E('{ id, lost }', 'swords.js resetSword (lost: the coins spent on it, not refunded)', 'ui'),

  // ---- items, magic, pickups
  'item-gained': E('{ id }', 'items: inventory.js giveItem', 'ui'),
  'item-selected': E('{ id }', 'items: inventory.js selectItem', 'ui'),
  'item-used': E('{ id }', 'items: inventory.js useSelectedItem (B, when the item reports it was used)', 'anyone'),
  'item-get': E('{ id, amount, name, text, source, model }', 'grants.js for grants marked fanfare (chests, shops, bosses, NPCs)', 'ui (item-get line), hero (cheer, the prize model overhead)'),
  'spell-learned': E('{ id }', 'spells.js learnSpell', 'ui'),
  'spell-cast': E('{ id, cost, x, z }', 'spells.js castSpell (x, z: where the hero stood)', 'dungeon (reveal), ui, audio'),
  'effect-start': E('{ name, seconds }', 'effects.js startEffect', 'anyone'),
  'effect-end': E('{ name }', 'effects.js when a timed effect runs out or is cleared', 'anyone'),
  pickup: E("{ entity, type, by: 'hero' | 'blade' | 'boomerang' | ..., wasFull }", 'Pickup (walked over) and pickups.js collectPickup (wasFull: heart and magic pickups)', 'hero (star special), ui, audio'),
  explosion: E('{ x, z, radius, damage, source }', 'items: bombs', 'blast.js (entities), world (tile onBomb)'),
  light: E("{ x, z, radius, source: 'fire' | 'candle' | 'lamp' | ... }", 'items: fire wand, candle, lamp', 'world (tile onLight), dungeon (torches, dark rooms)'),

  // ---- enemies and bosses
  'enemy-spawned': E('{ entity }', 'entities/manager.js when an enemy joins the world', 'bestiary.js (seen), foes'),
  'enemy-hit': E("{ entity, hit, result: 'hit' | 'killed' | 'immune' | 'blocked' | 'frozen', damage }", 'damage.js dealDamage, freezeAt (frozen)', 'hero (specials), ui (hit.crit: the red word)'),
  'enemy-killed': E('{ entity, hit }', 'foes: Enemy.die', 'bestiary.js (defeated), dungeon (kill rooms)'),
  'room-cleared': E('{ screen }', 'hero: combat.js checkRoomCleared, after the last enemy that counts dies', 'dungeon (shutters, key drops), clears.js (remembered clears)'),
  'boss-intro': E('{ id, name, title, dungeon, hint }', "foes-dungeon when the boss fight starts (its 'boss-intro' mode pushes the camera in)", 'ui (name card, the hint line)'),
  'boss-phase': E('{ id, phase }', 'foes-dungeon at each phase change', 'ui, audio'),
  'boss-defeated': E('{ id, dungeon, refight }', 'dungeons.js defeatBoss (called by foes-dungeon)', 'dungeon (reward room, portal), ui, overworld'),

  // ---- dungeons
  'dungeon-enter': E('{ id, via }', 'dungeons.js when the hero enters one of its areas from outside it', 'ui (title card), music'),
  'dungeon-leave': E('{ id }', 'dungeons.js when the hero leaves its areas', 'anyone'),
  'dungeon-complete': E('{ id, orb }', 'dungeons.js completeDungeon (the orb is taken)', 'overworld, ui'),
  'keys-changed': E('{ group, count, delta }', 'dungeon: keys.js addKeys / useKey', 'ui (key toast)'),
  'shutters-closed': E('{ screen }', 'dungeon: lock-in and event shutters shut', 'foes (start fighting), audio'),
  'shutters-opened': E('{ screen }', 'dungeon: shutters open', 'audio'),
  'switch-pressed': E("{ id, tx, tz, kind: 'floor' | 'wall' | 'color' | ..., on }", 'dungeon: switch tiles', 'dungeon'),
  'block-pushed': E('{ tx, tz, toX, toZ }', 'dungeon: push blocks and statues', 'dungeon'),
  'torch-lit': E('{ tx, tz }', 'dungeon: torches (a light event reached them)', 'dungeon'),
  'secret-found': E("{ kind: 'bomb-wall' | 'cave' | 'reveal' | ..., tx, tz }", 'dungeon and overworld when a secret opens', 'audio (jingle), ui'),

  // ---- overworld and services
  'shop-buy': E('{ shop, entry, price }', 'shops.js buy', 'ui, audio'),
  'inn-rest': E('{ inn, price }', 'services.js innRest', 'ui'),
  hour: E('{ hour }', 'game/clock.js when the in-game hour changes', 'npcs (schedules read hour())'),
  'new-day': E('{ day, reason }', 'game/clock.js after a night at an inn or past 2:00', 'forage (picked tiles reset), npcs (gifts once a day)'),
  'music-change': E('{ id, from }', 'music.js playMusic', 'audio'),

  // ---- meta
  'new-game': E('{ profile, prologue }', 'progress.js startNewGame, once play starts', 'anyone'),
  saved: E('{ slot, ok }', 'saves.js saveSlot', 'ui'),
  loaded: E('{ slot }', 'saves.js loadSlot, once the slot is applied', 'ui'),
  'settings-changed': E('{ key, value, old }', 'settings.js setSetting', 'look (quality, seams), audio, ui, hero (sway, assists)'),
};

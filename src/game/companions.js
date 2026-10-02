// One of each companion per party. The leader publishes their poses;
// room replicas never simulate duplicate companion attacks.
import * as THREE from 'three';
import { Entity } from '../entities/entity.js';
import { addEntity, entities } from '../entities/manager.js';
import { player } from '../entities/player.js';
import { makeHero } from '../models/hero.js';
import { getMaterial } from '../core/materials.js';
import { GROUND_Y } from '../core/constants.js';
import { state, hasFlag, setFlag, clearFlag, defineState } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { partyHooks } from '../multiplayer/adapters.js';
import { world, currentScreen } from '../world/world.js';
import { moveBody } from '../systems/physics.js';
import { registerPlayHook } from '../systems/flow.js';
import { dealDamage } from './damage.js';
import { spendMagic } from './vitals.js';
import { sparks } from '../systems/particles.js';
import { showDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { roomClearBlocked } from '../systems/combat.js';
import { input } from '../core/input.js';
import { hero, registerHitGuard } from './hero.js';
import { makeTern } from '../models/tern.js';
import { makeMara } from '../models/mara.js';
import { hasItem, selectedItem, itemLockLeft } from '../items/inventory.js';
import { companionGround, companionLine, companionRoute, companionTrailDistance } from './companion-path.js';

export const MIRA_TRAVEL = 'era:mira-travels';
export const MIRA_CHOICES = ['Travel with Mira', 'Wait in town'];
export const MIRA_PALETTE = { tunic: 0x397d88, tunicLight: 0x76c6bd, cap: 0x965576, hair: 0xe0a064,
  belt: 0x4a3223, leg: 0xd9cfae, boot: 0x4a3223, blade: null, shield: null,
  extras: ['glasses', ['scarf', 0xe8be79]] };
export const CLOCKWORK = { name: 'Clockwork Cross', cost: 2, radius: 3.2, cooldown: 4, damage: 6 };
export const TERN_TRAVEL = 'era:tern-travels';
export const TERN_CHOICES = ['Travel with Tern', 'Tend the garden'];
export const SHELTER = { name: 'Bell Shelter', cost: 2, radius: 3.2, cooldown: 8, duration: 3 };
export const MARA_TRAVEL = 'coast:mara-travels';
export const MARA_CHOICES = ['Travel with Mara', 'Keep the shore'];
export const STEAMWHEEL = { name: 'Steamwheel', cost: 3, radius: 3.4, cooldown: 6, damage: 8 };
const MIRA_SPEC = { name: 'Mira', flag: MIRA_TRAVEL, resident: 'npc-mira', frame: 'mira', gap: 1.4, side: 0, radius: .27 };
const TERN_SPEC = { name: 'Tern', flag: TERN_TRAVEL, resident: 'npc-tern', frame: 'tern', gap: 2.4, side: 1.1, radius: .35 };
const MARA_SPEC = { name: 'Mara', flag: MARA_TRAVEL, resident: 'npc-mara', frame: 'mara', gap: 3.4, side: -1.1, radius: .3 };
defineState('companionRuntime', () => ({ cooldown: 0, lastSword: -Infinity, techniqueCount: 0, lastTechnique: null,
  shelterCooldown: 0, shelterCount: 0, wardT: 0, wardScreen: null, blocks: 0,
  steamCooldown: 0, steamCount: 0, steamT: 0, steamScreen: null, steamX: 0, steamZ: 0 }), { persist: false });
let mira = null, tern = null, mara = null, runtime = state.companionRuntime;
const wardRing = new THREE.Mesh(new THREE.RingGeometry(.60, .70, 24), new THREE.MeshBasicMaterial({
  color: 0x8ff3df, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
wardRing.rotation.x = -Math.PI / 2; wardRing.position.y = .04; wardRing.visible = false;
player.hero.root.add(wardRing);
const steamRing = new THREE.Group();
for (const [r, color] of [[1, 0xffa575], [.75, 0x9ee6e0], [.45, 0xffe8af]]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * .91, r, 32), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; steamRing.add(ring);
}
steamRing.visible = false;
player.hero.root.add(steamRing);

export function setMiraTravelling(travel) {
  if (travel) setFlag(MIRA_TRAVEL); else clearFlag(MIRA_TRAVEL);
  toast(travel ? 'Mira joins your adventure' : 'Mira will wait in Mossbrook', 2.4);
}
export function setTernTravelling(travel) {
  if (travel && !hasFlag('era:voices-returned')) return false;
  if (travel) setFlag(TERN_TRAVEL); else clearFlag(TERN_TRAVEL);
  toast(travel ? 'Tern joins your adventure' : 'Tern will tend the garden', 2.4);
  return true;
}
export function talkToTern() {
  const screen = currentScreen();
  if (screen?.key === 'mossbrook-future:1,1') return Promise.resolve(world.trigger(screen.x0+3,screen.z0+4,'onInteract'));
  return showDialog(['The garden can water itself now. I have been practicing something else.',
    'I would like to find the people who need a caretaker. Hold Guard and tap Sword near me: two magic gems make a Bell Shelter.',
    'It lasts three seconds and shelters nearby friends from blades and shots. Mind the pits. I cannot mend a missing floor.'],
    { speaker: 'Tern', choices: TERN_CHOICES }).then(choice => { if (choice !== null) setTernTravelling(choice === 0); });
}
export function setMaraTravelling(travel) {
  if (travel && !hasFlag('coast:beacon-lit')) return false;
  if (travel) setFlag(MARA_TRAVEL); else clearFlag(MARA_TRAVEL);
  toast(travel ? 'Mara joins your adventure' : 'Mara will keep the shore', 2.4);
  return true;
}
export function talkToMara() {
  if (!hasFlag('coast:beacon-lit')) return showDialog([
    'Hooking to a distant bank keeps you above the water.',
    'The temple beast moves from bank to bank. Burn its tentacles, then cross to strike its body.',
    'My father kept the shore light. He said it was for the boats that had not been built yet. The temple kiln holds its missing Ember Lens.',
    'I stayed to mend that light. Bring its ember home, and perhaps I can finally take this paddle somewhere new.'
  ], { speaker: 'Keeper Mara' });
  return showDialog([
    'You lit it. All these years I thought I was waiting for my father to come home. He was leaving a light for everyone after us.',
    hasFlag('coast:beacon-memory') ? 'There are names beneath its light in tomorrow? Then we did not keep an empty shore.' : 'I would like to see the town beyond that clock. Do you think they can see our light?',
    'Mira makes a tiny turbine out of anything. I can turn a little fire into a great deal of steam. We ought to be terrible neighbors for an ice monster.',
    'With Mira and me nearby, select the Fire Wand, hold Guard and tap Item. Steamwheel costs three magic gems and warms the foes around you. Give us six seconds between turns.'
  ], { speaker: 'Keeper Mara', choices: MARA_CHOICES }).then(choice => { if (choice !== null) setMaraTravelling(choice === 0); });
}
const localLeader = () => partyHooks.leader()?.local !== false;

// A wrench swing and the combined pulse cannot hit through buildings or walls.
function clearLine(from, to) {
  const d = Math.hypot(to.x - from.x, to.z - from.z), steps = Math.max(1, Math.ceil(d * 8));
  for (let i = 1; i < steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps, z = from.z + (to.z - from.z) * i / steps;
    if (world.blocksShot(Math.floor(x), Math.floor(z))) return false;
  }
  return true;
}
const nearCompanion = (actor, range) => !!actor && !actor.removed && actor.object.visible
  && Math.hypot(actor.x - player.x, actor.z - player.z) <= range && clearLine(player, actor);
const nearMira = () => nearCompanion(mira, 2.8);
const nearTern = () => nearCompanion(tern, 3.2);
// The keeper is the third follower; her combination still reaches the leader.
const nearMara = () => nearCompanion(mara, 4);
export function canBellShelter() {
  return state.mode === 'play' && hasFlag(TERN_TRAVEL) && hasFlag('era:copper-memory') && state.hp > 0 && nearTern()
    && state.companionRuntime.shelterCooldown <= 0 && state.magic >= SHELTER.cost && !player.carrying
    && player.lockT <= 0 && player.knockT <= 0 && player.stallT <= 0 && !player.paralyzed();
}
export function canClockworkCross() {
  return state.mode === 'play' && hasFlag(MIRA_TRAVEL) && hasFlag('era:copper-memory')
    && state.hp > 0 && nearMira() && state.companionRuntime.cooldown <= 0 && state.magic >= CLOCKWORK.cost;
}
export function canSteamwheel() {
  return hero.canAct() && hasFlag(MIRA_TRAVEL) && hasFlag(MARA_TRAVEL) && hasFlag('coast:beacon-lit')
    && hasItem('fire-wand') && selectedItem()?.id === 'fire-wand' && nearMira() && nearMara()
    && state.companionRuntime.steamCooldown <= 0 && state.magic >= STEAMWHEEL.cost
    && !player.carrying && !hero.isPulled() && player.attackT <= 0 && player.knockT <= 0 && player.stallT <= 0 && itemLockLeft() <= 0;
}
export function companionView() {
  return { recruited: hasFlag(MIRA_TRAVEL), unlocked: hasFlag('era:copper-memory'), nearby: nearMira(),
    ready: canClockworkCross(), cooldown: state.companionRuntime.cooldown, techniqueCount: state.companionRuntime.techniqueCount, lastTechnique: state.companionRuntime.lastTechnique,
    ternRecruited: hasFlag(TERN_TRAVEL), ternNearby: nearTern(), shelterReady: canBellShelter(),
    shelterCooldown: state.companionRuntime.shelterCooldown, shelterCount: state.companionRuntime.shelterCount,
    wardT: state.companionRuntime.wardT, blocks: state.companionRuntime.blocks,
    tern: companionSnapshot(tern), mara: companionSnapshot(mara),
    maraRecruited: hasFlag(MARA_TRAVEL), maraNearby: nearMara(),
    steamUnlocked: hasFlag(MIRA_TRAVEL) && hasFlag(MARA_TRAVEL) && hasFlag('coast:beacon-lit') && hasItem('fire-wand'),
    steamSelected: selectedItem()?.id === 'fire-wand', steamReady: canSteamwheel(),
    steamCooldown: state.companionRuntime.steamCooldown, steamCount: state.companionRuntime.steamCount,
    steamT: state.companionRuntime.steamT,
    mira: mira && !mira.removed ? { x: mira.x, z: mira.z, visible: mira.object.visible, pose: mira.rig.pose(),
      leader: partyHooks.leader()?.id ?? 'solo', localLeader: localLeader(), blocked: world.blocked(mira.x, mira.z, mira.r, mira), assists: mira.assists } : null };
}
function companionSnapshot(actor) {
  return actor && !actor.removed ? { x: actor.x, z: actor.z, visible: actor.object.visible, pose: actor.rig.pose(),
    leader: partyHooks.leader()?.id ?? 'solo', localLeader: localLeader(), blocked: world.blocked(actor.x, actor.z, actor.r, actor) } : null;
}
export function companionFrame() {
  if (!localLeader() || !hasFlag(MIRA_TRAVEL) || !mira || mira.removed || !mira.object.visible) return null;
  return { x: mira.x, z: mira.z, yaw: mira.yaw, screen: world.screenAt(mira.x, mira.z)?.key,
    pose: mira.rig.pose(), attackT: mira.attackT };
}
function companionsFrame() {
  if (!localLeader()) return null;
  const frames = {};
  for (const actor of [tern, mara]) if (actor && !actor.removed && hasFlag(actor.spec.flag) && actor.object.visible) {
    frames[actor.spec.frame] = { x: actor.x, z: actor.z, yaw: actor.yaw, screen: world.screenAt(actor.x, actor.z)?.key,
      pose: actor.rig.pose(), attackT: actor.attackT };
  }
  return Object.keys(frames).length ? frames : null;
}

class TravellingCompanion extends Entity {
  constructor(spec = MIRA_SPEC) {
    super({ r: spec.radius });
    this.spec = spec;
    this.kind = 'companion'; this.name = spec.name; this.type = `companion-${spec.frame}`;
    this.priority = 25; this.screenScoped = false; this.prompt = `Talk to ${spec.name}`;
    this.rig = spec === TERN_SPEC ? makeTern() : spec === MARA_SPEC ? makeMara() : makeHero(getMaterial('character'), MIRA_PALETTE);
    this.object = new THREE.Group(); this.object.add(this.rig.root); this.object.visible = false;
    this.trail = []; this.area = null; this.room = null; this.leaderId = null; this.attackT = 0; this.assistT = 0;
    this.stuckT = 0; this.routeWait = 0; this.repaths = 0;
    this.walkT = 0; this.assists = 0; this.fxT = 0; this.fxX = 0; this.fxZ = 0;
    const wrench = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0xd9b266, roughness: .5 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.06, .43, .07), metal);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.21, .10, .08), metal);
    handle.position.y = .18; head.position.y = .39; wrench.add(handle, head); this.rig.setSword(wrench);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.84, 1, 32), new THREE.MeshBasicMaterial({ color: 0x8ff3df, transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    // A separate world-positioned ring remains at the caster while Mira moves.
    this.object.add(this.ring);
  }
  onInteract() {
    if (!this.object.visible || roomClearBlocked() || entities.some(e => e.kind === 'enemy' && !e.removed && e.countsForClear !== false)) return false;
    this.yaw = Math.atan2(player.x - this.x, player.z - this.z);
    if (this.spec === TERN_SPEC) return talkToTern();
    if (this.spec === MARA_SPEC) return talkToMara();
    const resident = entities.find(e => !e.removed && e.type === 'npc-mira');
    if (resident) return resident.talk();
    return showDialog('Come on. I want to see what we made possible.', { speaker: 'Mira', choices: MIRA_CHOICES })
      .then(choice => { if (choice !== null) setMiraTravelling(choice === 0); });
  }
  placeNearLeader(screen) {
    const dx = -Math.sin(player.yaw) * this.spec.gap + Math.cos(player.yaw) * this.spec.side;
    const dz = -Math.cos(player.yaw) * this.spec.gap - Math.sin(player.yaw) * this.spec.side;
    const spot = world.freeSpot(screen, player.x - screen.x0 + dx, player.z - screen.z0 + dz, this.r,
      { body: this, occupied: (x, z) => Math.hypot(x - player.x, z - player.z) < .8 || !companionGround(this, x, z) || !companionLine(this, { x, z }, player)
        || entities.some(e => e !== this && !e.removed && (e.solid || (e.kind === 'companion' && e.object.visible)) && e.type !== this.spec.resident && Math.hypot(e.x - x, e.z - z) < Math.max(.95, e.r + this.r)) });
    if (!spot) return false;
    this.x = screen.x0 + spot.x; this.z = screen.z0 + spot.z; this.yaw = player.yaw;
    this.trail = [{ x: player.x, z: player.z }]; this.area = screen.area.id; this.room = screen.key;
    this.stuckT = this.routeWait = 0;
    return true;
  }
  update(dt) {
    const screen = currentScreen(), leader = partyHooks.leader();
    this.attackT = Math.max(0, this.attackT - dt); this.assistT = Math.max(0, this.assistT - dt);
    this.fxT = Math.max(0, this.fxT - dt);
    if (!hasFlag(this.spec.flag) || !screen) { this.object.visible = false; return; }
    let moving = false;
    if (leader && !leader.local) {
      const frame = this.spec === MIRA_SPEC ? leader.info?.companion : leader.info?.companions?.[this.spec.frame];
      const home = frame && world.screens.get(frame.screen);
      this.object.visible = !!home && home.area === screen.area && (!screen.area.rooms || home.key === screen.key)
        && Number.isFinite(frame.x) && Number.isFinite(frame.z);
      if (!this.object.visible) return;
      this.x = frame.x; this.z = frame.z; this.yaw = frame.yaw;
      this.rig.setPose(['stand', 'walk1', 'walk2', 'swordOut', 'item'].includes(frame.pose) ? frame.pose : 'stand');
      this.attackT = frame.attackT ?? 0; this.leaderId = leader.id; this.area = null;
    } else {
      if (!this.object.visible || this.area !== screen.area.id || (screen.area.rooms && this.room !== screen.key)
        || this.leaderId !== (leader?.id ?? 'solo') || Math.hypot(this.x - player.x, this.z - player.z) > 10) {
        if (!this.placeNearLeader(screen)) { this.object.visible = false; return; }
      }
      this.object.visible = true; this.leaderId = leader?.id ?? 'solo';
      const walkingFrom = { x: this.x, z: this.z };
      const tail = this.trail.at(-1);
      if (!tail || Math.hypot(tail.x - player.x, tail.z - player.z) > .12) this.trail.push({ x: player.x, z: player.z });
      if (this.trail.length > 160) this.trail.splice(0, this.trail.length - 160);
      // Rejoin directly on clear floor. A turn or a passing manoeuvre must not
      // leave an old breadcrumb pulling the follower back into the convoy.
      const clearToLeader = companionLine(this, this, player);
      if (clearToLeader) this.trail = [{ x: player.x, z: player.z }];
      else while (this.trail.length > 1 && companionLine(this, this, this.trail[1])) this.trail.shift();
      while (this.trail.length > 1 && Math.hypot(this.x - this.trail[0].x, this.z - this.trail[0].z) < .08) this.trail.shift();
      this.routeWait = Math.max(0, this.routeWait - dt);
      if (this.routeWait <= 0 && !clearToLeader) {
        const route = companionRoute(this, player);
        if (route) { this.trail = route; this.repaths++; }
        this.routeWait = .6;
      }
      const remaining = companionTrailDistance(this, this.trail, player);
      const reconnect = !clearToLeader;
      if (remaining > this.spec.gap + .03 || reconnect) {
        const at = this.trail[0], dx = at.x - this.x, dz = at.z - this.z, dist = Math.hypot(dx, dz);
        const speed = Math.min(dist, reconnect ? dist : remaining - this.spec.gap, dt * (remaining > 4 ? 7 : 4.6));
        const before = { x: this.x, z: this.z };
        if (dist > 0 && companionGround(this, this.x + dx / dist * speed, this.z + dz / dist * speed)) moveBody(this, dx / dist * speed, dz / dist * speed, null);
        moving = Math.hypot(this.x - before.x, this.z - before.z) > .001;
        if (moving) this.yaw = Math.atan2(dx, dz);
        const progress = dist - Math.hypot(at.x - this.x, at.z - this.z);
        this.stuckT = progress > .002 ? 0 : this.stuckT + dt;
        if (this.stuckT > .3 && this.routeWait <= 0) {
          const route = companionRoute(this, player);
          if (route) { this.trail = route; this.repaths++; }
          this.stuckT = 0; this.routeWait = .6;
        }
      } else this.stuckT = 0;
      // Settled companions keep their silhouettes apart. Moving followers can
      // pass one another when the hero reverses in a narrow doorway.
      if (!moving) for (const other of [mira, tern, mara]) {
        if (!other || other === this || other.removed || !other.object.visible) continue;
        const dx = this.x - other.x, dz = this.z - other.z, d = Math.hypot(dx, dz), separation = .95;
        if (d >= separation) continue;
        const amount = Math.min(separation - d, dt * 8), ux = d > .001 ? dx / d : this.spec.side < other.spec.side ? -1 : 1, uz = d > .001 ? dz / d : 0;
        const nx = this.x + ux * amount, nz = this.z + uz * amount;
        if (companionGround(this, nx, nz)) {
          const before = { x: this.x, z: this.z }; moveBody(this, ux * amount, uz * amount, null);
          moving ||= Math.hypot(this.x - before.x, this.z - before.z) > .001;
        }
      }
      moving = Math.hypot(this.x - walkingFrom.x, this.z - walkingFrom.z) > .001;
      // Assist only after the hero attacks; Mira cannot farm or clear rooms alone.
      if (this.spec === MIRA_SPEC && state.time - state.companionRuntime.lastSword < 1.4 && this.assistT <= 0 && this.attackT <= 0) {
        const foe = entities.find(e => e.kind === 'enemy' && !e.removed && e.spawned && !e.airborne && Math.hypot(e.x - this.x, e.z - this.z) < 1.25 && clearLine(this, e));
        if (foe) {
          this.yaw = Math.atan2(foe.x - this.x, foe.z - this.z); this.attackT = .32; this.assistT = 1.6;
          const hit = dealDamage(foe, { amount: 1, source: 'sword', from: this, knockback: .15, stun: .12, swingId: `mira-${++this.assists}` });
          if (['hit', 'killed'].includes(hit.result)) sparks(foe.x, GROUND_Y + .5, foe.z, [0xf1c879, 0x9bf0df], 5);
        }
      }
      this.walkT += dt * (moving ? 9 : 0);
      this.rig.setPose(this.attackT > 0 ? 'swordOut' : moving ? (Math.sin(this.walkT) > 0 ? 'walk1' : 'walk2') : 'stand');
    }
    this.object.position.set(this.x, GROUND_Y, this.z); this.object.rotation.y = this.yaw;
    this.rig.swordPivot.rotation.z = this.attackT > 0 ? -.8 * Math.sin(this.attackT / .32 * Math.PI) : 0;
    this.ring.visible = this.fxT > 0;
    if (this.ring.visible) {
      this.object.updateMatrixWorld(true);
      const point = this.object.worldToLocal(new THREE.Vector3(this.fxX, GROUND_Y + .06, this.fxZ));
      this.ring.position.copy(point); this.ring.scale.setScalar(CLOCKWORK.radius * (1 - this.fxT / .65));
      this.ring.material.opacity = this.fxT;
    }
  }
}

// Warps and reloads replace the trail; continuous outdoor room edges retain it.
on('room-enter', ({ via }) => {
  if (['teleport', 'start', 'respawn', 'load', 'warp'].includes(via)) {
    for (const actor of [mira, tern, mara]) if (actor && localLeader()) actor.object.visible = false;
  }
});

registerPlayHook({ id: 'mira-companion', phase: 'input', order: 4, update(dt) {
    if (runtime !== state.companionRuntime) {
      runtime = state.companionRuntime;
    for (const actor of [mira, tern, mara]) if (actor) { actor.object.visible = false; actor.trail = []; actor.assistT = 0; actor.assists = 0; actor.fxT = 0; }
  }
  runtime.cooldown = Math.max(0, runtime.cooldown - dt);
  runtime.shelterCooldown = Math.max(0, runtime.shelterCooldown - dt);
  runtime.steamCooldown = Math.max(0, runtime.steamCooldown - dt);
  runtime.steamT = Math.max(0, runtime.steamT - dt);
  runtime.wardT = Math.max(0, runtime.wardT - dt);
  if (!hasFlag(TERN_TRAVEL) || runtime.wardScreen !== currentScreen()?.key) runtime.wardT = 0;
  wardRing.visible = runtime.wardT > 0;
  wardRing.material.opacity = .45 + .2 * Math.sin(state.time * 8);
  steamRing.visible = runtime.steamT > 0 && runtime.steamScreen === currentScreen()?.key;
  if (steamRing.visible) {
    player.hero.root.updateMatrixWorld(true);
    steamRing.position.copy(player.hero.root.worldToLocal(new THREE.Vector3(runtime.steamX, GROUND_Y + .06, runtime.steamZ)));
    steamRing.scale.setScalar(STEAMWHEEL.radius * (1 - runtime.steamT / .7));
    for (const ring of steamRing.children) ring.material.opacity = runtime.steamT;
  }
  if (hasFlag(MIRA_TRAVEL) && (!mira || mira.removed)) mira = addEntity(new TravellingCompanion(MIRA_SPEC));
  if (hasFlag(TERN_TRAVEL) && (!tern || tern.removed)) tern = addEntity(new TravellingCompanion(TERN_SPEC));
  if (hasFlag(MARA_TRAVEL) && (!mara || mara.removed)) mara = addEntity(new TravellingCompanion(MARA_SPEC));
  if (input.held('guard') && input.pressed('item') && canSteamwheel() && spendMagic(STEAMWHEEL.cost, 'steamwheel')) {
    input.consume('item');
    runtime.steamCooldown = STEAMWHEEL.cooldown; runtime.steamCount++;
    const hit = [], swingId = `steamwheel-${runtime.steamCount}-${state.time}`;
    for (const e of [...entities]) if (e.kind === 'enemy' && !e.removed && e.spawned
      && Math.hypot(e.x - player.x, e.z - player.z) <= STEAMWHEEL.radius + e.r && clearLine(player, e)) {
      hit.push({ type: e.type, ...dealDamage(e, { amount: STEAMWHEEL.damage, source: 'fire', from: player, swingId, stun: .4, knockback: .3 }) });
    }
    runtime.lastTechnique = { at: state.time, name: 'steamwheel', hit };
    const tech = { name: 'steamwheel', screen: currentScreen().key, x: player.x, z: player.z };
    emit('companion-tech', tech); partyHooks.technique(tech); toast('Steamwheel!', 1.4);
  }
  if (input.held('guard') && input.pressed('sword') && canBellShelter() && spendMagic(SHELTER.cost, 'bell-shelter')) {
    input.consume('sword'); player.attackBuffer = 0; player.charge = null; player.chargeArmed = false;
    runtime.shelterCooldown = SHELTER.cooldown; runtime.shelterCount++;
    const tech = { name: 'bell-shelter', screen: currentScreen().key, x: player.x, z: player.z };
    emit('companion-tech', tech); partyHooks.technique(tech); toast('Bell Shelter!', 1.4);
  }
} });
on('sword-swing', ({ player: actor }) => { if (actor === player) state.companionRuntime.lastSword = state.time; });
on('sword-charged-spin', ({ player: actor }) => {
  if (actor !== player || !canClockworkCross() || !spendMagic(CLOCKWORK.cost, 'clockwork-cross')) return;
  state.companionRuntime.cooldown = CLOCKWORK.cooldown; state.companionRuntime.techniqueCount++;
  const hit = [], swingId = `clockwork-${player.swingId}`;
  for (const e of [...entities]) if (e.kind === 'enemy' && !e.removed && Math.hypot(e.x - player.x, e.z - player.z) <= CLOCKWORK.radius + e.r && clearLine(player, e)) {
    hit.push({ type: e.type, ...dealDamage(e, { amount: CLOCKWORK.damage, source: 'spin', from: player, swingId, stun: .35, knockback: .45 }) });
  }
  const tech = { name: 'clockwork-cross', screen: currentScreen().key, x: player.x, z: player.z };
  state.companionRuntime.lastTechnique = { at: state.time, hit }; emit('companion-tech', tech); partyHooks.technique(tech);
  toast('Clockwork Cross!', 1.4);
});
on('companion-tech', ({ name, x, z, screen }) => {
  if (currentScreen()?.key !== screen || !Number.isFinite(x) || !Number.isFinite(z)) return;
  if (name === 'steamwheel') {
    const r = state.companionRuntime;
    r.steamT = .7; r.steamScreen = screen; r.steamX = x; r.steamZ = z;
    for (const actor of [mira, mara]) if (actor?.object.visible) actor.attackT = .55;
    sparks(x, GROUND_Y + .35, z, [0xffa575, 0x9ee6e0, 0xffe8af], 34, { speed: 4, up: 3, life: .7 });
    return;
  }
  if (name === 'bell-shelter') {
    if (currentScreen()?.key === screen && state.hp > 0 && Math.hypot(x - player.x, z - player.z) <= SHELTER.radius
      && clearLine({ x, z }, player)) {
      state.companionRuntime.wardT = SHELTER.duration; state.companionRuntime.wardScreen = screen;
    }
    if (tern?.object.visible) { tern.attackT = .55; tern.fxT = .65; tern.fxX = x; tern.fxZ = z; }
    sparks(x, GROUND_Y + .35, z, [0x8ff3df, 0xf1c879], 18, { speed: 3, up: 2, life: .6 });
    return;
  }
  if (!mira || !Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x - mira.x, z - mira.z) > 6) return;
  mira.attackT = .55; mira.fxT = .65; mira.fxX = x; mira.fxZ = z;
  sparks(x, GROUND_Y + .35, z, [0x8ff3df, 0xf1c879, 0xffffff], 26, { speed: 4, up: 3, life: .6 });
});
partyHooks.companion = companionFrame;
partyHooks.companions = companionsFrame;
registerHitGuard('bell-shelter', () => {
  if (state.companionRuntime.wardT <= 0 || state.companionRuntime.wardScreen !== currentScreen()?.key) return false;
  state.companionRuntime.blocks++;
  sparks(player.x, GROUND_Y + .5, player.z, [0x8ff3df, 0xf1c879], 8);
  return true;
});

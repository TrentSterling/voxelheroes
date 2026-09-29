// boss-serpent, D1's boss (gameplay spec 6.6, 8.5, 8.6; CONTRACTS 8.5),
// its `boss-intro` mode and the `boss-tombstone` that starts a re-fight.
// Numbers are TUNING.boss.serpent.
//
//   marker: { type: 'boss-serpent', dungeon: 'd1' }   (stays away once the
//           boss is beaten unless refight: true, which the tombstone passes)
//   marker: { type: 'boss-tombstone', dungeon: 'd1' } (only once it is beaten)
//
// A head and six body segments, 0.9 tile apart, curving round the arena at
// 3 t/s plus 0.5 t/s per segment lost (up to 6). Only the glowing tail can
// be hurt, and one hit breaks it (a heart drops); the next segment starts
// glowing 2.5 s later. Hitting any other part fires a ring of 8 orbs. Every
// 4 s the head fires a fan of 3 shots (tier 3). With the body gone the head
// has 24 HP. On death: defeatBoss(dungeon), a heart container on the first
// kill and the coin payout.
import * as THREE from 'three';
import { state } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { emit } from '../../core/events.js';
import { random } from '../../core/random.js';
import { TUNING } from '../../core/tuning.js';
import { mixHex } from '../../core/vox.js';
import { GROUND_Y } from '../../core/constants.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { startCameraTween, stepCameraTween, cameraPreset } from '../../core/camera.js';
import { showBanner } from '../../ui/banner.js';
import { toast } from '../../ui/toast.js';
import { burst, smoke, sparks } from '../../systems/particles.js';
import { currentScreen } from '../../world/world.js';
import * as M from '../../models/foes/foes.js';
import { bossDefeated, defeatBoss, getDungeon } from '../../game/dungeons.js';
import { dropCoins } from '../../game/pickups.js';
import { grant } from '../../systems/grants.js';
import { registerBestiary } from '../../game/bestiary.js';
import { Entity } from '../entity.js';
import { Enemy, stepSquash } from '../enemy.js';
import { tell, stepTell } from '../ai.js';
import { spawn, entities } from '../manager.js';
import { registerEntity, hasEntityType } from '../registry.js';
import { player } from '../player.js';
import { modelMesh } from '../../models/kit.js';

const S = () => TUNING.boss.serpent;
const DEG = Math.PI / 180;
export const SERPENT_NAME = 'Coilmaw';
export const SERPENT_TITLE = 'Warden of the Barrow';
export const SERPENT_HINT = 'Only the glowing tail gives way. Leave the rest alone!';

// ---------------------------------------------------------------- a body segment
class Segment extends Enemy {
  constructor(opts) {
    const s = S();
    super({ ...opts, crowned: false }, { hp: 1, r: s.segmentSize / 2, speed: 0, contactDamage: s.contact, drops: null, poses: { dull: M.serpentSegmentModel(false), glow: M.serpentSegmentModel(true) } });
    this.boss = true;
    this.head = opts.head;
    this.index = opts.index;
    this.countsForClear = false;
    this.glowing = false;
    this.pulseT = 0;
    this.sparkT = 0;
    this.spawned = true;
  }
  onAdd() {}
  think() {}
  // Only the glowing tail may be hurt; anything else is guarded (and punished).
  guards() {
    return !this.glowing;
  }
  onBlocked(hit) {
    this.head.punish(this, hit);
  }
  hurt(hit) {
    if (hit.swingId !== undefined) this.hitSwing = hit.swingId;
    this.squashT = TUNING.enemy.hitSquash.time;
    this.head.breakSegment(this, hit);
    return true;
  }
  // The tail's tell (fun audit: the rule has to read at a glance, not just live in the bestiary):
  // a bright pulse, on top of the flat emissive tint update() keeps painting over a hit's flash.
  setGlow(on) {
    this.glowing = on;
    this.mesh.setPose(on ? 'glow' : 'dull');
    this.pulseT = 0;
    this.sparkT = 0;
    this.mat.emissive.setHex(on ? S().tailPulseMax : 0x000000);
  }
  glowColor() {
    const s = S();
    const k = 0.5 + 0.5 * Math.sin(this.pulseT * s.tailPulseRate);
    return mixHex(s.tailPulseMin, s.tailPulseMax, k);
  }
  update(dt) {
    // the head places the segments; only contact, the flash and a hit's
    // squash-and-stretch run here
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.mat.emissive.setHex(this.flashT > 0 ? 0xffffff : this.glowing ? this.glowColor() : 0x000000);
    } else if (this.glowing) {
      const s = S();
      this.pulseT += dt;
      this.mat.emissive.setHex(this.glowColor());
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT += s.tailSparkEvery;
        sparks(this.x, GROUND_Y + 0.4, this.z, [0xffe680, 0xfff2b8], 3, { speed: 1.2, size: 0.05, up: 1.5, life: 0.35 });
      }
    }
    this.holder.scale.setScalar(1);
    stepSquash(this, dt);
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = this.yaw;
    if (Math.hypot(player.x - this.x, player.z - this.z) < this.r + player.r) this.touchHero();
  }
}
registerEntity('serpent-segment', (opts) => new Segment(opts));

// ---------------------------------------------------------------- the head
class Serpent extends Enemy {
  constructor(opts) {
    const s = S();
    super({ ...opts, crowned: false }, { hp: s.headHp, r: s.headSize / 2, speed: s.speed, contactDamage: s.contact, drops: null, poses: { shut: M.serpentHeadModel(0), open: M.serpentHeadModel(1) } });
    this.boss = true;
    this.dungeon = opts.dungeon ?? null;
    this.refight = !!opts.refight;
    this.heading = opts.heading ?? Math.PI / 2;
    this.curve = 1; // which way it bends
    this.curveT = 1.5;
    this.volleyT = s.volleyEvery;
    this.glowT = s.glowDelay;
    this.trail = [];
    this.segments = [];
    this.phase = 0;
    this.spawnT = 0;
    this.introDone = !!opts.skipIntro;
    this.brokenSwings = new Set(); // swingIds where a tail break already resolved this swing
    this.punishOrbs = new Map(); // swingId -> orbs a punish fired, undone if that same swing also broke the tail
    this.lungeT = s.lungeCooldown; // the telegraphed lunge: wind-up, then a fast straight dash
    this.lungeUntil = 0;
  }

  onAdd() {
    if (this.dungeon && getDungeon(this.dungeon) && bossDefeated(this.dungeon) && !this.refight) {
      this.remove();
      return;
    }
    const s = S();
    for (let i = 0; i < s.segments; i++) {
      const seg = spawn('serpent-segment', { x: this.x, z: this.z, head: this, index: i });
      this.segments.push(seg);
    }
    for (let i = 0; i < 400; i++) this.trail.push({ x: this.x - Math.cos(this.heading) * i * 0.05, z: this.z - Math.sin(this.heading) * i * 0.05 });
    this.placeSegments();
  }

  onRemove() {
    for (const seg of this.segments) seg.remove();
  }

  lost() {
    return S().segments - this.segments.length;
  }

  // The body left; its last segment is the tail.
  tail() {
    return this.segments[this.segments.length - 1] ?? null;
  }

  guards() {
    return this.segments.length > 0; // the head is only open once the body is gone
  }
  onBlocked(hit) {
    this.punish(this, hit);
  }

  // A hit on a part that isn't glowing: a ring of orbs from that part. A
  // correct thrust that also grazes a guarded neighbour is one swing, not
  // two rulings: if that same swingId breaks the tail (either order, since
  // segments overlap and one swing can land on more than one of them at
  // once), no punish from it stands (fun audit: 4 of 6 correct tail breaks
  // still fired 2-11 orbs). punishOrbs accumulates per swingId rather than
  // overwriting, since more than one guarded part can be hit in one swing.
  punish(part, hit) {
    if (hit.swingId !== undefined) {
      if (part.hitSwing === hit.swingId) return;
      part.hitSwing = hit.swingId;
      if (this.brokenSwings.has(hit.swingId)) return;
    }
    const s = S();
    const orbs = [];
    for (let i = 0; i < s.ringCount; i++) {
      const a = (i / s.ringCount) * Math.PI * 2;
      orbs.push(spawn('serpent-orb', { x: part.x + Math.sin(a) * part.r, z: part.z + Math.cos(a) * part.r, dir: { x: Math.sin(a), z: Math.cos(a) }, speed: s.ringSpeed, damage: s.ringDamage }));
    }
    if (hit.swingId !== undefined) this.punishOrbs.set(hit.swingId, [...(this.punishOrbs.get(hit.swingId) ?? []), ...orbs]);
    sfx.block();
  }

  breakSegment(seg, hit) {
    if (seg !== this.tail() || !seg.glowing) return;
    if (hit.swingId !== undefined) {
      this.brokenSwings.add(hit.swingId);
      const orbs = this.punishOrbs.get(hit.swingId);
      if (orbs) {
        for (const o of orbs) o.remove();
        this.punishOrbs.delete(hit.swingId);
      }
    }
    this.segments.pop();
    seg.remove();
    burst(seg.x, GROUND_Y + 0.5, seg.z, seg.colors, 30, { speed: 3.5, size: 0.12, up: 5, life: 1.0 });
    smoke(seg.x, GROUND_Y + 0.2, seg.z, 6);
    sfx.kill();
    if (random() < TUNING.boss.partHeart) spawn('heart', { x: seg.x, z: seg.z });
    emit('enemy-hit', { entity: this, hit, result: 'hit', damage: 0, part: seg.index });
    this.glowT = S().glowDelay;
    const s = S();
    this.speed = Math.min(s.speedMax, s.speed + s.speedPerLost * this.lost());
    const frac = this.segments.length / s.segments;
    const phase = TUNING.boss.phases.filter((p) => frac <= p).length;
    if (phase !== this.phase) {
      this.phase = phase;
      emit('boss-phase', { id: 'boss-serpent', phase });
    }
  }

  // Segments follow the head's trail, gap tiles apart.
  placeSegments() {
    const want = S().gap;
    let acc = 0;
    let k = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const target = want * (i + 1);
      while (k < this.trail.length - 1) {
        const a = this.trail[k];
        const b = this.trail[k + 1];
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        if (acc + d >= target) {
          const f = d ? (target - acc) / d : 0;
          const seg = this.segments[i];
          seg.x = a.x + (b.x - a.x) * f;
          seg.z = a.z + (b.z - a.z) * f;
          seg.yaw = Math.atan2(a.x - b.x, a.z - b.z);
          break;
        }
        acc += d;
        k++;
      }
    }
  }

  // Steer: bend steadily, turn in before the arena's walls.
  steer(dt) {
    const s = S();
    const r = currentScreen();
    this.curveT -= dt;
    if (this.curveT <= 0) {
      this.curveT = 1 + random() * 2;
      this.curve = random() < 0.5 ? -1 : 1;
    }
    let turn = this.curve * s.turnRate * DEG;
    if (r) {
      const m = s.wallMargin;
      const ax = this.x + Math.cos(this.heading) * m;
      const az = this.z + Math.sin(this.heading) * m;
      if (ax < r.x0 + 1 || ax > r.x1 - 1 || az < r.z0 + 1 || az > r.z1 - 1) {
        const cx = (r.x0 + r.x1) / 2;
        const cz = (r.z0 + r.z1) / 2;
        const want = Math.atan2(cz - this.z, cx - this.x);
        const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
        turn = Math.sign(diff) * s.turnRate * 2.5 * DEG;
      }
    }
    this.heading += turn * dt;
  }

  // Alone, the head is capped at speedMax (4.2 t/s: never outruns the hero's
  // 4.5) but still needs a real fight, so it telegraphs a lunge: a lungeTell
  // s wind-up (a readable shake, holding its line), then a fast lungeSpeed
  // straight dash for lungeTime s before it recovers to normal curving.
  moveStep(dt) {
    const s = S();
    const wasTelling = this.ai.pendingLunge;
    if (stepTell(this, dt)) return 0;
    if (wasTelling) {
      this.ai.pendingLunge = false;
      this.lungeUntil = s.lungeTime;
      return s.lungeSpeed * dt;
    }
    if (this.lungeUntil > 0) {
      this.lungeUntil -= dt;
      if (this.lungeUntil <= 0) this.lungeT = s.lungeCooldown; // recovers; cooldown restarts
      return s.lungeSpeed * dt;
    }
    this.steer(dt);
    this.lungeT -= dt;
    if (this.lungeT <= 0) {
      tell(this, s.lungeTell);
      this.ai.pendingLunge = true;
    }
    return this.speed * dt;
  }

  think(dt) {
    const s = S();
    if (!this.introDone) {
      this.introDone = true;
      startBossIntro(this);
    }
    const step = this.moveStep(dt);
    this.x += Math.cos(this.heading) * step;
    this.z += Math.sin(this.heading) * step;
    const r = currentScreen();
    if (r) {
      this.x = Math.min(r.x1 - 1 - this.r * 0.5, Math.max(r.x0 + 1 + this.r * 0.5, this.x));
      this.z = Math.min(r.z1 - 1 - this.r * 0.5, Math.max(r.z0 + 1 + this.r * 0.5, this.z));
    }
    this.yaw = Math.atan2(Math.cos(this.heading), Math.sin(this.heading));
    this.trail.unshift({ x: this.x, z: this.z });
    if (this.trail.length > 600) this.trail.length = 600;
    this.placeSegments();

    // the tail starts glowing glowDelay s after the last break
    const tail = this.tail();
    if (tail && !tail.glowing) {
      this.glowT -= dt;
      if (this.glowT <= 0) tail.setGlow(true);
    }

    // the forward fan
    this.volleyT -= dt;
    this.mesh.setPose(this.volleyT < 0.4 ? 'open' : 'shut');
    if (this.volleyT <= 0) {
      this.volleyT += s.volleyEvery;
      const n = s.volleyCount;
      for (let i = 0; i < n; i++) {
        const a = this.heading + (i - (n - 1) / 2) * s.volleySpread * DEG;
        const dir = { x: Math.cos(a), z: Math.sin(a) };
        spawn('serpent-shot', { x: this.x + dir.x * this.r, z: this.z + dir.z * this.r, dir, speed: s.volleySpeed, damage: s.volleyDamage, tier: s.volleyTier });
      }
      sfx.shoot();
    }
  }

  // Only reached once the body is gone (guards() gates it before this).
  // Unlike a normal boss part, the exposed head actually staggers: a real
  // punish for landing a hit on a real fight, not free follow-up damage
  // (fun audit: hits never staggered it, so a naive bot never got a window).
  hurt(hit) {
    const s = S();
    return super.hurt({ ...hit, tiles: s.headKnock, stun: s.headStagger, bossStagger: true });
  }

  die(hit = null) {
    const x = this.x;
    const z = this.z;
    super.die(hit);
    burst(x, GROUND_Y + 0.6, z, this.colors, 60, { speed: 4.5, size: 0.14, up: 6, life: 1.4 });
    let pay = { heartContainer: !this.refight, coins: TUNING.economy.bossPay[0] };
    if (this.dungeon && getDungeon(this.dungeon)) pay = defeatBoss(this.dungeon, { refight: this.refight });
    if (pay.heartContainer) {
      if (hasEntityType('heart-container')) spawn('heart-container', { x, z });
      else grant('heart-container', 1, { source: 'boss' });
    }
    // Reward pacing (fun audit item 5): most of bossPay now lives in D1's own chests
    // (world/areas/d1.js), reachable mid-dungeon; the arena keeps a smaller shower.
    const coins = Math.min(pay.coins, S().coinCap);
    if (coins > 0) dropCoins(x, z, coins);
  }
}
registerEntity('boss-serpent', (opts) => new Serpent(opts));

// ---------------------------------------------------------------- the intro
// 'boss-intro' (spec 6.6): the camera pushes in for bossIntro.in s with the
// name card and the companion's hint, then eases back for bossIntro.out s.
let intro = null;
function startBossIntro(boss) {
  if (state.mode !== 'play') return;
  intro = { boss, t: 0, stage: 0, back: cameraPreset() };
  pushMode('boss-intro');
}

registerMode('boss-intro', {
  enter() {
    const b = intro?.boss;
    emit('boss-intro', { id: 'boss-serpent', name: SERPENT_NAME, title: SERPENT_TITLE, dungeon: b?.dungeon ?? null, hint: SERPENT_HINT });
    showBanner(`${SERPENT_NAME}, ${SERPENT_TITLE}`);
    const C = TUNING.camera.bossIntro;
    startCameraTween(new THREE.Vector3(b?.x ?? player.x, 0, b?.z ?? player.z), C.in, { preset: 'boss-intro' });
  },
  update(dt) {
    const C = TUNING.camera.bossIntro;
    const k = stepCameraTween(dt);
    if (k < 1) return;
    if (intro.stage === 0) {
      intro.stage = 1;
      startCameraTween(new THREE.Vector3(player.x, 0, player.z), C.out, { preset: intro.back ?? 'boss' });
      return;
    }
    intro = null;
    popMode();
    // the fight's one rule, on screen, not just in the bestiary (fun audit: SERPENT_HINT used to
    // reach only there). toast() only shows in 'play', which popMode() has just switched back to.
    toast(SERPENT_HINT, 4.5);
  },
});

// ---------------------------------------------------------------- the tombstone
// Stands in the arena once the boss is beaten; strike it or press A at it
// for a re-fight (coins, no container).
class Tombstone extends Entity {
  constructor(opts) {
    super({ ...opts, r: 0.45 });
    this.kind = 'thing';
    this.solid = true;
    this.swordable = true;
    this.dungeon = opts.dungeon ?? null;
    this.object = modelMesh(M.tombstoneModel());
    this.object.position.set(this.x, GROUND_Y, this.z);
  }
  onAdd() {
    if (!this.dungeon || !getDungeon(this.dungeon) || !bossDefeated(this.dungeon)) this.remove();
  }
  canBeHit() {
    return !entities.some((e) => !e.removed && e.type === 'boss-serpent');
  }
  start() {
    if (!this.canBeHit()) return false;
    const r = currentScreen();
    const cx = r ? (r.x0 + r.x1) / 2 : this.x;
    const cz = r ? r.z0 + 3 : this.z - 4;
    smoke(this.x, GROUND_Y + 0.3, this.z, 10);
    spawn('boss-serpent', { x: cx, z: cz, dungeon: this.dungeon, refight: true });
    return true;
  }
  onSword() {
    return this.start();
  }
  onInteract() {
    return this.start();
  }
}
registerEntity('boss-tombstone', (opts) => new Tombstone(opts));

registerBestiary({ id: 'boss-serpent', name: SERPENT_NAME, hp: TUNING.boss.serpent.headHp, text: SERPENT_HINT, where: 'dungeon' });

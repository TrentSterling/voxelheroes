// Base class for people and other things the hero talks to: townsfolk, the
// smith, shopkeepers, a talking statue. An NPC is solid (the hero and enemies
// walk around it, not through it) and alive: it glances about, wanders near
// home if it is a wanderer, stops and watches the hero when he comes close,
// greets him with a bark or an emote bubble, flinches at a sword swung near it,
// and warms up to him over repeated conversations (game/npc-talk.js).
//
//   class Smith extends Npc {
//     constructor(opts) {
//       const rig = makeHero(getMaterial('character'), SMITH_COLOURS);
//       super(opts, { rig, name: 'Brannoc' });
//     }
//     async talk() { ... }
//   }
//   registerEntity('smith', (opts) => new Smith(opts));
//
// Second constructor argument (spawn-table fields win over it):
//   rig    a makeHero() rig: walks with its poses (or `model`, an Object3D that only bobs)
//   name   shown on the dialog box
//   lines  what the default talk() says the first time (a string or a list of pages)
//   wander tiles it strolls from home (0: stays at its post; townsfolk default 2)
//   personality  cheery | grumpy | gossip | dreamy | worker (default: from the name)
//   barks  { greet, idle, startled, ouch } lines in place of the personality's
//   r      collision radius (default 0.34)
//   yaw    facing before anyone talks to it (default 0: towards the camera)
// A generic one is registered as 'npc' (entities/npcs/npc.js).
import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import { lerpAngle } from '../core/math.js';
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { showDialog } from '../ui/dialog.js';
import { world } from '../world/world.js';
import { hash3 } from '../core/vox.js';
import { bark, befriend, chatLine, heartString, heartsOf, personalityOf, talksWith, giftableNow, giftChoices, giveGift, pendingHeartEvent, heartEventLines } from '../game/npc-talk.js';
import { addCoins, addHeartPiece } from '../game/vitals.js';
import { hour } from '../game/clock.js';
import { Bubble } from './npc-fx.js';
import { toast } from '../ui/toast.js';
import { Entity } from './entity.js';
import { player } from './player.js';

const NOTICE = 3.2; // tiles: he stops and watches the hero
const GREET = 2.4; // tiles: a greeting (once per approach)
const WALK = 1.3; // tiles per second
const PACE = { cheery: 1.35, grumpy: 0.7, gossip: 1.1, dreamy: 0.8, worker: 1.2 }; // times WALK
const live = new Set();

export class Npc extends Entity {
  constructor(opts = {}, def = {}) {
    super({ ...opts, r: opts.r ?? def.r ?? 0.34 });
    this.kind = 'npc';
    this.priority = 30;
    this.solid = true;
    this.name = opts.name ?? def.name ?? '';
    this.lines = opts.lines ?? def.lines ?? null;
    this.personality = opts.personality ?? def.personality ?? null;
    this.barks = opts.barks ?? def.barks ?? null;
    this.wander = opts.wander ?? def.wander ?? 0;
    this.yaw = opts.yaw ?? def.yaw ?? 0;
    this.home = { x: this.x, z: this.z, yaw: this.yaw };
    // the day: 'town' folk are out 7:00 to 21:30 and gather near the square's middle from 17:00;
    // 'post' keepers (shops, the smith, the inn) work 8:00 to 20:00; 'always' never leave
    this.schedule = opts.schedule ?? def.schedule ?? (this.wander > 0 ? 'town' : 'post');
    this.out = true;
    this.seed = Math.floor(hash3(Math.floor(this.x * 7), 3, Math.floor(this.z * 7), 11) * 1000);
    this.rs = null; // next()'s state
    this.idleT = (this.x * 1.7 + this.z * 2.3) % (Math.PI * 2); // idle phase, same on every visit
    this.holder = new THREE.Group();
    this.rig = def.rig ?? null;
    this.model = def.rig?.root ?? def.model ?? null;
    if (this.model) this.holder.add(this.model);
    this.bubble = new Bubble(this.holder, 1.55) // high enough to clear the head of a hero standing in front;
    // what it is doing: 'idle' | 'walk' | 'watch'; `t` counts down to the next decision
    this.mind = { mode: 'idle', t: 1.5 + this.next() * 3, target: null, glance: 0, greeted: false, watchT: 0, walkT: 0 };
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = this.yaw;
    this.object = this.holder;
    live.add(this);
  }

  // deterministic per-NPC random 0..1 (same on every visit, so play-tests repeat)
  next() {
    this.rs = ((this.rs ?? this.seed * 7919 + 17) * 1103515245 + 12345) & 0x7fffffff;
    return this.rs / 0x7fffffff;
  }

  remove() {
    live.delete(this);
    this.bubble.dispose();
    super.remove();
  }

  update(dt) {
    this.idleT += dt;
    const m = this.mind;
    const playing = state.mode === 'play';
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const near = Math.hypot(dx, dz);
    let moving = false;

    // the schedule: home time sends them indoors (walk to their door, then gone until morning)
    const slot = this.slotNow();
    if (slot === 'in') {
      if (this.out && playing) moving = this.headIn(dt);
      else if (this.out) this.hide();
      this.bubble.update(dt);
      this.holder.position.set(this.x, GROUND_Y, this.z);
      this.holder.rotation.y = lerpAngle(this.holder.rotation.y, this.yaw, Math.min(1, dt * 10));
      if (this.rig) this.rig.setPose(moving ? (Math.floor((m.walkT += dt / 0.14)) % 2 ? 'walk1' : 'walk2') : 'stand');
      return;
    }
    if (!this.out) this.show();

    if (playing) {
      m.t -= dt;
      if (m.replyT > 0 && (m.replyT -= dt) <= 0) {
        if (this.next() < 0.5) this.say('idle');
        else this.bubble.emote(this.next() < 0.5 ? '♪' : '…');
      }
      if (near < NOTICE) {
        // the hero is close: stop and watch him, greet him once per approach
        if (m.mode !== 'watch') m.mode = 'watch';
        this.yaw = Math.atan2(dx, dz);
        if (!m.greeted && near < GREET) {
          m.greeted = true;
          const hearts = heartsOf(this.name);
          if (hearts >= 3 && this.next() < 0.5) this.bubble.emote('♥');
          else if (this.next() < 0.35) this.bubble.emote(talksWith(this.name) ? '♪' : '!');
          else this.say('greet');
        }
      } else {
        if (m.mode === 'watch') {
          m.mode = 'idle';
          m.t = 0.6 + this.next() * 1.5;
        }
        if (near > NOTICE + 1.5) m.greeted = false;
        if (m.mode === 'walk') moving = this.stepWalk(dt);
        else if (m.t <= 0) this.decide();
        else if (m.glance > 0) {
          m.glance -= dt;
          if (m.glance <= 0) this.yaw = this.home.yaw;
        }
      }
    }

    // body: walk cycle while moving, a breathing bob when still
    if (this.rig) {
      if (moving) {
        m.walkT += dt / 0.14;
        const cel = Math.floor(m.walkT) % 4;
        this.rig.setPose(cel === 0 ? 'walk1' : cel === 2 ? 'walk2' : 'stand');
      } else {
        m.walkT = 0;
        this.rig.setPose('stand');
      }
    }
    if (this.model) this.model.position.y = moving ? 0 : Math.abs(Math.sin(this.idleT * 1.6)) * 0.02;
    this.bubble.update(dt);
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = lerpAngle(this.holder.rotation.y, this.yaw, Math.min(1, dt * 10));
  }

  slotNow() {
    if (this.schedule === 'always') return 'day';
    const h = hour();
    if (this.schedule === 'post') return h >= 8 && h < 20 ? 'day' : 'in';
    return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 21.5 ? 'eve' : 'in';
  }

  // Where it idles now: home by day, the gathering spot in the evening.
  anchor() {
    if (this.slotNow() !== 'eve') return this.home;
    if (!this.eve) {
      const at = world.locate(Math.floor(this.home.x), Math.floor(this.home.z));
      const s = at?.screen;
      const cx = s ? s.x0 + s.w / 2 : this.home.x;
      const cz = s ? s.z0 + s.h / 2 + 1 : this.home.z;
      const k = 0.55 + this.next() * 0.2;
      const ex = this.home.x + (cx - this.home.x) * k + (this.next() - 0.5) * 1.5;
      const ez = this.home.z + (cz - this.home.z) * k + (this.next() - 0.5) * 1.5;
      this.eve = world.blocked(ex, ez, this.r, this) ? this.home : { x: ex, z: ez };
    }
    return this.eve;
  }

  // The door it goes home through: the nearest door tile ('h') on its screen, standing in front of it.
  door() {
    if (this.doorAt !== undefined) return this.doorAt;
    const at = world.locate(Math.floor(this.home.x), Math.floor(this.home.z));
    let best = null;
    if (at) {
      const s = at.screen;
      for (let z = 0; z < s.h; z++) for (let x = 0; x < s.w; x++) {
        if (s.tiles[z][x] !== 'h') continue;
        // the side of the door that is open ground (houses in a square's south row open north)
        const south = !world.isSolid(s.x0 + x, s.z0 + z + 1);
        const p = { x: s.x0 + x + 0.5, z: s.z0 + z + (south ? 1.35 : -0.35) };
        const d = Math.hypot(p.x - this.home.x, p.z - this.home.z);
        if (!best || d < best.d) best = { ...p, d };
      }
    }
    return (this.doorAt = best);
  }

  headIn(dt) {
    const m = this.mind;
    const d = this.door();
    if (m.mode !== 'in') {
      m.mode = 'in';
      m.inT = 0;
      if (this.next() < 0.5) this.say('idle');
    }
    m.inT += dt;
    if (!d || m.inT > 12) return this.hide(), false;
    const dx = d.x - this.x;
    const dz = d.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) return this.hide(), false;
    const step = Math.min(dist, WALK * dt);
    const nx = this.x + (dx / dist) * step;
    const nz = this.z + (dz / dist) * step;
    if (world.blocked(nx, nz, this.r, this)) {
      // round an obstacle: try a sidestep
      const sx = this.x + (dz / dist) * step;
      const sz = this.z - (dx / dist) * step;
      if (world.blocked(sx, sz, this.r, this)) return false;
      this.x = sx;
      this.z = sz;
    } else {
      this.x = nx;
      this.z = nz;
    }
    this.yaw = Math.atan2(dx, dz);
    return true;
  }

  hide() {
    this.out = false;
    this.solid = false;
    this.holder.visible = false;
    this.bubble.e = this.bubble.b = null;
  }

  show() {
    this.out = true;
    this.solid = true;
    this.holder.visible = true;
    this.x = this.home.x;
    this.z = this.home.z;
    this.eve = null;
    this.mind.mode = 'idle';
    this.mind.t = 0.5 + this.next();
    this.bubble.emote(this.next() < 0.5 ? '♪' : '…', 1.2);
  }

  // Idle choices: stroll somewhere near home (the gathering spot in the evening), glance around,
  // hum or mutter.
  decide() {
    const m = this.mind;
    const r = this.next();
    m.t = 1.8 + this.next() * 3.5;
    const A = this.anchor();
    const far = Math.hypot(A.x - this.x, A.z - this.z) > this.wander + 1;
    if (this.wander > 0 && (r < 0.5 || far)) {
      const a = this.next() * Math.PI * 2;
      const d = far ? this.next() * 0.8 : 0.8 + this.next() * this.wander;
      const tx = A.x + Math.sin(a) * d;
      const tz = A.z + Math.cos(a) * d;
      if (!world.blocked(tx, tz, this.r, this)) {
        m.mode = 'walk';
        m.target = { x: tx, z: tz };
        return;
      }
    }
    // a neighbour close by: turn to each other and trade a line
    const pal = [...live].find((o) => o !== this && !o.removed && o.out && o.mind.mode === 'idle' && Math.hypot(o.x - this.x, o.z - this.z) < 2.6);
    if (pal && r < 0.8) {
      this.face(pal.x, pal.z);
      pal.face(this.x, this.z);
      this.mind.glance = pal.mind.glance = 2.5;
      pal.mind.t = Math.max(pal.mind.t, 2.5);
      this.say('idle');
      pal.mind.replyT = 0.9; // the answer comes a beat later (update)
      return;
    }
    if (r < 0.75) {
      // a look to one side
      this.yaw = this.home.yaw + (this.next() - 0.5) * 2.2;
      m.glance = 0.8 + this.next();
    } else if (r < 0.88) {
      if (this.next() < 0.5) this.bubble.emote(this.next() < 0.5 ? '♪' : '…');
      else this.say('idle');
    }
  }

  stepWalk(dt) {
    const m = this.mind;
    const t = m.target;
    const dx = t.x - this.x;
    const dz = t.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05 || m.t < -4) {
      m.mode = 'idle';
      return false;
    }
    const step = Math.min(d, WALK * (PACE[personalityOf(this)] ?? 1) * dt);
    const nx = this.x + (dx / d) * step;
    const nz = this.z + (dz / d) * step;
    const blockedByHero = Math.hypot(player.x - nx, player.z - nz) < this.r + 0.45;
    if (blockedByHero || world.blocked(nx, nz, this.r, this) || this.crowded(nx, nz)) {
      m.mode = 'idle';
      m.t = 0.8 + this.next();
      return false;
    }
    this.x = nx;
    this.z = nz;
    this.yaw = Math.atan2(dx, dz);
    return true;
  }

  crowded(x, z) {
    for (const o of live) if (o !== this && !o.removed && o.out && Math.hypot(o.x - x, o.z - z) < this.r + o.r) return true;
    return false;
  }

  say(kind) {
    if (this.bubble.busy) return;
    const line = bark(this, kind);
    if (line) this.bubble.say(line);
  }

  // Turn towards (x, z) at once: the game stops while a dialog box is open.
  face(x, z) {
    this.yaw = Math.atan2(x - this.x, z - this.z);
    this.holder.rotation.y = this.yaw;
  }

  // A pressed while the hero faces it (systems/interact.js).
  onInteract(player) {
    if (!this.out) return false; // home for the night
    this.face(player.x, player.z);
    this.mind.mode = 'watch';
    this.mind.greeted = true;
    const r = this.talk(player);
    // shops, the king and other custom talks count as a conversation too
    if (this.talk !== Npc.prototype.talk && this.name) {
      Promise.resolve(r).then(() => {
        const f = befriend(this.name);
        if (f.up) this.heartUp();
      });
    }
    return true;
  }

  // What the NPC does when spoken to. Default: `lines` the first time, then chat that warms up
  // with friendship (a point per conversation). Override it for shops, quests and choices.
  async talk(_player) {
    const first = talksWith(this.name) === 0;
    if (first && !this.lines && !this.name) return undefined;
    const speaker = () => (this.name ? `${this.name}${heartString(heartsOf(this.name))}` : undefined);
    const opts = () => (speaker() ? { speaker: speaker() } : {});
    // a heart event: a scene and a present, once at 2 and at 4 hearts
    const ev = !first && pendingHeartEvent(this);
    if (ev) {
      await showDialog(heartEventLines(this, ev), opts());
      if (ev === 2) {
        addCoins(20, 'friend');
        toast(`${this.name} gave you 20 coins`, 2.2);
      } else {
        addHeartPiece(1);
        toast(`${this.name} gave you a piece of heart`, 2.4);
      }
      this.bubble.emote('♥', 2);
      return;
    }
    const pages = first && this.lines ? this.lines : [chatLine(this)];
    const canGift = !first && giftableNow(this);
    const said = showDialog(canGift ? [...pages, 'Anything else?'] : pages, canGift ? { ...opts(), choices: ['Give a gift', 'Goodbye'] } : opts());
    const f = befriend(this.name);
    const choice = await said;
    if (f.up) this.heartUp();
    if (canGift && choice === 0) {
      const list = giftChoices();
      const pickI = await showDialog('What will you give?', { ...opts(), choices: [...list.map(([, g]) => g.label), 'Never mind'] });
      if (pickI == null || pickI >= list.length) return;
      const r = giveGift(this, list[pickI][0]);
      if (!r) return;
      this.bubble.emote(r.taste === 'love' ? '♥' : r.taste === 'dislike' ? '…' : '♪', 1.8);
      await showDialog(r.line, opts());
      if (r.up) this.heartUp();
    }
  }

  heartUp() {
    this.bubble.emote('♥', 1.8);
    toast(`${this.name} likes you more${heartString(heartsOf(this.name))}`, 2.2);
  }

  // A sword swung near it: a flinch, and an 'ow' for one right in front of the blade.
  reactToSwing(p) {
    const dx = this.x - p.x;
    const dz = this.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.6) return;
    const ahead = Math.cos(Math.atan2(dx, dz) - p.yaw) > 0.7 && d < 2;
    this.face(p.x, p.z);
    this.mind.mode = 'watch';
    this.bubble.emote(ahead ? '✦' : '!', 1);
    this.say(ahead ? 'ouch' : 'startled');
    if (ahead) befriend(this.name, -1);
  }
}

on('sword-swing', ({ player: p }) => {
  if (!p) return;
  for (const n of live) if (!n.removed && n.out) n.reactToSwing(p);
});

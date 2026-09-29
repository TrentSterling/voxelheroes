// The charged spin (systems/sword.js startChargedSpin, entities/player.js): holding the sword
// button past the thrust charges it (blade out, half-speed walk, facing kept); held CHARGE_TIME it
// is ready, and letting go spins a full turn that hits every foe in reach around the hero, once
// each. Let go early and nothing spins.
export const description = 'Charged spin: hold to charge (slow walk, blade out), release when ready for a 360 that hits all around; an early release does nothing.';

export default async function (t) {
  await t.press('Enter');
  // New games start unarmed now (the king arms the hero); this scenario swings from the start.
  await t.eval(() => {
    const h = window.__voxelHeroes;
    if (!h.state.swords.owned.includes('blade-start')) h.state.swords.owned.push('blade-start');
    h.state.swords.equipped = 'blade-start';
    h.state.gear.shield = Math.max(1, h.state.gear.shield ?? 0);
  });
  await t.step(1.1);
  await t.teleport('Crossroads', 8, 5.5);
  await t.step(0.2);

  const r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    for (const e of h.entities) if (e.kind === 'enemy') e.remove();
    h.setHp(h.state.maxHp);
    const ring = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const e = h.spawn('slime', 8 + Math.sin(a) * 1.6, 5.5 + Math.cos(a) * 1.6);
      e.spawned = true;
      e.hp = e.maxHp = 999;
      e.hits = 0;
      e.update = () => {}; // hold still
      const hurt = e.hurt.bind(e);
      e.hurt = (hit) => { e.hits++; return hurt({ ...hit, damage: 0, knockback: 0, stun: 0 }); };
      ring.push(e);
    }
    const out = {};
    // an early release: no spin
    h.input.down('sword');
    for (let i = 0; i < 30; i++) await h.tick();
    out.chargingEarly = !!h.player.charge;
    h.input.up('sword');
    await h.tick();
    out.earlySpin = !!h.player.thrust?.auto;
    for (let i = 0; i < 30; i++) await h.tick();
    // a full charge: slow walk while charging, then the spin
    for (const e of ring) e.hits = 0;
    h.input.down('sword');
    for (let i = 0; i < 25; i++) await h.tick(); // the thrust, then the charge starts
    const x0 = h.player.x;
    h.input.setStick(1, 0);
    for (let i = 0; i < 30; i++) await h.tick();
    out.chargeSpeed = +((h.player.x - x0) / 0.5).toFixed(2);
    h.input.setStick(0, 0);
    for (let i = 0; i < 40; i++) await h.tick();
    out.ready = !!h.player.charge?.ready;
    // back to the ring's centre, keeping the charge
    h.player.x = h.screen().x0 + 8;
    h.player.z = h.screen().z0 + 5.5;
    for (const e of ring) e.hits = 0; // (the opening thrust may have hit the one in front)
    h.input.up('sword');
    await h.tick();
    out.spinning = !!h.player.thrust?.auto;
    for (let i = 0; i < 40; i++) await h.tick();
    out.hits = ring.map((e) => e.hits);
    out.walkSpeed = h.game.tuning.TUNING.hero.walk;
    for (const e of ring) e.remove();
    return out;
  });
  t.expect(r.chargingEarly && !r.earlySpin, 'holding past the thrust starts a charge; letting go early does not spin');
  t.expect(r.chargeSpeed > 0.3 * r.walkSpeed && r.chargeSpeed < 0.6 * r.walkSpeed, `he walks at half speed while charging (${r.chargeSpeed} t/s)`);
  t.expect(r.ready, 'held long enough, the charge is ready');
  t.expect(r.spinning, 'letting go when ready spins');
  t.expect(r.hits.every((n) => n === 1), `the spin hits every foe around him once (${r.hits.join(',')})`);
  await t.shot('combat-01-spin');
}

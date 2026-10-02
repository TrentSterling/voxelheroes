// Economy (gameplay spec 10; fun audit: "coins buy nothing, one sword, no
// upgrades, 18 coins from 42 kills"): the smith sells real levels on the
// Squire Blade, a second findable sword is registered, and foe kills pay
// roughly triple in coins. See src/swords/blade-start.js, blade-warden.js,
// src/tuning/economy.js and src/systems/drops.js.
export const description = 'Smith levels grow the Squire Blade, the Warden’s Blade is registered and equippable, and all nine combat screens must clear. Actual drop tables are sampled separately from stochastic route income; native collected coins must match pickup events. Native fights allow explicit helper healing, periodic loot collection and walking recovery; every outcome is recorded.';

// Same 9 combat screens scripts/fun/audit.mjs uses to measure kills and drops.
const COMBAT = ['West Pasture', 'East Pasture', 'Buzzing Heath', 'Stump Wood', 'Leaper Hollow', 'Barrow Crossing', 'Barrow Road', 'Archer Ridge', 'Barrow Meadow'];

export default async function (t) {
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ name: 'Bo', class: 'balanced', prologue: true }));
  await t.step(1.2);

  // ---------------------------------------------------------------- smith
  const smith = await t.eval(() => {
    const h = window.__voxelHeroes;
    const S = h.game.swords;
    if (!h.state.swords.owned.includes('blade-start')) h.give('blade-start');
    S.equipSword('blade-start');
    const sold = S.SWORD_STATS.filter((k) => S.levelPrice('blade-start', k) !== null);
    const beforeFull = S.bladeSize(S.bladeStats({ id: 'blade-start', full: true }));
    const beforeSmall = S.bladeSize(S.bladeStats({ id: 'blade-start', full: false }));
    h.give('coins', 2000);
    const buy = sold.includes('length') ? S.buyLevel('blade-start', 'length') : { ok: false, reason: 'not-sold' };
    const coinsAfter = h.state.coins;
    const afterFull = S.bladeSize(S.bladeStats({ id: 'blade-start', full: true }));
    const afterSmall = S.bladeSize(S.bladeStats({ id: 'blade-start', full: false }));
    return { sold, buy, coinsAfter, beforeLength: beforeFull.length, afterLength: afterFull.length, beforeSmallLength: beforeSmall.length, afterSmallLength: afterSmall.length };
  });
  t.expect(smith.sold.length >= 3, `the smith sells at least 3 stats on the Squire Blade (sells: ${smith.sold.join(', ') || 'none'})`);
  t.expect(smith.buy.ok, `buying a length level succeeds (${JSON.stringify(smith.buy)})`);
  t.expect(smith.afterLength > smith.beforeLength, `bladeSize().length grows after the level (${smith.beforeLength} -> ${smith.afterLength})`);
  // fun audit: a bought level changed nothing below full life; the small thrusting blade must
  // still lengthen, not just the full-life one.
  t.expect(smith.afterSmallLength > smith.beforeSmallLength, `a length level lengthens the blade below full life too (${smith.beforeSmallLength} -> ${smith.afterSmallLength})`);
  t.expect(smith.coinsAfter === 2000 - smith.buy.price, `coins were spent on the level (2000 -> ${smith.coinsAfter}, price ${smith.buy.price})`);

  // ---------------------------------------------------------------- Warden's Blade
  const warden = await t.eval(() => {
    const h = window.__voxelHeroes;
    const S = h.game.swords;
    const def = S.getSword('blade-warden');
    if (!def) return { found: false };
    h.give('blade-warden');
    const equipped = S.equipSword('blade-warden');
    return { found: true, owned: S.hasSword('blade-warden'), equipped, length: def.base.length, startLength: S.getSword('blade-start').base.length };
  });
  t.expect(warden.found, 'blade-warden is registered');
  t.expect(warden.owned && warden.equipped, 'blade-warden can be owned and equipped');
  t.expect(warden.length > warden.startLength, `the Warden's Blade reaches further than the Squire Blade (${warden.length} vs ${warden.startLength})`);
  await t.shot('economy-01-swords');

  // back to the Squire Blade for the combat run below (the drop tables do
  // not care which blade lands the kill, but this keeps the run honest for
  // whichever sword a fresh save actually carries)
  await t.eval(() => window.__voxelHeroes.game.swords.equipSword('blade-start'));

  // ---------------------------------------------------------------- 9-screen combat run
  await t.eval(() => {
    const h = window.__voxelHeroes;
    window.__EA = { kills: 0, paid: 0, coins: 0 };
    h.events.on('pickup', ({type}) => { const value={'coin-1':1,'coin-10':10,'coin-100':100,gem:1,gem5:5}[type]??0; window.__EA.paid+=value; if(value)window.__EA.coins++; });
    h.events.on('enemy-killed', () => window.__EA.kills++);
  });
  const coins0 = (await t.state()).gems;
  for (const name of COMBAT) {
    await t.eval(() => {
      const h = window.__voxelHeroes;
      if (!h.state.swords.owned.includes('blade-start')) h.give('blade-start');
      h.game.swords.equipSword('blade-start');
      h.state.gear.shield = Math.max(1, h.state.gear.shield ?? 0);
      h.setHp(h.state.maxHp);
    });
    await t.teleport(name, 8, 8);
    await t.step(1.6);
    // This route already bought a length level. Fight at the blade's actual
    // current-life reach, rather than demanding contact distance across rocks.
    let fight;
    for(let attempt=0;attempt<6;attempt++) {
      const reach=await t.eval(()=>{const h=window.__voxelHeroes,s=h.game.swords;return Math.max(1.15,s.bladeSize(s.bladeStats({full:h.state.hp>=h.state.maxHp})).reach-.15);});
      fight=await t.fight({ seconds: 20, heal: 3, guard: true, reach, soft: true });
      t.note(`${name}, fight segment ${attempt+1}: ${JSON.stringify(fight)}`);
      // Drops expire after nine seconds. Gather still-live coins between
      // short bouts rather than silently losing everything during a long fight.
      const pending=await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.entities.filter(e=>!e.removed&&e.kind==='pickup'&&e.type.startsWith('coin-')).map(e=>[e.x-s.x0,e.z-s.z0]);});
      for(const[x,z]of pending) {
        await t.setHp((await t.state()).maxHp); // explicit economy-only healing
        const walk=await t.walkTo(x,z,{soft:true,timeout:4});
        if(!walk.ok)t.note(`${name}: remaining coin at ${x.toFixed(2)},${z.toFixed(2)}: ${walk.reason}`);
      }
      if(fight.ok||fight.reason!=='timeout')break;
      // A chaser can pin a naive turn-and-swing bot against a tree. Reposition
      // through a real reachable route. No actor removal, position writes or
      // direct damage are used to recover this combat helper.
      // Swing toward the remaining foe before walking. Native interaction can
      // lift/throw a pot sealing an alcove, and a full-life blade can cut it.
      const direction=await t.eval(()=>{const h=window.__voxelHeroes,p=h.player,e=h.entities.filter(e=>e.kind==='enemy').sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];return e?[e.x-p.x,e.z-p.z]:null;});
      if(direction){const d=Math.hypot(...direction)||1;await t.stick(direction[0]/d,direction[1]/d,1/60);await t.tap('sword');await t.step(.4);if(await t.eval(()=>!!window.__voxelHeroes.player.carrying)){await t.tap('sword');await t.step(.4);}}
      const target=await t.eval(()=>{
        const h=window.__voxelHeroes,s=h.screen(),p=h.player,b=window.__vhBot;
        const lx=p.x-s.x0,lz=p.z-s.z0,start=[Math.floor(lx),Math.floor(lz)];
        const foes=h.entities.filter(e=>e.kind==='enemy');if(!foes.length)return null;
        const near=Math.min(...foes.map(e=>Math.hypot(p.x-e.x,p.z-e.z)));
        let best=null,score=-Infinity;
        for(let z=1;z<s.h-1;z++)for(let x=1;x<s.w-1;x++) {
          const dx=x+.5-lx,dz=z+.5-lz,d=Math.hypot(dx,dz);
          if(d<1.5||d>4||!b.walkable(x,z,false))continue;
          const path=b.bfs(start,(a,c)=>a===x&&c===z);
          if(!path||path.length>7)continue;
          const distance=Math.min(...foes.map(e=>Math.hypot(s.x0+x+.5-e.x,s.z0+z+.5-e.z)));
          const value=(near>2.5?-distance:distance)-path.length*.15;
          if(value>score){score=value;best=[x+.5,z+.5];}
        }
        return best;
      });
      if(target){
        await t.setHp((await t.state()).maxHp);
        const walk=await t.walkTo(...target,{soft:true,timeout:5});
        t.note(`${name}: native walking recovery ${JSON.stringify({target,...walk})}`);
      }
    }
    t.expect(fight.ok&&fight.left===0, `${name}: the economy route actually clears the encounter (${fight.reason??'clear'})`);
  }
  const kills = await t.eval(() => window.__EA.kills);
  const after = await t.state();
  const gained = after.gems - coins0;
  t.note(`kills ${kills}, coins gained ${gained}`);
  t.expect(kills >= 10, `the run kills a reasonable number of foes (${kills})`);
  const ledger=await t.eval(()=>window.__EA);
  t.expect(gained>0&&ledger.coins>0, `native combat yields collected coins (${gained} from ${ledger.coins} pickups)`);
  t.expect(gained===ledger.paid, `collected coin events match the actual wallet gain (${gained} === ${ledger.paid})`);

  // A fixed minimum for one random route is not a drop-rate contract: a
  // completed 32-kill run paid 44 legitimately. Sample the real registered
  // tables at a disclosed fixed seed instead; never replace their odds.
  // Synthetic sample pickups are removed immediately and do not pay the hero.
  const sampled=await t.eval(()=>{
    const h=window.__voxelHeroes,s=h.screen();h.seed(0xec010001);
    const samples=4096,values={'coin-1':1,'coin-10':10,'coin-100':100};
    return ['pack-a','pack-b'].map(table=>{
      let paid=0;const counts={};
      for(let i=0;i<samples;i++){
        const prior=new Set(h.entities);
        const type=h.api.rollDrop(table,s.x0+8.5,s.z0+8.5);
        counts[type??'none']=(counts[type??'none']??0)+1;
        paid+=values[type]??0;
        for(const e of h.entities)if(!prior.has(e))e.remove();
      }
      return{table,samples,paid,mean:paid/samples,counts};
    });
  });
  t.note(`Actual drop-table samples: ${JSON.stringify(sampled)}`);
  t.expect(sampled[0].mean>=2&&sampled[0].mean<=3, `pack-a retains improved ordinary-foe income (${sampled[0].mean.toFixed(3)} coins per roll)`);
  t.expect(sampled[1].mean>=1.3&&sampled[1].mean<=2, `pack-b pays real archer income (${sampled[1].mean.toFixed(3)} coins per roll)`);
}

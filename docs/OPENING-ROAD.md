# From the town bell to the first key

The unarmed route from Mossbrook to King Aldric is safe. Castle Road and the
royal courtyard no longer roll field enemies, and the king stays beside the
four-hour mosaic. Morning errands and conversation can finish without an
unarmed hero taking damage. Nearby pastures retain their encounters.

Four original paving tiles give the approach distinct materials: riverstone
cobbles in Mossbrook Lane, pale limestone on Castle Road, a burgundy runner
with brass borders, and the four-hour mosaic under the king. They are ordinary
walkable ground and retain pushable-floor behavior.

The Next objective describes the current leg of the route. It directs players
south to the audience, north home, to Wyll for Sprint Boots, west to the
crossing, then south to the barrow. Pinned quests retain their own directions.
The king's existing story paragraphs and recorded voice clips are unchanged.

The three opening combat screens use authored pairs instead of several random
spawn groups: a blob and hopper on Barrow Road, a bow and blob at the crossing,
and a stump and blob at the Old Barrow. These foes are not crowned. The first
bow commits to a 0.8-second draw and fires tier-one arrows that the starter
shield can block. Other bows retain their original tier-two arrows and draw
time. Sword damage and zero-damage boomerang stuns cancel a loaded draw; a
recovered bow must aim and draw again.

A reusable stone spring stands west of the barrow path. A offers Drink spring.
Living approach guards prevent drinking, with readable feedback. Once clear,
the action refills only the interacting player's hearts up to their maximum.
It does not spend coins or award permanent progress. A co-op guest can drink
without owning the room; another friend's hearts remain personal.

The king now grants the shield through the shared grant system. Its quiet
presentation leaves the sword visible during his follow-up. Any first sword
grant equips an unarmed hero, including an independently exploring friend.
Later sword rewards preserve an already equipped weapon.

## Verification

`opening` begins at the actual title, walks to the king, advances his native
conversation, waits safely in the courtyard, walks home, and saves/reloads.
`first-road` continues to Wyll, earns boots through dialogue, uses native dash
and guard braking, walks west and south, defeats all six road foes without test
healing or invulnerability, drinks, enters the dungeon and earns its first
small key through native combat and pickup. The route does not teleport, grant
gear, remove foes, directly damage actors or edit health. The walking helper
settles positions within two movement steps of its exact final destination;
it never jumps between rooms or through obstacles.

`road-bow` isolates native drawing, projectile collisions, shield tiers and
sword/boomerang interruption in the arena. Actor placement, starting cooldown,
equipment, clear memory and health are explicit fixtures. A recovery placement
keeps the hero aligned with the wandering bow without changing its timers.

`scripts/opening-coop-test.mjs` connects muted Chromium and Firefox through
real local Trystero RTC. The host walks to the king while the guest stays in
town, receives the actual shared grants and uses sword and guard. Later room
and health fixtures isolate spring ownership and personal healing; the host
defeats its guards through native sword input. Friends stand on opposite sides
of the spring. Host departure preserves the clear.

`scripts/opening-touch-test.mjs` uses actual touch A and guard at 320x568 and
568x320, normal and large text. It checks contextual routes, guarded/restored
spring feedback, full native canvas text bounds and overlapping text runs.
Placement, gear, starting health and guard defeat are disclosed fixtures.

The gauntlet includes these routes in its critical cases and records both new
co-op/touch drivers. Resuming `first-road` also checks its imported `opening`
scenario hash. Guarding combat helpers retain a route to a stationary foe;
replanning every 0.3 seconds previously sent the slow hero back to the current
tile center before it could advance.

The economy route requires all nine fights to finish instead of ignoring soft
failures. It uses the bought blade's actual current-life reach and held guard,
with explicitly permitted helper healing. Short fight segments collect live coin
drops and use reachable native walking to escape a chaser pinning the helper
against trees. Recovery swipes can lift/throw an obstructing pot through normal
interaction; distant foes use the closest reachable approach. Every screen must clear. Collected pickup events must match the
wallet delta. A completed 32-kill route legitimately paid only 44 coins; the
old 50-coin single-run assertion mixed luck with correctness. Separate fixed-seed
4,096-roll samples of each real pack test income without changing drop odds;
synthetic sample pickups are removed and never pay the hero.
Long runs verify game and captured test hashes again at completion. Offline
runs also hash the HTML before and after. Static audio policy always runs
again, including on resume, so newly added launch sites cannot escape it.

Every browser test mutes output and disables NPC speech. This coverage measures
local RTC, not public signaling or connectivity between separate networks.

```powershell
node scripts/gauntlet.mjs --cases=first-road,road-bow,hero,reward-shield,town-chests,pots,foes,goals,economy,world-audit,guidance,d1,barrow-echo,campaign-story,adventure,contracts-m2 --engines=chromium,firefox --seeds=1,17,982451653 --scenarios-only --out=playtest-out/new-opening-run
node scripts/opening-coop-test.mjs --out=playtest-out/new-opening-coop
node scripts/opening-touch-test.mjs --out=playtest-out/new-opening-touch
```

Use fresh output folders for a subsequent run to preserve earlier receipts.

## Opening checkpoint receipts

The focused matrix runs sixteen scenarios with three seeds in Chromium and
Firefox: 96 browser cases plus the static silent-launch policy, 97 passed and
zero failed, with 9,319 assertions. Passing results are reused only for identical
game source and unchanged executed scenarios/helpers; changed economy cases
ran again. Its report is `playtest-out/opening-verified-browsers-20261001/result.json`.
The completed portable HTML passes four Firefox cases plus its audio policy
(186 assertions). Local mixed-browser RTC adds 12 checks; four touch size/text
combinations add 60 checks. Earlier failures remain in their original folders.

The native offline retakes, completed artifact, local RTC and layout receipts
all fingerprint the same game source. `scripts/build-opening-review.mjs` checks
those fingerprints and the source packet before producing the fifteen-slide
image-only `playtest-out/opening-review/static.html`. Recorded voices are
verified without listening. This checkpoint covers the opening and regressions;
public signaling, separate-network ICE, further campaign encounter redesign
and the rest of the art pass remain ongoing.

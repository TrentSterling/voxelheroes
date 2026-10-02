# Town placement and future vaults

The reported town resident was Old Wick in Mossbrook Lane, directly south of
the starting square. His authored position used the same tile as a clay pot.
His home now occupies the clear tile immediately west of that pot. The pot
remains available for lifting and throwing with the action button.

NPC creation, waking and morning placement check the full body against the
tile collision. A blocked home falls back to a nearby safe floor. Regrowing
pots, bushes and returning statues skip occupied footprints, including NPCs
in neighbouring streamed buckets, the hero, friends and grounded enemies.
Unoccupied props still return on later visits. The world audit now checks
authored NPC homes throughout the game, including the original town.

All base chest types now offer **Open chest** on the action button (J/Z or
touch A). Walking into them still works. The action invokes the current
tile's push hook through the existing owner route, preserving story gates
and authoritative party rewards. Locked future vaults explain the prerequisite
to the interacting player, including guests.

Vault feedback uses short location-and-action messages, such as
**First Bloom: fix signal**. The complete message fits small portrait and
landscape screens at large text size. On short touch screens, contextual
action labels yield while feedback is visible; the touch buttons remain usable.

| Future vault | Requirement | Reward |
| --- | --- | --- |
| Dawn Seed, northern Silent Year garden | Restore the First Bloom water engine | One permanent heart |
| Archive of Voices, east of the Copperwalk | Tune the past workshop valves and defeat the archive sentries | Two permanent magic gems |
| Last Platform, south of the Copperwalk | Repair the past station signal and defeat the Waiting Bell Courier | Departure Tag |
| Southeastern memorial vault | Relight the Brineglass shore beacon | One permanent magic gem |

The same `chestLock(ctx)` condition explains a lock locally and checks it
again on the owner before granting anything. Opened lids and permanent gains
survive saves and revisits. Repeated action or push claims give no extra reward.

`town-chests` reproduces Old Wick's interaction, physical pot lifting/throwing,
day/night placement, save/revisit, occupied regrowth on the stage and in a
neighbouring bucket, and every future vault's locked/available action input.
Its prerequisite flags, time, positions, invulnerability and isolated sentry
removal are fixtures. `eras`, `era-workshop`, `departure` and `brineglass-route`
separately exercise native story repairs and combat routes.

`scripts/town-chests-coop-test.mjs` uses muted Chromium and Firefox over real
local Trystero RTC. It checks guest lock explanations, guest-only archive A,
simultaneous claims, duplicate prevention and a remaining guest's save after
the host leaves. Public signaling and connections across different networks
are outside this local check.

`scripts/town-chests-touch-test.mjs` drives actual touch A at 320x568 and
568x320, with normal and large text. It measures bounds and overlapping text
for all locked/opened vaults and keeps native screenshots. All browser output
is muted; these checks do not play or regenerate recordings.

The standalone build and static screenshot review are regenerated together
with source fingerprints and receipt hashes. This is local work; publishing
remains with Trent.

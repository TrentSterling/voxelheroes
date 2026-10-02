# Keeper Mara and Steamwheel

Keeper Mara is now a third travelling companion. Her coast tutorial remains;
she also explains her father's unfinished shore light. Restore the actual beacon
with the Ember Lens, return to Hookshore Landing and choose **Travel with Mara**.
Her recruitment conversation changes after recovering the future keeper memory.
**Keep the shore** returns her to her post; she can rejoin without another reward.

Her quick native voxel poses use a plum coat, pale braid, teal cap, paddle and
small tide lantern. These are placeholders for Trent's later Boxel art pass.
The party has one Mira, one Tern and one Mara. A resident's collider and model
disappear while that person travels. Followers start on free ground and follow
the leader's trail through room edges and era transitions.

With Mira and Mara recruited and nearby, select the **Fire Wand**, hold **Guard**
and tap **Item**. **Steamwheel** costs three personal magic gems, has a six-second
personal recharge, and deals eight fire damage to foes within 3.4 tiles plus
their radius. The normal damage pipeline handles immunities, knockback and
ice-shell openings. Walls block both the companion combination and its damage.
The cast consumes Item; it does not simultaneously shoot a normal bolt.

The combination respects hero action locks, knockback, stalls, paralysis,
carried pottery, active sword attacks, grapple pulls, tool selection, item
locks and partner range. A failed combination leaves ordinary item use available.
It never damages friendly heroes. Mira's charged-spin Clockwork Cross and
Tern's Guard + Sword Bell Shelter remain available with the full party.

Co-op heroes near the leader's companions can cast with their own magic. The
room owner resolves enemy damage, and a separate replicated cue displays the
effect without dealing duplicate damage. Companions remain with their leader
when friends explore independently; departure transfers all three to the
surviving leader. Recruitment persists in saves; temporary effects and recharge
timers reset on load. New games clear every recruitment.

Conversation targeting favors a person directly under the facing direction
over a slightly nearer person at the edge of the interaction cone. In touch
landscape, Steamwheel help and its short cast feedback replace the redundant
Fire Wand prompt; an active Bell Shelter takes priority over Steamwheel help.

Seven new Keeper Mara paragraphs are pre-recorded with Kokoro's `bf_emma` voice.
Only the new lines were generated, using a muted development-only WebGPU worker.
The current bank contains 1,445 compressed Opus recordings, about 20.06 MB.
Older takes remain in local receipts; the shipped bank follows current dialogue.
There is no Kokoro model or inference dependency in the game.

## Verification

`scripts/scenarios/mara.mjs` drives the actual beacon shots, native recruitment,
walking, keyboard combination, fire-shell damage, cost/recharge boundaries,
wall/range and action gates, idle safety, save/load, room edges and dismissal.

`scripts/mara-coop-test.mjs` uses muted Chromium and Firefox over local Trystero
RTC to check guest casting, shared damage and effects, independent eras,
dismissal, reunion, harmless friendly bonks, leader migration and guest saves.

`scripts/mara-layout-test.mjs` pages every authored paragraph with real mouse or
touch, at desktop, 320-pixel portrait and landscape sizes and both text sizes.
It measures text and panel bounds, HUD/touch overlap and technique states;
simultaneous two-finger input casts Steamwheel. All tests force browser output
mute and disable NPC playback. Existing audio is not listened to or decoded again.

The delivery includes a freshly built standalone HTML, source ZIP, twelve-slide
review and hashed receipts. Public signaling across separate networks remains
outside this local test coverage. Tests verify behavior and layout; enjoyment
and perceptual voice quality still require human play. Trent publishes the site.

### October 1 delivery evidence

All final gameplay reports share source SHA-256
`0112e569c232a96f8bb2ed57e3e0ea2db69f65b3ee8e39bb17ff1bfd3a42f327`.

- `mara-regression-release1-20261001`: 35 Chromium scenarios, 2,011 gameplay
  assertions and 381 screenshot receipts; all four dungeon routes and tower pass.
- `mara-firefox-release1-20261001`: 16 scenarios across two seeds, 496 gameplay
  assertions and 150 screenshot receipts.
- `mara-interaction-release2-20261001`: ten cases across both browsers, 128 gameplay
  assertions and 22 screenshot receipts, including NPCs, journals and terrain.
- `mara-coop-release1-20261001`: 22 Mara/Steamwheel local RTC checks.
- `mara-tern-coop-release1-20261001`: 18 existing Bell Shelter local RTC checks.
- `mara-multiplayer-release2-20261001`: 69 existing multiplayer checks, including
  all campaign bosses, friendly sword knockback, shared quests and migration.
- `mara-layout-release2-20261001`: 117 input/layout checks across 126 measured
  captures, with every keeper paragraph and recruitment choice reachable.
- `mara-portable-release1-20261001`: both browsers run the real Steamwheel and
  the prior barrow, hive, watch, beacon, shelter, guidance and reload checks.
- `mara-static-20261001`: all 292 game JavaScript files parse. The asset-only
  voice audit verifies all 1,445 current clips without browser playback or decode.

Game assertion totals exclude launch-policy stages. Earlier failures remain
preserved: incorrect wall/position fixtures, crowded conversation targeting,
compact prompt overlap, and test startup timeouts. The final multiplayer
driver blocks external font requests, matching the gameplay harness. The
second interaction run passes the Firefox NPC startup that previously timed out.

Local review: `playtest-out/mara-review/index.html`. Delivery and source manifest:
`playtest-out/mara-delivery-final-20261001/index.html`. Prior Brineglass packets and
screenshots remain preserved.
